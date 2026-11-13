// workers/api/src/routes/sync.js
// Giao thức đồng bộ Offline-first (PROJECT_ROADMAP.md §5.1).
// - Thao tác xử lý theo thời gian; mỗi thao tác ghi trong MỘT db.batch (giao dịch) cùng dấu vết sync_op → không nửa vời.
// - Trùng op_id (gửi lại sau mất mạng) được coi là đã áp dụng để client xóa khỏi outbox.
// - Từ chối kèm `retry`: false là vĩnh viễn (client bỏ thao tác), true là lỗi tạm (giữ lại gửi sau).
// - Máy chủ tự tính Kusala (@vandao/shared/kusala.js) và tiến ngày (@vandao/shared/schedule.js) theo ngày địa phương
//   của từng thao tác, nên nhiều ngày ngoại tuyến vẫn khóa đúng 1 nấc mỗi ngày.
import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { kusala, validFactor, KUSALA } from '@vandao/shared';
import { computeUnlockedZones, profileView } from './me.js';
import { getLocalDate } from '../utils/time.js';
import { readJson, bad, jsonCapped, dayPillars, stepJourney, isComplete, journeyUpdate, currentJourney, kusalaTotals } from '../lib.js';

const MAX_OPS = 200;
const PAST_MS = 7 * 24 * 60 * 60 * 1000, FUTURE_MS = 2 * 60 * 1000;
const KINDS = ['thien15', 'thien_tu_do', 'nghe_giang', 'kinh_hanh', 'tra_dao', 'thien_duong'];
const str = (v, max) => (v === undefined || v === null ? null : String(v).slice(0, max));

const syncApp = new Hono();

syncApp.post('/', authMiddleware, async (c) => {
  const user = c.get('user'), db = c.env.DB, now = Date.now();
  const body = await readJson(c);
  if (!body || !Array.isArray(body.ops ?? [])) return bad(c, 'invalid_body', 'Payload không hợp lệ');
  const ops = body.ops ?? [];
  if (ops.length > MAX_OPS) return bad(c, 'too_many_ops', `Tối đa ${MAX_OPS} thao tác mỗi lần đồng bộ`, 413);

  const profileRow = await db.prepare(
    'SELECT tinh_danh, tag, look_json, settings_json, island_json, tz, visibility, pref_seat, rev FROM profile WHERE user_id = ?',
  ).bind(user.id).first();
  if (!profileRow) return bad(c, 'profile_not_found', 'Hồ sơ không tồn tại', 404);
  const tz = profileRow.tz || 'Asia/Ho_Chi_Minh';

  let J = await db.prepare(
    'SELECT program, cycle, day, started_on, last_done_on, completed_at, sacca_count, sessions_done, sermons_done, rev FROM journey WHERE user_id = ? AND is_current = 1',
  ).bind(user.id).first();
  if (!J) return bad(c, 'journey_not_found', 'Chưa có hành trình', 404);

  const applied = [], rejected = [];
  const reject = (op, code, retry = false) => rejected.push({ id: op.id, code, retry });
  const sorted = ops.filter((op) => op && typeof op.id === 'string' && op.id.length <= 64 && typeof op.type === 'string')
    .sort((a, b) => (Number(a.at) || 0) - (Number(b.at) || 0));

  for (const op of sorted) {
    if (await db.prepare('SELECT 1 FROM sync_op WHERE user_id = ? AND op_id = ?').bind(user.id, op.id).first()) { applied.push(op.id); continue; }
    const at = Number(op.at);
    if (!Number.isFinite(at) || at < now - PAST_MS || at > now + FUTURE_MS) { reject(op, 'invalid_timestamp'); continue; }
    const date = getLocalDate(at, tz), p = op.payload && typeof op.payload === 'object' ? op.payload : {};
    const done = db.prepare('INSERT INTO sync_op (user_id, op_id, applied_at) VALUES (?, ?, ?)').bind(user.id, op.id, now);
    const snapshot = { ...J };
    try {
      if (op.type === 'kusala.confirm') {
        if (date < J.started_on) { reject(op, 'before_start'); continue; }
        if (J.completed_at) { reject(op, 'completed'); continue; }
        let pillars = await dayPillars(db, user.id, J);
        if (stepJourney(J, pillars, date)) pillars = {};
        if (Number(p.day) !== J.day) { reject(op, Number(p.day) > J.day ? 'day_locked' : 'day_closed'); J = snapshot; continue; }
        if (!KUSALA.PILLARS.includes(p.pillar)) { reject(op, 'invalid_pillar'); J = snapshot; continue; }
        const f = { pre: Number(p.pre ?? 1), during: Number(p.during ?? 1), post: Number(p.post ?? 1) };
        if (![f.pre, f.during, f.post].every(validFactor)) { reject(op, 'invalid_factor'); J = snapshot; continue; }
        if (pillars[p.pillar]) { reject(op, 'exists'); J = snapshot; continue; }
        const note = p.note === undefined || p.note === null ? null : String(p.note);
        if (note && note.length > 1000) { reject(op, 'note_too_long'); J = snapshot; continue; }
        const wise = Boolean(p.wise), self = Boolean(p.self), E = kusala({ ...f, wise, self });
        pillars[p.pillar] = true;
        J.last_done_on = !J.last_done_on || J.last_done_on < date ? date : J.last_done_on;
        if (isComplete(J, pillars)) J.completed_at = now;
        await db.batch([
          db.prepare(`INSERT INTO kusala_entry (id, user_id, program, cycle, day, pillar, local_date, base, pre, during, post, wise, self, e_score, note, at, server_at)
                      VALUES (?, ?, ?, ?, ?, ?, ?, 10, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(op.id, user.id, J.program, J.cycle, J.day, p.pillar, date, f.pre, f.during, f.post, wise ? 1 : 0, self ? 1 : 0, E, note, at, now),
          journeyUpdate(db, user.id, J, now), done,
        ]);
      } else if (op.type === 'session.done') {
        if (!KINDS.includes(p.kind ?? 'thien15')) { reject(op, 'invalid_kind'); continue; }
        J.sessions_done = (J.sessions_done || 0) + 1;
        await db.batch([
          db.prepare('INSERT INTO practice_session (id, user_id, kind, ref, place, started_at, duration_s, completed, server_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .bind(op.id, user.id, p.kind ?? 'thien15', str(p.ref, 64), str(p.place ?? 'pad', 32), at, Math.min(Math.max(Math.round(Number(p.duration_s) || 0), 0), 14400), p.completed === false ? 0 : 1, now),
          journeyUpdate(db, user.id, J, now), done,
        ]);
      } else if (op.type === 'profile.patch') {
        const settings = p.settings === undefined ? profileRow.settings_json : jsonCapped({ ...JSON.parse(profileRow.settings_json || '{}'), ...p.settings });
        const island = p.island === undefined ? profileRow.island_json : jsonCapped(p.island);
        if (settings === null || island === null) { reject(op, 'invalid_profile'); continue; }
        await db.batch([db.prepare('UPDATE profile SET settings_json = ?, island_json = ?, rev = rev + 1, updated_at = ? WHERE user_id = ?').bind(settings, island, now, user.id), done]);
        profileRow.settings_json = settings; profileRow.island_json = island; profileRow.rev += 1;
      } else if (op.type === 'journey.reset_cycle') {
        // "Trở về ngày 1" = chu kỳ mới (PROJECT_ROADMAP.md §4.3); Tịnh danh và diện mạo giữ nguyên
        const next = { program: J.program, cycle: (J.cycle || 1) + 1, day: 1, started_on: date, last_done_on: null, completed_at: null, sacca_count: 0, sessions_done: 0, sermons_done: 0, rev: 1 };
        await db.batch([
          db.prepare('UPDATE journey SET is_current = 0, updated_at = ? WHERE user_id = ? AND is_current = 1').bind(now, user.id),
          db.prepare('INSERT INTO journey (user_id, program, cycle, day, started_on, is_current, rev, updated_at) VALUES (?, ?, ?, 1, ?, 1, 1, ?)').bind(user.id, next.program, next.cycle, date, now),
          done,
        ]);
        J = next;
      } else { reject(op, 'unknown_op'); continue; }
      applied.push(op.id);
    } catch (err) {
      J = snapshot;
      console.error('[sync]', op.type, err && err.message);
      reject(op, 'db_error', true);
    }
  }

  if (typeof body.device_id === 'string' && body.device_id.length <= 64) {
    await db.prepare('INSERT INTO device (id, user_id, platform, last_sync_at, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_sync_at = excluded.last_sync_at WHERE device.user_id = excluded.user_id')
      .bind(body.device_id, user.id, ['web', 'pwa', 'android'].includes(body.platform) ? body.platform : 'web', now, now).run().catch(() => {});
  }

  // Trạng thái sau đồng bộ: tiến ngày tới hôm nay (ngày địa phương) rồi trả đủ hồ sơ, hành trình, tổng Kusala
  J = (await currentJourney(db, user.id, getLocalDate(now, tz), now)) || J;
  return c.json({
    applied, rejected,
    state: { profile: profileView(profileRow), journey: J, totals: await kusalaTotals(db, user.id, J), unlocked_zones: computeUnlockedZones(J.day), server_now: now },
  });
});

export default syncApp;

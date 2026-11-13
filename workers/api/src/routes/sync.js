// workers/api/src/routes/sync.js
// Giao thức đồng bộ hai chiều Offline-first (PROJECT_ROADMAP.md §5.1)
import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { kusala, getUnlockedZones } from '@vandao/shared';
import { getLocalDate, daysBetween } from '../utils/time.js';

const syncApp = new Hono();

syncApp.post('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const now = Date.now();

  const body = await c.req.json();
  if (!body || typeof body !== 'object') {
    return c.json({ error: { code: 'invalid_body', message: 'Payload không hợp lệ' } }, 400);
  }

  const { device_id, tz, ops = [] } = body;

  // Lấy hồ sơ và hành trình hiện tại
  const profileRow = await db.prepare(
    `SELECT tinh_danh, tag, look_json, settings_json, island_json, tz, visibility, pref_seat, rev
     FROM profile
     WHERE user_id = ?`
  ).bind(user.id).first();

  if (!profileRow) {
    return c.json({ error: { code: 'profile_not_found', message: 'Hồ sơ không tồn tại' } }, 404);
  }

  let journeyRow = await db.prepare(
    `SELECT program, cycle, day, started_on, last_done_on, completed_at, sacca_count, sessions_done, sermons_done, rev
     FROM journey
     WHERE user_id = ? AND is_current = 1`
  ).bind(user.id).first();

  const userTz = profileRow.tz || tz || 'Asia/Ho_Chi_Minh';
  const localToday = getLocalDate(now, userTz);

  const applied = [];
  const rejected = [];

  // Giới hạn kẹp thời gian: 7 ngày trước đến 2 phút sau
  const minTime = now - 7 * 24 * 60 * 60 * 1000;
  const maxTime = now + 2 * 60 * 1000;

  // Sắp xếp các thao tác theo thứ tự thời gian tăng dần
  const sortedOps = [...ops].sort((a, b) => (a.at || 0) - (b.at || 0));

  for (const op of sortedOps) {
    if (!op || !op.id || !op.type) {
      continue;
    }

    // 1. Kiểm tra chống trùng thao tác (idempotency)
    const existingOp = await db.prepare(
      `SELECT op_id FROM sync_op WHERE user_id = ? AND op_id = ?`
    ).bind(user.id, op.id).first();

    if (existingOp) {
      rejected.push({ id: op.id, code: 'exists' });
      continue;
    }

    // 2. Kẹp thời gian hợp lệ
    const opAt = Number(op.at);
    if (!opAt || opAt < minTime || opAt > maxTime) {
      rejected.push({ id: op.id, code: 'invalid_timestamp' });
      continue;
    }

    const opLocalDate = getLocalDate(opAt, userTz);

    try {
      // 3. Xử lý theo loại thao tác
      if (op.type === 'kusala.confirm') {
        const payload = op.payload || {};
        const { program = 'so-nhap-49', cycle = 1, day = 1, pillar, pre = 1, during = 1, post = 1, wise = 0, self = 0, note = null } = payload;

        if (!['duc', 'thien', 'tue'].includes(pillar)) {
          rejected.push({ id: op.id, code: 'invalid_pillar' });
          continue;
        }

        // Bất biến cứng: day không thể vượt quá số ngày lịch đã trôi qua kể từ started_on
        const daysElapsed = daysBetween(journeyRow.started_on, opLocalDate);
        if (day > daysElapsed + 1) {
          rejected.push({ id: op.id, code: 'day_locked' });
          continue;
        }

        // Kiểm tra xem đã có bản ghi cho (user, program, cycle, day, pillar) chưa
        const existingEntry = await db.prepare(
          `SELECT id FROM kusala_entry
           WHERE user_id = ? AND program = ? AND cycle = ? AND day = ? AND pillar = ?`
        ).bind(user.id, program, cycle, day, pillar).first();

        if (existingEntry) {
          rejected.push({ id: op.id, code: 'exists' });
          continue;
        }

        // MÁY CHỦ TÍNH LẠI KUSALA ĐỘC LẬP
        const calculatedScore = kusala({
          pre: Number(pre),
          during: Number(during),
          post: Number(post),
          wise: Boolean(wise),
          self: Boolean(self)
        });

        await db.prepare(
          `INSERT INTO kusala_entry
           (id, user_id, program, cycle, day, pillar, local_date, base, pre, during, post, wise, self, e_score, note, at, server_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 10, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          op.id, user.id, program, cycle, day, pillar, opLocalDate,
          pre, during, post, wise ? 1 : 0, self ? 1 : 0,
          calculatedScore, note, opAt, now
        ).run();

        // Kiểm tra điều kiện tiến ngày:
        // Đã hoàn thành cả 3 trục (duc, thien, tue) cho day hiện tại và ngày gần nhất < ngày địa phương
        const completedPillars = await db.prepare(
          `SELECT COUNT(DISTINCT pillar) as cnt
           FROM kusala_entry
           WHERE user_id = ? AND program = ? AND cycle = ? AND day = ?`
        ).bind(user.id, journeyRow.program, journeyRow.cycle, journeyRow.day).first();

        const allPillarsDone = (completedPillars?.cnt || 0) === 3;
        const canAdvanceDay = allPillarsDone &&
          (!journeyRow.last_done_on || journeyRow.last_done_on < opLocalDate) &&
          (journeyRow.day + 1 <= daysBetween(journeyRow.started_on, localToday) + 1);

        if (canAdvanceDay) {
          const nextDay = journeyRow.day + 1;
          const completedAt = nextDay > 49 ? now : null;

          await db.prepare(
            `UPDATE journey
             SET day = ?, last_done_on = ?, completed_at = ?, rev = rev + 1, updated_at = ?
             WHERE user_id = ? AND program = ? AND cycle = ?`
          ).bind(nextDay, opLocalDate, completedAt, now, user.id, journeyRow.program, journeyRow.cycle).run();

          journeyRow.day = nextDay;
          journeyRow.last_done_on = opLocalDate;
          journeyRow.completed_at = completedAt;
        } else if (allPillarsDone && (!journeyRow.last_done_on || journeyRow.last_done_on < opLocalDate)) {
          await db.prepare(
            `UPDATE journey
             SET last_done_on = ?, updated_at = ?
             WHERE user_id = ? AND program = ? AND cycle = ?`
          ).bind(opLocalDate, now, user.id, journeyRow.program, journeyRow.cycle).run();

          journeyRow.last_done_on = opLocalDate;
        }

        applied.push(op.id);
      } else if (op.type === 'session.done') {
        const payload = op.payload || {};
        const { kind = 'thien15', ref = null, place = 'pad', duration_s = 900, completed = 1 } = payload;

        await db.prepare(
          `INSERT INTO practice_session
           (id, user_id, kind, ref, place, started_at, duration_s, completed, server_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          op.id, user.id, kind, ref, place, opAt,
          Math.min(Math.max(Number(duration_s) || 0, 0), 14400),
          completed ? 1 : 0, now
        ).run();

        await db.prepare(
          `UPDATE journey
           SET sessions_done = sessions_done + 1, updated_at = ?
           WHERE user_id = ? AND program = ? AND cycle = ?`
        ).bind(now, user.id, journeyRow.program, journeyRow.cycle).run();

        journeyRow.sessions_done += 1;
        applied.push(op.id);
      } else if (op.type === 'profile.patch') {
        const payload = op.payload || {};
        let updatedSettings = profileRow.settings_json;
        if (payload.settings) {
          const merged = { ...JSON.parse(profileRow.settings_json || '{}'), ...payload.settings };
          updatedSettings = JSON.stringify(merged);
        }

        let updatedIsland = profileRow.island_json;
        if (payload.island) {
          updatedIsland = JSON.stringify(payload.island);
        }

        await db.prepare(
          `UPDATE profile
           SET settings_json = ?, island_json = ?, rev = rev + 1, updated_at = ?
           WHERE user_id = ?`
        ).bind(updatedSettings, updatedIsland, now, user.id).run();

        profileRow.settings_json = updatedSettings;
        profileRow.island_json = updatedIsland;
        applied.push(op.id);
      } else if (op.type === 'journey.reset_cycle') {
        // "Trở về ngày 1" = chu kỳ mới (PROJECT_ROADMAP.md §4.3)
        const newCycle = (journeyRow.cycle || 1) + 1;

        await db.prepare(
          `UPDATE journey SET is_current = 0, updated_at = ? WHERE user_id = ? AND is_current = 1`
        ).bind(now, user.id).run();

        await db.prepare(
          `INSERT INTO journey (user_id, program, cycle, day, started_on, is_current, rev, updated_at)
           VALUES (?, 'so-nhap-49', ?, 1, ?, 1, 1, ?)`
        ).bind(user.id, newCycle, localToday, now).run();

        journeyRow = {
          program: 'so-nhap-49',
          cycle: newCycle,
          day: 1,
          started_on: localToday,
          last_done_on: null,
          completed_at: null,
          sacca_count: 0,
          sessions_done: 0,
          sermons_done: 0,
          rev: 1
        };

        applied.push(op.id);
      } else {
        rejected.push({ id: op.id, code: 'unknown_op_type' });
        continue;
      }

      // 4. Lưu vết thao tác đã xử lý
      await db.prepare(
        `INSERT INTO sync_op (user_id, op_id, applied_at) VALUES (?, ?, ?)`
      ).bind(user.id, op.id, now).run();

    } catch (err) {
      rejected.push({ id: op.id, code: 'db_error', message: err.message });
    }
  }

  // Cập nhật thông tin thiết bị nếu có device_id
  if (device_id) {
    const platform = body.platform || 'web';
    await db.prepare(
      `INSERT INTO device (id, user_id, platform, last_sync_at, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET last_sync_at = ?`
    ).bind(device_id, user.id, platform, now, now, now).run().catch(() => {});
  }

  // Tính lại tổng Kusala và các phân khu đã mở
  const totalsRow = await db.prepare(
    `SELECT
       SUM(CASE WHEN pillar = 'duc' THEN e_score ELSE 0 END) as duc,
       SUM(CASE WHEN pillar = 'thien' THEN e_score ELSE 0 END) as thien,
       SUM(CASE WHEN pillar = 'tue' THEN e_score ELSE 0 END) as tue,
       SUM(e_score) as all_score
     FROM kusala_entry
     WHERE user_id = ? AND program = ? AND cycle = ?`
  ).bind(user.id, journeyRow.program, journeyRow.cycle).first();

  const totals = {
    duc: Number((totalsRow?.duc || 0).toFixed(1)),
    thien: Number((totalsRow?.thien || 0).toFixed(1)),
    tue: Number((totalsRow?.tue || 0).toFixed(1)),
    all: Number((totalsRow?.all_score || 0).toFixed(1))
  };

  const unlockedZones = getUnlockedZones ? getUnlockedZones(journeyRow.day) : {
    tra_dao: journeyRow.day >= 15,
    cong_van_mon: journeyRow.day >= 43,
    cong_van_mon_half: journeyRow.day >= 29
  };

  return c.json({
    applied,
    rejected,
    state: {
      profile: {
        tinh_danh: profileRow.tinh_danh,
        tag: profileRow.tag,
        look: JSON.parse(profileRow.look_json || '{}'),
        settings: JSON.parse(profileRow.settings_json || '{}'),
        island: JSON.parse(profileRow.island_json || '{}'),
        tz: profileRow.tz,
        visibility: profileRow.visibility,
        pref_seat: profileRow.pref_seat,
        rev: profileRow.rev
      },
      journey: journeyRow,
      totals,
      unlocked_zones: unlockedZones,
      server_now: now
    }
  });
});

export default syncApp;

// workers/api/src/lib.js
// Tiện ích dùng chung cho các route: đọc JSON an toàn, lỗi Tịnh danh, giới hạn kích thước JSON, tiến ngày hành trình.
import { advance, allDone, DAYS } from '@vandao/shared';

/** Đọc body JSON; body rỗng hoặc sai cú pháp trả `null` thay vì ném lỗi 500 */
export async function readJson(c) {
  try {
    const body = await c.req.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

export const bad = (c, code, message, status = 400) => c.json({ error: { code, message } }, status);

/** Thông báo các quy tắc Tịnh danh chưa đạt (checkName trả `rules`, không có `reason`) */
export const nameError = (check) => check.rules.filter((r) => !r.ok).map((r) => r.text).join('; ');

/** Đối tượng JSON thuần, chuỗi hóa không quá `max` byte; trả chuỗi JSON hoặc null nếu không hợp lệ */
export function jsonCapped(v, max = 8192) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const s = JSON.stringify(v);
  return new TextEncoder().encode(s).length <= max ? s : null;
}

const JOURNEY_COLS = 'program, cycle, day, started_on, last_done_on, completed_at, sacca_count, sessions_done, sermons_done, rev';

/** Các trục đã xác nhận của một ngày trong hành trình hiện tại: { duc: true, ... } */
export async function dayPillars(db, uid, J, day = J.day) {
  const rows = await db.prepare('SELECT pillar FROM kusala_entry WHERE user_id = ? AND program = ? AND cycle = ? AND day = ?')
    .bind(uid, J.program, J.cycle, day).all();
  const out = {};
  for (const r of rows?.results || []) out[r.pillar] = true;
  return out;
}

/**
 * Tiến ngày theo luật chung @vandao/shared (khóa 1 nấc mỗi ngày): chỉ tiến khi ngày xác nhận gần nhất < `date`
 * và đủ ba trục của ngày hiện tại. Sửa `J` tại chỗ, trả `true` nếu ngày đổi.
 */
export function stepJourney(J, pillars, date) {
  const next = advance({ day: J.day, lastDate: J.last_done_on, done: { [J.day]: pillars }, completed: Boolean(J.completed_at) }, date);
  if (next.day === J.day) return false;
  J.day = next.day;
  return true;
}

/** Hoàn thành chương trình khi ngày cuối đủ ba trục (chỉ nói "đã hoàn thành chương trình", AGENTS.md §1.6) */
export const isComplete = (J, pillars) => J.day === DAYS && allDone({ [J.day]: pillars }, J.day);

export const journeyUpdate = (db, uid, J, now) => db.prepare(
  'UPDATE journey SET day = ?, last_done_on = ?, completed_at = ?, sessions_done = ?, rev = rev + 1, updated_at = ? WHERE user_id = ? AND program = ? AND cycle = ?',
).bind(J.day, J.last_done_on, J.completed_at, J.sessions_done, now, uid, J.program, J.cycle);

/** Hành trình hiện tại, đã tiến ngày tới `date` (ngày địa phương của người dùng) và lưu lại nếu đổi */
export async function currentJourney(db, uid, date, now = Date.now()) {
  const J = await db.prepare(`SELECT ${JOURNEY_COLS} FROM journey WHERE user_id = ? AND is_current = 1`).bind(uid).first();
  if (!J) return null;
  if (!J.completed_at && stepJourney(J, await dayPillars(db, uid, J), date)) { await journeyUpdate(db, uid, J, now).run(); J.rev += 1; }
  return J;
}

export async function kusalaTotals(db, uid, J) {
  const t = await db.prepare(
    `SELECT SUM(CASE WHEN pillar = 'duc' THEN e_score ELSE 0 END) AS duc, SUM(CASE WHEN pillar = 'thien' THEN e_score ELSE 0 END) AS thien,
            SUM(CASE WHEN pillar = 'tue' THEN e_score ELSE 0 END) AS tue, SUM(e_score) AS all_score
     FROM kusala_entry WHERE user_id = ? AND program = ? AND cycle = ?`,
  ).bind(uid, J.program, J.cycle).first();
  const r = (x) => Math.round((x || 0) * 100) / 100;
  return { duc: r(t?.duc), thien: r(t?.thien), tue: r(t?.tue), all: r(t?.all_score) };
}

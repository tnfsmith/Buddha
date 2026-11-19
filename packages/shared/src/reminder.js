// Nhắc nhở (#106, roadmap §9.2): luật thuần dùng chung API (PUT /reminders, #105) và Durable Object ReminderClock.
// Hợp đồng: docs/contracts/reminder-clock.md. Không đọc giờ, mạng hay bộ nhớ; `now` luôn truyền vào.
// Mặc định tắt; tối đa 2 nhắc đang bật mỗi người (nên ≤ 2 nhắc/ngày); giờ yên lặng 21:30–05:00; Tịnh khẩu 1–30 ngày.
import { hash32, isTraiDay } from './missions.js';
import { solarToLunar } from './amlich.js';

export const REMINDER_V = 1;
/** Loại nhắc mở ở GĐ3. `nhom` (lời mời nhóm, GĐ5) có trong schema nhưng chưa nhận. */
export const REMINDER_KINDS = Object.freeze(['thien', 'nhiem_vu', 'ghi_nhan', 'uposatha', 'tong_ket_tuan']);
/** Kênh do ReminderClock gửi. `local` (Android) do máy tự đặt; `email` chờ hạ tầng (§9.2). */
export const PUSH_CHANNEL = 'push';
export const SHARDS = 16;
export const MAX_ACTIVE = 2;
export const QUIET_FROM = '21:30';
export const QUIET_TO = '05:00';
export const PAUSE_MAX_DAYS = 30;
/** Quá hạn hơn chừng này (sự cố, alarm trễ) thì bỏ lượt, không gửi nhắc muộn */
export const LATE_MS = 30 * 60000;
const DAY = 86400000;
const UPOSATHA = Object.freeze(['vn_2', 'vn_4', 'vn_6', 'vn_10', 'khong']);

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isKind = (k) => typeof k === 'string' && REMINDER_KINDS.includes(k);
/** Giờ địa phương HH:MM có rơi vào giờ yên lặng 21:30–05:00 không */
export const inQuiet = (hm) => hm >= QUIET_FROM || hm < QUIET_TO;
/** Shard 0–15 theo user_id; tên DO: `rc-${shardOf(uid)}` */
export const shardOf = (userId) => hash32('rc:' + String(userId)) % SHARDS;
/** Khóa chống gửi trùng của một lần nhắc cho một đăng ký push */
export const sendKey = (reminderId, localDate, subId) => `${reminderId}:${localDate}:${subId}`;

/**
 * Kiểm một nhắc trong thân `PUT /api/v1/reminders`: { kind, local_hm, days_mask?, active? }.
 * → { ok: true, v } (v chuẩn hóa) | { ok: false, code }.
 * `days_mask`: bit d = Chủ nhật (0) … Thứ bảy (6), như Date#getDay. `uposatha` luôn 127 (ngày theo âm lịch);
 * `tong_ket_tuan` đúng một ngày trong tuần (mặc định Chủ nhật).
 */
export function checkReminder(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return { ok: false, code: 'invalid_reminder' };
  for (const k of Object.keys(p)) if (!['kind', 'local_hm', 'days_mask', 'active'].includes(k)) return { ok: false, code: 'invalid_reminder' };
  if (!isKind(p.kind)) return { ok: false, code: 'invalid_reminder' };
  if (typeof p.local_hm !== 'string' || !HM.test(p.local_hm)) return { ok: false, code: 'invalid_reminder' };
  if (inQuiet(p.local_hm)) return { ok: false, code: 'reminder_quiet_hours' };
  let mask = p.days_mask === undefined ? (p.kind === 'tong_ket_tuan' ? 1 : 127) : p.days_mask;
  if (!Number.isInteger(mask) || mask < 1 || mask > 127) return { ok: false, code: 'invalid_reminder' };
  if (p.kind === 'uposatha') mask = 127;
  if (p.kind === 'tong_ket_tuan' && (mask & (mask - 1)) !== 0) return { ok: false, code: 'invalid_reminder' };
  if (p.active !== undefined && typeof p.active !== 'boolean') return { ok: false, code: 'invalid_reminder' };
  return { ok: true, v: { kind: p.kind, local_hm: p.local_hm, days_mask: mask, active: p.active === true } };
}

/** Cả danh sách: tối đa một nhắc mỗi loại, tối đa MAX_ACTIVE nhắc đang bật. */
export function checkReminders(list) {
  if (!Array.isArray(list) || list.length > REMINDER_KINDS.length) return { ok: false, code: 'invalid_reminder' };
  const out = [], seen = new Set();
  for (const p of list) {
    const c = checkReminder(p); if (!c.ok) return c;
    if (seen.has(c.v.kind)) return { ok: false, code: 'invalid_reminder' };
    seen.add(c.v.kind); out.push(c.v);
  }
  if (out.filter((r) => r.active).length > MAX_ACTIVE) return { ok: false, code: 'reminder_limit' };
  return { ok: true, v: out };
}

/** Tịnh khẩu: tạm dừng 1–30 ngày tính từ now → paused_until (UTC ms); 0 → bỏ tạm dừng (null) */
export function pauseUntil(days, now) {
  if (days === 0) return { ok: true, v: null };
  if (!Number.isInteger(days) || days < 1 || days > PAUSE_MAX_DAYS || !Number.isFinite(now)) return { ok: false, code: 'invalid_pause' };
  return { ok: true, v: now + days * DAY };
}

const fmts = new Map();
function fmt(tz) {
  if (!fmts.has(tz)) fmts.set(tz, new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' }));
  return fmts.get(tz);
}
export function isTz(tz) { try { fmt(tz); return typeof tz === 'string' && tz.length > 0; } catch { return false; } }
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
/** UTC ms → { date: 'YYYY-MM-DD', hm: 'HH:MM', dow: 0–6 } theo múi giờ IANA */
export function localParts(ms, tz) {
  const o = {}; for (const x of fmt(tz).formatToParts(new Date(ms))) o[x.type] = x.value;
  return { date: `${o.year}-${o.month}-${o.day}`, hm: `${o.hour}:${o.minute}`, dow: WD[o.weekday] };
}
const offsetAt = (ms, tz) => { const p = localParts(ms, tz), [y, m, d] = p.date.split('-').map(Number), [h, mi] = p.hm.split(':').map(Number);
  return Date.UTC(y, m - 1, d, h, mi) - Math.floor(ms / 60000) * 60000; };
/** Giờ đồng hồ địa phương → UTC ms. Giờ lặp (lùi giờ) lấy lần đầu; giờ không tồn tại (nhảy giờ) lấy thời điểm ngay sau khoảng nhảy. */
export function zonedToUtc(date, hm, tz) {
  const [y, m, d] = date.split('-').map(Number), [h, mi] = hm.split(':').map(Number), wall = Date.UTC(y, m - 1, d, h, mi);
  const cands = [...new Set([-12, 0, 12].map((k) => wall - offsetAt(wall + k * 3600000, tz)))];
  const ok = cands.filter((t) => { const p = localParts(t, tz); return p.date === date && p.hm === hm; });
  return ok.length ? Math.min(...ok) : Math.max(...cands);
}
const addDays = (date, n) => { const [y, m, d] = date.split('-').map(Number), x = new Date(Date.UTC(y, m - 1, d + n)); return x.toISOString().slice(0, 10); };

/** Ngày dương lịch YYYY-MM-DD có phải ngày trai theo lựa chọn hồ sơ không (âm lịch Việt Nam, UTC+7) */
export function isTraiDate(date, mode) {
  if (!UPOSATHA.includes(mode) || mode === 'khong') return false;
  const [y, m, d] = date.split('-').map(Number);
  return isTraiDay(solarToLunar(y, m, d, 7), mode);
}

/**
 * Lần nhắc kế tiếp (UTC ms) sau `now`, hoặc null khi không có (tắt, ngày trai 'khong', giờ yên lặng, sai dữ liệu).
 * rem: { kind, local_hm, days_mask, active, paused_until }; ctx: { tz (profile.tz), now, uposatha (practice_profile, mặc định vn_4) }.
 * Tìm trong 62 ngày tới; thời điểm phải > now và ≥ paused_until.
 */
export function nextReminderAt(rem, { tz, now, uposatha = 'vn_4' } = {}) {
  if (!rem || rem.active !== true && rem.active !== 1) return null;
  if (!isKind(rem.kind) || typeof rem.local_hm !== 'string' || !HM.test(rem.local_hm) || inQuiet(rem.local_hm)) return null;
  if (!Number.isFinite(now) || !isTz(tz)) return null;
  const mask = Number(rem.days_mask), from = Math.max(now, Number(rem.paused_until) || 0);
  if (rem.kind !== 'uposatha' && !(Number.isInteger(mask) && mask >= 1 && mask <= 127)) return null;
  const start = localParts(from, tz).date;
  for (let i = 0; i <= 62; i++) {
    const date = addDays(start, i), t = zonedToUtc(date, rem.local_hm, tz);
    if (t <= now || t < from) continue;
    if (rem.kind === 'uposatha' ? !isTraiDate(date, uposatha) : !(mask & (1 << localParts(t, tz).dow))) continue;
    return t;
  }
  return null;
}

/** Dữ liệu push (không chứa chữ riêng tư; service worker hiện câu đã biên tập theo `kind`). */
export const pushPayload = (kind, at) => JSON.stringify({ v: REMINDER_V, kind, at });

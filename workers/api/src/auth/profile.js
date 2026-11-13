// workers/api/src/auth/profile.js
// Hồ sơ và hành trình ban đầu của mỗi người dùng mới (khách ẩn danh, Google, passkey…), tạo ngay sau khi Better Auth
// ghi bảng user. Tịnh danh để trống: người dùng tự chọn (AGENTS.md §1.4), máy chủ không đặt thay.
import { getLocalDate } from '../utils/time.js';

export const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
export const DEFAULT_LOOK = JSON.stringify({ v: 1, robe: 0, hair: 0, tone: 0 });
export const DEFAULT_SETTINGS = JSON.stringify({ birds: { n: 4, freq: 1, vol: 0.5 }, music: { mode: 'ambient', vol: 0.6 }, tts: { enabled: true, rate: 1.0 }, radar: { enabled: true } });

/** Khóa so trùng Tịnh danh: chữ thường tiếng Việt, NFC (đi cùng `tag` 4 số thành định danh hiển thị duy nhất) */
export const nameKey = (name) => name.normalize('NFC').toLocaleLowerCase('vi');
export const randomTag = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); return String(1000 + (b[0] % 9000)); };

/** Tạo profile + journey chu kỳ 1 nếu chưa có (gọi lại nhiều lần vẫn an toàn) */
export async function ensureProfile(db, userId, tz = DEFAULT_TZ, now = Date.now()) {
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO profile (user_id, tinh_danh, tinh_danh_key, tag, look_json, settings_json, tz, created_at, updated_at)
                VALUES (?, NULL, NULL, ?, ?, ?, ?, ?, ?)`).bind(userId, randomTag(), DEFAULT_LOOK, DEFAULT_SETTINGS, tz, now, now),
    db.prepare(`INSERT INTO journey (user_id, program, cycle, day, started_on, is_current, updated_at)
                SELECT ?, 'so-nhap-49', 1, 1, ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM journey WHERE user_id = ?)`).bind(userId, getLocalDate(now, tz), now, userId),
  ]);
}

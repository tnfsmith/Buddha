// workers/api/src/auth/session.js
// Quản lý phiên đăng nhập và tạo khách ẩn danh
import { generateId, generateToken } from '../utils/crypto.js';
import { getLocalDate } from '../utils/time.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

/** Khóa so trùng Tịnh danh: chữ thường tiếng Việt, NFC (đi cùng `tag` 4 số thành định danh hiển thị duy nhất) */
export const nameKey = (name) => name.normalize('NFC').toLocaleLowerCase('vi');
export const randomTag = () => { const b = new Uint32Array(1); crypto.getRandomValues(b); return String(1000 + (b[0] % 9000)); };

/**
 * Trích xuất token từ header Authorization (Bearer) hoặc cookie vd_session
 */
export function extractToken(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const match = /(?:^|;\s*)vd_session=([^;]+)/.exec(cookieHeader);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

/**
 * Middleware xác thực người dùng
 */
export async function authMiddleware(c, next) {
  const token = extractToken(c.req.raw);
  if (!token) {
    return c.json({ error: { code: 'unauthorized', message: 'Yêu cầu đăng nhập hoặc phiên khách' } }, 401);
  }

  const db = c.env.DB;
  const now = Date.now();

  const sessionRow = await db.prepare(
    `SELECT s.id as session_id, s.token, s.expiresAt, u.id as user_id, u.isAnonymous, u.email
     FROM session s
     JOIN user u ON s.userId = u.id
     WHERE s.token = ? AND s.expiresAt > ?`
  ).bind(token, now).first();

  if (!sessionRow) {
    return c.json({ error: { code: 'session_expired', message: 'Phiên đã hết hạn hoặc không tồn tại' } }, 401);
  }

  c.set('user', {
    id: sessionRow.user_id,
    isAnonymous: Boolean(sessionRow.isAnonymous),
    email: sessionRow.email
  });
  c.set('session', {
    id: sessionRow.session_id,
    token: sessionRow.token,
    expiresAt: sessionRow.expiresAt
  });

  await next();
}

/**
 * Tạo tài khoản khách ẩn danh mới kèm hồ sơ và hành trình ban đầu.
 * `name` là Tịnh danh đã qua checkName (đã chuẩn hóa) hoặc null: máy chủ không tự đặt Tịnh danh thay người dùng.
 */
export async function createAnonymousUser(db, ip = null, userAgent = null, name = null, tz = 'Asia/Ho_Chi_Minh') {
  const now = Date.now();
  const userId = generateId();
  const sessionId = generateId();
  const token = generateToken();
  const expiresAt = now + SESSION_TTL_MS;

  // Thẻ 4 chữ số đi kèm Tịnh danh; trùng (tinh_danh_key, tag) thì bốc thẻ khác (tối đa 5 lần)
  let tag = randomTag();
  const tinhDanhKey = name ? nameKey(name) : null;
  const startedOn = getLocalDate(now, tz);

  const defaultLook = JSON.stringify({ v: 1, robe: 0, hair: 0, tone: 0 });
  const defaultSettings = JSON.stringify({
    birds: { n: 4, freq: 1, vol: 0.5 },
    music: { mode: 'ambient', vol: 0.6 },
    tts: { enabled: true, rate: 1.0 },
    radar: { enabled: true }
  });

  // Ghi đồng thời vào user, session, profile, journey
  const stmts = [
    db.prepare(
      `INSERT INTO user (id, name, createdAt, updatedAt, isAnonymous)
       VALUES (?, ?, ?, ?, 1)`
    ).bind(userId, name, now, now),

    db.prepare(
      `INSERT INTO session (id, userId, token, expiresAt, ipAddress, userAgent, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(sessionId, userId, token, expiresAt, ip, userAgent, now, now),

    db.prepare(
      `INSERT INTO profile (user_id, tinh_danh, tinh_danh_key, tag, look_json, settings_json, tz, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(userId, name, tinhDanhKey, tag, defaultLook, defaultSettings, tz, now, now),

    db.prepare(
      `INSERT INTO journey (user_id, program, cycle, day, started_on, is_current, updated_at)
       VALUES (?, 'so-nhap-49', 1, 1, ?, 1, ?)`
    ).bind(userId, startedOn, now)
  ];

  for (let attempt = 0; ; attempt++) {
    try { await db.batch(stmts); break; } catch (e) {
      if (!name || attempt >= 4 || !/UNIQUE/i.test(String(e && e.message))) throw e;
      tag = randomTag();
      stmts[2] = db.prepare(
        `INSERT INTO profile (user_id, tinh_danh, tinh_danh_key, tag, look_json, settings_json, tz, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(userId, name, tinhDanhKey, tag, defaultLook, defaultSettings, tz, now, now);
    }
  }

  return {
    user: { id: userId, isAnonymous: true },
    session: { id: sessionId, token, expiresAt },
    profile: {
      tinh_danh: name,
      tag,
      look: JSON.parse(defaultLook),
      settings: JSON.parse(defaultSettings),
      tz
    },
    journey: {
      program: 'so-nhap-49',
      cycle: 1,
      day: 1,
      started_on: startedOn
    }
  };
}

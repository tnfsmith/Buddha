// workers/api/src/routes/auth.js
// Phiên đăng nhập GĐ2 bước 1: khách ẩn danh + bearer/cookie. Lược đồ bảng tương thích Better Auth để chuyển sang
// thư viện khi thêm passkey/Google ở T2.2 (#11) — xem docs/adr/0002-api-worker-va-dang-nhap.md.
import { Hono } from 'hono';
import { createAnonymousUser, authMiddleware, extractToken } from '../auth/session.js';
import { checkName } from '@vandao/shared';
import { isValidTimeZone } from '../utils/time.js';
import { readJson, bad, nameError } from '../lib.js';

const authApp = new Hono();
const COOKIE = (v, age) => `vd_session=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;

/** Tạo khách ẩn danh. Tịnh danh tùy chọn: có thì phải qua 4 quy tắc, không có thì để trống (người dùng tự chọn sau). */
authApp.post('/sign-in/anonymous', async (c) => {
  const body = (await readJson(c)) || {};
  let name = null;
  if (body.tinh_danh !== undefined && body.tinh_danh !== null && body.tinh_danh !== '') {
    const check = checkName(String(body.tinh_danh));
    if (!check.ok) return bad(c, 'invalid_name', nameError(check));
    name = check.name;
  }
  const tz = isValidTimeZone(body.tz) ? body.tz : 'Asia/Ho_Chi_Minh';
  const ip = c.req.header('CF-Connecting-IP') || null, ua = (c.req.header('User-Agent') || '').slice(0, 256) || null;
  const result = await createAnonymousUser(c.env.DB, ip, ua, name, tz);
  c.header('Set-Cookie', COOKIE(encodeURIComponent(result.session.token), 30 * 24 * 3600));
  return c.json(result, 201);
});

authApp.get('/session', authMiddleware, (c) => c.json({ user: c.get('user'), session: { id: c.get('session').id, expiresAt: c.get('session').expiresAt } }));

authApp.post('/sign-out', async (c) => {
  const token = extractToken(c.req.raw);
  if (token) await c.env.DB.prepare('DELETE FROM session WHERE token = ?').bind(token).run();
  c.header('Set-Cookie', COOKIE('', 0));
  return c.json({ success: true });
});

export default authApp;

// workers/api/src/routes/auth.js
// Định tuyến xác thực Better Auth (PROJECT_ROADMAP.md §6)
import { Hono } from 'hono';
import { createAnonymousUser, authMiddleware, extractToken } from '../auth/session.js';
import { checkName } from '@vandao/shared';

const authApp = new Hono();

/**
 * Đăng nhập ẩn danh tạo khách
 */
authApp.post('/sign-in/anonymous', async (c) => {
  const db = c.env.DB;
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('User-Agent') || null;

  let initialName = 'An Tịnh';
  try {
    const body = await c.req.json();
    if (body?.tinh_danh) {
      const v = checkName(body.tinh_danh);
      if (v.ok) initialName = body.tinh_danh.trim();
    }
  } catch {
    // Bỏ qua nếu body rỗng
  }

  const result = await createAnonymousUser(db, ip, userAgent, initialName);

  // Thiết lập cookie HttpOnly; Secure; SameSite=Lax
  const cookieVal = `vd_session=${encodeURIComponent(result.session.token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 3600}`;
  c.header('Set-Cookie', cookieVal);

  return c.json({
    user: result.user,
    session: result.session,
    profile: result.profile,
    journey: result.journey
  }, 201);
});

/**
 * Lấy thông tin phiên hiện tại
 */
authApp.get('/session', authMiddleware, async (c) => {
  const user = c.get('user');
  const session = c.get('session');
  return c.json({ user, session });
});

/**
 * Đăng xuất hủy phiên
 */
authApp.post('/sign-out', async (c) => {
  const token = extractToken(c.req.raw);
  if (token) {
    await c.env.DB.prepare('DELETE FROM session WHERE token = ?').bind(token).run();
  }
  c.header('Set-Cookie', 'vd_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return c.json({ success: true });
});

export default authApp;

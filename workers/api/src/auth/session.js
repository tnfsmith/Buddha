// workers/api/src/auth/session.js
// Middleware xác thực cho /api/v1/*: đọc phiên Better Auth từ cookie `vd.session_token` (web) hoặc
// `Authorization: Bearer` (ứng dụng Android, plugin bearer).
import { getAuth } from './index.js';
export { nameKey, randomTag } from './profile.js';

export async function authMiddleware(c, next) {
  const auth = getAuth(c);
  if (!auth) return c.json({ error: { code: 'auth_unavailable', message: 'Đăng nhập chưa sẵn sàng' } }, 503);
  const s = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!s?.user) return c.json({ error: { code: 'unauthorized', message: 'Yêu cầu đăng nhập hoặc phiên khách' } }, 401);
  c.set('user', { id: s.user.id, isAnonymous: Boolean(s.user.isAnonymous) });
  c.set('session', { id: s.session.id, expiresAt: new Date(s.session.expiresAt).getTime() });
  await next();
}

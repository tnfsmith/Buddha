// workers/api/src/routes/auth.js
// Mọi đường dẫn /api/auth/* do Better Auth xử lý (ADR 0001):
//   POST /sign-in/anonymous · GET /get-session · POST /sign-out · /passkey/* · /sign-in/social (Google, khi có secret)
//   · /email-otp/* (chỉ khi bật EMAIL_OTP). Tịnh danh và múi giờ đặt sau bằng PATCH /api/v1/profile.
import { Hono } from 'hono';
import { getAuth } from '../auth/index.js';

const authApp = new Hono();

authApp.on(['GET', 'POST'], '/*', (c) => {
  const auth = getAuth(c);
  if (!auth) return c.json({ error: { code: 'auth_unavailable', message: 'Đăng nhập chưa sẵn sàng' } }, 503);
  return auth.handler(c.req.raw);
});

export default authApp;

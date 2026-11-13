// workers/api/src/routes/account.js
// Yêu cầu và hủy yêu cầu xóa tài khoản (PROJECT_ROADMAP.md §4.3, §5, §15)
import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';

const accountApp = new Hono();

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngày ân hạn

/**
 * Đăng ký yêu cầu xóa tài khoản
 */
accountApp.post('/delete', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const now = Date.now();
  const executeAfter = now + GRACE_PERIOD_MS;

  await db.prepare(
    `INSERT INTO deletion_request (user_id, requested_at, execute_after)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET requested_at = ?, execute_after = ?`
  ).bind(user.id, now, executeAfter, now, executeAfter).run();

  return c.json({
    success: true,
    message: 'Yêu cầu xóa tài khoản đã được ghi nhận. Bạn có thể hủy yêu cầu trong vòng 7 ngày.',
    execute_after: executeAfter
  });
});

/**
 * Hủy yêu cầu xóa tài khoản trong thời gian ân hạn
 */
accountApp.delete('/delete', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;

  const result = await db.prepare(
    `DELETE FROM deletion_request WHERE user_id = ?`
  ).bind(user.id).run();

  return c.json({
    success: true,
    message: 'Đã hủy yêu cầu xóa tài khoản.',
    cancelled: (result?.meta?.changes || 0) > 0
  });
});

export default accountApp;

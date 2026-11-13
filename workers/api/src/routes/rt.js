// workers/api/src/routes/rt.js
// Cấp vé HMAC vào phòng thời gian thực (Durable Objects - PROJECT_ROADMAP.md §7.2)
import { Hono } from 'hono';
import { Buffer } from 'node:buffer';
import { authMiddleware } from '../auth/session.js';
import { signHmac } from '../utils/crypto.js';

const rtApp = new Hono();

rtApp.post('/ticket', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const secret = c.env.RT_SECRET || 'vandao-realtime-shared-secret-default';
  const now = Date.now();
  const exp = now + 60 * 1000; // Sống 60 giây

  let room = 'hall:t0:s1';
  try {
    const body = await c.req.json();
    if (body?.room) room = String(body.room).trim();
  } catch {
    // Sử dụng phòng mặc định
  }

  // Lấy Tịnh danh của người dùng
  const profile = await db.prepare(
    `SELECT tinh_danh FROM profile WHERE user_id = ?`
  ).bind(user.id).first();

  const tinhDanh = profile?.tinh_danh || 'Đồng Tu';

  // Ký vé bằng HMAC-SHA256
  const payloadStr = JSON.stringify({
    uid: user.id,
    room,
    tinh_danh: tinhDanh,
    exp
  });

  const sig = await signHmac(secret, payloadStr);
  const ticket = Buffer.from(JSON.stringify({ p: payloadStr, s: sig })).toString('base64url');

  return c.json({
    ticket,
    ws_url: `/ws/${encodeURIComponent(room)}?t=${ticket}`,
    expires_at: exp
  });
});

export default rtApp;

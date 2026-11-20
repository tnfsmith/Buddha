import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { byUser } from '../guard.js';
import { bad, readJson } from '../lib.js';
import { parsePushSubscription, pushEndpoint } from '../push-endpoint.js';
import { refreshReminders, resyncStoredReminders } from '../reminder-data.js';

const pushApp = new Hono();
const invalid = (c) => bad(c, 'invalid_push_subscription', 'Đăng ký thông báo không hợp lệ.');
pushApp.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); },
  authMiddleware, byUser('RL_API'));

pushApp.post('/subscription', async (c) => {
  const now = Date.now(), uid = c.get('user').id, env = c.env, db = env.DB;
  const value = await parsePushSubscription(await readJson(c), now);
  if (!value) return invalid(c);
  const before = await db.prepare('SELECT 1 FROM push_subscription WHERE user_id = ? LIMIT 1').bind(uid).first();
  const row = await db.prepare(`INSERT INTO push_subscription (id, user_id, endpoint, p256dh, auth, created_at)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET
    fail_count = CASE WHEN push_subscription.p256dh = excluded.p256dh AND push_subscription.auth = excluded.auth THEN push_subscription.fail_count ELSE 0 END,
    last_ok_at = CASE WHEN push_subscription.p256dh = excluded.p256dh AND push_subscription.auth = excluded.auth THEN push_subscription.last_ok_at ELSE NULL END,
    p256dh = excluded.p256dh, auth = excluded.auth
    WHERE push_subscription.user_id = excluded.user_id RETURNING id`)
    .bind(crypto.randomUUID(), uid, value.endpoint, value.p256dh, value.auth, now).first();
  if (!row) return bad(c, 'push_subscription_conflict', 'Đăng ký thông báo này thuộc phiên khác.', 409);
  if (!before) await refreshReminders(env, uid, now);
  return c.json({ id: row.id });
});

pushApp.delete('/subscription', async (c) => {
  const body = await readJson(c);
  const endpoint = pushEndpoint(body?.endpoint);
  if (!endpoint || Object.keys(body).length !== 1) return invalid(c);
  const uid = c.get('user').id, env = c.env;
  const removed = await env.DB.prepare('DELETE FROM push_subscription WHERE user_id = ? AND endpoint = ? RETURNING id').bind(uid, endpoint).first();
  if (removed) await resyncStoredReminders(env, uid);
  return c.body(null, 204);
});

export default pushApp;

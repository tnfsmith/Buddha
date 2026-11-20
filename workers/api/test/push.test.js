import { expect, it } from 'vitest';
import app from '../src/index.js';
import { linkGuest } from '../src/auth/link.js';
import { runCron, DAY } from '../src/cron.js';
import { shardOf } from '@vandao/shared/reminder.js';
import { call, env, guest, json } from './helpers.js';

const path = '/api/v1/push/subscription';
const remind = '/api/v1/reminders';
const key64 = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
async function subscription(endpoint = 'https://fcm.googleapis.com/fcm/send/' + crypto.randomUUID()) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { endpoint, expirationTime: null, keys: {
    p256dh: key64(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    auth: key64(crypto.getRandomValues(new Uint8Array(16))),
  } };
}
const req = (token, method, body, route = path) => call(route, { method, body: JSON.stringify(body) }, token).then(json);
const read = (token, route = remind) => call(route, {}, token).then(json);
const save = (token) => req(token, 'PUT', { reminders: [{ kind: 'thien', local_hm: '06:00', active: true }] }, remind);

function fakeClock(events) {
  return { ...env, REMINDERS_ENABLED: '1', VAPID_PUBLIC_KEY: 'public-fixture', VAPID_PRIVATE_KEY: 'private-fixture',
    VAPID_SUBJECT: 'mailto:fixture@example.test',
    REMINDER_CLOCK: {
      getByName(name) {
        return {
          async schedule(data) { events.push({ name, ...data }); return { ok: true }; },
          async cancelUser(data) {
            const row = await env.DB.prepare('SELECT 1 FROM reminder WHERE user_id = ?').bind(data.user_id).first();
            events.push({ name, cancelled: data.user_id, remaining: row });
            return { ok: true };
          },
        };
      },
    },
  };
}

it('chỉ nhận dịch vụ push của trình duyệt và khóa Web Push thực', async () => {
  const { token } = await guest();
  const good = await subscription();
  expect((await req(undefined, 'POST', good)).status).toBe(401);
  for (const endpoint of ['http://fcm.googleapis.com/fcm/send/x', 'https://example.test/push', 'https://fcm.googleapis.com@invalid.test/x',
    'https://fcm.googleapis.com:8443/x', 'https://fcm.googleapis.com/x#fragment']) {
    expect((await req(token, 'POST', { ...good, endpoint })).data.error.code).toBe('invalid_push_subscription');
  }
  const fake = new Uint8Array(65);
  fake[0] = 4;
  expect((await req(token, 'POST', { ...good, keys: { ...good.keys, p256dh: key64(fake) } })).status).toBe(400);
  expect((await req(token, 'POST', { ...good, expirationTime: Date.now() - 1 })).status).toBe(400);
  const apple = await subscription('https://web.push.apple.com/token/test');
  const saved = await req(token, 'POST', apple);
  expect(saved).toMatchObject({ status: 200, data: { id: expect.any(String) } });
  expect(Object.keys(saved.data)).toEqual(['id']);
});

it('đăng ký lặp không đổi ID, tài khoản khác không thể lấy hoặc xóa, export loại khóa', async () => {
  const a = await guest(), b = await guest(), good = await subscription();
  const first = await req(a.token, 'POST', good);
  expect((await req(a.token, 'POST', good)).data).toEqual(first.data);
  expect((await req(b.token, 'POST', good)).data.error.code).toBe('push_subscription_conflict');
  expect((await req(b.token, 'DELETE', { endpoint: good.endpoint })).status).toBe(204);
  expect((await read(a.token)).data.subscribed).toBe(true);
  const out = (await read(a.token, '/api/v1/export')).data;
  expect(out.push_subscriptions).toEqual([{ id: first.data.id, created_at: expect.any(Number), last_ok_at: null }]);
  expect(JSON.stringify(out)).not.toContain(good.endpoint);
  expect(JSON.stringify(out)).not.toContain(good.keys.auth);
  expect((await req(a.token, 'DELETE', { endpoint: good.endpoint })).status).toBe(204);
  expect((await read(a.token)).data.subscribed).toBe(false);
});

it('bỏ đăng ký cuối bỏ alarm, giữ lịch và yêu cầu đăng ký lại sau khi gộp khách', async () => {
  const from = await guest(), target = await guest();
  const data = await subscription(), events = [], runtime = fakeClock(events);
  await save(from.token);
  const request = (method, body) => app.request(path, { method,
    headers: { Authorization: `Bearer ${from.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }, runtime).then(json);
  expect((await request('POST', data)).status).toBe(200);
  expect(events.at(-1)).toMatchObject({ name: `rc-${shardOf(from.user.id)}`, next_at: expect.any(Number) });
  expect((await request('DELETE', { endpoint: data.endpoint })).status).toBe(204);
  expect(events.at(-1)).toMatchObject({ next_at: null });
  expect((await read(from.token)).data.reminders[0].next_at).toBeGreaterThan(Date.now());
  await request('POST', data);
  await linkGuest(env.DB, from.user, target.user, runtime);
  expect(events.at(-1)).toMatchObject({ cancelled: from.user.id, remaining: null });
  expect((await read(target.token)).data.subscribed).toBe(false);
  expect((await req(target.token, 'POST', data)).status).toBe(200);
});

it('cron dọn D1 rồi hủy index, gọi shard đúng và không phát lại mốc đã quá 30 phút', async () => {
  const a = await guest(), gone = await guest();
  await Promise.all([save(a.token), save(gone.token)]);
  await req(a.token, 'POST', await subscription());
  const now = Date.now();
  await env.DB.prepare('UPDATE reminder SET next_at = ? WHERE user_id = ?').bind(now - 2 * 3_600_000, a.user.id).run();
  await env.DB.prepare('INSERT INTO deletion_request (user_id, requested_at, execute_after) VALUES (?, ?, ?)')
    .bind(gone.user.id, now - 8 * DAY, now - 1).run();
  const events = [];
  const result = await runCron(fakeClock(events), now);
  expect(result.reminders.scheduled).toBeGreaterThanOrEqual(1);
  const matched = events.find((e) => e.user_id === a.user.id);
  expect(matched).toMatchObject({ name: `rc-${shardOf(a.user.id)}` });
  expect(matched.next_at).toBeGreaterThan(now);
  expect(events.find((e) => e.cancelled === gone.user.id)).toMatchObject({ remaining: null });
});

it('cron sửa hơn 50 lịch quá hạn trong hạn mức truy vấn của D1 Free', async () => {
  const { token, user } = await guest();
  expect((await req(token, 'POST', await subscription())).status).toBe(200);
  const now = Date.parse('2026-11-20T19:17:00Z');
  const due = now - 3_600_000;
  const ids = Array.from({ length: 64 }, () => crypto.randomUUID());
  await env.DB.batch(ids.map((id) => env.DB.prepare(`INSERT INTO reminder
    (id, user_id, kind, local_hm, channel, next_at, active, created_at)
    VALUES (?, ?, 'thien', '06:00', 'push', ?, 1, ?)`)
    .bind(id, user.id, due, due)));

  let calls = 0;
  const request = async (run) => {
    if (++calls > 50) throw new Error('D1 query limit');
    return run();
  };
  const track = (statement) => ({
    statement,
    bind: (...values) => track(statement.bind(...values)),
    all: () => request(() => statement.all()),
    first: () => request(() => statement.first()),
  });
  const DB = {
    prepare: (sql) => track(env.DB.prepare(sql)),
    batch: (statements) => request(() => env.DB.batch(statements.map((entry) => entry.statement))),
  };
  const events = [];
  const result = await runCron({ ...fakeClock(events), DB }, now);
  expect(result.reminders.failures).toBe(0);
  expect(calls).toBeLessThanOrEqual(50);
  const scheduled = events.filter((event) => event.user_id === user.id);
  expect(scheduled.map((event) => event.reminder_id).sort()).toEqual(ids.sort());
  expect(scheduled.every((event) => event.next_at > now)).toBe(true);
  const remaining = await env.DB.prepare('SELECT COUNT(*) AS n FROM reminder WHERE user_id = ? AND next_at = ?')
    .bind(user.id, due).first();
  expect(remaining.n).toBe(0);
});

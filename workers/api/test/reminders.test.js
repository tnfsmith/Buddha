import { expect, it } from 'vitest';
import { nextReminderAt, shardOf } from '@vandao/shared/reminder.js';
import app from '../src/index.js';
import { linkGuest } from '../src/auth/link.js';
import { readReminders, replaceReminders } from '../src/reminder-data.js';
import { call, env, guest, json } from './helpers.js';

const path = '/api/v1/reminders';
const normal = { kind: 'thien', local_hm: '06:00', active: true };
const read = (token, url = path) => call(url, {}, token).then(json);
const put = (token, reminders, extra = {}) => call(path, { method: 'PUT', body: JSON.stringify({ reminders, ...extra }) }, token).then(json);

it('đòi đúng phiên và chỉ bật khi người dùng chọn, trả lỗi giờ yên lặng/giới hạn', async () => {
  const denied = await read();
  expect(denied.status).toBe(401);
  expect(denied.headers.get('cache-control')).toBe('no-store');
  const { token } = await guest();
  expect((await read(token)).data).toEqual({ reminders: [], paused_until: null, subscribed: false, push_available: false, vapid_public_key: null });
  expect((await put(token, [{ kind: 'thien', local_hm: '06:00' }])).data.reminders[0])
    .toMatchObject({ active: false, next_at: null });
  expect((await put(token, [{ ...normal, local_hm: '21:30' }])).data.error.code).toBe('reminder_quiet_hours');
  expect((await put(token, [normal, { ...normal, kind: 'nhiem_vu' }, { ...normal, kind: 'ghi_nhan' }])).data.error.code).toBe('reminder_limit');
  expect((await put(token, [normal], { pause_days: 31 })).data.error.code).toBe('invalid_pause');
});

it('giữ Tịnh khẩu khi danh sách rỗng, giữ đúng phiên khi export và đổi múi giờ', async () => {
  const { token, user } = await guest(), other = await guest();
  const pause = await put(token, [], { pause_days: 2 });
  expect(pause.status).toBe(200);
  const scheduled = await put(token, [normal]);
  expect(scheduled.data.paused_until).toBe(pause.data.paused_until);
  expect(scheduled.data.reminders[0].next_at).toBeGreaterThanOrEqual(pause.data.paused_until);
  expect((await read(other.token)).data.reminders).toEqual([]);
  const exported = (await read(token, '/api/v1/export')).data;
  expect(exported.reminder_paused_until).toBe(pause.data.paused_until);
  expect(exported.reminders).toEqual(scheduled.data.reminders);

  const resumed = await put(token, [normal], { pause_days: 0 });
  const tz = 'America/Los_Angeles', before = Date.now();
  const changed = await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tz }) }, token);
  expect(changed.status).toBe(200);
  const actual = (await read(token)).data.reminders[0];
  expect(actual.id).toBe(resumed.data.reminders[0].id);
  expect(actual.next_at).toBe(nextReminderAt({ ...normal, days_mask: 127, channel: 'push' }, { tz, now: before, uposatha: 'vn_4' }));
  await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(user.id).run();
  expect(await readReminders(env.DB, user.id)).toBeNull();
  expect(await env.DB.prepare('SELECT user_id FROM reminder_setting WHERE user_id = ?').bind(user.id).first()).toBeNull();
});

it('hai thiết bị dùng cùng snapshot chỉ một lô thắng', async () => {
  const { user } = await guest();
  const before = await readReminders(env.DB, user.id);
  const a = { ...normal, days_mask: 127 };
  const b = { ...a, kind: 'ghi_nhan', local_hm: '19:30' };
  const now = Date.now();
  const results = await Promise.all([
    replaceReminders(env, user.id, before, [a], null, now),
    replaceReminders(env, user.id, before, [b], now + 100_000, now),
  ]);
  expect(results.filter(Boolean)).toHaveLength(1);
  expect((await readReminders(env.DB, user.id)).rows).toHaveLength(1);
});

it('ghi D1 trước khi gọi đúng shard, thất bại RPC vẫn lưu và xóa lịch gọi cancel', async () => {
  const { token, user } = await guest();
  await env.DB.prepare(`INSERT INTO push_subscription (id,user_id,endpoint,p256dh,auth,created_at)
    VALUES (?, ?, ?, 'test-key', 'test-auth', ?)`).bind(crypto.randomUUID(), user.id, 'https://fcm.googleapis.com/fcm/send/test-' + user.id, Date.now()).run();
  const called = [];
  const runtime = { ...env, REMINDER_CLOCK: { getByName(name) {
    called.push(name);
    return {
      async schedule(x) {
        const row = await env.DB.prepare('SELECT next_at FROM reminder WHERE id = ?').bind(x.reminder_id).first();
        called.push([x.next_at, row.next_at]);
        throw new Error('RPC unavailable');
      },
      async cancel(x) { called.push(x.reminder_id); return { ok: true }; },
    };
  } } };
  const request = (reminders) => app.request(path, {
    method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reminders }),
  }, runtime).then(json);
  const saved = await request([normal]);
  expect(saved.status).toBe(200);
  expect(saved.data.push_available).toBe(false);
  const stored = saved.data.reminders[0];
  expect(called).toEqual([`rc-${shardOf(user.id)}`, [stored.next_at, stored.next_at]]);
  const removed = await request([]);
  expect(removed.status).toBe(200);
  expect(called.at(-1)).toBe(stored.id);
});

it('gộp khách giữ cấu hình nếu đích trống và để người dùng tự bật lại', async () => {
  const from = await guest(), to = await guest();
  expect((await put(from.token, [normal], { pause_days: 1 })).status).toBe(200);
  await linkGuest(env.DB, from.user, to.user);
  const settings = (await read(to.token)).data;
  expect(settings.paused_until).toBeGreaterThan(Date.now());
  expect(settings.reminders[0]).toMatchObject({ kind: 'thien', local_hm: '06:00', active: false, next_at: null });
});

import { expect, it } from 'vitest';
import { CHEER_TTL_MS, sendCheer } from '../src/companion-cheers.js';
import { runCron } from '../src/cron.js';
import { call, env, guest, json } from './helpers.js';

const api = (person, path, method = 'GET', body) => call('/api/v1' + path, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}, person?.token).then(json);
const cheer = (sender, recipient, line = 'tuy_hy') => api(sender, '/companions/' + recipient.user.id + '/cheer', 'POST', { line });
const seen = (who, until) => api(who, '/cheers/seen', 'POST', { until });
const list = (who) => api(who, '/companions').then((r) => r.data.cheers);
const count = (who) => api(who, '/me').then((r) => r.data.social.cheers);
const denied = (r, status, code) => expect(r).toMatchObject({ status, data: { error: { code } } });

async function setup(size = 1) {
  const sender = await guest('Tuệ An');
  expect((await api(sender, '/profile', 'PATCH', { look: { height: 1 } })).status).toBe(200);
  const r = await api(sender, '/companions/link', 'POST', {});
  expect(r.status).toBe(200);
  const friends = [];
  for (let i = 0; i < size; i++) {
    const who = await guest();
    expect((await api(who, '/companions/link/' + r.data.code + '/accept', 'POST')).status).toBe(201);
    friends.push(who);
  }
  return { sender, friends };
}

it('từ chối khách chưa có phiên, người chưa kết nối, và nội dung ngoài mẫu', async () => {
  const { sender, friends: [friend] } = await setup(), stranger = await guest();
  const unauth = await cheer(null, friend);
  denied(unauth, 401, 'unauthorized');
  expect(unauth.headers.get('Cache-Control')).toBe('no-store');
  denied(await seen(null, 1), 401, 'unauthorized');
  denied(await cheer(sender, stranger), 404, 'not_found');
  denied(await cheer(sender, sender), 404, 'not_found');
  denied(await cheer(sender, friend, 'constructor'), 400, 'invalid_payload');
  denied(await cheer(sender, friend, ['tuy_hy']), 400, 'invalid_payload');
  denied(await api(sender, '/companions/' + friend.user.id + '/cheer', 'POST', { line: 'tien_trinh', day: 49 }), 400, 'invalid_payload');
  denied(await seen(friend, '1'), 400, 'invalid_payload');
  expect(await list(friend)).toEqual([]);
});

it('ghi một lần mỗi chiều mỗi ngày dù hai yêu cầu cùng lúc, đổi ngày theo múi giờ người gửi', async () => {
  const { sender, friends: [b, c] } = await setup(2);
  const time = Date.UTC(2026, 7, 9, 16, 59), from = sender.user.id, to = b.user.id;
  expect(await Promise.all([0, 1].map(() => sendCheer(env.DB, from, to, 'tuy_hy', time))))
    .toEqual(expect.arrayContaining([null, 'cheer_today']));
  expect(await sendCheer(env.DB, from, to, 'nho_ban', time + 120_000)).toBeNull();
  const rows = await env.DB.prepare('SELECT day, line FROM cheer WHERE from_id = ? AND to_id = ? ORDER BY day').bind(from, to).all();
  expect(rows.results).toEqual([{ day: '2026-08-09', line: 'tuy_hy' }, { day: '2026-08-10', line: 'nho_ban' }]);
  expect((await cheer(sender, c)).status).toBe(201);
  denied(await cheer(sender, c, 'cam_on'), 409, 'cheer_today');
  expect((await cheer(c, sender)).status).toBe(201);
});

it('chụp tiến trình trên máy chủ khi gửi, lần đổi hành trình sau đó không đổi lời cũ', async () => {
  const { sender, friends: [b, c] } = await setup(2);
  await env.DB.prepare('UPDATE journey SET day = 25, completed_at = NULL WHERE user_id = ? AND is_current = 1').bind(sender.user.id).run();
  expect((await cheer(sender, b, 'tien_trinh')).status).toBe(201);
  await env.DB.prepare('UPDATE journey SET day = 49, completed_at = ? WHERE user_id = ? AND is_current = 1').bind(Date.now(), sender.user.id).run();
  expect((await cheer(sender, c, 'tien_trinh')).status).toBe(201);
  expect(await list(b)).toMatchObject([{ from: { id: sender.user.id, tinh_danh: 'Tuệ An' }, line: 'tien_trinh', day: 25, completed: false }]);
  expect(await list(c)).toMatchObject([{ day: 49, completed: true }]);
});

it('sắp mới trước, bỏ lời quá 7 ngày và mốc đã xem chỉ tăng tới giờ máy chủ', async () => {
  const { sender, friends: [b, c, d] } = await setup(3);
  expect((await cheer(b, sender)).status).toBe(201);
  expect((await cheer(c, sender, 'cam_on')).status).toBe(201);
  expect((await cheer(d, sender, 'nho_ban')).status).toBe(201);
  const now = Date.now();
  const setAt = (who, at) => env.DB.prepare('UPDATE cheer SET at = ? WHERE from_id = ?').bind(at, who.user.id).run();
  await setAt(b, now - 10_000);
  await setAt(c, now - 1_000);
  await setAt(d, now - CHEER_TTL_MS);
  expect((await list(sender)).map((r) => r.from.id)).toEqual([c.user.id, b.user.id]);
  expect(await count(sender)).toBe(2);
  expect((await seen(sender, now - 10_000)).status).toBe(204);
  expect(await count(sender)).toBe(1);
  expect((await seen(sender, now - 15_000)).status).toBe(204);
  expect(await count(sender)).toBe(1);
  expect((await seen(sender, now + CHEER_TTL_MS)).status).toBe(204);
  expect(await count(sender)).toBe(0);
  const saved = await env.DB.prepare('SELECT seen_at FROM cheer_seen WHERE user_id = ?').bind(sender.user.id).first();
  expect(saved.seen_at).toBeGreaterThanOrEqual(now);
  expect(saved.seen_at).toBeLessThanOrEqual(Date.now());
  expect(await list(sender)).toHaveLength(2);
});

it('lọc danh sách và số chưa xem khi chặn theo một trong hai chiều', async () => {
  const { sender, friends: [b, c] } = await setup(2);
  expect((await cheer(b, sender)).status).toBe(201);
  expect((await cheer(c, sender)).status).toBe(201);
  expect(await count(sender)).toBe(2);
  expect((await api(sender, '/blocks', 'POST', { user: b.user.id })).status).toBe(204);
  expect((await api(c, '/blocks', 'POST', { user: sender.user.id })).status).toBe(204);
  expect(await list(sender)).toEqual([]);
  expect(await count(sender)).toBe(0);
  denied(await cheer(b, sender), 404, 'not_found');
  denied(await cheer(sender, c), 404, 'not_found');
});

it('export không kèm ID của bạn, cron dọn lời hết hạn và xóa tài khoản dọn lời cùng mốc', async () => {
  const { sender, friends: [b, c] } = await setup(2);
  expect((await cheer(sender, b)).status).toBe(201);
  expect((await cheer(c, sender, 'cam_on')).status).toBe(201);
  expect((await seen(sender, 1)).status).toBe(204);
  const exported = (await api(sender, '/export')).data.cheers;
  expect(exported.seen_at).toBe(1);
  expect(exported.entries).toEqual(expect.arrayContaining([
    expect.objectContaining({ direction: 'sent', line: 'tuy_hy', companion: { tinh_danh: null, tag: expect.any(String) } }),
    expect.objectContaining({ direction: 'received', line: 'cam_on' }),
  ]));
  expect(JSON.stringify(exported)).not.toContain(b.user.id);
  expect(JSON.stringify(exported)).not.toContain(c.user.id);
  const now = Date.now();
  await env.DB.prepare('UPDATE cheer SET at = ? WHERE to_id = ?').bind(now - CHEER_TTL_MS, b.user.id).run();
  expect((await runCron(env, now)).cheers).toBeGreaterThanOrEqual(1);
  expect(await env.DB.prepare('SELECT 1 FROM cheer WHERE to_id = ?').bind(b.user.id).first()).toBeNull();
  expect(await env.DB.prepare('SELECT 1 FROM cheer WHERE from_id = ? AND to_id = ?').bind(c.user.id, sender.user.id).first()).toBeTruthy();
  await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(sender.user.id).run();
  expect(await env.DB.prepare('SELECT 1 FROM cheer WHERE from_id = ? OR to_id = ?').bind(sender.user.id, sender.user.id).first()).toBeNull();
  expect(await env.DB.prepare('SELECT 1 FROM cheer_seen WHERE user_id = ?').bind(sender.user.id).first()).toBeNull();
});

import { expect, it } from 'vitest';
import { DAY, runCron } from '../src/cron.js';
import { call, env, guest } from './helpers.js';

function request(id, from, to, tag, at, expires, declined = null) {
  return env.DB.prepare(
    `INSERT INTO companion_request (id, from_id, to_id, tinh_danh, tag, created_at, expires_at, declined_at)
     VALUES (?, ?, ?, 'Tâm An', ?, ?, ?, ?)`,
  ).bind(id, from, to, tag, at, expires, declined);
}

it('xuất đúng dữ liệu của phiên khách và không tạo tín hiệu về người nhận phía gửi', async () => {
  const viewer = await guest(), contact = await guest(), other = await guest();
  const a = viewer.user.id, b = contact.user.id, c = other.user.id, now = Date.now(), expires = now + DAY;
  const db = env.DB;
  await db.batch([
    db.prepare("UPDATE profile SET tinh_danh='Tâm Minh', tag='0006' WHERE user_id=?").bind(c),
    request('export-matched', a, b, '0001', now, expires),
    request('export-masked', a, null, '0002', now, expires),
    request('export-expired', a, null, '0003', now - DAY, now - 1),
    request('export-declined', c, a, '0004', now, expires, now + 1),
    request('export-unrelated', b, c, '0005', now, expires),
    db.prepare("INSERT INTO presence (user_id,state,updated_at) VALUES (?,'online',?), (?,'thien',?)").bind(a, now, b, now),
    db.prepare("INSERT INTO island_visit (host_id,guest_id,day,at) VALUES (?,?,'2026-11-19',?), (?,?,'2026-11-19',?)").bind(a, b, now, b, a, now),
    db.prepare('INSERT INTO user_block (blocker_id,blocked_id,created_at) VALUES (?,?,?), (?,?,?)').bind(a, c, now, b, c, now),
  ]);
  const resp = await call('/api/v1/export', {}, viewer.token);
  expect(resp.status).toBe(200);
  expect(resp.headers.get('Cache-Control')).toBe('no-store');
  const data = await resp.json();
  expect(data.companion_requests).toEqual({
    outgoing: [
      { id: 'export-masked', tinh_danh: 'Tâm An', tag: '0002', at: now, expires_at: expires },
      { id: 'export-matched', tinh_danh: 'Tâm An', tag: '0001', at: now, expires_at: expires },
    ],
    incoming: [{ id: 'export-declined', from: { tinh_danh: 'Tâm Minh', tag: '0006' }, at: now, declined_at: now + 1 }],
  });
  expect(data.presence).toEqual({ state: 'online', updated_at: now });
  expect(data.island_visits).toEqual([{ guest_id: b, day: '2026-11-19', at: now }]);
  expect(data.blocks).toEqual([{ blocked_id: c, created_at: now }]);
});

it('cron dọn yêu cầu hết hạn, lời gặp hơn 7 ngày và lượt ghé hơn 30 ngày', async () => {
  const from = (await guest()).user.id, to = (await guest()).user.id, now = Date.now(), db = env.DB;
  const meet = (id, at) => db.prepare(
    "INSERT INTO meet_invite (id,from_id,to_id,kind,place,created_at) VALUES (?,?,?,'thien','dtd',?)",
  ).bind(id, from, to, at);
  const visit = (day, at) => db.prepare('INSERT INTO island_visit (host_id,guest_id,day,at) VALUES (?,?,?,?)')
    .bind(from, to, day, at);
  await db.batch([
    request('cron-expired', from, null, '0001', now - 14 * DAY, now),
    request('cron-live', from, to, '0002', now - DAY, now + 1),
    meet('cron-old', now - 7 * DAY - 1), meet('cron-keep', now - 7 * DAY),
    visit('2026-10-18', now - 30 * DAY - 1), visit('2026-10-19', now - 30 * DAY),
  ]);
  const result = await runCron(env, now);
  expect(result.companion_requests).toBeGreaterThanOrEqual(1);
  expect(result.meet_invites).toBeGreaterThanOrEqual(1);
  expect(result.island_visits).toBeGreaterThanOrEqual(1);
  expect((await db.prepare('SELECT id FROM companion_request WHERE from_id=?').bind(from).all()).results)
    .toEqual([{ id: 'cron-live' }]);
  expect((await db.prepare('SELECT id FROM meet_invite WHERE from_id=?').bind(from).all()).results)
    .toEqual([{ id: 'cron-keep' }]);
  expect((await db.prepare('SELECT day FROM island_visit WHERE host_id=?').bind(from).all()).results)
    .toEqual([{ day: '2026-10-19' }]);
});

import { expect, it } from 'vitest';
import { SESSION_STEP_MS } from '@vandao/shared/dong-tu.js';
import { runCron } from '../src/cron.js';
import { call, DAY, env, guest, json } from './helpers.js';

const api = (person, path, method = 'GET', body) => call('/api/v1' + path, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}, person?.token).then(json);
const at = () => Math.ceil((Date.now() + 120_000) / SESSION_STEP_MS) * SESSION_STEP_MS;
const invite = (host, invitees, start_at = at()) => api(host, '/sessions', 'POST', { start_at, invitees: invitees.map(({ user }) => user.id) });
const list = (who) => api(who, '/companions').then((r) => r.data.sessions);
const count = (who) => api(who, '/me').then((r) => r.data.social.sessions);
const respond = (who, id, accept) => api(who, '/sessions/' + id + '/respond', 'POST', { accept });
const cancel = (who, id) => api(who, '/sessions/' + id + '/cancel', 'POST');
const denied = (r, status, code) => expect(r).toMatchObject({ status, data: { error: { code } } });

async function setup(size = 2) {
  const host = await guest('Tuệ An'), friends = [];
  expect((await api(host, '/profile', 'PATCH', { look: { height: 1 } })).status).toBe(200);
  const r = await api(host, '/companions/link', 'POST', {});
  expect(r.status).toBe(200);
  for (let i = 0; i < size; i++) {
    const friend = await guest();
    expect((await api(friend, '/companions/link/' + r.data.code + '/accept', 'POST')).status).toBe(201);
    friends.push(friend);
  }
  return { host, friends };
}

it('yêu cầu phiên và nhân vật, từ chối giờ lẻ, người chưa kết nối và danh sách trùng', async () => {
  const { host, friends: [b] } = await setup(1), outsider = await guest();
  const refused = await invite(null, [b]);
  denied(refused, 401, 'unauthorized');
  expect(refused.headers.get('Cache-Control')).toBe('no-store');
  denied(await invite(host, [b], at() + 1), 400, 'invalid_payload');
  denied(await invite(host, [b], at() + 8 * DAY), 400, 'invalid_payload');
  denied(await invite(host, [host]), 400, 'invalid_payload');
  denied(await invite(host, [b, b]), 400, 'invalid_payload');
  denied(await invite(host, [b, outsider]), 404, 'not_found');
  denied(await invite(b, [host]), 409, 'need_character');
  expect(await list(host)).toEqual([]);
  expect(await count(b)).toBe(0);
});

it('hẹn trước cả khi bạn vắng, đổi số chờ giữa phiên, nhận, từ chối, rời và hủy', async () => {
  const { host, friends: [b, c] } = await setup();
  const time = at(), r = await invite(host, [b, c], time);
  expect(r.status).toBe(201);
  expect(r.data.skipped).toEqual([]);
  const s = r.data.session;
  expect(s).toMatchObject({ host: { id: host.user.id, tinh_danh: 'Tuệ An' }, kind: 'thien', place: 'dtd', start_at: time });
  expect(s.seats.map(({ id }) => id).sort()).toEqual([b.user.id, c.user.id].sort());
  expect(s.seats.every(({ status }) => status === 'moi')).toBe(true);
  expect(await count(b)).toBe(1);
  expect(await list(b)).toEqual([s]);
  expect((await respond(b, s.id, true)).data).toEqual({ status: 'nhan' });
  expect((await respond(b, s.id, true)).data).toEqual({ status: 'nhan' });
  expect(await count(b)).toBe(0);
  expect((await respond(b, s.id, false)).data).toEqual({ status: 'roi' });
  expect((await respond(c, s.id, false)).data).toEqual({ status: 'tu_choi' });
  denied(await cancel(b, s.id), 404, 'not_found');
  expect((await cancel(host, s.id)).status).toBe(204);
  expect((await cancel(host, s.id)).status).toBe(204);
  denied(await respond(c, s.id, true), 409, 'session_closed');
  expect(await list(b)).toEqual([]);
});

it('hẹn Ngay bỏ qua bạn vắng có hiện diện công khai, giữ riêng tư khi bạn ẩn', async () => {
  const { host, friends: [here, absent, hidden] } = await setup(3);
  expect((await api(here, '/presence', 'POST', { state: 'online' })).status).toBe(204);
  expect((await api(hidden, '/profile', 'PATCH', { settings: { dong_tu: { hien_trang_thai: false } } })).status).toBe(200);
  const before = Date.now(), r = await invite(host, [here, absent, hidden], 'ngay');
  expect(r.status).toBe(201);
  expect(r.data.skipped).toEqual([absent.user.id]);
  expect(r.data.session.start_at).toBeGreaterThanOrEqual(before + 60_000);
  expect(r.data.session.start_at).toBeLessThanOrEqual(Date.now() + 60_000);
  expect(r.data.session.seats.map(({ id }) => id).sort()).toEqual([here.user.id, hidden.user.id].sort());
  expect(await count(absent)).toBe(0);
});

it('chặn hai chiều che ghế hoặc cả phiên tùy người bị chặn, kể cả sau khi mời', async () => {
  const { host, friends: [b, c] } = await setup(), stranger = await guest();
  const r = await invite(host, [b, c]);
  expect(r.status).toBe(201);
  const id = r.data.session.id;
  expect(await list(stranger)).toEqual([]);
  denied(await respond(stranger, id, true), 404, 'not_found');
  expect((await api(b, '/blocks', 'POST', { user: c.user.id })).status).toBe(204);
  const shown = await list(b);
  expect(shown).toHaveLength(1);
  expect(shown[0].seats.map((s) => s.id)).toEqual([b.user.id]);
  expect(await count(b)).toBe(1);
  expect((await api(host, '/blocks', 'POST', { user: b.user.id })).status).toBe(204);
  expect(await list(b)).toEqual([]);
  expect(await count(b)).toBe(0);
  denied(await respond(b, id, true), 404, 'not_found');
});

it('tối đa ba hẹn đang mở dù bốn lượt tạo đồng thời, hủy một thì tạo lại được', async () => {
  const { host, friends: [b] } = await setup(1);
  const results = await Promise.all(Array.from({ length: 4 }, () => invite(host, [b])));
  expect(results.map((r) => r.status).sort()).toEqual([201, 201, 201, 409]);
  denied(results.find((r) => r.status === 409), 409, 'session_limit');
  const open = await list(host);
  expect(open).toHaveLength(3);
  expect((await cancel(host, open[0].id)).status).toBe(204);
  expect((await invite(host, [b])).status).toBe(201);
});

it('export chỉ có phiên và ghế của chủ phiên đăng nhập, cron dọn theo start_at', async () => {
  const { host, friends: [b] } = await setup(1);
  const r = await invite(host, [b]);
  const id = r.data.session.id;
  expect((await respond(b, id, true)).status).toBe(200);
  const a = (await api(host, '/export')).data.dong_tu_sessions;
  expect(a).toMatchObject({ hosted: [{ id, seat_counts: { nhan: 1 } }], seats: [] });
  expect(JSON.stringify(a)).not.toContain(b.user.id);
  const s = (await api(b, '/export')).data.dong_tu_sessions;
  expect(s).toMatchObject({ hosted: [], seats: [{ session_id: id, status: 'nhan' }] });
  expect(JSON.stringify(s)).not.toContain(host.user.id);
  const now = Date.now();
  await env.DB.prepare('UPDATE dong_tu_session SET start_at = ? WHERE id = ?').bind(now - 31 * DAY, id).run();
  denied(await respond(b, id, false), 409, 'session_closed');
  expect(await list(host)).toEqual([]);
  expect((await runCron(env, now)).dong_tu_sessions).toBe(1);
  expect(await env.DB.prepare('SELECT 1 FROM dong_tu_seat WHERE session_id = ?').bind(id).first()).toBeNull();
});

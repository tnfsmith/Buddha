import { expect, it } from 'vitest';
import { linkGuest } from '../src/auth/link.js';
import { getLocalDate } from '../src/utils/time.js';
import { call, env, guest, json } from './helpers.js';

const path = '/api/v1/deeds';
const deed = () => ({ op_id: crypto.randomUUID(), punna: 'veyyavacca', parami: ['metta', 'viriya'], scope: 'doi_thuc' });
const post = (token, value) => call(path, { method: 'POST', body: JSON.stringify(value) }, token).then(json);
const read = (token, url) => call(url, {}, token).then(json).then((r) => r.data);

it('yêu cầu phiên và chỉ nhận mã chuẩn, không lưu nội dung ngoài hợp đồng', async () => {
  const denied = await post(undefined, deed());
  expect(denied).toMatchObject({ status: 401 });
  expect(denied.headers.get('cache-control')).toBe('no-store');
  const { token } = await guest();
  for (const bad of [
    { op_id: 'number' }, { punna: 'gold' }, { parami: ['metta', 'metta'] }, { parami: ['invalid'] },
    { scope: 'online' }, { shared: 'true' }, { money: 10 }, { note: 'ghi chú' }, { date: '2026-11-01' },
  ]) {
    expect(await post(token, { ...deed(), ...bad })).toMatchObject({ status: 400, data: { error: { code: 'invalid_deed' } } });
  }
  expect((await read(token, '/api/v1/export')).deeds).toEqual([]);
});

it('giới hạn nguyên tử năm lượt trong ngày địa phương và gửi lại không tiêu thêm lượt hay tăng Kusala', async () => {
  const { token, user } = await guest();
  const tz = 'America/Los_Angeles';
  await env.DB.prepare('UPDATE profile SET tz = ? WHERE user_id = ?').bind(tz, user.id).run();
  await env.DB.prepare('UPDATE journey SET started_on = ? WHERE user_id = ?').bind(getLocalDate(Date.now(), tz), user.id).run();
  const inputs = Array.from({ length: 8 }, deed);
  const replies = await Promise.all(inputs.map((p) => post(token, p)));
  expect(replies.filter((r) => r.status === 201)).toHaveLength(5);
  expect(replies.filter((r) => r.data.error?.code === 'deed_daily_limit')).toHaveLength(3);
  const winner = replies.findIndex((r) => r.status === 201);
  const same = await post(token, { ...inputs[winner], parami: ['viriya', 'metta'] });
  expect(same).toMatchObject({ status: 200, data: replies[winner].data });
  expect(same.data.deed.date).toBe(getLocalDate(same.data.deed.at, tz));
  expect((await post(token, { ...inputs[winner], punna: 'dana' })).data.error.code).toBe('deed_id_conflict');
  const summary = await read(token, '/api/v1/practice/summary?range=cycle');
  expect(summary.punna).toEqual({ veyyavacca: 5 });
  expect(summary.pillars.all).toBe(0);
  expect(summary.lotus.counts).toMatchObject({ metta: 1, viriya: 1 });
  expect((await read(token, '/api/v1/export')).deeds).toHaveLength(5);
});

it('việc thiện riêng tư giữ theo tài khoản, chuyển khi gộp khách và xóa cùng tài khoản', async () => {
  const first = await guest(), target = await guest('Tịnh Lạc');
  const input = { ...deed(), shared: true };
  const created = await post(first.token, input);
  expect(created.status).toBe(201);
  expect((await read(target.token, '/api/v1/export')).deeds).toEqual([]);
  const other = await post(target.token, input);
  expect(other).toMatchObject({ status: 409, data: { error: { code: 'deed_id_conflict' } } });
  await linkGuest(env.DB, first.user, target.user);
  expect((await read(target.token, '/api/v1/export')).deeds).toEqual([created.data.deed]);
  expect((await post(target.token, input)).status).toBe(200);
  await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(target.user.id).run();
  expect(await env.DB.prepare('SELECT id FROM deed_log WHERE id = ?').bind(input.op_id).first()).toBeNull();
});

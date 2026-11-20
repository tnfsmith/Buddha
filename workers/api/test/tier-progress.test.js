import { expect, it } from 'vitest';
import { linkGuest } from '../src/auth/link.js';
import { call, env, guest, json, sync } from './helpers.js';

const path = '/api/v1/tier-progress/1';
const get = (token) => call(path, {}, token).then(json);
const post = (token, action, body) => call(path + '/' + action, { method: 'POST', body: JSON.stringify(body) }, token).then(json);
const reflect = (token, cycle = 1) => post(token, 'reflection', { cycle, done: true });
const open = (token, cycle = 1) => post(token, 'open', { cycle });
const reset = (token) => sync(token, [{ id: 'reset-tier-test', at: Date.now(), type: 'journey.reset_cycle', payload: {} }]);
const progress = (uid) => env.DB.prepare('SELECT status, opened_at, criteria_json FROM tier_progress WHERE user_id = ? AND tier = 1').bind(uid).first();
const day = (uid, n, completed = false) => env.DB.prepare(
  'UPDATE journey SET day = ?, completed_at = ? WHERE user_id = ? AND is_current = 1',
).bind(n, completed ? Date.now() : null, uid).run();
const events = (uid, prefix, count, { cycle = 1, program = 'so-nhap-49', n = 1, minutes = 12, slot = 'thoi_thien' } = {}) => {
  const value = JSON.stringify({ n, min: minutes });
  return env.DB.prepare(`
    INSERT OR IGNORE INTO practice_event (user_id, id, program, cycle, local_date, kind, slot, value_json, at, server_at)
    SELECT ?1, ?2 || key, ?3, ?4, '2026-11-20', 'tu', ?5, ?6, 1, 1 FROM json_each(?7)
  `).bind(uid, prefix, program, cycle, slot, value, JSON.stringify(Array(count).fill(0))).run();
};
const err = (response, status, code) => expect(response).toMatchObject({ status, data: { error: { code } } });

it('yêu cầu phiên, no-store và từ chối chu kỳ hoặc thân yêu cầu không hợp lệ', async () => {
  const anon = await get();
  err(anon, 401, 'unauthorized');
  expect(anon.headers.get('Cache-Control')).toBe('no-store');
  const { token, user } = await guest();
  const r = await get(token);
  expect(r.headers.get('Cache-Control')).toBe('no-store');
  expect(r).toMatchObject({ status: 200, data: { tier: 1, cycle: 1, status: 'dang_tu', opened_at: null,
    criteria: { journey_completed: false, full_sessions: 0, min_full_sessions: 30, week_7_reflected: false } } });
  for (const payload of [{ cycle: 1, done: false }, { cycle: '1', done: true }, { cycle: 1, done: true, note: 'riêng' }, { cycle: 0, done: true }, null]) {
    err(await post(token, 'reflection', payload), 400, 'invalid_payload');
  }
  err(await post(token, 'open', { cycle: 1, fake: true }), 400, 'invalid_payload');
  err(await reflect(token, 2), 409, 'cycle_conflict');
  expect(await progress(user.id)).toBeNull();
});

it('chỉ mở sau ngày 49 hoàn tất, đúng 30 thời trọn và tự vấn, không cần chứng thực', async () => {
  const { token, user } = await guest();
  await day(user.id, 48);
  err(await reflect(token), 409, 'reflection_too_early');
  await day(user.id, 49);
  const reflected = await reflect(token);
  expect(reflected).toMatchObject({ status: 200, data: { status: 'dang_tu', criteria: { week_7_reflected: true } } });
  const saved = await progress(user.id);
  expect((await reflect(token)).data).toEqual(reflected.data);
  expect(await progress(user.id)).toEqual(saved);
  await events(user.id, 'full', 29);
  await events(user.id, 'full', 29); // ID trùng không thành 58 thời.
  await events(user.id, 'short', 1, { minutes: 11 });
  await events(user.id, 'aggregate', 1, { n: 2, minutes: 30 });
  await events(user.id, 'history', 1, { cycle: 2 });
  await events(user.id, 'other-program', 1, { program: 'khac' });
  await events(user.id, 'other-slot', 1, { slot: 'kinh_hanh' });
  expect((await get(token)).data.criteria).toMatchObject({ journey_completed: false, full_sessions: 29 });
  err(await open(token), 409, 'tier_not_ready');
  await day(user.id, 49, true);
  err(await open(token), 409, 'tier_not_ready');
  await events(user.id, 'last', 1);
  expect((await get(token)).data).toMatchObject({ status: 'du_dieu_kien', criteria: { full_sessions: 30 } });
  const authPost = (route, body, bearer) => call('/api/auth/' + route, { method: 'POST', body: JSON.stringify(body) }, bearer).then(json);
  const { data: { code, secret } } = await authPost('device-link/start', {});
  expect((await authPost('device-link/approve', { code }, token)).status).toBe(200);
  const { data: { token: second } } = await authPost('sign-in/device-link', { code, secret });
  expect(second).toEqual(expect.any(String));
  expect(second).not.toBe(token);
  const all = await Promise.all([open(token), open(second)]);
  expect(all[0].status).toBe(200);
  expect(all[0].data).toMatchObject({ status: 'da_mo', opened_at: expect.any(Number) });
  expect(all[1].data).toEqual(all[0].data);
  expect((await open(token)).data).toEqual(all[0].data);
  expect((await get(token)).data).toEqual(all[0].data);
});

it('cờ của chu kỳ cũ không theo lần reset và tài khoản khác không thấy số đếm', async () => {
  const a = await guest(), b = await guest();
  await day(a.user.id, 49, true);
  await events(a.user.id, 'trained', 30);
  expect((await reflect(a.token)).data.status).toBe('du_dieu_kien');
  expect((await get(b.token)).data.criteria).toMatchObject({ full_sessions: 0, week_7_reflected: false });
  expect((await reset(a.token)).applied).toEqual(['reset-tier-test']);
  err(await open(a.token), 409, 'cycle_conflict');
  err(await reflect(a.token), 409, 'cycle_conflict');
  err(await reflect(a.token, 2), 409, 'reflection_too_early');
  expect((await get(a.token)).data).toMatchObject({ cycle: 2, status: 'dang_tu', criteria: { full_sessions: 0, week_7_reflected: false } });
  await day(a.user.id, 49, true);
  await events(a.user.id, 'new', 30, { cycle: 2 });
  err(await open(a.token, 2), 409, 'tier_not_ready');
  expect((await reflect(a.token, 2)).data.status).toBe('du_dieu_kien');
});

it('giữ thời điểm và bằng chứng sau khi reset, chỉ xuất của chủ tài khoản và xóa theo FK', async () => {
  const a = await guest(), b = await guest();
  await day(a.user.id, 49, true);
  await events(a.user.id, 'trained', 30);
  await reflect(a.token);
  const original = (await open(a.token)).data;
  expect((await reset(a.token)).applied).toEqual(['reset-tier-test']);
  const afterReset = (await get(a.token)).data;
  expect(afterReset).toEqual({ ...original, cycle: 2 });
  const exp = (token) => call('/api/v1/export', {}, token).then(json);
  expect((await exp(b.token)).data.tier_progress).toEqual([]);
  expect((await exp(a.token)).data.tier_progress).toEqual([{
    tier: 1, status: 'da_mo', opened_at: original.opened_at,
    criteria: { program: 'so-nhap-49', cycle: 1, criteria_version: 1, reflection_week: 7,
      week_7_reflected: true, journey_completed: true, full_sessions: 30, min_full_sessions: 30 },
  }]);
  await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(a.user.id).run();
  expect(await progress(a.user.id)).toBeNull();
});

it('gộp hành trình khách đã mở vào tài khoản có tiến trình và dời chu kỳ bằng chứng', async () => {
  const a = await guest(), b = await guest();
  await day(b.user.id, 2);
  await day(a.user.id, 49, true);
  await events(a.user.id, 'trained', 30);
  await reflect(a.token);
  const opened = (await open(a.token)).data;
  expect(await linkGuest(env.DB, a.user, b.user)).toEqual({ moved: 'archive' });
  expect((await get(b.token)).data).toMatchObject({ status: 'da_mo', opened_at: opened.opened_at, cycle: 1,
    criteria: { full_sessions: 30, week_7_reflected: true } });
  expect(JSON.parse((await progress(b.user.id)).criteria_json).cycle).toBe(2);
  const migrated = await env.DB.prepare('SELECT is_current FROM journey WHERE user_id = ? AND cycle = 2').bind(b.user.id).first();
  expect(migrated.is_current).toBe(0);
});

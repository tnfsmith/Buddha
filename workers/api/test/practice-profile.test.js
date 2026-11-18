import { describe, expect, it } from 'vitest';
import { runCron } from '../src/cron.js';
import { call, env, guest, json, sync } from './helpers.js';

const path = '/api/v1/practice/profile';
const profile = {
  level: 'vua', minutes: 15, time_window: 'toi', familiarity: null,
  precepts: [1, 2, 5], uposatha: 'vn_4', no_money: true, at_home: true,
};
const empty = { profile: null, rev: 0 };
const get = async (token, suffix = '') => json(await call(path + suffix, {}, token));
const post = async (path, token, body = {}) => json(await call(path, { method: 'POST', body: JSON.stringify(body) }, token));
const put = async (token, body, headers) => json(await call(path, { method: 'PUT', body: JSON.stringify(body), headers }, token));
const save = (token, rev, p = profile) => put(token, { rev, profile: p });
const row = (uid) => env.DB.prepare('SELECT updated_at FROM practice_profile WHERE user_id = ?').bind(uid).first();

describe('hồ sơ tu tập #105 trên Worker/D1', () => {
  it('đòi phiên, gắn no-store, đọc hồ sơ trống mà không ghi', async () => {
    for (const r of [await get(), await save(undefined, 0)]) {
      expect(r.status).toBe(401);
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(r.data.error.code).toBe('unauthorized');
    }
    const { token, user } = await guest();
    const r = await get(token);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.data).toEqual(empty);
    expect(await row(user.id)).toBeNull();
  });

  it('chỉ nhận JSON đúng các trường và kiểu của hợp đồng', async () => {
    const { token, user } = await guest();
    const invalid = [
      null, [], {}, { rev: 0 }, { profile }, { profile, rev: '0' }, { profile, rev: -1 },
      { profile, rev: 2 ** 53 }, { profile, rev: 0, note: 'riêng tư' },
      { profile: { ...profile, minutes: undefined }, rev: 0 },
      ...Object.entries({
        minutes: [4, 121, 15.5, '15'], level: ['khac'], time_window: ['sớm'], familiarity: [false, ''],
        uposatha: ['tuy_y'], precepts: [[1, 1], [0], [6], ['1'], [1, 2, 3, 4, 5, 6]],
        no_money: [1], at_home: ['true'], note: ['riêng tư'],
      }).flatMap(([key, values]) => values.map((value) => ({ profile: { ...profile, [key]: value }, rev: 0 }))),
    ];
    const malformed = await json(await call(path, { method: 'PUT', body: '{' }, token));
    const wrongType = await put(token, { profile, rev: 0 }, { 'Content-Type': 'text/plain' });
    for (const r of [malformed, wrongType]) expect(r).toMatchObject({ status: 400, data: { error: { code: 'invalid_practice_profile' } } });
    for (const body of invalid) {
      const r = await put(token, body);
      expect(r.status).toBe(400);
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(r.data.error.code).toBe('invalid_practice_profile');
    }
    expect(await row(user.id)).toBeNull();
  });

  it('lưu, xuất, đọc đúng tài khoản; đổi chu kỳ giữ hồ sơ và rev riêng', async () => {
    const a = await guest(), b = await guest();
    const before = (await json(await call('/api/v1/me', {}, a.token))).data;
    expect((await json(await call('/api/v1/export', {}, a.token))).data.practice_profile).toBeNull();
    const saved = await save(a.token, 0, { ...profile, precepts: [5, 1, 2] });
    expect(saved.status).toBe(200);
    expect(saved.data).toEqual({ profile, rev: expect.any(Number) });
    expect(saved.headers.get('cache-control')).toBe('no-store');
    expect((await get(a.token)).data).toEqual(saved.data);
    expect((await get(b.token, '?user_id=' + a.user.id)).data).toEqual(empty);
    expect((await save(b.token, saved.data.rev)).status).toBe(409);
    expect(await row(b.user.id)).toBeNull();

    const after = (await json(await call('/api/v1/me', {}, a.token))).data;
    expect(after.journey).toEqual(before.journey);
    expect(after.totals).toEqual(before.totals);
    expect(after.profile.rev).toBe(before.profile.rev);
    expect((await json(await call('/api/v1/export', {}, a.token))).data.practice_profile)
      .toEqual({ ...profile, updated_at: saved.data.rev });

    const reset = await sync(a.token, [{ id: 'PROFILE_RESET_' + a.user.id, type: 'journey.reset_cycle', at: Date.now() }]);
    expect(reset.state.journey.cycle).toBe(2);
    expect((await get(a.token)).data).toEqual(saved.data);
  });

  it('hai thiết bị cùng rev chỉ một lượt ghi khi lựa chọn khác nhau', async () => {
    const { token } = await guest();
    const race = async (rev, first, second) => {
      const r = await Promise.all([save(token, rev, first), save(token, rev, second)]);
      expect(r.map((a) => a.status).sort()).toEqual([200, 409]);
      const winner = r.find((a) => a.status === 200).data;
      expect(r.find((a) => a.status === 409).data.error.code).toBe('practice_profile_conflict');
      expect((await get(token)).data).toEqual(winner);
      expect(winner.rev).toBeGreaterThan(rev);
      return winner;
    };
    const created = await race(0, { ...profile, minutes: 5 }, { ...profile, minutes: 120 });
    const updated = await race(created.rev, { ...profile, minutes: 20, precepts: [] }, { ...profile, minutes: 25, precepts: [] });
    const replay = await save(token, created.rev, updated.profile);
    expect(replay.status).toBe(200);
    expect(replay.data).toEqual(updated);
    expect((await save(token, created.rev, created.profile)).status).toBe(409);
  });

  it('hai lần lưu cùng lựa chọn với rev 0 trả về cùng một bản', async () => {
    const { token } = await guest();
    const [a, b] = await Promise.all([save(token, 0), save(token, 0, { ...profile, precepts: [5, 2, 1] })]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.data).toEqual(b.data);
    expect((await get(token)).data).toEqual(a.data);
  });

  it('rev vẫn tăng khi đồng hồ Worker lùi', async () => {
    const { token, user } = await guest();
    const initial = await save(token, 0);
    const later = initial.data.rev + 3_600_000;
    await env.DB.prepare('UPDATE practice_profile SET updated_at = ? WHERE user_id = ?').bind(later, user.id).run();
    const next = await save(token, later, { ...profile, at_home: false });
    expect(next.status).toBe(200);
    expect(next.data.rev).toBe(later + 1);
  });

  it.each([
    { name: 'đích trống, chuyển hành trình', progress: false, configured: false },
    { name: 'đích trống, giữ hành trình đích', progress: true, configured: false },
    { name: 'đích đã có hồ sơ nhưng chưa có tiến trình', progress: false, configured: true },
    { name: 'đích đã có hồ sơ và tiến trình', progress: true, configured: true },
  ])('gộp khách qua mã khôi phục: $name', async ({ progress, configured }) => {
    const target = await guest(progress ? 'Tịnh Lạc' : undefined);
    const existing = configured ? await save(target.token, 0, { ...profile, minutes: 30 }) : null;
    if (existing) expect(existing.status).toBe(200);
    const recovery = await post('/api/auth/recovery-code/generate', target.token);
    expect(recovery.status).toBe(200);
    const moving = await guest();
    const saved = await save(moving.token, 0);
    expect(saved.status).toBe(200);
    const login = await post('/api/auth/sign-in/recovery-code', moving.token, { code: recovery.data.code });
    expect(login.status).toBe(200);
    expect(login.data.user.id).toBe(target.user.id);
    expect((await get(login.data.token)).data).toEqual((existing || saved).data);
    expect(await row(moving.user.id)).toBeNull();
  });

  it('xóa theo vòng đời tài khoản dọn luôn hồ sơ tu tập', async () => {
    const { user, token } = await guest();
    expect((await save(token, 0)).status).toBe(200);
    const deletion = await post('/api/v1/account/delete', token);
    expect(deletion.status).toBe(200);
    await runCron(env, deletion.data.execute_after + 1);
    expect(await row(user.id)).toBeNull();
    expect((await get(token)).status).toBe(401);
  });
});

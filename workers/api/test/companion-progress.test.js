import { expect, it } from 'vitest';
import { companionProgress } from '../src/companions-data.js';
import { call, env, guest, json, sync } from './helpers.js';

const api = (person, path, method = 'GET', body) => call('/api/v1' + path, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
}, person?.token).then(json);
const patch = (person, body) => api(person, '/profile', 'PATCH', body);
const toggle = (person, social) => patch(person, { settings: { dong_tu: social } });
const progress = (viewer, targetId) => api(viewer, '/companions/' + targetId + '/progress');

async function connected() {
  const viewer = await guest('Tuệ An'), friend = await guest();
  expect((await patch(viewer, { look: { height: 1 } })).status).toBe(200);
  const created = await api(viewer, '/companions/link', 'POST', {});
  expect(created.status).toBe(200);
  expect((await api(friend, '/companions/link/' + created.data.code + '/accept', 'POST')).status).toBe(201);
  return { viewer, friend };
}

it('chỉ trả sáu trường tiến trình khi bạn tự bật, che giống nhau khi ẩn hoặc bị chặn', async () => {
  const { viewer, friend } = await connected();
  const stranger = await guest(), target = friend.user.id;
  const denial = await progress(viewer, target);
  expect(denial.status).toBe(404);
  expect(denial.data.error.code).toBe('not_found');
  expect((await progress(null, target)).status).toBe(401);
  expect((await progress(viewer, 'missing-user')).data).toEqual(denial.data);

  await toggle(friend, { chia_se_tien_trinh: true, hien_ngay: false });
  await env.DB.prepare('UPDATE journey SET day = 49, completed_at = ?, sessions_done = 12, sermons_done = 4 WHERE user_id = ?')
    .bind(Date.now(), target).run();
  const visible = await progress(viewer, target);
  expect(visible.status).toBe(200);
  expect(visible.headers.get('cache-control')).toBe('no-store');
  expect(visible.data).toEqual({ cycle: 1, day: 49, completed: true, sessions_done: 12, sermons_done: 4, last_active: null });
  expect((await progress(stranger, target)).data).toEqual(denial.data);

  const hidden = await patch(friend, { visibility: 'an' });
  expect(hidden.data.profile.settings.dong_tu.chia_se_tien_trinh).toBe(false);
  expect((await api(friend, '/me')).data.profile.settings.dong_tu.chia_se_tien_trinh).toBe(false);
  expect((await progress(viewer, target)).data).toEqual(denial.data);
  expect((await patch(friend, { visibility: 'dong_tu' })).data.profile.settings.dong_tu.chia_se_tien_trinh).toBe(true);

  for (const [a, b] of [[viewer.user.id, target], [target, viewer.user.id]]) {
    await env.DB.prepare('INSERT INTO user_block (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)').bind(a, b, Date.now()).run();
    expect((await progress(viewer, target)).data).toEqual(denial.data);
    await env.DB.prepare('DELETE FROM user_block WHERE blocker_id = ? AND blocked_id = ?').bind(a, b).run();
  }
  expect((await progress(viewer, target)).data).toEqual(visible.data);
});

it('cài đặt đồng tu gộp theo khóa trên PATCH và qua đồng bộ cũ', async () => {
  const account = await guest();
  const [sharing, nameSearch] = await Promise.all([
    toggle(account, { chia_se_tien_trinh: true }),
    toggle(account, { cho_tim: false }),
  ]);
  expect(sharing.status).toBe(200);
  expect(nameSearch.status).toBe(200);
  expect((await api(account, '/me')).data.profile.settings.dong_tu).toEqual({ chia_se_tien_trinh: true, cho_tim: false });
  const old = { id: 'old-social-flags', at: Date.now(), type: 'profile.patch', payload: {
    settings: { dong_tu: { hien_trang_thai: false, cho_tim: true, hien_ngay: true } },
  } };
  const result = await sync(account.token, [old]);
  expect(result.applied).toEqual([old.id]);
  expect((await sync(account.token, [old])).applied).toEqual([old.id]);
  expect(result.state.profile.settings.dong_tu).toEqual({
    chia_se_tien_trinh: true, hien_trang_thai: false, cho_tim: true, hien_ngay: true,
  });
  for (const value of [{ chia_se_tien_trinh: 'true' }, { extra: false }, null]) {
    expect(await toggle(account, value)).toMatchObject({ status: 400, data: { error: { code: 'invalid_payload' } } });
  }
  expect((await toggle(account, { chia_se_tien_trinh: false })).data.profile.settings.dong_tu)
    .toEqual({ chia_se_tien_trinh: false, hien_trang_thai: false, cho_tim: true, hien_ngay: true });
});

it('lần tu tập gần nhất phân nhóm theo ngày của người chia sẻ', async () => {
  const { viewer, friend } = await connected();
  await toggle(friend, { chia_se_tien_trinh: true });
  await patch(friend, { tz: 'Asia/Ho_Chi_Minh' });
  const t = Date.parse('2026-11-20T17:30:00Z'); // Ngày 21 ở Việt Nam.
  await env.DB.prepare(`INSERT INTO practice_session (id, user_id, kind, place, started_at, duration_s, completed, server_at)
    VALUES ('activity-fixture', ?, 'thien15', 'pad', ?, 900, 1, ?)`).bind(friend.user.id, t, t).run();
  const day = 86_400_000;
  for (const [now, wanted] of [[t + 23 * 3_600_000, 'hom_nay'], [t + day, 'hom_qua'], [t + 6 * day, 'trong_tuan'], [t + 7 * day, 'lau_hon']]) {
    expect((await companionProgress(env.DB, viewer.user.id, friend.user.id, now)).last_active).toBe(wanted);
  }
});

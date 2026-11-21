import { expect, it } from 'vitest';
import { linkGuest } from '../src/auth/link.js';
import { INVITE_MS } from '../src/routes/attestation.js';
import { call, env, guest, json, sync } from './helpers.js';

const base = '/api/v1/attest';
const input = () => ({ week: 1, op_id: crypto.randomUUID() });
const invite = (token, body) => call(base + '/invite', { method: 'POST', body: JSON.stringify(body) }, token).then(json);
const endOfWeek = (id, week = 1) => env.DB.prepare('UPDATE journey SET day = ? WHERE user_id = ?').bind(week * 7, id).run();
const readWeeks = (token) => call(base, {}, token).then(json);
const redeem = (token, body) => call(base + '/link', {
  ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  headers: { Authorization: `Bearer ${token}` },
}).then(json);
const tokenOf = ({ data }) => new URLSearchParams(data.link.split('#')[1]).get('attest');
const exportData = (token) => call('/api/v1/export', {}, token).then(json).then((r) => r.data);

it('chỉ mở một lời mời vào cuối tuần và cho gửi lại cùng thao tác', async () => {
  expect((await invite(undefined, input())).status).toBe(401);
  const { token, user } = await guest();
  const a = input(), b = input();
  expect((await invite(token, a)).data.error.code).toBe('attest_week_not_due');
  await endOfWeek(user.id);
  const race = await Promise.all([invite(token, a), invite(token, b)]);
  expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
  const won = race.findIndex((r) => r.status === 201);
  const created = race[won];
  expect(created.data.link).toMatch(/^\/#attest=[A-Za-z0-9_-]{43}$/);
  expect(created.headers.get('cache-control')).toBe('no-store');
  expect((await invite(token, [a, b][won])).data).toEqual(created.data);
  const row = await env.DB.prepare('SELECT token_hash, created_at FROM attestation WHERE user_id = ?').bind(user.id).first();
  const secret = tokenOf(created);
  expect(row.token_hash).not.toBe(secret);
  expect(created.data.expires_at - row.created_at).toBe(INVITE_MS);
  expect(await redeem(secret)).toMatchObject({ status: 200, data: { week: 1, expires_at: created.data.expires_at } });
  expect(Object.keys((await redeem(secret)).data)).toEqual(['week', 'expires_at']);
});

it('người thân chưa đăng nhập dùng được một lần, và ghi chú chỉ hiện cho chủ', async () => {
  const owner = await guest(), other = await guest();
  await endOfWeek(owner.user.id);
  const secret = tokenOf(await invite(owner.token, input()));
  expect((await redeem(secret, { accept: true, note: 'ệ'.repeat(301) })).status).toBe(400);
  const answer = { accept: true, attester_label: 'nguoi_than', note: 'Dạo này bạn lắng nghe tôi kỹ hơn.' };
  const results = await Promise.all([redeem(secret, answer), redeem(secret, answer)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
  expect((await redeem(secret)).status).toBe(404);
  const data = (await exportData(owner.token)).attestations[0];
  expect(data).toMatchObject({ cycle: 1, week: 1, status: 'da_xac_nhan', note: answer.note, attester_label: 'nguoi_than' });
  expect(data).not.toHaveProperty('token_hash');
  expect((await exportData(other.token)).attestations).toEqual([]);
  expect((await readWeeks(other.token)).data).toEqual({ cycle: 1, weeks: [] });
  await linkGuest(env.DB, owner.user, other.user);
  expect((await exportData(other.token)).attestations).toEqual([data]);
  await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(other.user.id).run();
  expect(await env.DB.prepare('SELECT id FROM attestation WHERE user_id = ?').bind(other.user.id).first()).toBeNull();
});

it('chỉ người mời có phiên đọc kết quả, đủ bốn trạng thái theo thứ tự tuần', async () => {
  const { token, user } = await guest();
  expect((await readWeeks()).status).toBe(401);
  expect((await readWeeks(token)).data).toEqual({ cycle: 1, weeks: [] });

  const invitations = [];
  for (const week of [1, 2, 3, 4]) {
    await endOfWeek(user.id, week);
    const response = await invite(token, { ...input(), week });
    expect(response.status).toBe(201);
    invitations.push(response);
  }
  expect((await readWeeks(tokenOf(invitations[0]))).status).toBe(401);
  expect((await redeem(tokenOf(invitations[1]), { accept: true, attester_label: 'ban_be', note: 'Bạn lắng nghe.' })).status).toBe(200);
  expect((await redeem(tokenOf(invitations[2]), { accept: false })).status).toBe(200);
  const expiredCreatedAt = Date.now() - INVITE_MS;
  await env.DB.prepare('UPDATE attestation SET created_at = ? WHERE user_id = ? AND week IN (2, 4)')
    .bind(expiredCreatedAt, user.id).run();

  const response = await readWeeks(token);
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.data).toEqual({ cycle: 1, weeks: [
    { week: 1, status: 'cho', expires_at: invitations[0].data.expires_at, attester_label: null, note: null, confirmed_at: null },
    { week: 2, status: 'da_xac_nhan', expires_at: expiredCreatedAt + INVITE_MS, attester_label: 'ban_be', note: 'Bạn lắng nghe.', confirmed_at: expect.any(Number) },
    { week: 3, status: 'tu_choi', expires_at: invitations[2].data.expires_at, attester_label: null, note: null, confirmed_at: expect.any(Number) },
    { week: 4, status: 'het_han', expires_at: expiredCreatedAt + INVITE_MS, attester_label: null, note: null, confirmed_at: null },
  ] });
});

it.each(['expired', 'reset'])('liên kết hết hiệu lực khi %s', async (how) => {
  const owner = await guest();
  await endOfWeek(owner.user.id);
  const secret = tokenOf(await invite(owner.token, input()));
  if (how === 'expired') {
    await env.DB.prepare('UPDATE attestation SET created_at = ? WHERE user_id = ?').bind(Date.now() - INVITE_MS, owner.user.id).run();
  } else {
    await sync(owner.token, [{ id: 'reset-attestation', type: 'journey.reset_cycle', at: Date.now() }]);
    expect((await readWeeks(owner.token)).data).toEqual({ cycle: 2, weeks: [] });
  }
  expect((await redeem(secret)).status).toBe(404);
  expect((await redeem(secret, { accept: true })).status).toBe(404);
  expect((await exportData(owner.token)).attestations[0].status).toBe('het_han');
});

// Cron dọn dữ liệu (src/cron.js): xóa tài khoản theo yêu cầu sau 7 ngày, dọn khách không hoạt động 90 ngày,
// sync_op quá 30 ngày, phiên và mã hết hạn. Tài khoản đã gắn mã khôi phục/passkey không bị dọn.
import { describe, it, expect } from 'vitest';
import { createScheduledController, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import app from '../src/index.js';
import { runCron, DAY } from '../src/cron.js';
import { env, call, guest, sync, confirm } from './helpers.js';

const n = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).first()).n;
const exists = async (uid) => (await n('SELECT COUNT(*) AS n FROM user WHERE id = ?', uid)) === 1;

describe('cron', () => {
  it('thực thi yêu cầu xóa đã quá 7 ngày; yêu cầu chưa tới hạn giữ nguyên', async () => {
    const a = await guest('Tâm An'), b = await guest();
    await sync(a.token, [confirm('A1', Date.now(), 1, 'duc')]);
    await call('/api/v1/account/delete', { method: 'POST', body: '{}' }, a.token);
    await call('/api/v1/account/delete', { method: 'POST', body: '{}' }, b.token);
    const r = await runCron(env, Date.now() + 7 * DAY + 60_000);   // hơn 7 ngày sau: a và b đều tới hạn
    expect(r.deleted_requested).toBe(2);
    expect(await exists(a.user.id)).toBe(false);
    expect(await n('SELECT COUNT(*) AS n FROM kusala_entry WHERE user_id = ?', a.user.id)).toBe(0);
    expect(await n('SELECT COUNT(*) AS n FROM sync_op WHERE user_id = ?', a.user.id)).toBe(0);
    expect(await n('SELECT COUNT(*) AS n FROM deletion_request')).toBe(0);
    const c = await guest();
    await call('/api/v1/account/delete', { method: 'POST', body: '{}' }, c.token);
    expect((await runCron(env, Date.now() + DAY)).deleted_requested).toBe(0);
    expect(await exists(c.user.id)).toBe(true);
  });

  it('khách không hoạt động 90 ngày bị dọn; tài khoản đã có mã khôi phục được giữ; /me báo trước hạn', async () => {
    const idle = await guest(), kept = await guest();
    await call('/api/auth/recovery-code/generate', { method: 'POST', body: '{}' }, kept.token);
    const me = await (await call('/api/v1/me', {}, idle.token)).json();
    expect(me.guest_purge_after).toBeGreaterThan(Date.now() + 89 * DAY);
    expect((await (await call('/api/v1/me', {}, kept.token)).json()).guest_purge_after).toBeNull();
    expect((await runCron(env, Date.now() + 30 * DAY)).deleted_idle_guests).toBe(0);
    const r = await runCron(env, Date.now() + 91 * DAY);
    expect(r.deleted_idle_guests).toBeGreaterThanOrEqual(1);
    expect(await exists(idle.user.id)).toBe(false);
    expect(await exists(kept.user.id)).toBe(true);
  });

  it('dọn sync_op quá 30 ngày, phiên và mã dùng một lần đã hết hạn', async () => {
    const g = await guest();
    await call('/api/auth/recovery-code/generate', { method: 'POST', body: '{}' }, g.token);
    await sync(g.token, [confirm('S1', Date.now(), 1, 'duc')]);
    await call('/api/auth/device-link/start', { method: 'POST', body: '{}' });
    const r = await runCron(env, Date.now() + 31 * DAY);
    expect(r.sync_ops).toBeGreaterThanOrEqual(1);
    expect(r.sessions).toBeGreaterThanOrEqual(1);   // phiên 30 ngày đã hết hạn
    expect(r.verifications).toBeGreaterThanOrEqual(1);
    expect(await n('SELECT COUNT(*) AS n FROM kusala_entry WHERE user_id = ?', g.user.id)).toBe(1);   // dữ liệu tu tập giữ nguyên
  });

  it('Worker có handler scheduled', async () => {
    const ctrl = createScheduledController({ scheduledTime: Date.now(), cron: '17 19 * * *' }), ctx = createExecutionContext();
    await app.scheduled(ctrl, env, ctx);
    await waitOnExecutionContext(ctx);
  });
});

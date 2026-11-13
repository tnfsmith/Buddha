// Gộp dữ liệu khi khách đăng nhập vào tài khoản đã có (onLinkAccount, PROJECT_ROADMAP.md §6.1 bước 5)
import { describe, it, expect } from 'vitest';
import { linkGuest, hasProgress } from '../src/auth/link.js';
import { env, call, guest, sync, confirm } from './helpers.js';

const me = async (t) => (await call('/api/v1/me', {}, t)).json();
const row = (sql, ...a) => env.DB.prepare(sql).bind(...a).first();

describe('linkGuest', () => {
  it('đích chưa có tiến trình: chuyển nguyên hành trình của khách sang', async () => {
    const g = await guest('Tâm An'), t = await guest();
    await sync(g.token, [confirm('G1', Date.now(), 1, 'duc')]);
    expect(await hasProgress(env.DB, t.user.id)).toBe(false);
    expect(await linkGuest(env.DB, g.user, { ...t.user, isAnonymous: false })).toEqual({ moved: 'guest' });
    const m = await me(t.token);
    expect(m.profile.tinh_danh).toBe('Tâm An');
    expect(m.totals.duc).toBe(10);
    expect((await row('SELECT COUNT(*) AS n FROM kusala_entry WHERE user_id = ?', g.user.id)).n).toBe(0);
  });

  it('đích đã có tiến trình: giữ bản đã lưu, hành trình khách thành chu kỳ cũ, không mất dữ liệu', async () => {
    const g = await guest(), t = await guest('Tịnh Lạc');
    await sync(g.token, [confirm('G2', Date.now(), 1, 'thien')]);
    await sync(t.token, [confirm('T2', Date.now(), 1, 'duc')]);
    expect(await linkGuest(env.DB, g.user, { ...t.user, isAnonymous: false })).toEqual({ moved: 'archive' });
    const m = await me(t.token);
    expect(m.profile.tinh_danh).toBe('Tịnh Lạc');
    expect(m.journey.cycle).toBe(1);
    expect(m.totals).toMatchObject({ duc: 10, thien: 0 });   // tổng tính trên hành trình hiện tại
    const old = await row('SELECT cycle, is_current FROM journey WHERE user_id = ? AND cycle = 2', t.user.id);
    expect(old).toEqual({ cycle: 2, is_current: 0 });
    expect((await row("SELECT COUNT(*) AS n FROM kusala_entry WHERE user_id = ? AND cycle = 2 AND pillar = 'thien'", t.user.id)).n).toBe(1);
  });

  it('đích vẫn là khách: xóa tài khoản khách cũ sau khi gộp', async () => {
    const g = await guest(), t = await guest();
    await linkGuest(env.DB, g.user, t.user);
    expect(await row('SELECT id FROM user WHERE id = ?', g.user.id)).toBeNull();
    expect((await call('/api/v1/me', {}, g.token)).status).toBe(401);
  });
});

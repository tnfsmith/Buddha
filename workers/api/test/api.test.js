// workers/api/test/api.test.js — các đường API chính (T2.1, T2.2), chạy trong workerd với D1 thật
import { describe, it, expect } from 'vitest';
import { verifyHmac } from '../src/utils/crypto.js';
import { env, call, json, guest, sync } from './helpers.js';

describe('Vân Đạo API', () => {
  it('GET /api/health', async () => {
    const r = await json(await call('/api/health'));
    expect(r.status).toBe(200);
    expect(r.data).toMatchObject({ status: 'ok', service: 'vandao-api' });
  });

  it('Better Auth: khách ẩn danh có phiên, cookie vd.*, token bearer; hồ sơ + hành trình ngày 1 tạo sẵn', async () => {
    const { token, user, res } = await guest();
    expect(user.isAnonymous).toBe(true);
    expect(token).toBeTruthy();
    expect(res.headers.get('set-auth-token')).toBeTruthy();
    expect(res.headers.get('set-cookie')).toMatch(/vd\.session_token=.*HttpOnly/i);
    const me = await json(await call('/api/v1/me', {}, token));
    expect(me.status).toBe(200);
    expect(me.data.profile.tinh_danh).toBeNull();
    expect(me.data.journey).toMatchObject({ program: 'so-nhap-49', cycle: 1, day: 1 });
    expect(me.data.totals).toEqual({ duc: 0, thien: 0, tue: 0, all: 0 });
    expect(me.data.unlocked_zones.tea).toBe(false);
    // ULID cho mọi định danh (§4.1)
    expect(user.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('GET /api/auth/get-session và POST /api/auth/sign-out (Better Auth)', async () => {
    const { token } = await guest();
    const s = await json(await call('/api/auth/get-session', {}, token));
    expect(s.data.user.isAnonymous).toBe(true);
    expect((await call('/api/auth/sign-out', { method: 'POST', body: '{}' }, token)).status).toBe(200);
    expect((await call('/api/v1/me', {}, token)).status).toBe(401);
  });

  it('không có phiên → 401', async () => {
    expect((await call('/api/v1/me')).status).toBe(401);
    expect((await call('/api/v1/me', {}, 'gia-mao')).status).toBe(401);
  });

  it('PATCH /api/v1/profile nhận múi giờ trình duyệt báo (kể cả UTC, Asia/Saigon), từ chối chuỗi không phải vùng', async () => {
    for (const tz of ['+07:00', 'Không/Có', '', 'Asia/Khong_Co']) {
      const { token } = await guest();
      expect((await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tz }) }, token)).status, tz).toBe(400);
    }
    for (const tz of ['UTC', 'Asia/Saigon', 'America/Argentina/Buenos_Aires']) {
      const { token } = await guest();
      const r = await json(await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tz }) }, token));
      expect(r.status, tz).toBe(200); expect(r.data.profile.tz).toBe(tz);
    }
  });

  it('PATCH /api/v1/profile kiểm 4 quy tắc Tịnh danh', async () => {
    const { token } = await guest();
    expect((await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: 'Đại Đức Minh' }) }, token)).status).toBe(400);
    const ok = await json(await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: 'Tịnh Lạc' }) }, token));
    expect(ok.status).toBe(200);
    expect(ok.data.profile.tinh_danh).toBe('Tịnh Lạc');
  });

  it('sync: máy chủ tự tính Kusala, gửi lại trùng không ghi thêm', async () => {
    const { token } = await guest();
    const op = { id: '01TEST_KUSALA_OP_001', type: 'kusala.confirm', at: Date.now(), payload: { day: 1, pillar: 'duc', pre: 1.0, during: 1.2, post: 0.8, wise: 1, self: 1 } };
    const a = await sync(token, [op]);
    expect(a.applied).toContain(op.id);
    expect(a.state.totals.duc).toBe(18.75);   // 10 × 1 × 1,5 × 1,25
    const b = await sync(token, [op]);
    expect(b.applied).toContain(op.id);
    expect(b.rejected).toEqual([]);
    expect(b.state.totals.duc).toBe(18.75);
  });

  it('sync: không nhảy ngày; "Trở về ngày 1" mở chu kỳ mới', async () => {
    const { token } = await guest();
    const cheat = await sync(token, [{ id: '01TEST_CHEAT', type: 'kusala.confirm', at: Date.now(), payload: { day: 5, pillar: 'duc' } }]);
    expect(cheat.rejected).toEqual([{ id: '01TEST_CHEAT', code: 'day_locked', retry: false }]);
    const reset = await sync(token, [{ id: '01TEST_RESET', type: 'journey.reset_cycle', at: Date.now() }]);
    expect(reset.state.journey).toMatchObject({ cycle: 2, day: 1 });
  });

  it('GET /api/v1/export (BVDLCN 91/2025)', async () => {
    const { token } = await guest('Tâm An');
    const r = await json(await call('/api/v1/export', {}, token));
    expect(r.status).toBe(200);
    expect(r.data.profile.tinh_danh).toBe('Tâm An');
    expect(Array.isArray(r.data.journeys)).toBe(true);
    expect(Array.isArray(r.data.kusala_entries)).toBe(true);
  });

  it('yêu cầu và hủy yêu cầu xóa tài khoản', async () => {
    const { token } = await guest();
    const d = await json(await call('/api/v1/account/delete', { method: 'POST', body: '{}' }, token));
    expect(d.data.success).toBe(true);
    expect(d.data.execute_after).toBeGreaterThan(Date.now());
    const c = await json(await call('/api/v1/account/delete', { method: 'DELETE' }, token));
    expect(c.data.cancelled).toBe(true);
  });

  it('POST /api/v1/rt/ticket: vé HMAC hợp lệ', async () => {
    const { token } = await guest();
    const r = await json(await call('/api/v1/rt/ticket', { method: 'POST', body: JSON.stringify({ room: 'hall:t1:s1' }) }, token));
    expect(r.status).toBe(200);
    expect(r.data.ws_url).toContain('/ws/hall%3At1%3As1');
    const bin = atob(r.data.ticket.replace(/-/g, '+').replace(/_/g, '/'));
    const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0))));
    expect(await verifyHmac(env.RT_SECRET, decoded.p, decoded.s)).toBe(true);
  });
});

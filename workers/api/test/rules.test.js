// Kiểm thử các luật bất biến ở máy chủ (AGENTS.md §1): Tịnh danh không tự đặt, Kusala chỉ nhận hệ số 0,5–1,2,
// khóa 1 nấc mỗi ngày kể cả khi đồng bộ dồn nhiều ngày ngoại tuyến, CORS chỉ mở cho nguồn của Vân Đạo.
import { describe, it, expect } from 'vitest';
import app from '../src/index.js';
import { getLocalDate } from '../src/utils/time.js';
import { env, call, guest, sync, confirm, DAY, TZ } from './helpers.js';

describe('Tịnh danh', () => {
  it('khách ẩn danh không được máy chủ tự đặt Tịnh danh', async () => {
    const { token } = await guest();
    const me = await (await call('/api/v1/me', {}, token)).json();
    expect(me.profile.tinh_danh).toBeNull();
  });
  it('Tịnh danh sai quy tắc bị từ chối, kèm quy tắc chưa đạt', async () => {
    const { token } = await guest();
    const r = await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: 'Phật Tổ' }) }, token);
    expect(r.status).toBe(400);
    const d = await r.json();
    expect(d.error.code).toBe('invalid_name');
    expect(d.error.message).toMatch(/quả vị/);
  });
  it('đặt tên lần đầu không tính giới hạn 30 ngày; lần đổi kế tiếp mới tính', async () => {
    const { token: t } = await guest();
    expect((await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: 'Tịnh Lạc' }) }, t)).status).toBe(200);
    expect((await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: 'An Nhiên' }) }, t)).status).toBe(200);
    expect((await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: 'Tuệ Quang' }) }, t)).status).toBe(429);
  });
});

describe('Kusala và khóa ngày', () => {
  it('hệ số ngoài 0,5–1,2 bị từ chối vĩnh viễn, không cộng điểm', async () => {
    const { token } = await guest(), r = await sync(token, [confirm('OP_FACTOR', Date.now(), 1, 'duc', { pre: 1000 })]);
    expect(r.rejected).toEqual([{ id: 'OP_FACTOR', code: 'invalid_factor', retry: false }]);
    expect(r.state.totals.all).toBe(0);
  });

  it('đồng bộ dồn 3 ngày ngoại tuyến: mỗi ngày tiến đúng 1 nấc, không nhảy ngày trong cùng một ngày', async () => {
    const { token: t } = await guest(), now = Date.now();
    // hành trình bắt đầu 3 ngày trước (giả lập dùng ngoại tuyến từ trước khi đồng bộ)
    await env.DB.prepare('UPDATE journey SET started_on = ?').bind(getLocalDate(now - 3 * DAY, TZ)).run();
    const d2 = now - 2 * DAY, d1 = now - DAY, ops = [];
    ['duc', 'thien', 'tue'].forEach((p, i) => ops.push(confirm(`D1_${p}`, d2 + i * 1000, 1, p)));
    ['duc', 'thien', 'tue'].forEach((p, i) => ops.push(confirm(`D2_${p}`, d1 + i * 1000, 2, p)));
    ops.push(confirm('D3_SAME_DAY', d1 + 5000, 3, 'duc'));   // cùng ngày lịch với ngày 2 → chưa được sang ngày 3
    const r = await sync(t, ops);
    expect(r.applied).toHaveLength(6);
    expect(r.rejected).toEqual([{ id: 'D3_SAME_DAY', code: 'day_locked', retry: false }]);
    // hôm nay đủ điều kiện sang ngày 3 (ngày 2 đủ ba trục, ngày xác nhận gần nhất là hôm qua)
    expect(r.state.journey.day).toBe(3);
    expect(r.state.totals.all).toBe(60);
  });

  it('thao tác có ngày trước khi bắt đầu hành trình bị từ chối', async () => {
    const { token } = await guest(), r = await sync(token, [confirm('OP_OLD', Date.now() - 2 * DAY, 1, 'duc')]);
    expect(r.rejected[0]).toMatchObject({ id: 'OP_OLD', code: 'before_start', retry: false });
  });

  it('GET /me tự tiến ngày tới hôm nay theo luật chung', async () => {
    const { token: t } = await guest(), now = Date.now();
    await env.DB.prepare('UPDATE journey SET started_on = ?').bind(getLocalDate(now - 2 * DAY, TZ)).run();
    await sync(t, ['duc', 'thien', 'tue'].map((p, i) => confirm(`Y_${p}`, now - DAY + i, 1, p)));
    const me = await (await call('/api/v1/me', {}, t)).json();
    expect(me.journey.day).toBe(2);
  });
});

describe('Bảo vệ API', () => {
  it('body JSON sai trả 400, không phải 500', async () => {
    const { token } = await guest();
    const r = await call('/api/v1/sync', { method: 'POST', body: '{khong-phai-json' }, token);
    expect(r.status).toBe(400);
  });
  it('/api/* không tồn tại trả 404 JSON thay vì trang SPA', async () => {
    const r = await call('/api/v1/khong-co');
    expect(r.status).toBe(404);
    expect((await r.json()).error.code).toBe('not_found');
  });
  it('CORS chỉ mở cho nguồn của Vân Đạo', async () => {
    const pre = (origin) => app.request('/api/v1/me', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' } }, env);
    expect((await pre('https://evil.example')).status).toBe(403);
    const ok = await pre('https://pr-15-vandao-staging.vandao-staging.workers.dev');
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe('https://pr-15-vandao-staging.vandao-staging.workers.dev');
  });
  it('thiếu RT_SECRET thì không cấp vé phòng thời gian thực', async () => {
    const { token } = await guest();
    const r = await app.request('/api/v1/rt/ticket', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }, { ...env, RT_SECRET: undefined });
    expect(r.status).toBe(503);
  });
});

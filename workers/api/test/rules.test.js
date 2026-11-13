// Kiểm thử các luật bất biến ở máy chủ (AGENTS.md §1): Tịnh danh không tự đặt, Kusala chỉ nhận hệ số 0,5–1,2,
// khóa 1 nấc mỗi ngày kể cả khi đồng bộ dồn nhiều ngày ngoại tuyến, CORS chỉ mở cho nguồn của Vân Đạo.
import { describe, it, expect, beforeEach } from 'vitest';
import app from '../src/index.js';
import { createTestD1 } from './d1-mock.js';
import { getLocalDate } from '../src/utils/time.js';

const DAY = 24 * 60 * 60 * 1000, TZ = 'Asia/Ho_Chi_Minh';
let env;
beforeEach(() => { env = { DB: createTestD1() }; });

const call = (path, init = {}, token) => app.request(path, {
  ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
}, env);
async function guest(body) { const r = await call('/api/auth/sign-in/anonymous', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }); return { res: r, data: await r.json() }; }
const sync = async (token, ops) => (await call('/api/v1/sync', { method: 'POST', body: JSON.stringify({ ops }) }, token)).json();
const confirm = (id, at, day, pillar, extra = {}) => ({ id, type: 'kusala.confirm', at, payload: { day, pillar, pre: 1, during: 1, post: 1, ...extra } });

describe('Tịnh danh', () => {
  it('khách ẩn danh không được máy chủ tự đặt Tịnh danh', async () => {
    const { res, data } = await guest();
    expect(res.status).toBe(201);
    expect(data.profile.tinh_danh).toBeNull();
  });
  it('Tịnh danh sai quy tắc khi tạo khách bị từ chối, kèm quy tắc chưa đạt', async () => {
    const { res, data } = await guest({ tinh_danh: 'Phật Tổ' });
    expect(res.status).toBe(400);
    expect(data.error.code).toBe('invalid_name');
    expect(data.error.message).toMatch(/quả vị/);
  });
  it('đặt tên lần đầu không tính giới hạn 30 ngày; lần đổi kế tiếp mới tính', async () => {
    const { data } = await guest(), t = data.session.token;
    expect((await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: 'Tịnh Lạc' }) }, t)).status).toBe(200);
    expect((await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: 'An Nhiên' }) }, t)).status).toBe(200);
    expect((await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: 'Tuệ Quang' }) }, t)).status).toBe(429);
  });
});

describe('Kusala và khóa ngày', () => {
  it('hệ số ngoài 0,5–1,2 bị từ chối vĩnh viễn, không cộng điểm', async () => {
    const { data } = await guest(), r = await sync(data.session.token, [confirm('OP_FACTOR', Date.now(), 1, 'duc', { pre: 1000 })]);
    expect(r.rejected).toEqual([{ id: 'OP_FACTOR', code: 'invalid_factor', retry: false }]);
    expect(r.state.totals.all).toBe(0);
  });

  it('đồng bộ dồn 3 ngày ngoại tuyến: mỗi ngày tiến đúng 1 nấc, không nhảy ngày trong cùng một ngày', async () => {
    const { data } = await guest(), t = data.session.token, now = Date.now();
    // hành trình bắt đầu 3 ngày trước (giả lập dùng ngoại tuyến từ trước khi đồng bộ)
    env.DB._rawDb.prepare('UPDATE journey SET started_on = ?').run(getLocalDate(now - 3 * DAY, TZ));
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
    const { data } = await guest(), r = await sync(data.session.token, [confirm('OP_OLD', Date.now() - 2 * DAY, 1, 'duc')]);
    expect(r.rejected[0]).toMatchObject({ id: 'OP_OLD', code: 'before_start', retry: false });
  });

  it('GET /me tự tiến ngày tới hôm nay theo luật chung', async () => {
    const { data } = await guest(), t = data.session.token, now = Date.now();
    env.DB._rawDb.prepare('UPDATE journey SET started_on = ?').run(getLocalDate(now - 2 * DAY, TZ));
    await sync(t, ['duc', 'thien', 'tue'].map((p, i) => confirm(`Y_${p}`, now - DAY + i, 1, p)));
    const me = await (await call('/api/v1/me', {}, t)).json();
    expect(me.journey.day).toBe(2);
  });
});

describe('Bảo vệ API', () => {
  it('body JSON sai trả 400, không phải 500', async () => {
    const { data } = await guest();
    const r = await call('/api/v1/sync', { method: 'POST', body: '{khong-phai-json' }, data.session.token);
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
    const { data } = await guest();
    const r = await call('/api/v1/rt/ticket', { method: 'POST', body: '{}' }, data.session.token);
    expect(r.status).toBe(503);
  });
});

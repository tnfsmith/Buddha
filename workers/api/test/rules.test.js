// Kiểm thử các luật bất biến ở máy chủ (AGENTS.md §1): Tịnh danh không tự đặt, Kusala chỉ nhận hệ số 0,5–1,2,
// khóa 1 nấc mỗi ngày kể cả khi đồng bộ dồn nhiều ngày ngoại tuyến, CORS chỉ mở cho nguồn của Vân Đạo.
import { describe, it, expect, vi } from 'vitest';
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

  it('đồng hồ thiết bị qua nửa đêm trước máy chủ: giữ sổ trong hàng chờ rồi ghi một lần qua ngày', async () => {
    const before = Date.parse('2026-11-18T23:59:30+07:00'), after = before + 60_000;
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(before);
      const { token, user } = await guest();
      const today = await sync(token, ['duc', 'thien', 'tue'].map((p, i) => confirm(`MIDNIGHT_DAY1_${p}`, before + i, 1, p)));
      expect(today.applied).toHaveLength(3); // lệch nhẹ nhưng vẫn trong cùng ngày
      const op = confirm('MIDNIGHT_DAY2_DUC', after, 2, 'duc');
      const waiting = await sync(token, [op]);
      expect(waiting.applied).toEqual([]);
      expect(waiting.rejected).toEqual([{ id: op.id, code: 'day_locked', retry: true }]);
      expect(waiting.state.journey).toMatchObject({ day: 1, rev: today.state.journey.rev });
      expect(waiting.state.totals.all).toBe(30);
      expect(await env.DB.prepare('SELECT 1 FROM sync_op WHERE user_id = ? AND op_id = ?').bind(user.id, op.id).first()).toBeNull();
      vi.setSystemTime(after);
      const accepted = await sync(token, [op]);
      expect(accepted.applied).toEqual([op.id]);
      expect(accepted.state.journey.day).toBe(2);
      expect((await sync(token, [op])).state.totals.all).toBe(40);
    } finally { vi.useRealTimers(); }
  });

  it('chu kỳ mới và thao tác nối sau cùng chờ ngày của máy chủ', async () => {
    const before = Date.parse('2026-11-18T23:59:30+07:00'), after = before + 60_000;
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(before);
      const { token, user } = await guest();
      const ops = [
        { id: 'MIDNIGHT_RESET', type: 'journey.reset_cycle', at: after },
        confirm('MIDNIGHT_NEW_DAY1_DUC', after + 1, 1, 'duc'),
      ];
      const waiting = await sync(token, ops);
      expect(waiting.rejected).toEqual(ops.map(({ id }) => ({ id, code: 'day_locked', retry: true })));
      expect(waiting.state.journey).toMatchObject({ cycle: 1, started_on: '2026-11-18' });
      expect(waiting.state.totals.all).toBe(0);
      vi.setSystemTime(after + 1);
      const accepted = await sync(token, ops);
      expect(accepted.applied).toEqual(ops.map(({ id }) => id));
      expect(accepted.state.journey).toMatchObject({ cycle: 2, started_on: '2026-11-19' });
      expect(await env.DB.prepare('SELECT cycle, local_date FROM kusala_entry WHERE user_id = ?').bind(user.id).first())
        .toEqual({ cycle: 2, local_date: '2026-11-19' });
    } finally { vi.useRealTimers(); }
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

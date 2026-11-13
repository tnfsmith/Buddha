// workers/api/test/api.test.js
// Bộ kiểm thử tự động toàn diện cho Vân Đạo API (GĐ2 T2.1, T2.2)
import { describe, it, expect, beforeEach } from 'vitest';
import { Buffer } from 'node:buffer';
import app from '../src/index.js';
import { createTestD1 } from './d1-mock.js';
import { verifyHmac } from '../src/utils/crypto.js';

describe('Vân Đạo API & D1 Database Test Suite', () => {
  let db;
  let env;

  beforeEach(() => {
    db = createTestD1();
    env = {
      DB: db,
      RT_SECRET: 'test-shared-secret-123'
    };
  });

  it('GET /api/health trả về status ok', async () => {
    const res = await app.request('/api/health', {}, env);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.service).toBe('vandao-api');
  });

  it('POST /api/auth/sign-in/anonymous tạo khách ẩn danh thành công', async () => {
    const res = await app.request('/api/auth/sign-in/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tinh_danh: 'Tuệ Quang' })
    }, env);

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user.id).toBeDefined();
    expect(data.user.isAnonymous).toBe(true);
    expect(data.session.token).toBeDefined();
    expect(data.profile.tinh_danh).toBe('Tuệ Quang');
    expect(data.journey.program).toBe('so-nhap-49');
    expect(data.journey.day).toBe(1);

    // Kiểm tra Set-Cookie header
    const cookie = res.headers.get('Set-Cookie');
    expect(cookie).toContain('vd_session=');
    expect(cookie).toContain('HttpOnly');
  });

  it('GET /api/v1/me trả về đầy đủ hồ sơ, hành trình và tổng Kusala', async () => {
    // 1. Tạo user ẩn danh
    const authRes = await app.request('/api/auth/sign-in/anonymous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tinh_danh: 'Chánh Tâm' })
    }, env);
    const authData = await authRes.json();
    const token = authData.session.token;

    // 2. Gọi GET /api/v1/me với Bearer token
    const meRes = await app.request('/api/v1/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    }, env);

    expect(meRes.status).toBe(200);
    const meData = await meRes.json();
    expect(meData.profile.tinh_danh).toBe('Chánh Tâm');
    expect(meData.journey.day).toBe(1);
    expect(meData.totals).toEqual({ duc: 0, thien: 0, tue: 0, all: 0 });
    expect(meData.unlocked_zones.tea).toBe(false);
  });

  it('PATCH /api/v1/profile kiểm tra quy tắc Tịnh danh và múi giờ', async () => {
    const authRes = await app.request('/api/auth/sign-in/anonymous', { method: 'POST' }, env);
    const { session } = await authRes.json();
    const headers = {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    };

    // Tên không hợp lệ (vi phạm 4 quy tắc: tự phong danh hiệu)
    const badNameRes = await app.request('/api/v1/profile', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ tinh_danh: 'Đại Đức Minh' })
    }, env);
    expect(badNameRes.status).toBe(400);

    // Tên hợp lệ (có chữ tu tập, 2-3 chữ)
    const goodNameRes = await app.request('/api/v1/profile', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ tinh_danh: 'Tịnh Lạc' })
    }, env);
    expect(goodNameRes.status).toBe(200);
    const goodData = await goodNameRes.json();
    expect(goodData.profile.tinh_danh).toBe('Tịnh Lạc');
  });

  describe('POST /api/v1/sync - Đồng bộ Offline-first & Khóa ngày', () => {
    it('Tính lại Kusala độc lập ở máy chủ và chống ghi trùng (idempotency)', async () => {
      const authRes = await app.request('/api/auth/sign-in/anonymous', { method: 'POST' }, env);
      const { session } = await authRes.json();
      const headers = {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      };

      const now = Date.now();
      const op1 = {
        id: '01TEST_KUSALA_OP_001',
        type: 'kusala.confirm',
        at: now,
        payload: {
          program: 'so-nhap-49',
          cycle: 1,
          day: 1,
          pillar: 'duc',
          pre: 1.0,
          during: 1.2,
          post: 0.8,
          wise: 1, // x1.5
          self: 1  // x1.25
        }
      };

      // Gửi lần 1
      const sync1 = await app.request('/api/v1/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ops: [op1] })
      }, env);

      expect(sync1.status).toBe(200);
      const sync1Data = await sync1.json();
      expect(sync1Data.applied).toContain('01TEST_KUSALA_OP_001');

      // Máy chủ tính lại: 10 * ((1.0 + 1.2 + 0.8) / 3) * 1.5 * 1.25 = 18.75 (làm tròn 2 chữ số như client)
      expect(sync1Data.state.totals.duc).toBe(18.75);

      // Gửi lại cùng op.id (idempotency check)
      const sync2 = await app.request('/api/v1/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ops: [op1] })
      }, env);

      // gửi lại sau mất mạng: coi là đã áp dụng để client xóa khỏi outbox, không ghi thêm lần nữa
      const sync2Data = await sync2.json();
      expect(sync2Data.applied).toContain('01TEST_KUSALA_OP_001');
      expect(sync2Data.rejected).toEqual([]);
      expect(sync2Data.state.totals.duc).toBe(18.75);
    });

    it('Bất biến khóa ngày: Người dùng không thể nhảy ngày tu', async () => {
      const authRes = await app.request('/api/auth/sign-in/anonymous', { method: 'POST' }, env);
      const { session } = await authRes.json();
      const headers = {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      };

      const now = Date.now();
      // Gian lận: gửi xác nhận cho Ngày 5 trong khi vừa mới bắt đầu (ngày 1)
      const cheatOp = {
        id: '01TEST_CHEAT_DAY_05',
        type: 'kusala.confirm',
        at: now,
        payload: {
          program: 'so-nhap-49',
          cycle: 1,
          day: 5,
          pillar: 'duc',
          pre: 1.0, during: 1.0, post: 1.0
        }
      };

      const syncRes = await app.request('/api/v1/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ops: [cheatOp] })
      }, env);

      expect(syncRes.status).toBe(200);
      const syncData = await syncRes.json();
      expect(syncData.rejected).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: '01TEST_CHEAT_DAY_05', code: 'day_locked', retry: false })])
      );
    });

    it('Tiến hành chu kỳ mới (journey.reset_cycle) khi "Trở về ngày 1"', async () => {
      const authRes = await app.request('/api/auth/sign-in/anonymous', { method: 'POST' }, env);
      const { session } = await authRes.json();
      const headers = {
        'Authorization': `Bearer ${session.token}`,
        'Content-Type': 'application/json'
      };

      const resetOp = {
        id: '01TEST_RESET_CYCLE',
        type: 'journey.reset_cycle',
        at: Date.now()
      };

      const syncRes = await app.request('/api/v1/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ops: [resetOp] })
      }, env);

      expect(syncRes.status).toBe(200);
      const syncData = await syncRes.json();
      expect(syncData.applied).toContain('01TEST_RESET_CYCLE');
      expect(syncData.state.journey.cycle).toBe(2);
      expect(syncData.state.journey.day).toBe(1);
    });
  });

  it('GET /api/v1/export xuất toàn bộ dữ liệu người dùng đúng chuẩn BVDLCN 91/2025', async () => {
    const authRes = await app.request('/api/auth/sign-in/anonymous', { method: 'POST' }, env);
    const { session } = await authRes.json();

    const exportRes = await app.request('/api/v1/export', {
      headers: { 'Authorization': `Bearer ${session.token}` }
    }, env);

    expect(exportRes.status).toBe(200);
    const expData = await exportRes.json();
    expect(expData.user).toBeDefined();
    expect(expData.profile).toBeDefined();
    expect(Array.isArray(expData.journeys)).toBe(true);
    expect(Array.isArray(expData.kusala_entries)).toBe(true);
  });

  it('Yêu cầu xóa tài khoản (POST /api/v1/account/delete) và hủy yêu cầu (DELETE)', async () => {
    const authRes = await app.request('/api/auth/sign-in/anonymous', { method: 'POST' }, env);
    const { session } = await authRes.json();
    const headers = { 'Authorization': `Bearer ${session.token}` };

    // Yêu cầu xóa
    const delRes = await app.request('/api/v1/account/delete', { method: 'POST', headers }, env);
    expect(delRes.status).toBe(200);
    const delData = await delRes.json();
    expect(delData.success).toBe(true);
    expect(delData.execute_after).toBeGreaterThan(Date.now());

    // Hủy yêu cầu xóa
    const cancelRes = await app.request('/api/v1/account/delete', { method: 'DELETE', headers }, env);
    expect(cancelRes.status).toBe(200);
    const cancelData = await cancelRes.json();
    expect(cancelData.cancelled).toBe(true);
  });

  it('POST /api/v1/rt/ticket cấp vé HMAC 60 giây hợp lệ', async () => {
    const authRes = await app.request('/api/auth/sign-in/anonymous', { method: 'POST' }, env);
    const { session } = await authRes.json();
    const headers = {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json'
    };

    const ticketRes = await app.request('/api/v1/rt/ticket', {
      method: 'POST',
      headers,
      body: JSON.stringify({ room: 'hall:t1:s1' })
    }, env);

    expect(ticketRes.status).toBe(200);
    const ticketData = await ticketRes.json();
    expect(ticketData.ticket).toBeDefined();
    expect(ticketData.ws_url).toContain('/ws/hall%3At1%3As1');

    // Giải mã và xác thực chữ ký HMAC
    const decoded = JSON.parse(Buffer.from(ticketData.ticket, 'base64url').toString('utf8'));
    const isSigValid = await verifyHmac(env.RT_SECRET, decoded.p, decoded.s);
    expect(isSigValid).toBe(true);
  });
});

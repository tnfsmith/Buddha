// Đăng nhập gói Free (§6.4): mã khôi phục, QR liên kết thiết bị; giới hạn tần suất; Turnstile
import { describe, it, expect } from 'vitest';
import app from '../src/index.js';
import { normalizeCode, randomB32, deviceLabel } from '../src/auth/free-login.js';
import { verifyTurnstile } from '../src/guard.js';
import { env, call, json, guest, sync, confirm } from './helpers.js';

const post = (p, body, token, headers) => call(p, { method: 'POST', body: JSON.stringify(body ?? {}), headers }, token);
const row = (sql, ...a) => env.DB.prepare(sql).bind(...a).first();

describe('Mã khôi phục', () => {
  it('tạo mã 26 ký tự (nhóm 4), chỉ lưu SHA-256, tài khoản thôi là khách', async () => {
    const g = await guest('Tâm An');
    const r = await json(await post('/api/auth/recovery-code/generate', {}, g.token));
    expect(r.status).toBe(200);
    expect(r.data.code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{2}$/);
    const db = await row('SELECT code_hash FROM recovery_code WHERE user_id = ?', g.user.id);
    expect(db.code_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(db.code_hash).not.toContain(r.data.code.replace(/-/g, ''));
    expect((await row('SELECT isAnonymous FROM user WHERE id = ?', g.user.id)).isAnonymous).toBe(0);
    const st = await json(await call('/api/auth/recovery-code/status', {}, g.token));
    expect(st.data.has_code).toBe(true);
  });

  it('máy mới đăng nhập bằng mã (gõ thường, có khoảng trắng) → về đúng hành trình; khách trên máy mới được gộp', async () => {
    const owner = await guest('Tịnh Lạc');
    await sync(owner.token, [confirm('O1', Date.now(), 1, 'duc')]);
    const { data } = await json(await post('/api/auth/recovery-code/generate', {}, owner.token));
    const fresh = await guest();   // máy mới đã ngầm tạo khách
    const typed = data.code.toLowerCase().replace(/-/g, ' ');
    const r = await json(await post('/api/auth/sign-in/recovery-code', { code: typed }, fresh.token));
    expect(r.status).toBe(200);
    expect(r.data.user.id).toBe(owner.user.id);
    const me = await (await call('/api/v1/me', {}, r.data.token)).json();
    expect(me.profile.tinh_danh).toBe('Tịnh Lạc');
    expect(me.totals.duc).toBe(10);
    expect(await row('SELECT id FROM user WHERE id = ?', fresh.user.id)).toBeNull();   // khách máy mới đã gộp và xóa
  });

  it('mã sai → 401; tạo mã mới thì mã cũ hết hiệu lực', async () => {
    const g = await guest();
    const a = (await (await post('/api/auth/recovery-code/generate', {}, g.token)).json()).code;
    await post('/api/auth/recovery-code/generate', {}, g.token);
    expect((await post('/api/auth/sign-in/recovery-code', { code: a })).status).toBe(401);
    expect((await post('/api/auth/sign-in/recovery-code', { code: 'ABCD-ABCD-ABCD-ABCD-ABCD-ABCD-AB' })).status).toBe(401);
  });
});

describe('QR liên kết thiết bị', () => {
  it('máy mới chờ → máy cũ xem và đồng ý → máy mới nhận phiên đúng tài khoản; mã dùng một lần', async () => {
    const owner = await guest('An Nhiên');
    const ua = { 'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36' };
    const s = await json(await post('/api/auth/device-link/start', {}, undefined, ua));
    expect(s.data.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(s.data.qr).toContain('#lienket=');
    const poll = () => post('/api/auth/sign-in/device-link', { code: s.data.code, secret: s.data.secret });
    expect((await (await poll()).json()).status).toBe('pending');
    const info = await json(await call(`/api/auth/device-link/info?code=${encodeURIComponent(s.data.code)}`, {}, owner.token));
    expect(info.data.device).toBe('Android · Chrome');
    expect((await post('/api/auth/device-link/approve', { code: s.data.code }, owner.token)).status).toBe(200);
    const r = await json(await poll());
    expect(r.data.status).toBe('approved');
    expect(r.data.user.id).toBe(owner.user.id);
    expect((await call('/api/v1/me', {}, r.data.token)).status).toBe(200);
    expect((await poll()).status).toBe(404);   // đã dùng
  });

  it('sai secret hoặc hết hạn → 404; chưa đăng nhập thì không duyệt được', async () => {
    const s = (await (await post('/api/auth/device-link/start', {})).json());
    expect((await post('/api/auth/sign-in/device-link', { code: s.code, secret: 'X'.repeat(32) })).status).toBe(404);
    expect((await post('/api/auth/device-link/approve', { code: s.code })).status).toBe(401);
    await env.DB.prepare("UPDATE verification SET expiresAt = ? WHERE identifier LIKE 'device-link:%'").bind(Date.now() - 1).run();
    expect((await post('/api/auth/sign-in/device-link', { code: s.code, secret: s.secret })).status).toBe(404);
  });
});

describe('Giới hạn tần suất và Turnstile', () => {
  it('đăng nhập khách: quá 5 lần/phút/IP → 429', async () => {
    const h = { 'CF-Connecting-IP': '203.0.113.77' }, codes = [];
    for (let i = 0; i < 6; i++) codes.push((await post('/api/auth/sign-in/anonymous', {}, undefined, h)).status);
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes[5]).toBe(429);
  });
  it('xuất dữ liệu tối đa 2 lần/ngày', async () => {
    const g = await guest();
    const codes = [];
    for (let i = 0; i < 3; i++) codes.push((await call('/api/v1/export', {}, g.token)).status);
    expect(codes).toEqual([200, 200, 429]);
  });
  it('có TURNSTILE_SECRET thì thiếu token bị từ chối 403 (kiểm ở máy chủ)', async () => {
    const r = await app.request('/api/auth/device-link/start', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' } }, { ...env, TURNSTILE_SECRET: 'x' });
    expect(r.status).toBe(403);
    expect(await verifyTurnstile({}, undefined)).toBe(true);           // chưa cấu hình: không chặn (dev)
    expect(await verifyTurnstile({ TURNSTILE_SECRET: 'x' }, '')).toBe(false);
  });
  it('tiện ích mã', () => {
    expect(normalizeCode('ab cd-il o0')).toBe('ABCD1100');
    expect(randomB32(26)).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/140.0 Safari/537.36 Edg/140.0')).toBe('Windows · Edge');
  });
});

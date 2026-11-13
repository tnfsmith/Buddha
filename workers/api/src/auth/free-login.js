// workers/api/src/auth/free-login.js
// Đăng nhập khi còn gói Free (PROJECT_ROADMAP.md §6.4), viết thành plugin Better Auth để phiên tạo ra giống hệt
// mọi cách đăng nhập khác (cookie vd.session_token, bearer, gộp dữ liệu khách qua onLinkAccount):
//   Mã khôi phục:  POST /recovery-code/generate · GET /recovery-code/status · POST /sign-in/recovery-code
//   QR liên kết:   POST /device-link/start (máy mới) · GET /device-link/info · POST /device-link/approve (máy đã đăng nhập)
//                  · POST /sign-in/device-link (máy mới hỏi lại mỗi 2 giây: {status:'pending'} → {status:'approved', token, user}; mã sống 2 phút)
import { createAuthEndpoint, sessionMiddleware, APIError } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import * as z from 'zod';
import { sha256 } from '../utils/crypto.js';
import { markSecured } from './secured.js';

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';   // Crockford: bỏ I, L, O, U cho dễ đọc
const LINK_TTL_MS = 2 * 60 * 1000;

/** n ký tự Crockford Base32 ngẫu nhiên (5 bit mỗi ký tự) */
export function randomB32(n) {
  const bytes = new Uint8Array(Math.ceil((n * 5) / 8)); crypto.getRandomValues(bytes);
  let bits = 0, val = 0, out = '';
  for (const b of bytes) { val = (val << 8) | b; bits += 8; while (bits >= 5 && out.length < n) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  return out;
}
/** Chuẩn hóa mã người dùng gõ: chữ hoa, bỏ khoảng trắng/gạch, I/L→1, O→0 */
export const normalizeCode = (s) => String(s || '').toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
export const groupCode = (c) => c.match(/.{1,4}/g).join('-');
/** Mô tả máy thô để người duyệt nhận ra (không lưu User-Agent đầy đủ) */
export function deviceLabel(ua = '') {
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Thiết bị';
  const br = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return br ? `${os} · ${br}` : os;
}

async function signIn(ctx, userId) {
  const user = await ctx.context.internalAdapter.findUserById(userId);
  if (!user) throw new APIError('UNAUTHORIZED', { message: 'Không tìm thấy tài khoản' });
  const session = await ctx.context.internalAdapter.createSession(user.id);
  await setSessionCookie(ctx, { session, user });
  return ctx.json({ status: 'approved', token: session.token, user: { id: user.id, name: user.name, isAnonymous: Boolean(user.isAnonymous) } });
}
const linkKey = (code) => `device-link:${code}`;
async function findLink(ctx, code) {
  const v = await ctx.context.internalAdapter.findVerificationValue(linkKey(normalizeCode(code)));
  if (!v || new Date(v.expiresAt).getTime() < Date.now()) return null;
  return { v, data: JSON.parse(v.value) };
}

export const freeLogin = (db) => ({
  id: 'vandao-free-login',
  endpoints: {
    generateRecoveryCode: createAuthEndpoint('/recovery-code/generate', { method: 'POST', use: [sessionMiddleware] }, async (ctx) => {
      const uid = ctx.context.session.user.id, code = randomB32(26), now = Date.now();
      await db.prepare(`INSERT INTO recovery_code (user_id, code_hash, created_at) VALUES (?, ?, ?)
                        ON CONFLICT(user_id) DO UPDATE SET code_hash = excluded.code_hash, created_at = excluded.created_at, last_used_at = NULL`)
        .bind(uid, await sha256(code), now).run();
      await markSecured(db, uid);
      // hiện MỘT lần; máy chủ không lưu mã gốc
      return ctx.json({ code: groupCode(code), created_at: now });
    }),
    recoveryCodeStatus: createAuthEndpoint('/recovery-code/status', { method: 'GET', use: [sessionMiddleware] }, async (ctx) => {
      const r = await db.prepare('SELECT created_at, last_used_at FROM recovery_code WHERE user_id = ?').bind(ctx.context.session.user.id).first();
      return ctx.json({ has_code: Boolean(r), created_at: r?.created_at ?? null, last_used_at: r?.last_used_at ?? null });
    }),
    signInRecoveryCode: createAuthEndpoint('/sign-in/recovery-code', { method: 'POST', body: z.object({ code: z.string().min(20).max(64) }) }, async (ctx) => {
      const code = normalizeCode(ctx.body.code);
      const r = code.length === 26 ? await db.prepare('SELECT user_id FROM recovery_code WHERE code_hash = ?').bind(await sha256(code)).first() : null;
      if (!r) throw new APIError('UNAUTHORIZED', { message: 'Mã khôi phục không đúng', code: 'INVALID_RECOVERY_CODE' });
      await db.prepare('UPDATE recovery_code SET last_used_at = ? WHERE user_id = ?').bind(Date.now(), r.user_id).run();
      return signIn(ctx, r.user_id);
    }),
    deviceLinkStart: createAuthEndpoint('/device-link/start', { method: 'POST' }, async (ctx) => {
      const code = randomB32(8), secret = randomB32(32), expiresAt = new Date(Date.now() + LINK_TTL_MS);
      await ctx.context.internalAdapter.createVerificationValue({
        identifier: linkKey(code), expiresAt,
        value: JSON.stringify({ s: await sha256(secret), status: 'pending', device: deviceLabel(ctx.request?.headers.get('user-agent') || '') }),
      });
      const origin = new URL(ctx.context.baseURL).origin;
      return ctx.json({ code: groupCode(code), secret, expires_at: expiresAt.getTime(), qr: `${origin}/#lienket=${code}` });
    }),
    deviceLinkInfo: createAuthEndpoint('/device-link/info', { method: 'GET', use: [sessionMiddleware], query: z.object({ code: z.string().max(16) }) }, async (ctx) => {
      const l = await findLink(ctx, ctx.query.code);
      if (!l || l.data.status !== 'pending') throw new APIError('NOT_FOUND', { message: 'Mã đã hết hạn hoặc không tồn tại', code: 'LINK_EXPIRED' });
      return ctx.json({ device: l.data.device, expires_at: new Date(l.v.expiresAt).getTime() });
    }),
    deviceLinkApprove: createAuthEndpoint('/device-link/approve', { method: 'POST', use: [sessionMiddleware], body: z.object({ code: z.string().max(16) }) }, async (ctx) => {
      const l = await findLink(ctx, ctx.body.code);
      if (!l || l.data.status !== 'pending') throw new APIError('NOT_FOUND', { message: 'Mã đã hết hạn hoặc không tồn tại', code: 'LINK_EXPIRED' });
      await ctx.context.internalAdapter.updateVerificationByIdentifier(l.v.identifier, { value: JSON.stringify({ ...l.data, status: 'approved', uid: ctx.context.session.user.id }) });
      return ctx.json({ approved: true, device: l.data.device });
    }),
    signInDeviceLink: createAuthEndpoint('/sign-in/device-link', { method: 'POST', body: z.object({ code: z.string().max(16), secret: z.string().length(32) }) }, async (ctx) => {
      const l = await findLink(ctx, ctx.body.code);
      if (!l || l.data.s !== (await sha256(ctx.body.secret))) throw new APIError('NOT_FOUND', { message: 'Mã đã hết hạn hoặc không tồn tại', code: 'LINK_EXPIRED' });
      if (l.data.status !== 'approved') return ctx.json({ status: 'pending' });
      await ctx.context.internalAdapter.deleteVerificationByIdentifier(l.v.identifier);   // dùng một lần
      return signIn(ctx, l.data.uid);
    }),
  },
});

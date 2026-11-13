// workers/api/src/auth/index.js
// Better Auth (ADR 0001, PROJECT_ROADMAP.md §6): khởi tạo THEO TỪNG REQUEST vì binding D1 chỉ có trong fetch().
// Plugin: anonymous (khách, gộp dữ liệu khi đăng nhập), bearer (ứng dụng Android), passkey; Google khi có secret;
// emailOTP chỉ bật khi EMAIL_OTP = "1" và có binding EMAIL (gói Paid, §6.4).
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins/anonymous';
import { bearer } from 'better-auth/plugins/bearer';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { passkey } from '@better-auth/passkey';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.js';
import { generateId } from '../utils/crypto.js';
import { ensureProfile } from './profile.js';
import { linkGuest } from './link.js';
import { markSecured } from './secured.js';
import { freeLogin } from './free-login.js';

export { markSecured };

const DAY = 24 * 60 * 60;
const DEV_ORIGINS = ['http://127.0.0.1:8787', 'http://localhost:8787', 'http://127.0.0.1:4173', 'http://localhost:4173'];


const secured = (db) => ({
  id: 'vandao-secured',
  hooks: { after: [{
    matcher: (ctx) => ctx.path === '/passkey/verify-registration',
    handler: createAuthMiddleware(async (ctx) => {
      if (ctx.context.returned instanceof Error) return;
      const s = await getSessionFromCtx(ctx, { disableRefresh: true });
      if (s?.user?.id) await markSecured(db, s.user.id);
    }),
  }] },
});

export function createAuth(env, request, extraPlugins = []) {
  const url = new URL(request.url), origin = url.origin;
  const plugins = [
    anonymous({ generateName: () => 'Khách', onLinkAccount: ({ anonymousUser, newUser }) => linkGuest(env.DB, anonymousUser.user, newUser.user) }),
    bearer(),
    passkey({ rpID: url.hostname, rpName: 'Vân Đạo', origin }),
    secured(env.DB),
    freeLogin(env.DB),
    ...extraPlugins,
  ];
  if (env.EMAIL_OTP === '1' && env.EMAIL) {
    plugins.push(emailOTP({
      expiresIn: 600, allowedAttempts: 5,
      // chỉ gửi tới chính email đang xác thực (§6.3); nội dung thư không chứa dữ liệu tu tập
      sendVerificationOTP: async ({ email, otp }) => env.EMAIL.send({ to: email, from: env.EMAIL_FROM, subject: 'Mã đăng nhập Vân Đạo', text: `Mã của bạn: ${otp}\nMã có hiệu lực 10 phút.` }),
    }));
  }
  const google = env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } } : {};
  const auth = betterAuth({
    appName: 'Vân Đạo',
    baseURL: origin,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: 'sqlite', schema }),
    trustedOrigins: [origin, ...DEV_ORIGINS],
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    socialProviders: google,
    account: { accountLinking: { enabled: true, trustedProviders: ['google'] } },
    rateLimit: { enabled: false },   // giới hạn tần suất bằng binding ratelimits của Workers (T2.2), không dùng bộ nhớ isolate
    telemetry: { enabled: false },
    advanced: {
      cookiePrefix: 'vd',
      database: { generateId: () => generateId() },   // ULID như mọi bảng ứng dụng (§4.1)
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
    },
    databaseHooks: { user: { create: { after: async (u) => { await ensureProfile(env.DB, u.id); } } } },
    plugins,
  });
  return auth;
}

/** Một phiên bản Better Auth cho mỗi request Hono; null nếu môi trường thiếu BETTER_AUTH_SECRET */
export function getAuth(c) {
  if (!c.env?.BETTER_AUTH_SECRET) return null;
  let a = c.get('auth');
  if (!a) { a = createAuth(c.env, c.req.raw, c.get('authPlugins') || []); c.set('auth', a); }
  return a;
}

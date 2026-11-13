// workers/api/src/guard.js
// Giới hạn tần suất (binding `ratelimits` của Workers, PROJECT_ROADMAP.md §5 cột "Giới hạn") và Turnstile (§6.3).
// Binding vắng (dev cục bộ, môi trường chưa khai báo) thì bỏ qua giới hạn; Turnstile chỉ kiểm khi có TURNSTILE_SECRET.

export const clientIp = (c) => c.req.header('CF-Connecting-IP') || 'unknown';
const tooMany = (c) => { c.header('Retry-After', '60'); return c.json({ error: { code: 'rate_limited', message: 'Thao tác quá nhanh, xin thử lại sau một phút' } }, 429); };

/** Giới hạn theo khóa; `key(c)` trả chuỗi khóa (IP, user id…) */
export const limit = (binding, key) => async (c, next) => {
  const rl = c.env?.[binding];
  if (rl && typeof rl.limit === 'function') {
    const { success } = await rl.limit({ key: `${binding}:${key(c)}` });
    if (!success) return tooMany(c);
  }
  await next();
};
export const byIp = (binding) => limit(binding, clientIp);
/** Dùng sau authMiddleware: giới hạn theo người dùng */
export const byUser = (binding) => limit(binding, (c) => c.get('user')?.id || clientIp(c));

/** Giới hạn theo ngày bằng KV (binding ratelimits chỉ có chu kỳ 10/60 giây); ví dụ xuất dữ liệu 2 lần/ngày */
export const perDay = (name, max) => async (c, next) => {
  const kv = c.env?.CONFIG, uid = c.get('user')?.id;
  if (kv && uid) {
    const k = `quota:${name}:${uid}:${new Date().toISOString().slice(0, 10)}`, n = Number((await kv.get(k)) || 0);
    if (n >= max) return tooMany(c);
    await kv.put(k, String(n + 1), { expirationTtl: 2 * 86400 });
  }
  await next();
};

/** Kiểm token Turnstile ở máy chủ (Siteverify). Token gửi trong header `cf-turnstile-response`. */
export async function verifyTurnstile(env, token, ip) {
  if (!env?.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const form = new FormData();
  form.append('secret', env.TURNSTILE_SECRET); form.append('response', token);
  if (ip && ip !== 'unknown') form.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    return Boolean((await r.json()).success);
  } catch { return false; }
}
export const turnstile = () => async (c, next) => {
  if (!(await verifyTurnstile(c.env, c.req.header('cf-turnstile-response'), clientIp(c)))) {
    return c.json({ error: { code: 'turnstile_failed', message: 'Không xác minh được, xin thử lại' } }, 403);
  }
  await next();
};

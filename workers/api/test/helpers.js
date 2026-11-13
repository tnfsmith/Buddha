// Tiện ích kiểm thử: gọi app Hono với env thật của workerd (D1 đã chạy migration)
import { env } from 'cloudflare:test';
import app from '../src/index.js';

export { env };
export const DAY = 24 * 60 * 60 * 1000, TZ = 'Asia/Ho_Chi_Minh';
// mỗi lần gọi một IP giả khác nhau, để giới hạn 5 lần đăng nhập/phút/IP không chạm vào các ca không kiểm giới hạn
let ipN = 0;
export const nextIp = () => `198.51.100.${(ipN = (ipN % 250) + 1)}`;
export const call = (path, init = {}, token) => app.request(path, {
  ...init, headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': nextIp(), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) },
}, env);
export const json = async (res) => ({ status: res.status, data: await res.json().catch(() => null), headers: res.headers });

/** Khách ẩn danh qua Better Auth; đặt Tịnh danh (nếu có) bằng PATCH /profile như client sẽ làm */
export async function guest(name) {
  const r = await json(await call('/api/auth/sign-in/anonymous', { method: 'POST', body: '{}' }));
  if (r.status !== 200) throw new Error('sign-in anonymous ' + r.status + ' ' + JSON.stringify(r.data));
  const token = r.data.token;
  if (name) { const p = await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ tinh_danh: name }) }, token); if (p.status !== 200) throw new Error('đặt tên ' + p.status); }
  return { token, user: r.data.user, res: r };
}
export const sync = async (token, ops) => (await call('/api/v1/sync', { method: 'POST', body: JSON.stringify({ ops }) }, token)).json();
export const confirm = (id, at, day, pillar, extra = {}) => ({ id, type: 'kusala.confirm', at, payload: { day, pillar, pre: 1, during: 1, post: 1, ...extra } });

// apps/web/src/net/turnstile.js
// Lấy token Turnstile cho các bước đăng nhập cần xác minh (§6.3). Sitekey là công khai (docs/infra.md).
// Máy dev (localhost/127.0.0.1) không tải widget: máy chủ dev không có TURNSTILE_SECRET nên không kiểm.
export const TURNSTILE_SITEKEY = '0x4AAAAAAF_iytQJWvfn-nya';
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading = null;
const load = () => loading || (loading = new Promise((resolve, reject) => {
  if (window.turnstile) return resolve();
  const s = document.createElement('script'); s.src = SRC; s.async = true; s.onload = () => resolve(); s.onerror = () => { loading = null; reject(new Error('turnstile')); };
  document.head.appendChild(s);
}));

/** Token Turnstile, hoặc '' nếu không lấy được trong 20 giây (máy chủ sẽ từ chối và giao diện báo thử lại). `host`: phần tử chứa widget. */
export async function turnstileToken(host) {
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !window.turnstile) return '';
  try { await load(); } catch { return ''; }
  return new Promise((resolve) => {
    const box = document.createElement('div'); (host || document.body).appendChild(box);
    let id = null; const done = (t) => { clearTimeout(timer); try { if (id !== null) window.turnstile.remove(id); } catch { /* đã gỡ */ } box.remove(); resolve(t || ''); };
    const timer = setTimeout(() => done(''), 20000);
    try { id = window.turnstile.render(box, { sitekey: TURNSTILE_SITEKEY, appearance: 'interaction-only', callback: done, 'error-callback': () => done('') }); } catch { done(''); }
  });
}

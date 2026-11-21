// Gửi Web Push chỉ bằng Web Crypto (#106, hợp đồng docs/contracts/reminder-clock.md §4 bước 5).
// Thư viện `web-push` gốc dựa vào crypto của Node nên không chạy trên Workers. Ở đây:
// - VAPID (RFC 8292): JWT ES256, header `Authorization: vapid t=…, k=…`;
// - mã hóa nội dung aes128gcm (RFC 8291 + RFC 8188), một bản ghi.
// Không ghi endpoint, khóa hay nội dung vào log.

const te = new TextEncoder();
export const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function unb64u(s) {
  const t = String(s).replace(/-/g, '+').replace(/_/g, '/'), p = t + '='.repeat((4 - (t.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
}
const concat = (...xs) => { const out = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of xs) { out.set(x, i); i += x.length; } return out; };

/**
 * Dịch vụ push được phép gọi. Endpoint lưu từ trình duyệt, nhưng vẫn kiểm lại mỗi lần gửi (kể cả dữ liệu cũ)
 * và không đi theo chuyển hướng, để máy chủ không bị dùng gọi tới địa chỉ tùy ý.
 */
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function pushEndpointOk(endpoint) {
  let u; try { u = new URL(endpoint); } catch { return false; }
  return u.protocol === 'https:' && !u.username && !u.password && (!u.port || u.port === '443') && PUSH_HOSTS.some((re) => re.test(u.hostname));
}

const vapidKeys = new Map();
async function vapidKey(publicKey, privateKey) {
  const id = publicKey + '|' + privateKey;
  if (!vapidKeys.has(id)) {
    const pub = unb64u(publicKey);
    if (pub.length !== 65 || pub[0] !== 4) throw new Error('vapid_public');
    const jwk = { kty: 'EC', crv: 'P-256', x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), d: privateKey, ext: true };
    vapidKeys.set(id, crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']));
  }
  return vapidKeys.get(id);
}

/** Header Authorization VAPID cho một endpoint. `now` UTC ms; JWT hết hạn sau 12 giờ (RFC 8292 cho tối đa 24 giờ). */
export async function vapidAuth(endpoint, { publicKey, privateKey, subject }, now) {
  const aud = new URL(endpoint).origin;
  const head = b64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const body = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidKey(publicKey, privateKey), te.encode(`${head}.${body}`));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${publicKey}`;
}

async function hkdf(salt, ikm, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8));
}

/**
 * Mã hóa aes128gcm theo RFC 8291. `p256dh`, `auth` là chuỗi base64url từ PushSubscription.
 * Trả thân yêu cầu: salt(16) ‖ rs(4) ‖ idlen(1) ‖ khóa công khai tạm(65) ‖ bản mã.
 */
export async function encryptPayload(payload, p256dh, auth) {
  const ua = unb64u(p256dh), secret = unb64u(auth);
  if (ua.length !== 65 || ua[0] !== 4 || secret.length < 16) throw new Error('push_keys');
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const as = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, pair.privateKey, 256));
  const ikm = await hkdf(secret, shared, concat(te.encode('WebPush: info\0'), ua, as), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = concat(te.encode(payload), new Uint8Array([2]));   // 0x02: bản ghi cuối, không đệm
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([65]), as, ct);
}

/**
 * Gửi một thông báo. → `{ status }` khi dịch vụ trả lời, `null` khi không có phản hồi (lỗi mạng, hết giờ).
 * Kết quả đưa vào `classifyPush` (@vandao/shared/reminder.js). Endpoint không hợp lệ → `{ status: 410 }` để xóa đăng ký.
 * opts: { vapid: { publicKey, privateKey, subject }, now, topic, ttl = 3600, fetch = globalThis.fetch, timeoutMs = 10000 }
 */
export async function sendPush(sub, payload, { vapid, now, topic, ttl = 3600, fetch: f = globalThis.fetch, timeoutMs = 10000 }) {
  if (!sub || !pushEndpointOk(sub.endpoint)) return { status: 410 };
  let body, authz;
  try { body = await encryptPayload(payload, sub.p256dh, sub.auth); authz = await vapidAuth(sub.endpoint, vapid, now); } catch { return { status: 400 }; }
  const headers = { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'normal', Authorization: authz };
  if (topic) headers.Topic = topic;
  try {
    const res = await f(sub.endpoint, { method: 'POST', headers, body, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    try { await res.body?.cancel(); } catch { /* đã đọc */ }
    return { status: res.status };
  } catch { return null; }
}

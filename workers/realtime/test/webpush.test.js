// Bộ gửi Web Push (#106): mã hóa aes128gcm giải lại được theo RFC 8291, JWT VAPID ký đúng, kiểm endpoint, phân loại phản hồi.
import { describe, it, expect } from 'vitest';
import { b64u, unb64u, encryptPayload, vapidAuth, pushEndpointOk, sendPush } from '../src/webpush.js';
import { env } from 'cloudflare:test';

const te = new TextEncoder(), td = new TextDecoder();
async function receiver() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)), auth = crypto.getRandomValues(new Uint8Array(16));
  return { pair, pub, auth, p256dh: b64u(pub), authS: b64u(auth) };
}
const cat = (...xs) => { const o = new Uint8Array(xs.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of xs) { o.set(x, i); i += x.length; } return o; };
async function hk(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}
/** Giải mã phía trình duyệt (RFC 8291 §3.4, RFC 8188) để chứng minh bản mã đúng chuẩn */
async function decrypt(body, r) {
  const salt = body.slice(0, 16), rs = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0), idlen = body[20], as = body.slice(21, 21 + idlen), ct = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', as, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, r.pair.privateKey, 256));
  const ikm = await hk(r.auth, shared, cat(te.encode('WebPush: info\0'), r.pub, as), 32);
  const cek = await hk(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16), nonce = await hk(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  expect(plain[plain.length - 1]).toBe(2);   // bản ghi cuối
  return { rs, idlen, text: td.decode(plain.slice(0, -1)) };
}
const vapid = () => ({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT });

describe('aes128gcm', () => {
  it('trình duyệt giải lại đúng nội dung, rs 4096, khóa tạm 65 byte, mỗi lần một khóa tạm và salt mới', async () => {
    const r = await receiver(), msg = '{"v":1,"kind":"thien","at":1795000000000}';
    const a = await encryptPayload(msg, r.p256dh, r.authS), b = await encryptPayload(msg, r.p256dh, r.authS);
    const d = await decrypt(a, r);
    expect(d).toEqual({ rs: 4096, idlen: 65, text: msg });
    expect(b64u(a.slice(0, 16))).not.toBe(b64u(b.slice(0, 16)));
    expect(b64u(a.slice(21, 86))).not.toBe(b64u(b.slice(21, 86)));
  });
  it('khóa của trình duyệt sai thì ném lỗi', async () => {
    await expect(encryptPayload('x', b64u(new Uint8Array(10)), b64u(new Uint8Array(16)))).rejects.toThrow();
  });
});

describe('VAPID', () => {
  it('JWT ES256 ký đúng bằng khóa công khai, aud là origin của endpoint, hết hạn sau 12 giờ', async () => {
    const now = Date.UTC(2026, 10, 22, 23, 0), h = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', vapid(), now);
    const [, t, k] = /^vapid t=([^,]+), k=(.+)$/.exec(h);
    expect(k).toBe(env.VAPID_PUBLIC_KEY);
    const [hd, bd, sg] = t.split('.');
    const claims = JSON.parse(td.decode(unb64u(bd)));
    expect(JSON.parse(td.decode(unb64u(hd)))).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: now / 1000 + 43200, sub: 'mailto:kiem-thu@vandao.invalid' });
    const pub = await crypto.subtle.importKey('raw', unb64u(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64u(sg), te.encode(`${hd}.${bd}`))).toBe(true);
  });
});

describe('endpoint và gửi', () => {
  it('chỉ nhận HTTPS của dịch vụ push đã biết, không thông tin đăng nhập hay cổng lạ', () => {
    for (const ok of ['https://fcm.googleapis.com/fcm/send/x', 'https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/Q', 'https://wns2-par02p.notify.windows.com/w/?token=x'])
      expect(pushEndpointOk(ok), ok).toBe(true);
    for (const bad of ['http://fcm.googleapis.com/x', 'https://evil.example/x', 'https://fcm.googleapis.com.evil.example/x', 'https://u:p@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x', 'không phải URL', 'https://169.254.169.254/'])
      expect(pushEndpointOk(bad), bad).toBe(false);
  });
  it('POST aes128gcm với TTL, Urgency, Topic, VAPID, không theo chuyển hướng; lỗi mạng → null; endpoint lạ → 410 không gọi mạng', async () => {
    const r = await receiver(), calls = [];
    const f = async (url, init) => { calls.push({ url, init }); return new Response(null, { status: 201 }); };
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: r.p256dh, auth: r.authS };
    expect(await sendPush(sub, 'xin chào', { vapid: vapid(), now: Date.now(), topic: 'thien', fetch: f })).toEqual({ status: 201 });
    const { url, init } = calls[0];
    expect(url).toBe(sub.endpoint);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(init.headers).toMatchObject({ 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '3600', Urgency: 'normal', Topic: 'thien' });
    expect(init.headers.Authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/);
    expect((await decrypt(init.body, r)).text).toBe('xin chào');
    expect(await sendPush(sub, 'x', { vapid: vapid(), now: Date.now(), fetch: async () => { throw new Error('mất mạng'); } })).toBeNull();
    expect(await sendPush({ ...sub, endpoint: 'https://evil.example/x' }, 'x', { vapid: vapid(), now: Date.now(), fetch: f })).toEqual({ status: 410 });
    expect(calls).toHaveLength(1);
  });
});

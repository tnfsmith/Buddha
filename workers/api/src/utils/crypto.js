// workers/api/src/utils/crypto.js
// Các hàm mã hóa, băm, sinh định danh và token theo Web Crypto API chuẩn
import { webcrypto } from 'node:crypto';

const crypto = globalThis.crypto || webcrypto;
const TextEncoder = globalThis.TextEncoder;

/**
 * Sinh chuỗi ID 26 ký tự dạng ULID sắp xếp theo thời gian
 */
export function generateId() {
  const time = Date.now();
  const timeChars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let str = '';
  let t = time;
  for (let i = 9; i >= 0; i--) {
    str = timeChars[t % 32] + str;
    t = Math.floor(t / 32);
  }
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  for (let i = 0; i < 10; i++) {
    str += timeChars[randomBytes[i] % 32];
  }
  return str;
}

/**
 * Sinh token ngẫu nhiên bảo mật độ dài 32 byte (64 hex ký tự)
 */
export function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Ký HMAC-SHA256
 */
export async function signHmac(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Xác thực chữ ký HMAC-SHA256 (constant-time)
 */
export async function verifyHmac(secret, message, signatureHex) {
  try {
    const expected = await signHmac(secret, message);
    if (expected.length !== signatureHex.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) {
      mismatch |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i);
    }
    return mismatch === 0;
  } catch {
    return false;
  }
}

/**
 * Tính SHA-256 (hex)
 */
export async function sha256(text) {
  const enc = new TextEncoder();
  const hash = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

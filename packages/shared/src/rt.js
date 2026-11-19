// Thời gian thực (GĐ4, #108, roadmap §7): tên phòng, bản ghi 16 byte, khung gộp và vé HMAC v1.
// Dùng chung API (/rt/ticket, Codex) và Durable Object Lobby/HallRoom/IslandRoom (Claude). Hợp đồng: docs/contracts/realtime.md.
// Thuần: không đọc giờ, mạng hay bộ nhớ; ký/kiểm vé dùng Web Crypto (Workers, Node ≥ 20, trình duyệt).
import { hash32 } from './missions.js';

export const RT_V = 1;
export const REC = 16;               // byte mỗi bản ghi trạng thái
export const BATCH_HEAD = 4;         // [type u8 = 1][count u16][rsv u8 = 0]
export const T_BATCH = 1;
export const HALL_CAP = 200;
export const ISLAND_CAP = 12;
export const FREE_HALL_SHARDS = 3;
export const SEND_HZ = 5;            // client → máy chủ, tối đa khi đang đi
export const BATCH_HZ = 4;           // máy chủ → client; gói Free dùng 2
export const BATCH_HZ_FREE = 2;
export const TICKET_TTL_MS = 60000;
/** Bộ lọc chặn trong vé: tối đa 800 người (cả hai chiều); nhiều hơn thì không cấp vé (client dùng mô phỏng) */
export const BLF_MAX_N = 800;
export const BLF_K = 7;
/** Quyền ở trong đảo do API xác thực lúc cấp vé (hợp đồng §4 IslandRoom) */
export const PERMS = Object.freeze(['host', 'open', 'away']);
/** Trạng thái thân (byte 14) */
export const STATES = Object.freeze({ dung: 0, toa_thien: 1, chap_tay: 2, danh_le: 3, kinh_hanh: 4, tuy_hy: 5 });
export const STATE_MAX = 5;
/** Mã đóng WebSocket */
export const CLOSE = Object.freeze({ ticket: 4401, forbidden: 4403, codec: 4400, replaced: 4409, rate: 4429, full: 4503, busy: 4504, closed: 4410 });
/** Giới hạn tọa độ theo loại phòng (đơn vị cảnh); bản ghi ngoài khoảng bị bỏ */
export const BOUNDS = Object.freeze({ hall: Object.freeze({ r: 400, ymin: -50, ymax: 500 }), island: Object.freeze({ r: 260, ymin: -50, ymax: 300 }) });

const UID = /^[A-Za-z0-9_-]{8,64}$/;
/**
 * Tên phòng → { kind, tier, shard, host } hoặc null.
 * - `hall:t{0–4}` là phòng gốc client xin; `hall:t{0–4}:s{1–99}` là shard Lobby cấp.
 * - `island:{user_id chủ đảo}`.
 */
export function parseRoom(name) {
  if (typeof name !== 'string' || name.length > 80) return null;
  let m = /^hall:t([0-4])(?::s([1-9]\d?))?$/.exec(name);
  if (m) return { kind: 'hall', tier: +m[1], shard: m[2] ? +m[2] : null, host: null };
  m = /^island:([A-Za-z0-9_-]{8,64})$/.exec(name);
  if (m) return { kind: 'island', tier: null, shard: null, host: m[1] };
  return null;
}
export const hallShard = (tier, shard) => `hall:t${tier}:s${shard}`;

const TAU = Math.PI * 2;
/** yaw (radian) → byte 0–255 và ngược lại */
export const yawByte = (yaw) => (Math.round((((yaw % TAU) + TAU) % TAU) * 256 / TAU) & 255);
export const byteYaw = (b) => (b & 255) * TAU / 256;

/** Ghi một bản ghi { slot, x, y, z, state, yaw } vào DataView tại `off` (little-endian) */
export function writeRec(dv, off, r) {
  dv.setUint16(off, r.slot & 0xffff, true);
  dv.setFloat32(off + 2, r.x, true); dv.setFloat32(off + 6, r.y, true); dv.setFloat32(off + 10, r.z, true);
  dv.setUint8(off + 14, r.state & 255); dv.setUint8(off + 15, yawByte(r.yaw || 0));
}
export function readRec(dv, off) {
  return { slot: dv.getUint16(off, true), x: dv.getFloat32(off + 2, true), y: dv.getFloat32(off + 6, true), z: dv.getFloat32(off + 10, true), state: dv.getUint8(off + 14), yaw: byteYaw(dv.getUint8(off + 15)) };
}
/** Client → máy chủ: đúng 16 byte */
export function encodeState(r) { const b = new ArrayBuffer(REC); writeRec(new DataView(b), 0, r); return b; }
/** 16 byte → bản ghi, hoặc null nếu sai độ dài */
export function decodeState(buf) {
  const u = buf instanceof ArrayBuffer ? new Uint8Array(buf) : ArrayBuffer.isView(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : null;
  if (!u || u.byteLength !== REC) return null;
  return readRec(new DataView(u.buffer, u.byteOffset, REC), 0);
}
/** Bản ghi hợp lệ cho loại phòng: số hữu hạn, trong giới hạn, trạng thái 0–5 */
export function validRec(r, kind = 'hall') {
  const B = BOUNDS[kind]; if (!r || !B) return false;
  if (![r.x, r.y, r.z].every(Number.isFinite)) return false;
  return Math.hypot(r.x, r.z) <= B.r && r.y >= B.ymin && r.y <= B.ymax && Number.isInteger(r.state) && r.state >= 0 && r.state <= STATE_MAX;
}
/** Máy chủ → client: khung gộp [1][count u16][0] + count × 16 byte */
export function encodeBatch(recs) {
  const n = Math.min(recs.length, 0xffff), b = new ArrayBuffer(BATCH_HEAD + n * REC), dv = new DataView(b);
  dv.setUint8(0, T_BATCH); dv.setUint16(1, n, true); dv.setUint8(3, 0);
  for (let i = 0; i < n; i++) writeRec(dv, BATCH_HEAD + i * REC, recs[i]);
  return b;
}
/** Khung gộp → mảng bản ghi, hoặc null nếu sai kiểu/độ dài */
export function decodeBatch(buf) {
  const u = buf instanceof ArrayBuffer ? new Uint8Array(buf) : ArrayBuffer.isView(buf) ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) : null;
  if (!u || u.byteLength < BATCH_HEAD) return null;
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength), n = dv.getUint16(1, true);
  if (dv.getUint8(0) !== T_BATCH || u.byteLength !== BATCH_HEAD + n * REC) return null;
  const out = new Array(n); for (let i = 0; i < n; i++) out[i] = readRec(dv, BATCH_HEAD + i * REC);
  return out;
}

// ── Vé v1: "v1.<payload base64url>.<HMAC-SHA256 base64url>" ──
const enc = new TextEncoder(), dec = new TextDecoder();
export function b64u(bytes) { let s = ''; const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
export function unb64u(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; } catch { return null; }
}
const hkey = (secret, use) => crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [use]);

// ── Bộ lọc Bloom cho danh sách chặn (DO không đọc D1 lúc vào phòng) ──
// m bit = lũy thừa 2 ≥ 10·n, trong khoảng 256–8192; k = 7 → tỉ lệ dương tính giả < 1 %. Dương tính giả chỉ làm hai người
// không chặn nhau cũng không thấy nhau (vô hại); không có âm tính giả nên mọi cặp đã chặn đều bị lọc, bất kể ai vào trước.
const mix = (h) => { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; };
const idx = (m, uid) => { const a = mix(hash32('b1|' + uid)), b = mix(hash32('b2|' + uid)) | 1; return Array.from({ length: BLF_K }, (_, i) => ((a + Math.imul(i, b)) >>> 0) % m); };
/** Danh sách user_id (người mình chặn + người chặn mình) → { m, b } hoặc null nếu vượt BLF_MAX_N */
export function bloomMake(uids) {
  const list = [...new Set((uids || []).filter((x) => typeof x === 'string' && UID.test(x)))];
  if (list.length > BLF_MAX_N) return null;
  let m = 256; while (m < list.length * 10 && m < 8192) m *= 2;
  const bits = new Uint8Array(m / 8);
  for (const u of list) for (const i of idx(m, u)) bits[i >> 3] |= 1 << (i & 7);
  return { m, b: b64u(bits) };
}
/** Bộ lọc có thể chứa uid không (false là chắc chắn không có) */
export function bloomHas(f, uid) {
  if (!f || typeof uid !== 'string') return false;
  const bits = unb64u(f.b); if (!bits || bits.length * 8 !== f.m) return false;
  return idx(f.m, uid).every((i) => (bits[i >> 3] >> (i & 7)) & 1);
}
/** Hai người trong phòng có phải ẩn với nhau không: bộ lọc của một trong hai chứa người kia */
export const hiddenPair = (a, b) => bloomHas(a.blf, b.uid) || bloomHas(b.blf, a.uid);
const okBlf = (f) => !!f && typeof f === 'object' && [256, 512, 1024, 2048, 4096, 8192].includes(f.m) && (unb64u(f.b) || []).length * 8 === f.m;

/**
 * Thân vé hợp lệ: { v: 1, uid, room (đã có shard nếu là hall), tinh_danh, tag, look, blf, exp, n } và với đảo thêm { perm, open }.
 * - `blf`: bộ lọc Bloom của toàn bộ danh sách chặn hai chiều (bloomMake). Vượt BLF_MAX_N → API không cấp vé.
 * - `perm` (chỉ đảo): `host` (chủ) · `open` (chủ đang Nghênh khách) · `away` (ghé khi vắng, canVisitAway); `open`: cổng đảo lúc cấp vé.
 * - `n`: nonce chống dùng lại.
 */
export function checkTicketPayload(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || p.v !== RT_V) return false;
  if (typeof p.uid !== 'string' || !UID.test(p.uid)) return false;
  const r = parseRoom(p.room); if (!r || (r.kind === 'hall' && !r.shard)) return false;
  if (typeof p.tinh_danh !== 'string' || p.tinh_danh.length < 2 || p.tinh_danh.length > 16) return false;
  if (typeof p.tag !== 'string' || !/^\d{4}$/.test(p.tag)) return false;
  if (p.look !== null && (typeof p.look !== 'object' || Array.isArray(p.look))) return false;
  if (!okBlf(p.blf)) return false;
  if (r.kind === 'island') {
    if (!PERMS.includes(p.perm) || typeof p.open !== 'boolean') return false;
    if ((p.perm === 'host') !== (p.uid === r.host)) return false;
    if (p.perm !== 'host' && !p.open) return false;   // Độc cư: chỉ chủ được vé
  } else if (p.perm !== undefined || p.open !== undefined) return false;
  if (!Number.isInteger(p.exp) || typeof p.n !== 'string' || !/^[A-Za-z0-9_-]{16,32}$/.test(p.n)) return false;
  return true;
}
/** Ký vé (API). Ném lỗi nếu thân vé sai hợp đồng hay thiếu khóa. */
export async function signTicket(secret, payload) {
  if (!secret) throw new Error('rt_unavailable');
  if (!checkTicketPayload(payload)) throw new Error('invalid_ticket_payload');
  const head = 'v1.' + b64u(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hkey(secret, 'sign'), enc.encode(head)));
  return head + '.' + b64u(sig);
}
/**
 * Kiểm vé (DO, lúc nâng cấp WebSocket). → { ok: true, payload } | { ok: false, code }.
 * code: ticket_invalid (sai dạng/chữ ký/thân) · ticket_expired · ticket_room (vé không dành cho phòng này).
 */
export async function verifyTicket(secret, ticket, { now, room } = {}) {
  if (!secret || typeof ticket !== 'string' || ticket.length > 4096) return { ok: false, code: 'ticket_invalid' };
  const parts = ticket.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, code: 'ticket_invalid' };
  const body = unb64u(parts[1]), sig = unb64u(parts[2]);
  if (!body || !sig || sig.length !== 32) return { ok: false, code: 'ticket_invalid' };
  const good = await crypto.subtle.verify('HMAC', await hkey(secret, 'verify'), sig, enc.encode(parts[0] + '.' + parts[1]));
  if (!good) return { ok: false, code: 'ticket_invalid' };
  let p; try { p = JSON.parse(dec.decode(body)); } catch { return { ok: false, code: 'ticket_invalid' }; }
  if (!checkTicketPayload(p)) return { ok: false, code: 'ticket_invalid' };
  if (!Number.isFinite(now) || now > p.exp) return { ok: false, code: 'ticket_expired' };
  if (room !== undefined && room !== p.room) return { ok: false, code: 'ticket_room' };
  return { ok: true, payload: p };
}
/**
 * Báo cáo trong phòng (REST `POST /api/v1/reports`, ngữ cảnh `room`): { context: 'room', room, slot, sid, reason? }.
 * `sid` là dấu phiên kết nối do DO cấp trong `welcome`/`join`; API hỏi DO `whois` để biết đúng người (hợp đồng §4).
 */
export function checkRoomReport(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) || p.context !== 'room') return { ok: false, code: 'invalid_payload' };
  const r = parseRoom(p.room);
  if (!r || (r.kind === 'hall' && !r.shard) || !Number.isInteger(p.slot) || p.slot < 0 || p.slot > 0xffff) return { ok: false, code: 'invalid_payload' };
  if (typeof p.sid !== 'string' || !/^[A-Za-z0-9_-]{16,32}$/.test(p.sid)) return { ok: false, code: 'invalid_payload' };
  if (p.reason !== undefined && (typeof p.reason !== 'string' || [...p.reason].length > 500)) return { ok: false, code: 'invalid_payload' };
  return { ok: true, v: { room: p.room, slot: p.slot, sid: p.sid, reason: p.reason ?? null } };
}

/** Nonce 16 byte ngẫu nhiên cho vé và dấu phiên kết nối (sid) */
export const nonce = () => b64u(crypto.getRandomValues(new Uint8Array(16)));

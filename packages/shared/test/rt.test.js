import { describe, expect, it } from 'vitest';
import {
  BATCH_HEAD, BLK_MAX, REC, STATES, b64u, byteYaw, checkTicketPayload, decodeBatch, decodeState, encodeBatch, encodeState, hallShard, nonce,
  parseRoom, signTicket, unb64u, validRec, verifyTicket, yawByte,
} from '../src/rt.js';

const rec = (o = {}) => ({ slot: 7, x: 12.5, y: 75, z: -3.25, state: STATES.toa_thien, yaw: Math.PI / 2, ...o });

describe('tên phòng', () => {
  it('hall gốc, hall shard, island', () => {
    expect(parseRoom('hall:t0')).toEqual({ kind: 'hall', tier: 0, shard: null, host: null });
    expect(parseRoom('hall:t2:s13')).toEqual({ kind: 'hall', tier: 2, shard: 13, host: null });
    expect(parseRoom('island:u_01HXYZabcd')).toEqual({ kind: 'island', tier: null, shard: null, host: 'u_01HXYZabcd' });
    expect(hallShard(1, 3)).toBe('hall:t1:s3');
  });
  it('sai dạng → null', () => {
    for (const r of ['hall:t5', 'hall:t0:s0', 'hall:t0:s100', 'hall:t0:s01', 'island:ngắn', 'island:a b c d e f', 'group:x', '', null, 'hall:t0 ', 'x'.repeat(81)]) expect(parseRoom(r)).toBeNull();
  });
});

describe('bản ghi 16 byte', () => {
  it('mã hóa/giải mã little-endian đúng vị trí byte', () => {
    const b = encodeState(rec());
    expect(b.byteLength).toBe(REC);
    const dv = new DataView(b);
    expect(dv.getUint16(0, true)).toBe(7);
    expect(dv.getFloat32(2, true)).toBe(12.5);
    expect(dv.getFloat32(6, true)).toBe(75);
    expect(dv.getFloat32(10, true)).toBe(-3.25);
    expect(dv.getUint8(14)).toBe(1);
    expect(dv.getUint8(15)).toBe(64);   // π/2 × 256 / 2π
    const r = decodeState(b);
    expect(r).toMatchObject({ slot: 7, x: 12.5, y: 75, z: -3.25, state: 1 });
    expect(r.yaw).toBeCloseTo(Math.PI / 2, 5);
    expect(decodeState(new Uint8Array(b))).toEqual(r);
  });
  it('yaw: âm, vượt 2π, làm tròn 256 nấc', () => {
    expect(yawByte(0)).toBe(0);
    expect(yawByte(-Math.PI / 2)).toBe(192);
    expect(yawByte(Math.PI * 2)).toBe(0);
    expect(yawByte(Math.PI * 4 + Math.PI)).toBe(128);
    expect(byteYaw(128)).toBeCloseTo(Math.PI, 9);
  });
  it('sai độ dài → null', () => {
    for (const x of [new ArrayBuffer(15), new ArrayBuffer(17), new Uint8Array(0), 'abc', null]) expect(decodeState(x)).toBeNull();
  });
  it('validRec: số hữu hạn, trong giới hạn phòng, trạng thái 0–5', () => {
    expect(validRec(rec())).toBe(true);
    for (const bad of [rec({ x: NaN }), rec({ y: Infinity }), rec({ x: 500 }), rec({ y: 600 }), rec({ state: 6 }), rec({ state: 1.5 }), null]) expect(validRec(bad)).toBe(false);
    expect(validRec(rec({ x: 300 }), 'island')).toBe(false);
    expect(validRec(rec(), 'group')).toBe(false);
  });
});

describe('khung gộp', () => {
  it('[1][count][0] + count × 16, giải mã lại đúng', () => {
    const recs = [rec(), rec({ slot: 8, x: -1, state: 4 }), rec({ slot: 300, state: 0, yaw: 0 })];
    const b = encodeBatch(recs);
    expect(b.byteLength).toBe(BATCH_HEAD + 3 * REC);
    const dv = new DataView(b);
    expect([dv.getUint8(0), dv.getUint16(1, true), dv.getUint8(3)]).toEqual([1, 3, 0]);
    expect(decodeBatch(b).map((r) => [r.slot, r.state])).toEqual([[7, 1], [8, 4], [300, 0]]);
    expect(decodeBatch(encodeBatch([]))).toEqual([]);
  });
  it('200 người = 3.204 byte', () => expect(encodeBatch(Array.from({ length: 200 }, (_, i) => rec({ slot: i }))).byteLength).toBe(3204));
  it('sai kiểu hoặc độ dài → null', () => {
    const b = new Uint8Array(encodeBatch([rec()]));
    const wrongType = b.slice(); wrongType[0] = 2;
    for (const x of [wrongType, b.slice(0, b.length - 1), new Uint8Array(3), null]) expect(decodeBatch(x)).toBeNull();
  });
});

describe('vé v1', () => {
  const SECRET = 'bi-mat-thu-chi-de-kiem-thu';
  const now = 1_800_000_000_000;
  const P = (o = {}) => ({ v: 1, uid: 'u_01HXYZabcd', room: 'hall:t0:s1', tinh_danh: 'Tuệ Thái', tag: '5696', look: { robe: 1 }, blk: [], exp: now + 60000, n: nonce(), ...o });
  it('ký rồi kiểm: đúng phòng, còn hạn', async () => {
    const t = await signTicket(SECRET, P());
    expect(t.startsWith('v1.')).toBe(true);
    const r = await verifyTicket(SECRET, t, { now, room: 'hall:t0:s1' });
    expect(r.ok).toBe(true);
    expect(r.payload).toMatchObject({ uid: 'u_01HXYZabcd', tinh_danh: 'Tuệ Thái', tag: '5696' });
  });
  it('hết hạn, sai phòng, sai khóa, sửa thân vé → từ chối', async () => {
    const t = await signTicket(SECRET, P());
    expect((await verifyTicket(SECRET, t, { now: now + 60001, room: 'hall:t0:s1' })).code).toBe('ticket_expired');
    expect((await verifyTicket(SECRET, t, { now, room: 'hall:t0:s2' })).code).toBe('ticket_room');
    expect((await verifyTicket('khoa-khac', t, { now })).code).toBe('ticket_invalid');
    const [v, body, sig] = t.split('.');
    const forged = JSON.parse(new TextDecoder().decode(unb64u(body))); forged.uid = 'u_khac_12345';
    const t2 = [v, b64u(new TextEncoder().encode(JSON.stringify(forged))), sig].join('.');
    expect((await verifyTicket(SECRET, t2, { now })).code).toBe('ticket_invalid');
    for (const bad of ['', 'v1.a', 'v2.' + body + '.' + sig, 'v1.' + body + '.!!', 'v1.' + body + '.' + sig.slice(0, 10), null, 'x'.repeat(5000)]) expect((await verifyTicket(SECRET, bad, { now })).ok).toBe(false);
    expect((await verifyTicket('', t, { now })).ok).toBe(false);
  });
  it('thân vé sai hợp đồng: không ký được', async () => {
    const bad = [P({ v: 2 }), P({ uid: 'ngắn' }), P({ room: 'hall:t0' }), P({ room: 'group:x' }), P({ tinh_danh: 'A' }), P({ tag: '56' }), P({ look: [] }),
      P({ blk: Array.from({ length: BLK_MAX + 1 }, (_, i) => 'u_chan_' + String(i).padStart(4, '0')) }), P({ blk: ['x'] }), P({ exp: 1.5 }), P({ n: 'ngan' })];
    for (const p of bad) { expect(checkTicketPayload(p)).toBe(false); await expect(signTicket(SECRET, p)).rejects.toThrow(); }
    await expect(signTicket('', P())).rejects.toThrow('rt_unavailable');
    expect(checkTicketPayload(P({ room: 'island:u_01HXYZabcd', look: null }))).toBe(true);
  });
  it('nonce 16 byte base64url, mỗi lần một khác', () => {
    const a = nonce(), b = nonce();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a).not.toBe(b);
  });
});

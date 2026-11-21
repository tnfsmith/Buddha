// Durable Object ReminderClock (#106): các ca nghiệm thu DO của hợp đồng docs/contracts/reminder-clock.md §7.
// Dịch vụ push là hàm giả gắn vào đối tượng; đồng hồ cố định. Mỗi ca dùng người dùng và DO riêng.
import { describe, it, expect, vi } from 'vitest';
import { env, runInDurableObject } from 'cloudflare:test';
import { b64u } from '../src/webpush.js';

const MIN = 60_000, DAY = 86_400_000;
const at = (d, hm) => { const [h, m] = hm.split(':').map(Number); return Date.UTC(2026, 10, d, h - 7, m); };   // giờ Việt Nam, tháng 11/2026
let seq = 0;

async function keys() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  return { p256dh: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) };
}
/** Một người, các nhắc và các thiết bị đã đăng ký; trả { uid, stub, subs } */
async function seed({ rems, devices = 2, tz = 'Asia/Ho_Chi_Minh' }) {
  const n = ++seq, uid = `u${n}`, db = env.DB;
  await db.batch([
    db.prepare('INSERT INTO user (id, createdAt, updatedAt) VALUES (?, 0, 0)').bind(uid),
    db.prepare("INSERT INTO profile (user_id, tinh_danh, tag, look_json, tz, created_at, updated_at) VALUES (?, 'Tâm An', '1234', '{}', ?, 0, 0)").bind(uid, tz),
    db.prepare('INSERT INTO practice_profile (user_id, updated_at) VALUES (?, 0)').bind(uid),
  ]);
  for (const r of rems) {
    await db.prepare('INSERT INTO reminder (id, user_id, kind, local_hm, days_mask, channel, next_at, active, paused_until, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)')
      .bind(`${uid}-${r.id}`, uid, r.kind || 'thien', r.hm, r.mask ?? 127, r.channel || 'push', r.next, r.active ?? 1, r.paused ?? null).run();
  }
  const subs = [];
  for (let i = 0; i < devices; i++) {
    const k = await keys(), s = { id: `${uid}-s${i}`, endpoint: i % 2 ? `https://updates.push.services.mozilla.com/wpush/v2/${uid}-${i}` : `https://fcm.googleapis.com/fcm/send/${uid}-${i}`, ...k };
    await db.prepare('INSERT INTO push_subscription (id, user_id, endpoint, p256dh, auth, fail_count, created_at) VALUES (?, ?, ?, ?, ?, 0, 0)').bind(s.id, uid, s.endpoint, s.p256dh, s.auth).run();
    subs.push(s);
  }
  const stub = env.REMINDER_CLOCK.get(env.REMINDER_CLOCK.idFromName(`rc-test-${n}`));
  for (const r of rems) if (r.next !== null) await stub.schedule({ user_id: uid, reminder_id: `${uid}-${r.id}`, next_at: r.next });
  return { uid, stub, subs, rid: (id) => `${uid}-${id}` };
}
/** Chạy alarm lúc `now`; `plan(endpoint, lầnGọi)` trả mã HTTP hoặc 'neterr'. Trả các lần gọi dịch vụ push. */
async function tick(stub, now, plan = () => 201, envPatch) {
  const calls = [];
  await runInDurableObject(stub, async (inst) => {
    inst.now = () => now;
    if (envPatch) inst.env = { ...inst.env, ...envPatch };
    inst.pushFetch = async (url, init) => {
      calls.push({ url, init });
      const st = plan(url, calls.filter((c) => c.url === url).length);
      if (st === 'neterr') throw new Error('mất kết nối');
      return new Response(null, { status: st });
    };
    await inst.alarm();
  });
  return calls;
}
const sql = (stub, q, ...a) => runInDurableObject(stub, (inst, state) => state.storage.sql.exec(q, ...a).toArray());
const nextAt = async (id) => (await env.DB.prepare('SELECT next_at FROM reminder WHERE id = ?').bind(id).first()).next_at;
const sub = (id) => env.DB.prepare('SELECT fail_count, last_ok_at FROM push_subscription WHERE id = ?').bind(id).first();
const atOf = (call) => call.init.headers.Topic && call.init.body && call;   // thân đã mã hóa; giờ gốc kiểm qua bảng occ

describe('lịch và alarm', () => {
  it('schedule hai lần cùng dữ liệu → một dòng, alarm không đổi; null xóa; cancelUser dọn hết', async () => {
    const t = at(23, '06:00'), { uid, stub, rid } = await seed({ rems: [{ id: 'a', hm: '06:00', next: t }] });
    const a1 = await runInDurableObject(stub, (i, s) => s.storage.getAlarm());
    expect(await stub.schedule({ user_id: uid, reminder_id: rid('a'), next_at: t })).toEqual({ ok: true });
    expect(await sql(stub, 'SELECT * FROM idx')).toEqual([{ reminder_id: rid('a'), user_id: uid, next_at: t }]);
    expect(await runInDurableObject(stub, (i, s) => s.storage.getAlarm())).toBe(a1);
    expect(a1).toBe(t);
    expect(await stub.stats()).toMatchObject({ rows: 1, next_alarm: t });
    expect(await stub.schedule({ user_id: uid, reminder_id: rid('a'), next_at: 'mai' })).toEqual({ ok: false, code: 'invalid' });
    await stub.schedule({ user_id: uid, reminder_id: rid('a'), next_at: null });
    expect(await sql(stub, 'SELECT * FROM idx')).toEqual([]);
    expect(await runInDurableObject(stub, (i, s) => s.storage.getAlarm())).toBeNull();
    await stub.schedule({ user_id: uid, reminder_id: rid('a'), next_at: t });
    await stub.cancelUser({ user_id: uid });
    expect((await stub.stats()).rows).toBe(0);
  });

  it('đúng giờ: một lượt tới hai thiết bị, một dòng occ; D1 hẹn 06:00 hôm sau; đăng ký ghi last_ok_at', async () => {
    const t = at(23, '06:00'), { stub, subs, rid } = await seed({ rems: [{ id: 'a', hm: '06:00', next: t }] });
    const calls = await tick(stub, t + 20_000);
    expect(calls.map((c) => c.url).sort()).toEqual(subs.map((s) => s.endpoint).sort());
    expect(calls.every((c) => atOf(c) && c.init.headers.Topic === 'thien')).toBe(true);
    expect(await sql(stub, 'SELECT occ_key, local_date, due_at, done FROM occ')).toEqual([{ occ_key: `${rid('a')}:2026-11-23`, local_date: '2026-11-23', due_at: t, done: 1 }]);
    expect(await nextAt(rid('a'))).toBe(t + DAY);
    expect(await sql(stub, 'SELECT next_at FROM idx')).toEqual([{ next_at: t + DAY }]);
    expect(await sub(subs[0].id)).toEqual({ fail_count: 0, last_ok_at: t + 20_000 });
    // alarm chạy lại cùng lúc: không gửi trùng
    expect(await tick(stub, t + 25_000)).toEqual([]);
  });

  it('giới hạn theo lượt: nhắc thứ hai trong ngày vẫn gửi, lượt thứ ba khác nhau trong cùng ngày bị bỏ nhưng vẫn hẹn lần sau', async () => {
    const { stub, rid } = await seed({ devices: 1, rems: [{ id: 'a', hm: '06:00', next: at(23, '06:00') }, { id: 'b', kind: 'nhiem_vu', hm: '12:00', next: at(23, '12:00') }, { id: 'c', kind: 'ghi_nhan', hm: '20:00', next: at(23, '20:00') }] });
    expect(await tick(stub, at(23, '06:00'))).toHaveLength(1);
    expect(await tick(stub, at(23, '12:00'))).toHaveLength(1);
    expect(await tick(stub, at(23, '20:00'))).toHaveLength(0);
    expect((await sql(stub, 'SELECT count(*) AS n FROM occ'))[0].n).toBe(2);
    expect(await nextAt(rid('c'))).toBe(at(24, '20:00'));
  });

  it('429 giữ giờ gốc: lượt thử lúc 06:05 dùng khóa của 06:00, chỉ gửi thiết bị bị từ chối; next_at đã sang ngày mai', async () => {
    const t = at(23, '06:00'), { stub, subs, rid } = await seed({ rems: [{ id: 'a', hm: '06:00', next: t }] });
    let first = true;
    const plan = (u) => { if (u === subs[1].endpoint && first) { first = false; return 429; } return 201; };
    expect(await tick(stub, t, plan)).toHaveLength(2);
    expect(await nextAt(rid('a'))).toBe(t + DAY);
    expect(await sql(stub, 'SELECT attempt, retry_at, done FROM occ')).toEqual([{ attempt: 2, retry_at: t + 5 * MIN, done: 0 }]);
    expect(await runInDurableObject(stub, (i, s) => s.storage.getAlarm())).toBe(t + 5 * MIN);
    const again = await tick(stub, t + 5 * MIN, plan);
    expect(again.map((c) => c.url)).toEqual([subs[1].endpoint]);
    expect(await sql(stub, 'SELECT due_at, done FROM occ')).toEqual([{ due_at: t, done: 1 }]);
    expect((await sql(stub, 'SELECT status FROM sent ORDER BY sub_id')).map((r) => r.status)).toEqual(['ok', 'ok']);
  });

  it('429 rồi bước hẹn lần sau lỗi: alarm chạy lại lúc 06:01 không gửi sớm, chỉ hẹn lại; lượt thử vẫn gửi lúc 06:05', async () => {
    const t = at(23, '06:00'), { stub, rid } = await seed({ devices: 1, rems: [{ id: 'a', hm: '06:00', next: t }] });
    await runInDurableObject(stub, async (inst) => {
      inst.now = () => t; inst.pushFetch = async () => new Response(null, { status: 429 });
      const adv = inst.advance; inst.advance = async () => { inst.advance = adv; throw new Error('D1 tạm lỗi'); };
      await expect(inst.alarm()).rejects.toThrow('D1 tạm lỗi');
    });
    expect(await nextAt(rid('a'))).toBe(t);   // D1 chưa kịp hẹn lần sau
    expect(await tick(stub, t + MIN)).toEqual([]);
    expect(await nextAt(rid('a'))).toBe(t + DAY);
    expect(await sql(stub, 'SELECT retry_at, done FROM occ')).toEqual([{ retry_at: t + 5 * MIN, done: 0 }]);
    expect(await tick(stub, t + 5 * MIN)).toHaveLength(1);
    expect(await sql(stub, 'SELECT done FROM occ')).toEqual([{ done: 1 }]);
  });

  it('tắt nhắc trước 06:05 thì lượt đang thử lại bị hủy, không gửi; cancel cũng hủy', async () => {
    const t = at(23, '06:00'), { stub, subs, rid } = await seed({ devices: 1, rems: [{ id: 'a', hm: '06:00', next: t }, { id: 'b', kind: 'nhiem_vu', hm: '06:00', next: t }] });
    await tick(stub, t, () => 429);
    await env.DB.prepare('UPDATE reminder SET active = 0 WHERE id = ?').bind(rid('a')).run();
    await stub.cancel({ reminder_id: rid('b') });
    expect(await tick(stub, t + 5 * MIN, () => 201)).toEqual([]);
    expect((await sql(stub, 'SELECT done FROM occ')).map((r) => r.done)).toEqual([1, 1]);
    expect((await sql(stub, 'SELECT status FROM sent')).map((r) => r.status)).toEqual(['cancel', 'cancel']);
    expect(subs).toHaveLength(1);
  });

  it('dừng sau 3 lần thử: thiết bị còn 429 chuyển fail, fail_count tăng một', async () => {
    const t = at(23, '06:00'), { stub, subs } = await seed({ devices: 1, rems: [{ id: 'a', hm: '06:00', next: t }] });
    for (const k of [0, 5, 10]) await tick(stub, t + k * MIN, () => 429);
    expect(await sql(stub, 'SELECT attempt, done FROM occ')).toEqual([{ attempt: 3, done: 1 }]);
    expect((await sql(stub, 'SELECT status FROM sent'))[0].status).toBe('fail');
    expect((await sub(subs[0].id)).fail_count).toBe(1);
    expect(await tick(stub, t + 15 * MIN, () => 201)).toEqual([]);
  });

  it('giờ yên lặng theo giờ thực: nhắc 21:28 gặp 429 thì lượt thử 21:33 bị hủy; alarm 21:20 đến trễ lúc 21:35 thì bỏ lượt, vẫn hẹn', async () => {
    const a = await seed({ devices: 1, rems: [{ id: 'a', hm: '21:28', next: at(23, '21:28') }] });
    expect(await tick(a.stub, at(23, '21:28'), () => 429)).toHaveLength(1);
    expect(await tick(a.stub, at(23, '21:33'), () => 201)).toEqual([]);
    const b = await seed({ devices: 1, rems: [{ id: 'b', hm: '21:20', next: at(23, '21:20') }] });
    expect(await tick(b.stub, at(23, '21:35'))).toEqual([]);
    expect(await nextAt(b.rid('b'))).toBe(at(24, '21:20'));
  });

  it('không rõ kết quả (mất kết nối, 502): unknown, không thử lại, fail_count giữ nguyên; 410 xóa đăng ký; 400 cộng fail_count', async () => {
    const t = at(23, '06:00'), { stub, subs } = await seed({ devices: 4, rems: [{ id: 'a', hm: '06:00', next: t }] });
    const st = { [subs[0].endpoint]: 'neterr', [subs[1].endpoint]: 502, [subs[2].endpoint]: 410, [subs[3].endpoint]: 400 };
    await tick(stub, t, (u) => st[u]);
    expect((await sql(stub, 'SELECT sub_id, status FROM sent ORDER BY sub_id')).map((r) => r.status)).toEqual(['unknown', 'unknown', 'gone', 'fail']);
    expect(await sql(stub, 'SELECT done FROM occ')).toEqual([{ done: 1 }]);
    expect((await sub(subs[0].id)).fail_count).toBe(0);
    expect(await sub(subs[2].id)).toBeNull();
    expect((await sub(subs[3].id)).fail_count).toBe(1);
  });

  it('phục hồi sending: alarm trước bị dừng sau khi dịch vụ đã nhận → unknown, không gọi lại, không cộng fail_count', async () => {
    const t = at(23, '06:00'), { stub, subs, rid } = await seed({ devices: 1, rems: [{ id: 'a', hm: '06:00', next: t }] });
    const key = `${rid('a')}:2026-11-23`;
    await runInDurableObject(stub, (i, s) => {
      s.storage.sql.exec("INSERT INTO occ (occ_key, reminder_id, user_id, local_date, due_at, kind, local_hm) VALUES (?, ?, ?, '2026-11-23', ?, 'thien', '06:00')", key, rid('a'), subs[0].id.split('-')[0], t);
      s.storage.sql.exec("INSERT INTO sent (key, occ_key, sub_id, status, at) VALUES (?, ?, ?, 'sending', ?)", `${key}:${subs[0].id}`, key, subs[0].id, t);
    });
    expect(await tick(stub, t + 10_000)).toEqual([]);
    expect((await sql(stub, 'SELECT status FROM sent'))[0].status).toBe('unknown');
    expect((await sub(subs[0].id)).fail_count).toBe(0);
    expect(await nextAt(rid('a'))).toBe(t + DAY);
  });

  it('API đổi giờ trước khi alarm chạy → không gửi theo giờ cũ; Tịnh khẩu, trễ quá 30 phút, cờ tắt → không gửi, vẫn hẹn', async () => {
    const t = at(23, '06:00'), a = await seed({ devices: 1, rems: [{ id: 'a', hm: '06:00', next: t }] });
    await env.DB.prepare('UPDATE reminder SET local_hm = ?, next_at = ? WHERE id = ?').bind('07:00', at(23, '07:00'), a.rid('a')).run();
    expect(await tick(a.stub, t)).toEqual([]);
    expect(await sql(a.stub, 'SELECT next_at FROM idx')).toEqual([{ next_at: at(23, '07:00') }]);

    const b = await seed({ devices: 1, rems: [{ id: 'b', hm: '06:00', next: t, paused: t + 2 * DAY }] });
    expect(await tick(b.stub, t)).toEqual([]);
    expect(await nextAt(b.rid('b'))).toBe(t + 2 * DAY);

    const c = await seed({ devices: 1, rems: [{ id: 'c', hm: '06:00', next: t }] });
    expect(await tick(c.stub, t + 31 * MIN)).toEqual([]);
    expect(await nextAt(c.rid('c'))).toBe(t + DAY);

    const d = await seed({ devices: 1, rems: [{ id: 'd', hm: '06:00', next: t }] });
    expect(await tick(d.stub, t, () => 201, { REMINDERS_ENABLED: '0' })).toEqual([]);
    expect(await nextAt(d.rid('d'))).toBe(t + DAY);
    expect(await sql(d.stub, 'SELECT count(*) AS n FROM occ')).toEqual([{ n: 0 }]);
  });

  it('log chỉ có số đếm, không user_id, endpoint hay khóa', async () => {
    const t = at(23, '06:00'), { uid, stub, subs } = await seed({ devices: 2, rems: [{ id: 'a', hm: '06:00', next: t }] });
    const spy = vi.spyOn(console, 'log');
    await tick(stub, t, (u) => (u === subs[0].endpoint ? 201 : 410));
    const out = spy.mock.calls.flat().join('\n'); spy.mockRestore();
    expect(out).toContain('"reminder_clock"');
    for (const bad of [uid, subs[0].endpoint, subs[1].endpoint, subs[0].p256dh, subs[0].auth, env.VAPID_PRIVATE_KEY]) expect(out).not.toContain(bad);
  });
});

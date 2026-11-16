// #94: chạy route thật trong workerd + D1, dùng nguyên hợp đồng client #96.
import { describe, it, expect } from 'vitest';
import { foldPractice, importEvents, MAX_EVENTS_PER_DAY, PRACTICE_V } from '@vandao/shared/practice.js';
import { getLocalDate } from '../src/utils/time.js';
import { linkGuest } from '../src/auth/link.js';
import { env, call, guest, sync, DAY, TZ } from './helpers.js';

const shift = (date, n) => new Date(Date.parse(date) + n * DAY).toISOString().slice(0, 10);
const me = async (token, full = true) => (await call('/api/v1/me' + (full ? '?entries=1' : ''), {}, token)).json();
const op = (id, payload = {}, at = Date.now()) => ({ id, type: 'practice.event', at,
  payload: { date: getLocalDate(Date.now(), TZ), kind: 'viec', slot: 'gioi.1', value: { id: 'sn-gioi-1-01', parami: ['sila'] }, ...payload } });
const rowCount = async (uid, table) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`).bind(uid).first()).n;
const seedDay = (uid, date, n) => env.DB.prepare(`INSERT INTO practice_event (user_id, id, program, cycle, local_date, kind, slot, value_json, at, server_at)
  SELECT ?1, 'seed-' || value, 'so-nhap-49', 1, ?2, 'viec', 'hanh', NULL, ?3, ?3 FROM json_each(?4)`)
  .bind(uid, date, Date.now(), JSON.stringify(Array.from({ length: n }, (_, i) => i))).run();

describe('practice.event — máy chủ cho hai thiết bị', () => {
  it('nhận đủ ba loại, trả theo at/id, gộp đúng sổ và tăng rev mà không đổi Kusala', async () => {
    const { token, user } = await guest(), before = await me(token), t = Date.now() - 1000, date = getLocalDate(t, TZ);
    const ops = [
      op('b', { date, at: t, value: null }), op('a', { date, at: t }), // gửi ngược id; cùng giờ b bỏ giới a
      op('vow', { date, kind: 'vow', slot: '1', value: { id: 'sn-nguyen-tuan-1' }, at: t + 1 }),
      op('tu-2', { date, kind: 'tu', slot: 'thoi_thien', value: { n: 1, min: 15, refs: ['dai-thien'] }, at: t + 3 }),
      op('tu-1', { date, kind: 'tu', slot: 'thoi_thien', value: { n: 1, min: 15, refs: ['dai-thien'] }, at: t + 2 }),
    ];
    const result = await sync(token, ops), full = await me(token), light = await me(token, false);
    expect(result.rejected).toEqual([]); expect(result.applied).toHaveLength(5);
    expect(result.state.practice).toBe(PRACTICE_V); expect(full.practice).toBe(PRACTICE_V);
    expect(light).not.toHaveProperty('events'); expect(light).not.toHaveProperty('entries');
    expect(full.events.map((e) => e.id)).toEqual(['a', 'b', 'vow', 'tu-1', 'tu-2']);
    expect(full.events[1].value).toBeNull(); expect(full.events[0]).not.toHaveProperty('value_json');
    expect(foldPractice(full.events)).toEqual({ viec: {}, nguyen: { 1: { id: 'sn-nguyen-tuan-1', at: t + 1 } },
      tu: { [date]: { thoi_thien: { n: 2, min: 30, refs: ['dai-thien'] } } } });
    expect(result.state.journey.rev).toBe(before.journey.rev + 5);
    expect(full.journey.rev).toBe(result.state.journey.rev); expect(full.totals).toEqual(before.totals);
    expect(full.journey.day).toBe(before.journey.day); expect(full.journey.sessions_done).toBe(before.journey.sessions_done);
    const retry = await sync(token, ops);
    expect(retry.applied).toHaveLength(5); expect(retry.state.journey.rev).toBe(full.journey.rev);
    expect(await rowCount(user.id, 'practice_event')).toBe(5);
  });

  it.each([
    ['invalid_slot', { slot: 'gioi.6' }],
    ['invalid_kind', { kind: 'note' }],
    ['invalid_date', { date: '2026-02-31' }],
    ['invalid_value', { value: { id: 'lời riêng tư', parami: [] } }],
    ['invalid_value', { kind: 'tu', slot: 'thoi_thien', value: { refs: ['ghi chú riêng tư'] } }],
    ['invalid_value', { kind: 'tu', slot: 'thoi_thien', value: { refs: Array.from({ length: 40 }, (_, i) => 'a'.repeat(77) + i) } }],
    ['invalid_at', { at: -1 }],
  ])('từ chối %s vĩnh viễn, không ghi dấu hoặc tăng rev (%j)', async (code, payload) => {
    const { token, user } = await guest(), before = await me(token);
    const r = await sync(token, [op('invalid', payload)]);
    expect(r.rejected).toEqual([{ id: 'invalid', code, retry: false }]); expect(r.applied).toEqual([]);
    expect(await rowCount(user.id, 'practice_event')).toBe(0); expect(await rowCount(user.id, 'sync_op')).toBe(0);
    expect(r.state.journey.rev).toBe(before.journey.rev);
  });

  it('dùng payload.date, nhận dữ liệu cũ với op.at mới; kiểm các biên ngày/giờ độc lập', async () => {
    const { token, user } = await guest(), now = Date.now(), today = getLocalDate(now, TZ), start = shift(today, -14);
    await env.DB.prepare('UPDATE journey SET started_on = ? WHERE user_id = ?').bind(start, user.id).run();
    const a = await sync(token, [
      op('old', { date: start, at: Date.parse(start) - DAY }),
      op('lower', { date: shift(start, -1), at: Date.parse(start) - 2 * DAY }),
      op('upper', { date: shift(today, 1), at: now + 118000 }),
      op('date-low', { date: shift(start, -2) }), op('date-high', { date: shift(today, 2) }),
      op('time-low', { at: Date.parse(start) - 2 * DAY - 1 }), op('time-high', { at: now + 180000 }),
      op('old-envelope', { date: start }, now - 8 * DAY),
    ]);
    expect(a.applied).toEqual(['old', 'lower', 'upper']);
    expect(a.rejected).toEqual(expect.arrayContaining([
      { id: 'date-low', code: 'date_out_of_range', retry: false }, { id: 'date-high', code: 'date_out_of_range', retry: false },
      ...['time-low', 'time-high', 'old-envelope'].map((id) => ({ id, code: 'invalid_timestamp', retry: false })),
    ])); expect(a.rejected).toHaveLength(5);
    expect((await me(token)).events.find((e) => e.id === 'old')).toMatchObject({ date: start, at: Date.parse(start) - DAY });
  });

  it('biên ngày theo múi giờ hồ sơ, không theo UTC của op.at', async () => {
    const { token, user } = await guest(), tz = 'Pacific/Kiritimati', today = getLocalDate(Date.now(), tz);
    await env.DB.prepare('UPDATE profile SET tz = ? WHERE user_id = ?').bind(tz, user.id).run();
    const r = await sync(token, [op('local-upper', { date: shift(today, 1) }), op('local-too-far', { date: shift(today, 2) })]);
    expect(r.applied).toEqual(['local-upper']); expect(r.rejected[0]).toMatchObject({ id: 'local-too-far', code: 'date_out_of_range' });
  });

  it('hạn 60/ngày: chặn trong cùng lô, vẫn nhận gửi lại và ngày khác', async () => {
    const { token, user } = await guest(), date = getLocalDate(Date.now(), TZ), before = await me(token);
    await seedDay(user.id, date, MAX_EVENTS_PER_DAY - 1);
    const r = await sync(token, [op('last'), op('excess')]);
    expect(r.applied).toEqual(['last']); expect(r.rejected).toEqual([{ id: 'excess', code: 'too_many_events', retry: false }]);
    expect(r.state.journey.rev).toBe(before.journey.rev + 1);
    expect((await sync(token, [op('last')])).applied).toEqual(['last']);
    expect((await sync(token, [op('tomorrow', { date: shift(date, 1) })])).applied).toEqual(['tomorrow']);
    expect(await rowCount(user.id, 'practice_event')).toBe(MAX_EVENTS_PER_DAY + 1);
  });

  it('hai thiết bị gửi cùng lúc không vượt 60; sự kiện bị chặn không tăng rev/ghi sync_op', async () => {
    const { token, user } = await guest(), date = getLocalDate(Date.now(), TZ), before = await me(token);
    await seedDay(user.id, date, MAX_EVENTS_PER_DAY - 1);
    const results = await Promise.all([sync(token, [op('phone')]), sync(token, [op('pc')])]);
    expect(results.flatMap((r) => r.applied)).toHaveLength(1);
    expect(results.flatMap((r) => r.rejected)).toEqual([expect.objectContaining({ code: 'too_many_events', retry: false })]);
    expect(await rowCount(user.id, 'practice_event')).toBe(MAX_EVENTS_PER_DAY);
    expect(await rowCount(user.id, 'sync_op')).toBe(1); expect((await me(token)).journey.rev).toBe(before.journey.rev + 1);
  });

  it('db.batch lỗi ở dấu sync_op thì rollback cả sự kiện và rev, gửi lại sau sửa lỗi thành công', async () => {
    const { token, user } = await guest(), before = await me(token);
    await env.DB.exec("CREATE TRIGGER practice_test_failure BEFORE INSERT ON sync_op WHEN NEW.op_id = 'rollback-op' BEGIN SELECT RAISE(ABORT, 'test rollback'); END;");
    try {
      const r = await sync(token, [op('rollback-op')]);
      expect(r.rejected).toEqual([{ id: 'rollback-op', code: 'db_error', retry: true }]);
      expect(await rowCount(user.id, 'practice_event')).toBe(0); expect(await rowCount(user.id, 'sync_op')).toBe(0);
      expect((await me(token)).journey.rev).toBe(before.journey.rev);
    } finally { await env.DB.exec('DROP TRIGGER practice_test_failure'); }
    expect((await sync(token, [op('rollback-op')])).applied).toEqual(['rollback-op']);
  });

  it('imp.* đưa sổ cũ lên: chống trùng cả sau khi cron dọn sync_op', async () => {
    const { token, user } = await guest(), date = getLocalDate(Date.now(), TZ);
    const source = { viec: { [date]: { gioi: { 1: { id: 'sn-gioi-1-01', parami: ['sila'] } } } },
      nguyen: { 1: { id: 'sn-nguyen-tuan-1', at: Date.now() } }, tu: { [date]: { thoi_thien: { n: 2, min: 30, refs: [] } } } };
    const ops = importEvents(source, date, 'device-cycle1').map(({ id, ...payload }) => op(id, payload));
    expect((await sync(token, ops)).applied).toHaveLength(3);
    const full = await me(token); expect(foldPractice(full.events)).toMatchObject({ viec: source.viec, tu: source.tu });
    await env.DB.prepare('DELETE FROM sync_op WHERE user_id = ?').bind(user.id).run();
    const retry = await sync(token, ops);
    expect(retry.applied).toHaveLength(3); expect(retry.rejected).toEqual([]);
    expect(retry.state.journey.rev).toBe(full.journey.rev); expect((await me(token)).events).toEqual(full.events);
  });

  it('cách ly tài khoản/chu kỳ: /me chỉ chu kỳ hiện tại, export đủ lịch sử, xóa user cascade', async () => {
    const A = await guest(), B = await guest();
    await sync(A.token, [op('same-id')]); await sync(B.token, [op('same-id', { value: null })]);
    const reset = await sync(A.token, [{ id: 'reset', type: 'journey.reset_cycle', at: Date.now() }]);
    expect(reset.state.practice).toBe(PRACTICE_V); expect((await me(A.token)).events).toEqual([]);
    expect((await sync(A.token, [op('cycle2')])).applied).toEqual(['cycle2']);
    expect((await me(A.token)).events.map((e) => e.id)).toEqual(['cycle2']);
    expect((await me(B.token)).events).toEqual([expect.objectContaining({ id: 'same-id', value: null })]);
    const exported = await (await call('/api/v1/export', {}, A.token)).json();
    expect(exported.practice_events.map((e) => e.cycle).sort()).toEqual([1, 2]);
    expect(exported.practice_events.every((e) => e.value?.id === 'sn-gioi-1-01')).toBe(true);
    await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(A.user.id).run();
    expect(await rowCount(A.user.id, 'practice_event')).toBe(0); expect(await rowCount(B.user.id, 'practice_event')).toBe(1);
  });

  it.each([false, true])('khách đăng nhập: giữ sổ mới khi chuyển/gộp tài khoản (đích có sổ: %s)', async (targetHasEvents) => {
    const G = await guest(), T = await guest();
    await sync(G.token, [op('guest-event')]);
    if (targetHasEvents) await sync(T.token, [op('target-event')]);
    const result = await linkGuest(env.DB, G.user, T.user);
    expect(result.moved).toBe(targetHasEvents ? 'archive' : 'guest');
    expect((await me(T.token)).events.map((e) => e.id)).toEqual([targetHasEvents ? 'target-event' : 'guest-event']);
    const exported = await (await call('/api/v1/export', {}, T.token)).json();
    expect(exported.practice_events.map((e) => e.id).sort()).toEqual(targetHasEvents ? ['guest-event', 'target-event'] : ['guest-event']);
    expect(await rowCount(G.user.id, 'practice_event')).toBe(0);
    expect(await env.DB.prepare('SELECT id FROM user WHERE id = ?').bind(G.user.id).first()).toBeNull();
  });
});

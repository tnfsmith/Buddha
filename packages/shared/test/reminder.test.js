import { describe, expect, it } from 'vitest';
import { solarToLunar } from '../src/amlich.js';
import {
  LATE_MS, MAX_ACTIVE, SEND_FINAL, SHARDS, canSend, checkReminder, checkReminders, inQuiet, isTraiDate, localParts, nextReminderAt, occKey, occurrenceValid, pauseUntil, pushPayload, quietAt, recoverStatus, sendKey, shardOf, zonedToUtc,
} from '../src/reminder.js';

const VN = 'Asia/Ho_Chi_Minh';
const at = (iso) => Date.parse(iso);
const iso = (t) => new Date(t).toISOString();
const R = (o = {}) => ({ kind: 'thien', local_hm: '06:30', days_mask: 127, active: true, paused_until: null, ...o });

describe('checkReminder / checkReminders', () => {
  it('chuẩn hóa và mặc định', () => {
    expect(checkReminder({ kind: 'thien', local_hm: '06:30' })).toEqual({ ok: true, v: { kind: 'thien', local_hm: '06:30', days_mask: 127, active: false } });
    expect(checkReminder({ kind: 'tong_ket_tuan', local_hm: '19:00', active: true }).v).toMatchObject({ days_mask: 1, active: true });
    expect(checkReminder({ kind: 'uposatha', local_hm: '06:00', days_mask: 3 }).v.days_mask).toBe(127);
  });
  it('giờ yên lặng 21:30–05:00 bị từ chối', () => {
    for (const hm of ['21:30', '23:59', '00:00', '04:59']) expect(checkReminder({ kind: 'thien', local_hm: hm }).code).toBe('reminder_quiet_hours');
    for (const hm of ['05:00', '21:29']) expect(checkReminder({ kind: 'thien', local_hm: hm }).ok).toBe(true);
    expect(inQuiet('21:29')).toBe(false);
  });
  it('dữ liệu sai → invalid_reminder, không ném lỗi', () => {
    const bad = [null, [], 'x', { kind: 'nhom', local_hm: '06:00' }, { kind: 'toString', local_hm: '06:00' }, { kind: 'thien', local_hm: '6:30' },
      { kind: 'thien', local_hm: '24:00' }, { kind: 'thien', local_hm: '06:30', days_mask: 0 }, { kind: 'thien', local_hm: '06:30', days_mask: 128 },
      { kind: 'thien', local_hm: '06:30', days_mask: 1.5 }, { kind: 'thien', local_hm: '06:30', active: 'true' }, { kind: 'thien', local_hm: '06:30', note: 'x' },
      { kind: 'tong_ket_tuan', local_hm: '19:00', days_mask: 3 }];
    for (const b of bad) expect(checkReminder(b)).toMatchObject({ ok: false, code: 'invalid_reminder' });
  });
  it('tối đa một nhắc mỗi loại và MAX_ACTIVE nhắc đang bật', () => {
    expect(MAX_ACTIVE).toBe(2);
    expect(checkReminders([R(), R({ kind: 'uposatha' })].map(({ paused_until, ...x }) => x)).ok).toBe(true);
    expect(checkReminders([{ kind: 'thien', local_hm: '06:30' }, { kind: 'thien', local_hm: '07:30' }]).code).toBe('invalid_reminder');
    const three = ['thien', 'nhiem_vu', 'ghi_nhan'].map((kind) => ({ kind, local_hm: '07:00', active: true }));
    expect(checkReminders(three).code).toBe('reminder_limit');
    expect(checkReminders(three.map((x, i) => ({ ...x, active: i < 2 }))).ok).toBe(true);
    expect(checkReminders('x').code).toBe('invalid_reminder');
  });
});

describe('pauseUntil (Tịnh khẩu)', () => {
  it('1–30 ngày; 0 bỏ tạm dừng', () => {
    const now = at('2026-11-19T00:00:00Z');
    expect(pauseUntil(1, now).v).toBe(now + 86400000);
    expect(pauseUntil(30, now).ok).toBe(true);
    expect(pauseUntil(0, now)).toEqual({ ok: true, v: null });
    for (const d of [31, -1, 1.5, '3']) expect(pauseUntil(d, now).code).toBe('invalid_pause');
  });
});

describe('múi giờ', () => {
  it('Asia/Ho_Chi_Minh: không đổi giờ, UTC+7', () => {
    expect(iso(zonedToUtc('2026-11-19', '06:30', VN))).toBe('2026-11-18T23:30:00.000Z');
    expect(localParts(at('2026-11-18T23:30:00Z'), VN)).toEqual({ date: '2026-11-19', hm: '06:30', dow: 4 });
  });
  it('giờ không tồn tại khi nhảy giờ → ngay sau; giờ lặp → lần đầu', () => {
    const gap = zonedToUtc('2026-03-08', '02:30', 'America/New_York');
    expect(localParts(gap, 'America/New_York').hm).toBe('03:30');
    expect(iso(zonedToUtc('2026-11-01', '01:30', 'America/New_York'))).toBe('2026-11-01T05:30:00.000Z');
  });
});

describe('nextReminderAt', () => {
  const now = at('2026-11-19T00:00:00Z');   // 07:00 thứ Năm 19/11 giờ Việt Nam
  it('hằng ngày: hôm nay đã qua giờ → ngày mai', () => {
    expect(iso(nextReminderAt(R(), { tz: VN, now }))).toBe('2026-11-19T23:30:00.000Z');
    expect(iso(nextReminderAt(R({ local_hm: '20:00' }), { tz: VN, now }))).toBe('2026-11-19T13:00:00.000Z');
  });
  it('đúng giờ nhắc thì lấy lần sau (không gửi lại cùng lượt)', () => {
    const t = at('2026-11-19T13:00:00Z');
    expect(nextReminderAt(R({ local_hm: '20:00' }), { tz: VN, now: t })).toBe(t + 86400000);
  });
  it('days_mask theo Chủ nhật = bit 0', () => {
    expect(iso(nextReminderAt(R({ days_mask: 1 }), { tz: VN, now }))).toBe('2026-11-21T23:30:00.000Z');   // CN 22/11 06:30
    expect(iso(nextReminderAt(R({ days_mask: 1 << 5, local_hm: '06:30' }), { tz: VN, now }))).toBe('2026-11-19T23:30:00.000Z');   // T6 20/11
  });
  it('Tịnh khẩu: không trước paused_until', () => {
    const until = at('2026-11-25T00:00:00Z');   // 07:00 ngày 25/11 giờ Việt Nam
    expect(nextReminderAt(R({ paused_until: until }), { tz: VN, now })).toBe(at('2026-11-25T23:30:00Z'));
    expect(nextReminderAt(R({ paused_until: at('2026-11-24T23:00:00Z') }), { tz: VN, now })).toBe(at('2026-11-24T23:30:00Z'));
  });
  it('tắt, giờ yên lặng, sai múi giờ hay sai dữ liệu → null', () => {
    for (const r of [R({ active: false }), R({ local_hm: '22:00' }), R({ kind: 'nhom' }), R({ days_mask: 0 }), null]) expect(nextReminderAt(r, { tz: VN, now })).toBeNull();
    expect(nextReminderAt(R(), { tz: 'Không/Có', now })).toBeNull();
    expect(nextReminderAt(R(), { tz: VN, now: NaN })).toBeNull();
  });
  it('ngày trai theo lựa chọn hồ sơ, đúng âm lịch', () => {
    for (const mode of ['vn_2', 'vn_4', 'vn_6', 'vn_10']) {
      const t = nextReminderAt(R({ kind: 'uposatha', local_hm: '06:00' }), { tz: VN, now, uposatha: mode });
      const p = localParts(t, VN);
      expect(p.hm).toBe('06:00');
      expect(isTraiDate(p.date, mode)).toBe(true);
      // không có ngày trai nào sớm hơn giữa hôm nay và ngày tìm được
      for (let d = new Date(at(p.date + 'T00:00:00Z') - 86400000); d >= at('2026-11-19T00:00:00Z'); d = new Date(d - 86400000)) {
        const date = d.toISOString().slice(0, 10);
        if (date > '2026-11-19') expect(isTraiDate(date, mode)).toBe(false);
      }
    }
    expect(nextReminderAt(R({ kind: 'uposatha' }), { tz: VN, now, uposatha: 'khong' })).toBeNull();
  });
  it('isTraiDate khớp lịch âm: rằm và mồng một luôn là ngày trai (2 ngày)', () => {
    for (const date of ['2026-11-09', '2026-11-23', '2026-12-09']) {
      const [y, m, d] = date.split('-').map(Number), l = solarToLunar(y, m, d, 7);
      expect(isTraiDate(date, 'vn_2')).toBe(l.day === 1 || l.day === 15);
    }
  });
  it('tổng kết tuần: đúng một ngày', () => {
    const t = nextReminderAt(R({ kind: 'tong_ket_tuan', days_mask: 1, local_hm: '19:00' }), { tz: VN, now });
    expect(localParts(t, VN)).toMatchObject({ date: '2026-11-22', hm: '19:00', dow: 0 });
  });
});

describe('shard, khóa gửi, dữ liệu push', () => {
  it('16 shard ổn định theo user_id', () => {
    expect(SHARDS).toBe(16);
    const s = shardOf('u-tue-thai');
    expect(s).toBe(shardOf('u-tue-thai'));
    expect(s).toBeGreaterThanOrEqual(0); expect(s).toBeLessThan(16);
    const used = new Set(Array.from({ length: 400 }, (_, i) => shardOf('u' + i)));
    expect(used.size).toBe(16);
  });
  it('khóa chống trùng và payload không có chữ riêng tư', () => {
    expect(occKey('r1', '2026-11-20')).toBe('r1:2026-11-20');
    expect(sendKey('r1', '2026-11-20', 's1')).toBe('r1:2026-11-20:s1');
    expect(JSON.parse(pushPayload('thien', 1))).toEqual({ v: 1, kind: 'thien', at: 1 });
  });
});

describe('occurrenceValid (lượt đang thử lại)', () => {
  // Nhắc 06:00 thứ Sáu 20/11 giờ Việt Nam gặp 429; lượt thử lại lúc 06:05 dùng giờ gốc
  const due = at('2026-11-19T23:00:00Z');
  const occ = { kind: 'thien', local_hm: '06:00', local_date: '2026-11-20', due_at: due };
  const rem = R({ local_hm: '06:00', channel: 'push' });
  const ctx = { tz: VN, now: due + 5 * 60000 };
  it('còn hiệu lực khi cấu hình không đổi, kể cả next_at đã sang ngày mai', () => {
    expect(nextReminderAt(rem, { tz: VN, now: due })).toBe(due + 86400000);
    expect(occurrenceValid({ ...rem, next_at: due + 86400000 }, occ, ctx)).toBe(true);
  });
  it('tắt, đổi giờ, đổi loại, khác kênh, xóa nhắc → hủy', () => {
    for (const r of [{ ...rem, active: false }, { ...rem, local_hm: '07:00' }, { ...rem, kind: 'nhiem_vu' }, { ...rem, channel: 'local' }, null]) expect(occurrenceValid(r, occ, ctx)).toBe(false);
  });
  it('Tịnh khẩu phủ giờ gốc → hủy; Tịnh khẩu bắt đầu sau giờ gốc → vẫn thử', () => {
    expect(occurrenceValid({ ...rem, paused_until: due + 86400000 }, occ, ctx)).toBe(false);
    expect(occurrenceValid({ ...rem, paused_until: due - 60000 }, occ, ctx)).toBe(true);
  });
  it('đổi múi giờ, ngày không còn trong days_mask, quá due_at + 30 phút → hủy', () => {
    expect(occurrenceValid(rem, occ, { ...ctx, tz: 'Asia/Tokyo' })).toBe(false);
    expect(occurrenceValid({ ...rem, days_mask: 1 }, occ, ctx)).toBe(false);   // 20/11 là thứ Sáu
    expect(occurrenceValid(rem, occ, { ...ctx, now: due + LATE_MS + 1 })).toBe(false);
    expect(occurrenceValid(rem, occ, { ...ctx, now: due + LATE_MS })).toBe(true);
  });
  it('ngày trai: đổi lựa chọn sang khong → hủy', () => {
    const t = nextReminderAt(R({ kind: 'uposatha', local_hm: '06:00' }), { tz: VN, now: due, uposatha: 'vn_4' });
    const o = { kind: 'uposatha', local_hm: '06:00', local_date: localParts(t, VN).date, due_at: t };
    const r = R({ kind: 'uposatha', local_hm: '06:00' });
    expect(occurrenceValid(r, o, { tz: VN, now: t + 60000, uposatha: 'vn_4' })).toBe(true);
    expect(occurrenceValid(r, o, { tz: VN, now: t + 60000, uposatha: 'khong' })).toBe(false);
  });
});

describe('giờ yên lặng theo giờ thực lúc gửi', () => {
  it('nhắc 21:28 thử lại lúc 21:33 → hủy; thử lúc 21:29 → còn hiệu lực', () => {
    const due = zonedToUtc('2026-11-20', '21:28', VN);
    const occ = { kind: 'thien', local_hm: '21:28', local_date: '2026-11-20', due_at: due };
    const rem = R({ local_hm: '21:28', channel: 'push' });
    expect(occurrenceValid(rem, occ, { tz: VN, now: due + 60000 })).toBe(true);
    expect(occurrenceValid(rem, occ, { tz: VN, now: due + 5 * 60000 })).toBe(false);
  });
  it('quietAt: alarm đến trễ vào giờ yên lặng thì bỏ lượt mới', () => {
    expect(quietAt(zonedToUtc('2026-11-20', '21:35', VN), VN)).toBe(true);
    expect(quietAt(zonedToUtc('2026-11-20', '04:59', VN), VN)).toBe(true);
    expect(quietAt(zonedToUtc('2026-11-20', '05:00', VN), VN)).toBe(false);
    expect(quietAt(NaN, VN)).toBe(false);
    expect(quietAt(0, 'Không/Có')).toBe(false);
  });
});

describe('phục hồi khóa gửi (không gửi trùng)', () => {
  it('chỉ gửi khi chưa có khóa hoặc đang retry', () => {
    expect([undefined, null, 'retry'].map(canSend)).toEqual([true, true, true]);
    expect(['sending', ...SEND_FINAL].map(canSend).every((x) => x === false)).toBe(true);
  });
  it('sending còn lại từ alarm trước bị dừng → unknown, không gửi lại; trạng thái khác giữ nguyên', () => {
    expect(recoverStatus('sending')).toBe('unknown');
    expect(canSend(recoverStatus('sending'))).toBe(false);
    for (const st of ['ok', 'retry', 'gone', 'fail', 'cancel', undefined]) expect(recoverStatus(st)).toBe(st);
  });
});

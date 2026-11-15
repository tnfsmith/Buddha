import { describe, expect, it } from 'vitest';
import { PASSIVE, WEEK_FOCUS, WEEK_PARAMI, calendar, catalogOk, heardEnough, heardIds, listenCode, logPassive, lotus, shiftDate, weakest, weekSitMinutes } from '../src/missions.js';
import { PARAMI } from '../src/parami.js';

describe('danh mục tự ghi nhận', () => {
  it('mọi mã Phước nghiệp sự / Ba-la-mật đều hợp lệ (Phụ lục H)', () => expect(catalogOk()).toBe(true));
  it('7 tuần phủ đủ 10 Ba-la-mật trọng tâm, mỗi tuần hai', () => {
    expect(WEEK_FOCUS).toHaveLength(7);
    expect(WEEK_FOCUS.every((f) => f.length === 2)).toBe(true);
    expect(new Set(WEEK_FOCUS.flat())).toEqual(new Set(Object.keys(PARAMI)));
  });
  it('WEEK_PARAMI có 7 tuần, ba trục', () => { expect(WEEK_PARAMI).toHaveLength(7); for (const w of WEEK_PARAMI) expect(Object.keys(w).sort()).toEqual(['duc', 'thien', 'tue']); });
  it('mã nghe theo loạt', () => { expect(listenCode('duong-xua')).toBe('nghe_duong_xua'); expect(listenCode('loi-phat-day')).toBe('nghe_loi_phat_day'); expect(listenCode(undefined)).toBe('nghe_loi_phat_day'); });
});

describe('ngưỡng nghe trọn', () => {
  it('70 % mặc định, 80 % cho hồi hướng', () => {
    expect(heardEnough(70, 100)).toBe(true); expect(heardEnough(69.9, 100)).toBe(false);
    expect(heardEnough(79, 100, 0.8)).toBe(false); expect(heardEnough(80, 100, 0.8)).toBe(true);
  });
  it('tổng 0, NaN hay âm thì chưa đủ', () => { for (const [a, b] of [[1, 0], [NaN, 10], [5, NaN], [5, -1]]) expect(heardEnough(a, b)).toBe(false); });
});

describe('sổ tự ghi nhận', () => {
  it('cộng lần, phút và mã bài không trùng; không sửa sổ cũ', () => {
    const a = logPassive({}, '2026-11-15', 'thoi_thien', { minutes: 15, ref: 'dai-thien' });
    const b = logPassive(a, '2026-11-15', 'thoi_thien', { minutes: 15, ref: 'dai-thien' });
    expect(a['2026-11-15'].thoi_thien).toEqual({ n: 1, min: 15, refs: ['dai-thien'] });
    expect(b['2026-11-15'].thoi_thien).toEqual({ n: 2, min: 30, refs: ['dai-thien'] });
  });
  it('mã lạ, ngày sai định dạng: giữ nguyên', () => {
    const a = logPassive({}, '2026-11-15', 'nghe_duong_xua', { ref: 'x' });
    expect(logPassive(a, '2026-11-15', 'mua_hang')).toBe(a);
    expect(logPassive(a, '15/11/2026', 'thoi_thien')).toBe(a);
  });
  it('phút bị chặn trong 0–240', () => { expect(logPassive({}, '2026-11-15', 'van_du', { minutes: 9999 })['2026-11-15'].van_du.min).toBe(240); expect(logPassive({}, '2026-11-15', 'van_du', { minutes: -5 })['2026-11-15'].van_du.min).toBe(0); });
});

describe('hoa sen 10 cánh', () => {
  it('mỗi mã chỉ tính một lần mỗi ngày (nghe nhiều bài không cày điểm)', () => {
    let L = {}; for (let i = 0; i < 10; i++) L = logPassive(L, '2026-11-15', 'nghe_duong_xua', { ref: 'b' + i });
    const s = lotus(L);
    expect(s.counts.panna).toBe(1); expect(s.counts.metta).toBe(1);
    expect(s.norm.panna).toBe(1); expect(s.norm.dana).toBe(0);
  });
  it('trục đã ghi nhận làm sáng cánh theo tuần (§8.2) và Sám hối thêm Chân thật', () => {
    const done = { 1: { duc: { E: 10 }, tue: { E: 10 } }, 8: { duc: { E: 10 } } };   // tuần 1: Đức + Tuệ; tuần 2: Đức
    const s = lotus({}, done, 2);
    expect(s.counts.sila).toBe(1); expect(s.counts.metta).toBe(1); expect(s.counts.panna).toBe(1); expect(s.counts.viriya).toBe(1);
    expect(s.counts.sacca).toBe(1 + 2); expect(s.counts.khanti).toBe(1);
    expect(s.total).toBe(8);   // 2 + 2 + 2 cánh từ ba lần ghi nhận, cộng 2 lần Sám hối
  });
  it('cánh yếu nhất để gợi ý; chưa có gì thì null', () => {
    expect(weakest(lotus())).toBe(null);
    const s = lotus(logPassive({}, '2026-11-15', 'thoi_thien', { minutes: 15 }));
    expect(weakest(s)).toBe('dana');
  });
});

describe('lịch tu, nhịp thiền, sổ nghe', () => {
  const log = ['2026-11-13', '2026-11-15'].reduce((L, d) => logPassive(L, d, 'thoi_thien', { minutes: 15 }), logPassive({}, '2026-11-14', 'nghe_loi_phat_day', { ref: 'kalama' }));
  it('lùi ngày đúng qua đầu tháng', () => { expect(shiftDate('2026-12-01', -1)).toBe('2026-11-30'); expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28'); });
  it('49 ô tới hôm nay; ngày trống để trống', () => {
    const c = calendar(log, { 3: { duc: { at: new Date(2026, 10, 12, 20).getTime() } } }, '2026-11-15');
    expect(c).toHaveLength(49); expect(c[48].date).toBe('2026-11-15'); expect(c[0].date).toBe('2026-09-28');
    const by = Object.fromEntries(c.map((x) => [x.date, x]));
    expect(by['2026-11-15']).toMatchObject({ sit: true, listen: false, any: true });
    expect(by['2026-11-14']).toMatchObject({ sit: false, listen: true, any: true });
    expect(by['2026-11-12']).toMatchObject({ confirm: true, any: true });
    expect(by['2026-11-11'].any).toBe(false);
  });
  it('phút thiền 7 ngày gần nhất', () => { expect(weekSitMinutes(log, '2026-11-15')).toBe(30); expect(weekSitMinutes(log, '2026-11-25')).toBe(0); });
  it('bài đã nghe theo loạt', () => { const h = heardIds(log); expect([...h['loi-phat-day']]).toEqual(['kalama']); expect(h['duong-xua'].size).toBe(0); });
  it('PASSIVE không cho sửa', () => { expect(Object.isFrozen(PASSIVE)).toBe(true); expect(Object.isFrozen(PASSIVE.thoi_thien.parami)).toBe(true); });
});

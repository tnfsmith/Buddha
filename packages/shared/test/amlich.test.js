import { describe, expect, it } from 'vitest';
import { solarToLunar, lunarToSolar, lunarOf } from '../src/amlich.js';

describe('Âm lịch Việt Nam (UTC+7)', () => {
  it.each([
    [2024, 2, 10], [2025, 1, 29], [2026, 2, 17], [2027, 2, 6],
  ])('Tết %i-%i-%i là mùng 1 tháng Giêng', (y, m, d) => {
    expect(solarToLunar(y, m, d)).toMatchObject({ day: 1, month: 1, year: y, leap: false });
  });
  it('tháng 2 nhuận năm 2023 bắt đầu 22/3/2023', () => expect(solarToLunar(2023, 3, 22)).toMatchObject({ day: 1, month: 2, leap: true }));
  it('tháng 6 nhuận năm 2025 bắt đầu 25/7/2025', () => expect(solarToLunar(2025, 7, 25)).toMatchObject({ day: 1, month: 6, leap: true }));
  it('rằm tháng Giêng 2026 là 3/3/2026', () => expect(lunarToSolar(2026, 1, 15)).toEqual([2026, 3, 3]));
  it('đổi qua lại khớp nhau suốt năm 2026', () => {
    for (let t = Date.UTC(2026, 0, 1); t < Date.UTC(2027, 0, 1); t += 86400e3) {
      const d = new Date(t), L = solarToLunar(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      expect(lunarToSolar(L.year, L.month, L.day, L.leap)).toEqual([d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]);
      expect([29, 30]).toContain(L.monthLength);
    }
  });
  it('tháng nhuận không tồn tại thì trả null', () => expect(lunarToSolar(2026, 3, 1, true)).toBeNull());
  it('lunarOf tính theo giờ Việt Nam, không theo múi giờ máy', () => {
    // 17:30 UTC ngày 16/2/2026 = 00:30 ngày 17/2/2026 giờ VN = mùng 1 Tết
    expect(lunarOf(new Date(Date.UTC(2026, 1, 16, 17, 30)))).toMatchObject({ day: 1, month: 1, year: 2026 });
  });
});

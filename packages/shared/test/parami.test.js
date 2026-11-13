import { describe, expect, it } from 'vitest';
import { PUNNA, PARAMI, PILLAR_PUNNA, isPunna, isParami } from '../src/parami.js';

describe('Mã Phước nghiệp sự và Ba-la-mật (Phụ lục H)', () => {
  it('đủ 10 mỗi loại', () => { expect(Object.keys(PUNNA)).toHaveLength(10); expect(Object.keys(PARAMI)).toHaveLength(10); });
  it('ba trục ứng với Sīla – Dāna – Bhāvanā', () => expect(PILLAR_PUNNA).toEqual({ duc: 'sila', thien: 'dana', tue: 'bhavana' }));
  it('kiểm mã', () => { expect(isPunna('veyyavacca')).toBe(true); expect(isParami('upekkha')).toBe(true); expect(isPunna('toString')).toBe(false); });
});

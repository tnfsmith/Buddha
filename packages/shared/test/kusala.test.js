import { describe, expect, it } from 'vitest';
import { kusala, KUSALA, validFactor } from '../src/kusala.js';

describe('Kusala — E = 10 × (trước+trong+sau)/3 × 1,5 (như lý tác ý) × 1,25 (tự giác)', () => {
  it('mặc định ra 10', () => expect(kusala({})).toBe(10));
  it('đủ hai hệ số: 18,75', () => expect(kusala({ wise: true, self: true })).toBe(18.75));
  it('chặn trên 22,5 và chặn dưới 5 với thanh trượt [0,5; 1,2]', () => {
    expect(kusala({ pre: 1.2, during: 1.2, post: 1.2, wise: true, self: true })).toBe(22.5);
    expect(kusala({ pre: 0.5, during: 0.5, post: 0.5 })).toBe(5);
  });
  it('làm tròn 2 chữ số', () => expect(kusala({ pre: 0.9, during: 1.1, post: 1.05, wise: true })).toBe(15.25));
  it('hằng số không đổi', () => expect(KUSALA).toMatchObject({ BASE: 10, MIN: 0.5, MAX: 1.2, WISE: 1.5, SELF: 1.25 }));
  it('kiểm hệ số đầu vào', () => {
    expect(validFactor(0.5)).toBe(true);
    expect(validFactor(1.2)).toBe(true);
    expect(validFactor(1.21)).toBe(false);
    expect(validFactor('1')).toBe(false);
    expect(validFactor(NaN)).toBe(false);
  });
});

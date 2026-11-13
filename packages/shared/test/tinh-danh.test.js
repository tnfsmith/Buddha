import { describe, expect, it } from 'vitest';
import { checkName, suggestNames, tidyName } from '../src/tinh-danh.js';

const ok = (n) => checkName(n).ok;

describe('Tịnh danh — 4 quy tắc', () => {
  it('chuẩn hóa hoa thường và khoảng trắng', () => expect(tidyName('  tâm   an ')).toBe('Tâm An'));
  it('chấp nhận tên hợp lệ', () => { expect(ok('Tâm An')).toBe(true); expect(ok('Minh Tịnh Hạnh')).toBe(true); });
  it('2 đến 3 chữ, tối đa 16 ký tự', () => { expect(ok('An')).toBe(false); expect(ok('Tâm An Lạc Tịnh')).toBe(false); });
  it('chỉ chữ cái tiếng Việt', () => { expect(ok('Tâm An1')).toBe(false); expect(ok('Tâm @n')).toBe(false); });
  it('cần ít nhất một chữ mang nghĩa tu tập', () => expect(ok('Lan Hương')).toBe(false));
  it('không tự xưng quả vị, giáo phẩm', () => {
    for (const n of ['Phật Tâm', 'Thánh An', 'Bồ Tát An', 'La Hán Tâm', 'Thiền Sư An', 'Phat Tam']) expect(ok(n)).toBe(false);
  });
  it('trả 4 dòng quy tắc kèm nghĩa', () => {
    const c = checkName('Tâm An');
    expect(c.rules).toHaveLength(4);
    expect(c.meaning).toContain('bình an');
  });
  it('gợi ý luôn hợp lệ và không trùng', () => {
    let seed = 1; const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const list = suggestNames(30, rand);
    expect(new Set(list).size).toBe(30);
    for (const n of list) expect(ok(n), n).toBe(true);
  });
});

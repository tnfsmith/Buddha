import { describe, it, expect } from 'vitest';
import { checkAccountReport } from '../account-ci-report.mjs';

const good = { expected: 2, unexpected: 0, skipped: 0, flaky: 0 };
describe('cửa kiểm tài khoản đầy đủ', () => {
  it('chỉ nhận đủ hai ca thành công', () => {
    expect(() => checkAccountReport({ stats: good, errors: [] })).not.toThrow();
  });
  it.each([undefined, { ...good, expected: 0 }, { ...good, expected: 1, skipped: 1 },
    { ...good, unexpected: 1 }, { ...good, flaky: 1 }])('chặn thiếu/skip/lỗi/retry: %j', (stats) => {
    expect(() => checkAccountReport({ stats })).toThrow();
  });
  it('chặn lỗi thiết lập ngoài ca kiểm thử', () => {
    expect(() => checkAccountReport({ stats: good, errors: [{ message: 'worker failed' }] })).toThrow();
  });
});

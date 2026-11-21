import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

describe('ngân sách kích thước bản dựng', () => {
  let root;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'vandao-size-'));
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'public', 'assets'), { recursive: true });
    copyFileSync(new URL('../size-budget.mjs', import.meta.url), join(root, 'scripts', 'size-budget.mjs'));
    writeFileSync(join(root, 'public', 'index.html'), Buffer.alloc(105));
    writeFileSync(join(root, 'public', 'assets', 'app-abc.js'), Buffer.alloc(80));
    writeFileSync(join(root, 'public', 'assets', 'dong-tu-def.js'), Buffer.alloc(20));
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function run(files, groups = {}) {
    writeFileSync(join(root, 'scripts', 'size-budget.json'), JSON.stringify({ files, groups }));
    return spawnSync(process.execPath, [join(root, 'scripts', 'size-budget.mjs')], { encoding: 'utf8' });
  }

  it('cảnh báo tăng quá 3% nhưng chấp nhận tệp trong trần', () => {
    const result = run({ 'public/index.html': { baseline: 100, max: 105 } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('vượt 3 %');
  });

  it('đo từng tệp khớp glob và chỉ cộng các tệp tải đầu mỗi tệp một lần', () => {
    const files = { 'public/assets/dong-tu-*.js': { max: 20 } };
    const patterns = ['public/index.html', 'public/assets/app-*.js', 'public/assets/app-abc.js'];
    const result = run(files, { 'Lượt tải đầu': { patterns, max: 185 } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Lượt tải đầu: 185 byte');
    const over = run({ 'public/assets/dong-tu-*.js': { max: 19 } }, { 'Lượt tải đầu': { patterns, max: 184 } });
    expect(over.status).toBe(1);
    expect(over.stderr).toContain('dong-tu-def.js: 20 byte');
    expect(over.stderr).toContain('Lượt tải đầu: 185 byte');
  });

  it('báo lỗi khi mục bắt buộc của nhóm không sinh ra tệp', () => {
    const result = run({}, { 'Lượt tải đầu': { patterns: ['public/index.html', 'public/assets/three-*.js'], max: 200 } });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('public/assets/three-*.js: không tìm thấy tệp bản dựng');
  });
});

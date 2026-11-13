import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { check, laneOf, parseNameStatus } from '../lane-guard-core.mjs';

const cfg = parse(readFileSync(new URL('../../.github/lanes.yml', import.meta.url), 'utf8'));
const run = (branch, files, labels) => check({ branch, files: files.map((f) => (typeof f === 'string' ? { status: 'M', path: f } : f)), labels, cfg }).violations;

describe('lane-guard', () => {
  it('nhận làn theo tiền tố nhánh', () => {
    expect(laneOf('claude/12-x')).toBe('claude');
    expect(laneOf('ag/3-api')).toBe('antigravity');
    expect(laneOf('hermes/9-report')).toBe('hermes');
    expect(laneOf('feature/x')).toBeNull();
  });
  it('nhánh không tiền tố bị chặn', () => expect(run('feature/x', ['apps/web/src/world.js'])).toHaveLength(1));
  it('Claude sửa tệp 3D: qua', () => expect(run('claude/1-sky', ['apps/web/src/world.js', 'apps/web/src/rt/net.js'])).toEqual([]));
  it('Claude sửa workflow: chặn', () => expect(run('claude/1-x', ['.github/workflows/ci.yml'])[0].reason).toMatch(/Ngoài làn/));
  it('vùng dùng chung cần nhãn shared-ok', () => {
    expect(run('claude/1-x', ['packages/shared/src/kusala.js'])[0].reason).toMatch(/shared-ok/);
    expect(run('claude/1-x', ['packages/shared/src/kusala.js'], ['shared-ok'])).toEqual([]);
  });
  it('Hermes chỉ content/ops/docs/reports', () => {
    expect(run('hermes/2-r', ['content/catalog/a.md', 'ops/k6/hall.js', 'docs/reports/2026-11-13.md'])).toEqual([]);
    expect(run('hermes/2-r', ['workers/api/src/index.ts'])).toHaveLength(1);
  });
  it('migration mới chỉ từ Antigravity', () => {
    expect(run('ag/5-db', [{ status: 'A', path: 'db/migrations/0006_practice_plus.sql' }])).toEqual([]);
    expect(run('claude/5-db', [{ status: 'A', path: 'db/migrations/0006_practice_plus.sql' }])).toHaveLength(1);
  });
  it('sửa migration đã merge luôn bị chặn, kể cả owner', () => {
    expect(run('ag/5-db', [{ status: 'M', path: 'db/migrations/0001_auth.sql' }])[0].reason).toMatch(/không được sửa/);
    expect(run('owner/x', [{ status: 'D', path: 'db/migrations/0001_auth.sql' }])).toHaveLength(1);
  });
  it('owner sửa mọi nơi', () => expect(run('owner/gd0', ['.github/workflows/ci.yml', 'apps/web/src/main.js', 'workers/api/x.ts'])).toEqual([]));
  it('hotfix được sửa làn claude/antigravity/shared, không đụng content', () => {
    expect(run('hotfix/1', ['apps/web/src/world.js', 'workers/api/a.ts', 'apps/web/src/main.js'])).toEqual([]);
    expect(run('hotfix/1', ['content/a.md'])).toHaveLength(1);
  });
  it('đổi tên kiểm cả đường cũ và mới', () => {
    expect(run('claude/1', [{ status: 'R', from: 'apps/web/src/world.js', path: 'workers/api/world.js' }])).toHaveLength(1);
  });
  it('đọc kết quả git diff --name-status', () => {
    expect(parseNameStatus('M\ta.js\nR100\told.js\tnew.js\nA\tb.js\n')).toEqual([
      { status: 'M', path: 'a.js' }, { status: 'R', from: 'old.js', path: 'new.js' }, { status: 'A', path: 'b.js' },
    ]);
  });
});

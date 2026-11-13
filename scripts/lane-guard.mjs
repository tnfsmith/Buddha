#!/usr/bin/env node
// Lane-guard (PROJECT_ROADMAP.md §14.7): đánh đỏ CI khi PR sửa tệp ngoài làn của nhánh.
// Biến môi trường: HEAD_REF (nhánh nguồn), BASE_REF (mặc định main), PR_LABELS (JSON mảng tên nhãn).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { check, parseNameStatus } from './lane-guard-core.mjs';

const branch = process.env.HEAD_REF || execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
const base = process.env.BASE_REF || 'main';
const labels = (() => { try { return JSON.parse(process.env.PR_LABELS || '[]') ?? []; } catch { return []; } })();

const cfg = parse(readFileSync(new URL('../.github/lanes.yml', import.meta.url), 'utf8'));
const diff = execFileSync('git', ['diff', '--name-status', '-M', `origin/${base}...HEAD`], { encoding: 'utf8' });
const files = parseNameStatus(diff);
const { lane, violations } = check({ branch, files, labels, cfg });

console.log(`lane-guard: nhánh ${branch} → làn ${lane ?? '?'} · ${files.length} tệp đổi · nhãn: ${labels.join(', ') || '(không)'}`);
if (violations.length) {
  for (const x of violations) console.log(`  ✗ ${x.path} — ${x.reason}`);
  console.log(`\n${violations.length} vi phạm. Tách thay đổi sang đúng làn, hoặc xin nhãn shared-ok cho vùng dùng chung (AGENTS.md).`);
  process.exit(1);
}
console.log('  ✓ mọi tệp đúng làn');

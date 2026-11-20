#!/usr/bin/env node
// Ngân sách kích thước bản dựng (DoD: không tăng quá 3 % so với mốc nếu không giải thích).
import { globSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const { files, groups } = JSON.parse(readFileSync(new URL('./size-budget.json', import.meta.url), 'utf8'));
let fail = false;

function matches(pattern) {
  const entries = globSync(pattern, { cwd: root, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name));
  if (entries.length === 0) {
    console.error(`✗ ${pattern}: không tìm thấy tệp bản dựng`);
    fail = true;
  }
  return entries;
}

function check(label, size, { baseline, max }) {
  const change = baseline === undefined ? '' : `, thay đổi ${((size / baseline - 1) * 100).toFixed(1)} % so với mốc ${baseline} byte`;
  const line = `${label}: ${size} byte (trần ${max} byte${change})`;
  if (size > max) {
    console.error(`✗ ${line}`);
    fail = true;
  } else if (baseline !== undefined && size > baseline * 1.03) {
    console.log(`⚠ ${line} — vượt 3 %: ghi lý do trong PR`);
  } else {
    console.log(`✓ ${line}`);
  }
}

for (const [pattern, limit] of Object.entries(files)) {
  for (const file of matches(pattern)) check(file.slice(root.length), statSync(file).size, limit);
}
// Mỗi nhóm có patterns, max và có thể có baseline. Chỉ liệt kê tài nguyên tải ngay để tính lượt tải đầu.
for (const [label, { patterns, ...limit }] of Object.entries(groups)) {
  const uniqueFiles = new Set(patterns.flatMap(matches));
  const total = [...uniqueFiles].reduce((sum, file) => sum + statSync(file).size, 0);
  check(label, total, limit);
}
process.exitCode = fail ? 1 : 0;

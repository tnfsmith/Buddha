#!/usr/bin/env node
// Ngân sách kích thước bản dựng (DoD: không tăng quá 3 % so với mốc nếu không giải thích).
import { readFileSync, statSync } from 'node:fs';

const budget = JSON.parse(readFileSync(new URL('./size-budget.json', import.meta.url), 'utf8'));
let fail = false;
for (const [file, { baseline, max }] of Object.entries(budget)) {
  const size = statSync(new URL(`../${file}`, import.meta.url)).size;
  const pct = ((size / baseline - 1) * 100).toFixed(1);
  const line = `${file}: ${(size / 1024).toFixed(0)} KB (mốc ${(baseline / 1024).toFixed(0)} KB, ${pct >= 0 ? '+' : ''}${pct} %, trần ${(max / 1024).toFixed(0)} KB)`;
  if (size > max) { console.log('✗ ' + line); fail = true; }
  else if (size > baseline * 1.03) console.log('⚠ ' + line + ' — vượt 3 %: ghi lý do trong PR');
  else console.log('✓ ' + line);
}
process.exit(fail ? 1 : 0);

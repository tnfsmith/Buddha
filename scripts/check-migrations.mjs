#!/usr/bin/env node
// Kiểm migration D1 (PROJECT_ROADMAP.md §4.1): tên NNNN_ten.sql, đánh số liên tục từ 0001, không trùng.
// Việc "không sửa migration đã merge" do lane-guard kiểm trên diff của PR.
import { existsSync, readdirSync } from 'node:fs';

const dir = new URL('../db/migrations/', import.meta.url);
if (!existsSync(dir)) { console.log('check-migrations: chưa có db/migrations (sẽ có từ GĐ2) — bỏ qua'); process.exit(0); }
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const bad = [];
files.forEach((f, i) => {
  const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
  if (!m) bad.push(`${f}: sai mẫu NNNN_ten.sql (chữ thường, số, gạch dưới)`);
  else if (+m[1] !== i + 1) bad.push(`${f}: số thứ tự phải là ${String(i + 1).padStart(4, '0')}`);
});
if (bad.length) { bad.forEach((b) => console.log('✗ ' + b)); process.exit(1); }
console.log(`check-migrations: ${files.length} tệp hợp lệ`);

import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { previewMigrationPolicy } from './preview-migration-policy.mjs';

const paths = execFileSync('git', ['diff', '--name-only', '--no-renames', 'origin/main...HEAD'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const policy = previewMigrationPolicy(paths);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `remote_allowed=${policy.remoteAllowed}\n`);
console.log(policy.remoteAllowed ? 'Không có migration chưa merge: preview cũ được phép chạy.'
  : `Chỉ kiểm cục bộ; không upload preview dùng D1 staging trước khi migration vào main: ${policy.migrations.join(', ')}`);

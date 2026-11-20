import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { previewMigrationPolicy } from './preview-migration-policy.mjs';
import { previewBinding } from './preview-bindings.mjs';

const paths = execFileSync('git', ['diff', '--name-only', '--no-renames', 'origin/main...HEAD'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
const isolated = Boolean(previewBinding(process.env.BUDDHA_PREVIEW_BINDINGS, process.env.PR));
const required = process.env.BUDDHA_PREVIEW_REQUIRE_ISOLATION === 'true';
const policy = previewMigrationPolicy(paths, { isolated, required });
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `remote_allowed=${policy.remoteAllowed}\nisolated=${isolated}\n`);
if (isolated) console.log('PR đã được chỉ định cặp D1/KV riêng; xác minh tài nguyên trước khi áp migration.');
else if (required) console.log('Chỉ kiểm cục bộ vì PR chưa có cặp D1/KV riêng.');
else console.log(policy.remoteAllowed ? 'Không có migration chưa merge: preview cũ được phép chạy.'
  : `Chỉ kiểm cục bộ; không upload preview dùng D1 staging trước khi migration vào main: ${policy.migrations.join(', ')}`);

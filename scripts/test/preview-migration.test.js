import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { previewMigrationPolicy } from '../preview-migration-policy.mjs';

it('chặn hai PR có schema độc lập và mọi đổi/xóa/đổi tên migration chưa nằm trên main', () => {
  for (const paths of [['db/migrations/0008_content_meta.sql'], ['workers/api/src/index.js', 'db/migrations/0008_other.sql'], ['db/migrations/0007_cu.sql', 'db/migrations/0008_moi.sql']]) {
    expect(previewMigrationPolicy(paths).remoteAllowed).toBe(false);
  }
  expect(previewMigrationPolicy(['workers/api/src/routes/content.js', 'scripts/tts/README.md']).remoteAllowed).toBe(true);
});
it('workflow bắt buộc qua cổng trước job có Cloudflare, không cấp secrets cho cổng', () => {
  const workflow = parse(readFileSync(new URL('../../.github/workflows/preview.yml', import.meta.url), 'utf8'));
  expect(workflow.jobs.preview.needs).toContain('migration-policy');
  expect(workflow.jobs.preview.if).toContain("needs.migration-policy.outputs.remote_allowed == 'true'");
  expect(JSON.stringify(workflow.jobs['migration-policy'])).not.toContain('CF_STAGING');
  const deploy = parse(readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8'));
  expect(deploy.jobs.staging.concurrency).toEqual({ group: 'deploy-staging', 'cancel-in-progress': false });
  expect(deploy.jobs.production.concurrency).toEqual({ group: 'deploy-production', 'cancel-in-progress': false });
});

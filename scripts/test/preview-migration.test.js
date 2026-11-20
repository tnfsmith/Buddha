import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { previewMigrationPolicy } from '../preview-migration-policy.mjs';
import { isolatedConfig, previewBinding, verifyPreviewResources } from '../preview-bindings.mjs';

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

const a = { d1: '11111111-1111-4111-8111-111111111111', kv: 'a'.repeat(32) };
const b = { d1: '22222222-2222-4222-8222-222222222222', kv: 'b'.repeat(32) };
const settings = (name, d1, kv) => ({
  name,
  main: 'src/index.js',
  d1_databases: [{ binding: 'DB', database_id: d1, database_name: name, migrations_dir: '../../db/migrations' }],
  kv_namespaces: [{ binding: 'CONFIG', id: kv }],
});
const staging = settings('vandao-staging', '33333333-3333-4333-8333-333333333333', 'c'.repeat(32));
const prod = settings('vandao', '44444444-4444-4444-8444-444444444444', 'd'.repeat(32));

it('hai PR chỉ dùng cặp riêng; chế độ bắt buộc chặn PR không có cặp dù không đổi schema', () => {
  const raw = JSON.stringify({ 142: a, 146: b });
  const first = previewBinding(raw, '142'), second = previewBinding(raw, '146');
  expect(previewBinding(raw, '1')).toBeNull();
  expect(first).toEqual({ ...a, dbName: 'vandao-core-preview-pr-142', kvName: 'vandao-config-preview-pr-142' });
  expect(second.d1).not.toBe(first.d1);
  expect(second.kv).not.toBe(first.kv);
  expect(previewMigrationPolicy(['db/migrations/0012_practice_choice.sql'], { isolated: true, required: true }).remoteAllowed).toBe(true);
  expect(previewMigrationPolicy([], { required: true }).remoteAllowed).toBe(false);
  const config = isolatedConfig(staging, prod, first);
  expect(config.d1_databases[0]).toMatchObject({ database_id: a.d1, database_name: first.dbName });
  expect(config.kv_namespaces[0].id).toBe(a.kv);
  expect(config.name).toBe('vandao-staging');
  expect(config).not.toHaveProperty('triggers');
});

it('từ chối dùng chung ID giữa hai PR hoặc mượn ID staging/production', () => {
  expect(() => previewBinding(JSON.stringify({ 142: a, 146: { ...b, kv: a.kv } }), '142')).toThrow('riêng');
  expect(() => previewBinding(JSON.stringify({ 142: a, 146: { ...b, d1: a.d1 } }), '142')).toThrow('riêng');
  const pair = previewBinding(JSON.stringify({ 142: a }), '142');
  expect(() => isolatedConfig(staging, prod, { ...pair, d1: staging.d1_databases[0].database_id })).toThrow('staging');
  expect(() => isolatedConfig(staging, prod, { ...pair, kv: prod.kv_namespaces[0].id })).toThrow('production');
  expect(() => previewBinding(JSON.stringify({ unknown: a }), '142')).toThrow('không hợp lệ');
});

it('đối chiếu đúng tên Cloudflare chỉ bằng GET và dừng khi bản đồ trỏ sai', async () => {
  const pair = previewBinding(JSON.stringify({ 142: a }), '142');
  const account = 'e'.repeat(32);
  const paths = [];
  const read = async (url, options) => {
    paths.push(url);
    expect(options.method).toBeUndefined();
    return Response.json({ success: true, result: url.includes('/d1/database/')
      ? { uuid: pair.d1, name: pair.dbName } : { id: pair.kv, title: pair.kvName } });
  };
  await expect(verifyPreviewResources(account, 'test-only', pair, read)).resolves.toBeUndefined();
  expect(paths).toEqual([
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${a.d1}`,
    `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${a.kv}`,
  ]);
  await expect(verifyPreviewResources(account, 'test-only', pair, async () => Response.json({
    success: true, result: { uuid: pair.d1, name: 'vandao-core-staging' },
  }))).rejects.toThrow('không đúng cặp');
});

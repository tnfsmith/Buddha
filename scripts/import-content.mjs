import { mkdir, mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { readPublished, contentSql } from './content-data.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const { values } = parseArgs({ options: { env: { type: 'string' }, remote: { type: 'boolean' }, local: { type: 'boolean' }, check: { type: 'boolean' } } });
  const { remote, local, env: target, check } = values;
  if ((remote && local) || (check && (remote || local)) || (target && !['staging', 'production'].includes(target)) || ((remote || local) && !target)) throw new Error('Dùng --check hoặc --env staging|production --local|--remote');
  const rows = readPublished(join(root, 'content/bai-giang'));
  console.log(`content: ${rows.length} bài đã chọn phát hành; reviewed_* tùy chọn; ghi meta JSON sau migration 0008.`);
  if ((remote || local) && rows.length) {
    const scratch = join(root, '.wrangler');
    await mkdir(scratch, { recursive: true });
    const dir = await mkdtemp(join(scratch, 'content-')), sqlPath = join(dir, 'content.sql');
    try {
      await writeFile(sqlPath, contentSql(rows), 'utf8');
      const db = target === 'staging' ? 'vandao-core-staging' : 'vandao-core';
      const result = spawnSync(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', 'execute', db,
        remote ? '--remote' : '--local', '--env', target === 'staging' ? 'staging' : '', '--file', sqlPath],
      { cwd: join(root, 'workers/api'), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, stdio: 'inherit' });
      if (result.error || result.status !== 0) throw new Error('Nạp D1 không thành công');
    } finally { await unlink(sqlPath).catch(() => {}); await rmdir(dir); }
  }
} catch (error) { console.error(`content: ${error.message}`); process.exitCode = 1; }

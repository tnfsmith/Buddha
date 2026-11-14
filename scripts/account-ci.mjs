#!/usr/bin/env node
// Chạy đúng hai ca tài khoản hiện có bằng Worker/workerd + D1 riêng, không đụng Cloudflare từ xa.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { checkAccountReport } from './account-ci-report.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const apiRoot = join(root, 'workers/api');
const require = createRequire(import.meta.url);
const tempRoot = join(root, '.wrangler');
await mkdir(tempRoot, { recursive: true });
const scratch = await mkdtemp(join(tempRoot, 'vandao-account-ci-'));
const reportPath = join(root, 'test-results/account-ci-report.json');
let server, child;
let stopped = false;

async function stop() {
  if (stopped) return;
  stopped = true;
  child?.kill('SIGTERM');
  await server?.close();
  // Chỉ xóa thư mục tạm do runner vừa tạo, đã kiểm vị trí trước khi xóa đệ quy trên Windows.
  if (dirname(scratch) !== tempRoot || !basename(scratch).startsWith('vandao-account-ci-')) throw new Error('Thư mục tạm không hợp lệ');
  await rm(scratch, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { stop().finally(() => process.exit(1)); });

try {
  process.env.WRANGLER_WRITE_LOGS = 'false';
  process.env.WRANGLER_SEND_METRICS = 'false';
  process.env.CLOUDFLARE_INCLUDE_PROCESS_ENV = 'false';
  const { createTestHarness, experimental_readRawConfig } = await import('wrangler');
  await readFile(join(root, 'apps/web/public/index.html')); // CI dựng trước; không âm thầm kiểm bản cũ/file://.
  const { rawConfig } = experimental_readRawConfig({ config: join(apiRoot, 'wrangler.jsonc') });
  const { env, ...base } = rawConfig;
  const config = { ...base, ...env.staging };
  config.routes = [];
  config.triggers = { crons: [] };
  config.main = resolve(apiRoot, config.main);
  config.assets = { ...config.assets, directory: resolve(apiRoot, config.assets.directory) };
  config.d1_databases = config.d1_databases.map((db) => ({ ...db, migrations_dir: resolve(apiRoot, db.migrations_dir), remote: false }));
  for (const key of ['kv_namespaces', 'r2_buckets']) config[key] = config[key].map((binding) => ({ ...binding, remote: false }));
  // Config nằm trong thư mục tạm không có .dev.vars/.env. Secret chỉ truyền qua binding trong bộ nhớ.
  config.vars = { ENV_NAME: 'test' };
  const configPath = join(scratch, 'wrangler.json');
  await writeFile(configPath, JSON.stringify(config));
  server = createTestHarness({ root: scratch, workers: [{ configPath, secrets: { BETTER_AUTH_SECRET: randomBytes(32).toString('hex') } }] });
  const { url } = await server.listen();
  // WebAuthn yêu cầu RP là tên miền, không chấp nhận địa chỉ IP 127.0.0.1.
  const browserUrl = new URL(url); browserUrl.hostname = 'localhost';
  await server.getWorker().applyD1Migrations('DB');
  const health = await fetch(new URL('/api/health', url));
  if (!health.ok || (await health.json()).service !== 'vandao-api') throw new Error('Worker kiểm thử chưa sẵn sàng');
  await mkdir(dirname(reportPath), { recursive: true });
  await rm(reportPath, { force: true });
  console.log(`Tài khoản: Worker/D1 cục bộ riêng tại ${browserUrl.origin}; chạy đủ hai ca với API thật.`);
  const code = await new Promise((done, reject) => {
    // Không qua npm/npx/shell: đường dẫn Windows có dấu & và khoảng trắng giữ nguyên.
    child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', 'tests/e2e/account.spec.js',
      '--grep', 'đầy đủ với Worker thật', '--workers=1', '--retries=0', '--reporter=list,json', '--trace=retain-on-failure'], {
      cwd: root, stdio: 'inherit', windowsHide: true,
      env: { ...process.env, E2E_ACCOUNT: browserUrl.href, E2E_BASE_URL: browserUrl.href, PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath },
    });
    child.once('error', reject);
    child.once('exit', (status) => done(status ?? 1));
  });
  if (code !== 0) throw new Error(`Kiểm thử tài khoản thất bại (mã ${code})`);
  checkAccountReport(JSON.parse(await readFile(reportPath, 'utf8')));
  console.log('Tài khoản: 2/2 ca đầy đủ thành công, không skip.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await stop();
}

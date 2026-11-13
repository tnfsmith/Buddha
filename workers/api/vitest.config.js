// Kiểm thử workers/api chạy trong workerd (Miniflare) với D1 thật, áp dụng đủ migration db/migrations (T2.1 #10).
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(here('../../db/migrations'));
  return {
    plugins: [cloudflareTest({
      main: './src/index.js',
      miniflare: {
        compatibilityDate: '2026-11-01',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['DB'],
        kvNamespaces: ['CONFIG'],
        ratelimits: Object.fromEntries([['RL_AUTH', 5], ['RL_POLL', 60], ['RL_OTP', 3], ['RL_SYNC', 30], ['RL_API', 60], ['RL_TICKET', 20]]
          .map(([n, limit], i) => [n, { namespace_id: String(1001 + i), simple: { limit, period: 60 } }])),
        bindings: { TEST_MIGRATIONS: migrations, BETTER_AUTH_SECRET: 'kiem-thu-khong-dung-o-dau-ca-0123456789', RT_SECRET: 'test-shared-secret-123', ENV_NAME: 'test' },
      },
    })],
    test: { name: 'api', include: ['test/**/*.test.js'], setupFiles: ['./test/setup.js'] },
  };
});

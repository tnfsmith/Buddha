import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // workers/api chạy riêng trong workerd (workers/api/vitest.config.js, @cloudflare/vitest-plugin)
    projects: [
      { test: { name: 'node', include: ['packages/*/test/**/*.test.js', 'scripts/test/**/*.test.js'], environment: 'node' } },
      'workers/api/vitest.config.js',
    ],
  },
});

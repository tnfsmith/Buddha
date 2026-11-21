import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // workers/api và workers/realtime chạy riêng trong workerd (@cloudflare/vitest-plugin)
    projects: [
      { test: { name: 'node', include: ['packages/*/test/**/*.test.js', 'scripts/test/**/*.test.js'], environment: 'node' } },
      'workers/api/vitest.config.js',
      'workers/realtime/vitest.config.js',   // #106: Durable Object ReminderClock + bộ gửi Web Push (làn Claude)
    ],
  },
});

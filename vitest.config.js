import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.js', 'scripts/test/**/*.test.js', 'workers/*/test/**/*.test.js'],
    environment: 'node',
  },
});

import js from '@eslint/js';
import globals from 'globals';

// Lint bắt lỗi thật (biến chưa khai báo, mã chết, khóa trùng…), không ép phong cách cho mã 3D dày đặc hiện có.
export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/public/**', 'playwright-report/**', 'test-results/**', '.wrangler/**', '.lighthouseci/**'] },
  js.configs.recommended,
  {
    files: ['apps/web/src/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['**/*.mjs', 'scripts/**/*.js', '*.config.js', 'packages/*/test/**/*.js', 'workers/*/test/**/*.js', 'scripts/test/**/*.js', 'tests/**/*.js', 'ops/**/*.mjs'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.node } },
  },
  {
    // Hàm truyền vào page.evaluate chạy trong trình duyệt
    files: ['tests/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ['workers/*/src/**/*.js', 'packages/shared/src/**/*.js'],
    languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: { ...globals.worker } },
  },
  {
    rules: {
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
];

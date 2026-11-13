import { defineConfig } from '@playwright/test';

// Kiểm khói Vân Đạo. Dùng Chrome có sẵn (runner GitHub và máy dev) với SwiftShader để có WebGL không cần GPU.
// E2E_BASE_URL rỗng → kiểm khói mở bản HTML đơn apps/web/dist/van-dao.html (file://), kiểm PWA mở apps/web/public qua
// tests/e2e/serve.mjs (http://127.0.0.1:4173); có giá trị → mọi kiểm thử chạy trên bản đã deploy (preview/staging/production).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  webServer: process.env.E2E_BASE_URL ? undefined : { command: 'node tests/e2e/serve.mjs', url: 'http://127.0.0.1:4173/', reuseExistingServer: true },
  use: {
    channel: process.env.PW_CHANNEL || 'chrome',
    viewport: { width: 1440, height: 757 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] },
  },
});

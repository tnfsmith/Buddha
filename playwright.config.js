import { defineConfig } from '@playwright/test';

// Kiểm khói Vân Đạo. Dùng Chrome có sẵn (runner GitHub và máy dev) với SwiftShader để có WebGL không cần GPU.
// E2E_BASE_URL rỗng → mở bản dựng cục bộ apps/web/dist/van-dao.html; có giá trị → kiểm bản đã deploy (preview/staging/production).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    channel: process.env.PW_CHANNEL || 'chrome',
    viewport: { width: 1440, height: 757 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] },
  },
});

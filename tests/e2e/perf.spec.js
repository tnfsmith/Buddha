import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Ngân sách hiệu năng PROJECT_ROADMAP.md §12.2, đo bằng renderer.info gộp mọi lượt vẽ của một khung (kể cả bóng đổ, bloom).
// Điện thoại: mức chất lượng 0 (mức mà chất lượng thích ứng hạ xuống trên máy yếu) ≤ 120 lệnh vẽ, ≤ 400.000 tam giác.
// Máy tính: mức 2 (mặc định) ≤ 250 lệnh vẽ, ≤ 1 triệu tam giác. Mỗi lần chạy in bảng số đo để theo dõi xu hướng.
const BUDGET = { mobile: { calls: 120, triangles: 400_000 }, desktop: { calls: 250, triangles: 1_000_000 } };
const VIEWS = [['Vân Đảo', ''], ['Đại Thiền Đường', 'mode=hall&'], ['Hành trình', 'mode=journey&'], ['Cõi mở rộng', 'realm=1&'], ['Tầng 1', 'tier=1&']];

const BASE = process.env.E2E_BASE_URL || pathToFileURL(resolve('apps/web/dist/van-dao.html')).href;
const url = (hash) => `${BASE.replace(/#.*$/, '')}#${hash}`;

async function measure(page, hash) {
  await page.goto('about:blank');
  await page.goto(url(hash));
  await page.waitForFunction(() => window.__app?.world?.perf, null, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  return page.evaluate(async () => {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const p = window.__app.world.perf();
    return { calls: p.calls, triangles: p.triangles, quality: p.quality, dpr: p.dpr };
  });
}

for (const [device, q, use] of [
  ['mobile', 0, { viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['desktop', 2, { viewport: { width: 1440, height: 757 } }],
]) {
  test.describe(`ngân sách ${device}`, () => {
    test.use(use);
    test(`mức ${q}: mọi cảnh chính trong ngân sách §12.2`, async ({ page }) => {
      test.setTimeout(300_000);
      const rows = [];
      for (const [name, h] of VIEWS) rows.push({ view: name, ...(await measure(page, `${h}q=${q}&snap=1`)) });
      console.log(`Ngân sách ${device} (mức ${q}):\n` + rows.map((r) => `  ${r.view.padEnd(16)} ${String(r.calls).padStart(4)} lệnh vẽ  ${String(r.triangles).padStart(8)} tam giác  DPR ${r.dpr}`).join('\n'));
      for (const r of rows) {
        expect(r.quality, r.view).toBe(q);
        expect.soft(r.calls, `${r.view}: lệnh vẽ`).toBeLessThanOrEqual(BUDGET[device].calls);
        expect.soft(r.triangles, `${r.view}: tam giác`).toBeLessThanOrEqual(BUDGET[device].triangles);
      }
    });
  });
}

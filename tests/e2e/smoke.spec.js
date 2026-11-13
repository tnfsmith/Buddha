import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.E2E_BASE_URL || pathToFileURL(resolve('apps/web/dist/van-dao.html')).href;
const url = (hash) => `${BASE.replace(/#.*$/, '')}#${hash}`;

// Số đo cấu trúc cảnh (PROJECT_ROADMAP.md §1.5): đổi lớn là dấu hiệu dựng thiếu/vỡ cảnh.
// Từ T1.2 hình khối tĩnh được gộp theo vật liệu nên số geometry giảm mạnh; lệnh vẽ của khung gần nhất cho biết cảnh có thật sự vẽ.
const stats = (page) => page.evaluate(async () => {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const r = window.__app.world.renderer.info, p = window.__app.world.perf();
  return { geometries: r.memory.geometries, textures: r.memory.textures, programs: (r.programs ?? []).length, calls: p.calls, triangles: p.triangles };
});

async function open(page, hash) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const res = await page.goto(url(hash));
  if (res) expect(res.status(), 'HTTP status').toBeLessThan(400);
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 30_000 });
  await page.waitForTimeout(2500);
  return errors;
}

test('Vân Đảo dựng đủ cảnh, không lỗi', async ({ page }) => {
  const errors = await open(page, 'q=2&snap=1');
  await expect(page).toHaveTitle(/Vân Đạo/);
  const s = await stats(page);
  console.log('Vân Đảo', JSON.stringify(s));
  expect(s.geometries).toBeGreaterThan(80);
  expect(s.programs).toBeGreaterThan(20);
  expect(s.calls).toBeGreaterThan(40);
  await expect(page.locator('#panel')).toContainText('Vân Đảo');
  expect(await page.locator('#err').textContent()).toBe('');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Đại Thiền Đường dựng đủ cảnh', async ({ page }) => {
  const errors = await open(page, 'mode=hall&q=2&snap=1');
  const s = await stats(page);
  console.log('Đại Thiền Đường', JSON.stringify(s));
  expect(s.geometries).toBeGreaterThan(60);
  expect(s.calls).toBeGreaterThan(30);
  await expect(page.locator('#panel')).toContainText('Đại Thiền Đường');
  expect(errors, errors.join('\n')).toEqual([]);
});

test('Bia Tích Lũy hiện 49 ngày và 3 trục', async ({ page }) => {
  const errors = await open(page, 'view=board&snap=1');
  const panel = page.locator('#panel');
  await expect(panel).toContainText('Bia Tích Lũy');
  await expect(panel).toContainText('Ngày 1/49');
  for (const p of ['Đức', 'Thiện', 'Tuệ']) await expect(panel).toContainText(p);
  expect(errors, errors.join('\n')).toEqual([]);
});

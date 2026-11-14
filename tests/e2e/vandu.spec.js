import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Issue #29: Vân Du. Khi tọa thiền, máy quay rời chỗ ngồi đi viếng các cảnh theo số phút ngồi yên.
const BASE = process.env.E2E_BASE_URL || pathToFileURL(resolve('apps/web/dist/van-dao.html')).href;
const url = (hash) => `${BASE.replace(/#.*$/, '')}#${hash}`;
// Chờ dựng xong cảnh rồi cho ngừng vẽ (như tab ẩn): logic máy quay vẫn chạy theo khung hình, không tốn CPU vẽ 3D
const ready = async (page) => { await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 }); await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })); };
const slow = expect.configure({ timeout: 30_000 });
const sitDown = (page) => page.evaluate(() => { const W = window.__app.world; for (let i = 0; i < 900; i++) { W.tween = null; W._avatarStep(0.05, { breath: 0 }); } W.tween = null; W.controls.enabled = true; return { state: W.av.state, id: W.av.id }; });
const vd = (page) => page.evaluate(() => { const W = window.__app.world; return { on: document.body.classList.contains('vandu'), k: W.vd ? +W.vd.k.toFixed(2) : null, free: W.controls.enabled, sit: !!window.__app.U.sit, cap: document.querySelector('#vd').hidden ? '' : document.querySelector('#vd').textContent }; });

test('đường Vân Du: không điểm nhìn nào cao hơn mắt Tôn tượng; chặng cuối thấy trọn đầu tượng trên máy tính và điện thoại', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(url('q=0&snap=1&vandu=0')); await ready(page);
  await slow.poll(() => vd(page)).toMatchObject({ on: true, k: 0, cap: 'Vân Du · An trú · chặng 1/7' });
  const path = await page.evaluate(() => { const W = window.__app.world; let top = -1e9, low = 1e9;
    for (let k = 0; k <= 6.001; k += 0.05) for (let tm = 0; tm < 400; tm += 9) { const y = W.vanduAt(Math.min(6, k), tm).p.y; top = Math.max(top, y); low = Math.min(low, y); }
    return { top, low }; });
  expect(path.top).toBeLessThan(75 + 196 * 1.5);   // BUD_EYE = 369: tầm mắt Ngài
  expect(path.low).toBeGreaterThan(5);             // không chìm dưới biển mây

  // chặng cuối: đỉnh đầu (460), tầm mắt (369) và ngực tượng (300) đều nằm trong khung hình
  const head = async () => { await slow.poll(() => page.evaluate(() => { const W = window.__app.world; return W.vd.k === 6 && W.camera.position.distanceTo(W.vanduAt(6).p) < 14; })).toBe(true);
    return page.evaluate(() => { const W = window.__app.world, V3 = W.constructor.V3; W.camera.updateMatrixWorld(); return [[0, 460, -760], [0, 369, -760], [0, 300, -760]].map((p) => { const v = new V3(...p).project(W.camera); return [+v.x.toFixed(2), +v.y.toFixed(2), v.z < 1]; }); }); };
  await page.evaluate(() => { window.__app.U.vdForce = 6; });
  for (const p of await head()) { expect(Math.abs(p[0])).toBeLessThan(0.95); expect(Math.abs(p[1])).toBeLessThan(0.95); expect(p[2]).toBe(true); }
  await page.setViewportSize({ width: 390, height: 800 }); await page.evaluate(() => window.__app.world.resize());
  for (const p of await head()) { expect(Math.abs(p[0])).toBeLessThan(0.95); expect(Math.abs(p[1])).toBeLessThan(0.95); expect(p[2]).toBe(true); }
});

test('Vân Du theo số phút ngồi yên; chạm vào cảnh thì hỏi; "Ngồi tiếp" đi tiếp, "Xả thiền" đưa máy quay về bên nhân vật', async ({ page, context }) => {
  test.setTimeout(300_000);
  await context.addInitScript(() => { if (!localStorage.getItem('vandao.v1')) localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day: 1, vandu: true })); });
  await page.goto(url('q=0&snap=1&zone=kuti')); await ready(page);
  expect(await sitDown(page)).toEqual({ state: 'sit', id: 'kuti' });
  await expect(page.locator('#panel [data-vandu]')).toBeChecked();
  await expect(page.locator('#panel')).toContainText('không phải thước đo tầng thiền hay quả vị');
  expect(await vd(page)).toMatchObject({ on: false, k: null });   // ngồi sẵn nhưng chưa bấm "Tọa thiền": chưa Vân Du

  await page.locator('#panel [data-act="kuti-sit"]').click();
  await slow.poll(() => vd(page)).toMatchObject({ on: true, sit: true, free: false });
  expect((await vd(page)).cap).toMatch(/^Vân Du · An trú · chặng 1\/7 · ngồi yên 00:0\d$/);

  // đã ngồi yên 5 phút: đang lướt từ Biển mây (4′) sang Tịnh Cảnh (9′)
  await page.evaluate(() => { window.__app.U.sit.at -= 5 * 60000; });
  await slow.poll(async () => (await vd(page)).k).toBeGreaterThan(2);
  const a = await vd(page); expect(a.k).toBeLessThan(2.5); expect(a.cap).toMatch(/^Vân Du · Biển mây · chặng 3\/7 · ngồi yên 05:\d\d$/);
  // 45 phút: chặng cuối, đứng yên ở đó
  await page.evaluate(() => { window.__app.U.sit.at -= 40 * 60000; });
  await slow.poll(() => vd(page)).toMatchObject({ on: true, k: 6 });
  expect((await vd(page)).cap).toContain('Vô Biên · chặng 7/7 · ngồi yên 45:');

  // chạm vào cảnh: hỏi, không tự bỏ thời ngồi
  const wake = page.locator('#wake');
  await page.mouse.click(300, 320);
  await slow(wake).toBeVisible(); await expect(wake).toContainText('Đang Vân Du, đã ngồi yên 45 phút');
  await wake.locator('[data-wake="no"]').click();
  await slow(wake).toBeHidden(); expect(await vd(page)).toMatchObject({ on: true, k: 6, sit: true });

  await page.mouse.click(300, 320);
  await slow(wake).toBeVisible();
  await wake.locator('[data-wake="yes"]').click();
  await slow.poll(() => vd(page)).toMatchObject({ on: false, k: null, sit: false, cap: '' });
  // máy quay trở về bên nhân vật, người dùng điều khiển lại được
  await slow.poll(() => page.evaluate(() => { const W = window.__app.world, A = W.av; if (W.tween) W.tween.k = 0.999; return W.controls.enabled && Math.hypot(W.controls.target.x - A.pos.x, W.controls.target.z - A.pos.z) < 3 && W.camera.position.distanceTo(W.controls.target) < 30; })).toBe(true);
  await slow(page.locator('#toast')).toHaveText('Đã xả thiền.');
});

test('Vân Du mặc định tắt; thời thiền 15 phút viên mãn thì Vân Du tự trở về', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(url('q=0&snap=1&zone=kuti')); await ready(page);
  await sitDown(page);
  await expect(page.locator('#panel [data-vandu]')).not.toBeChecked();
  await page.locator('#panel [data-act="kuti-sit"]').click();
  await slow.poll(async () => (await vd(page)).sit).toBe(true);
  await page.evaluate(() => { window.__app.U.sit.at -= 5 * 60000; });
  await page.waitForTimeout(1500); expect(await vd(page)).toMatchObject({ on: false, k: null, free: true });

  await page.locator('#panel [data-vandu]').check();
  await slow.poll(() => vd(page)).toMatchObject({ on: true });
  expect(await page.evaluate(() => window.__app.state().vandu)).toBe(true);
  await page.evaluate(() => window.__app.player.onend());   // thời thiền kết thúc
  await slow.poll(() => vd(page)).toMatchObject({ on: false, k: null, sit: false });
  expect(await page.evaluate(() => window.__app.world.av.state)).toBe('sit');   // nhân vật vẫn ngồi, chỉ máy quay trở về
});

import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Issue #27: đi lại bằng bấm chuột và phím mũi tên, zoom tại phân khu, xả thiền có xác nhận.
// Máy kiểm thử vẽ 3D bằng CPU nên không chờ nhân vật đi theo khung hình thật: gọi thẳng bước mô phỏng của nhân vật (_avatarStep).
const BASE = process.env.E2E_BASE_URL || pathToFileURL(resolve('apps/web/dist/van-dao.html')).href;
const url = (hash) => `${BASE.replace(/#.*$/, '')}#${hash}`;
// Chờ dựng xong cảnh rồi cho ngừng vẽ (như tab ẩn): logic đi lại, máy quay vẫn chạy theo khung hình nhưng không tốn CPU vẽ 3D
const ready = async (page) => { await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 }); await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })); };
const slow = expect.configure({ timeout: 60_000 });
/** Tua nhanh n bước 0,05 giây; trả trạng thái nhân vật và việc có lúc nào bước vào chỗ cấm (ngoài bậc đá lên Tịnh Thất) hay không */
const step = (page, n) => page.evaluate((n) => {
  const W = window.__app.world, A = W.av; let bad = 0; W.tween = null; W.controls.enabled = true;
  for (let i = 0; i < n; i++) { W._avatarStep(0.05, { breath: 0 }); if (A.state === 'walk' && Math.abs(A.pos.x + 13) > 1.6 && W._blocked(A.pos.x, A.pos.z)) bad++; }
  return { state: A.state, pose: W.fig.pose, x: +A.pos.x.toFixed(2), z: +A.pos.z.toFixed(2), id: A.id, bad, onHill: W._blocked(A.pos.x, A.pos.z) };
}, n);
const sitInKuti = async (page) => { await page.evaluate(() => { const W = window.__app.world; W.setMode('island'); W.goZone('kuti'); }); const r = await step(page, 900); expect(r).toMatchObject({ state: 'sit', pose: 'sit', id: 'kuti' }); };

test('từ chỗ ngồi trong Tịnh Thất: bấm lên mặt đảo thì theo bậc đá đi ra; phím mũi tên cũng vậy; zoom được tới sát nhân vật', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(url('q=0&snap=1')); await ready(page);

  await sitInKuti(page);
  // Tại phân khu: phóng to được tới sát nhân vật (trước đây giới hạn gần nhất là 14 nên đứng ở Tịnh Thất không zoom vào được)
  const lim = await page.evaluate(() => { const W = window.__app.world; W.setLimits(); return { mode: W.mode, min: W.controls.minDistance, max: W.controls.maxDistance }; });
  expect(lim.mode).toBe('zone'); expect(lim.min).toBeLessThanOrEqual(4); expect(lim.max).toBeGreaterThanOrEqual(200);

  // Bấm một điểm gần Bia Tích Lũy: đường thẳng bị đồi chắn → phải đi theo lối, không xuyên tường, không lội hồ
  const went = await page.evaluate(() => { const W = window.__app.world, ok = W.walkToPoint(8, 4); return { ok, legs: W.av.path.length, track: W.av.track }; });
  expect(went.ok).toBe(true); expect(went.legs).toBeGreaterThan(2); expect(went.track).toBe(true);   // máy quay đang nhìn gần nên trượt theo nhân vật
  const a = await step(page, 900);
  expect(a).toMatchObject({ state: 'idle', pose: 'stand', bad: 0 }); expect(Math.hypot(a.x - 8, a.z - 4)).toBeLessThan(0.3);
  // Điểm nằm giữa hồ hoặc ngoài mép đảo thì không đi
  expect(await page.evaluate(() => { const W = window.__app.world; return [W.walkToPoint(-3, 9.3), W.walkToPoint(60, 0)]; })).toEqual([false, false]);

  // Phím: đang trên đồi thì xuống hết bậc đá trước, rồi mới đi theo hướng máy quay; nhả phím thì dừng
  await sitInKuti(page);
  await page.evaluate(() => window.__app.world.steer(0, 1));
  const b = await step(page, 300);
  expect(b, JSON.stringify(b)).toMatchObject({ onHill: false, bad: 0, pose: 'stand' });
  // ra giữa đảo, đặt máy quay nhìn về hướng −z cho dễ kiểm: phím phải = đi về +x
  await page.evaluate(() => { window.__app.world.steer(0, 0); window.__app.world.walkToPoint(2, -1); }); const m = await step(page, 900); expect(Math.hypot(m.x - 2, m.z + 1)).toBeLessThan(0.3);
  await page.evaluate(() => { const W = window.__app.world, A = W.av; W.camera.position.set(A.pos.x, 40, A.pos.z + 30); W.controls.target.set(A.pos.x, 12, A.pos.z); W.steer(1, 0); });
  const c = await step(page, 20); expect(c.state).toBe('walk'); expect(c.x).toBeGreaterThan(m.x + 1); expect(Math.abs(c.z - m.z)).toBeLessThan(0.5);
  await page.evaluate(() => window.__app.world.steer(0, 0));
  expect((await step(page, 5)).state).toBe('idle');
  // Giữ phím mãi một hướng cũng không ra khỏi đảo, không lội hồ
  await page.evaluate(() => window.__app.world.steer(1, 0));
  const e = await step(page, 1200); expect(e.bad).toBe(0); expect(e.onHill).toBe(false); expect(e.x).toBeLessThan(40);   // dừng ở mép đảo (cùng giới hạn với bấm chuột)
  await page.evaluate(() => window.__app.world.steer(0, 0));
});

test('đang tọa thiền mà bấm phím đi: hỏi trước; "Ngồi tiếp" giữ nguyên, "Xả thiền" thì chắp tay xá, đứng dậy rồi mới đi', async ({ page }) => {
  test.setTimeout(420_000);
  await page.goto(url('q=0&snap=1&zone=kuti')); await ready(page);
  expect(await step(page, 900)).toMatchObject({ state: 'sit', id: 'kuti' });
  const wake = page.locator('#wake'), sitting = () => page.evaluate(() => ({ state: window.__app.world.av.state, sit: !!window.__app.U.sit }));
  await page.locator('#panel [data-act="kuti-sit"]').click();
  await slow.poll(sitting).toEqual({ state: 'sit', sit: true });

  // Chưa trả lời thì nhân vật vẫn ngồi
  await page.keyboard.down('ArrowUp');
  await slow(wake).toBeVisible(); await slow(wake).toContainText('Bạn đang tọa thiền');
  await page.keyboard.up('ArrowUp');
  expect(await step(page, 40)).toMatchObject({ state: 'sit', pose: 'sit' });
  await wake.locator('[data-wake="no"]').click();
  await slow(wake).toBeHidden(); expect(await sitting()).toEqual({ state: 'sit', sit: true });

  // Về góc nhìn toàn đảo (nhân vật vẫn ngồi) rồi bấm phím lần nữa: vẫn hỏi. Đồng ý: chắp tay xá → đứng dậy
  await page.evaluate(() => document.querySelector('#panel [data-act="home"]').click());
  expect(await sitting()).toEqual({ state: 'sit', sit: true });
  await page.keyboard.down('ArrowUp'); await slow(wake).toBeVisible(); await page.keyboard.up('ArrowUp');
  const just = await page.evaluate(() => { document.querySelector('#wake [data-wake="yes"]').click(); const W = window.__app.world; return { state: W.av.state, pose: W.fig.pose, sit: !!window.__app.U.sit, hidden: document.querySelector('#wake').hidden }; });
  expect(just).toEqual({ state: 'idle', pose: 'anjali', sit: false, hidden: true });
  expect(await step(page, 40)).toMatchObject({ state: 'idle', pose: 'stand' });   // xá xong (1,7 giây) mới đứng thẳng
  await slow(page.locator('#toast')).toHaveText('Đã xả thiền.');

  // Đã xả thiền: phím đi ngay, không hỏi nữa
  await page.keyboard.down('ArrowDown');
  await expect(wake).toBeHidden();
  const r = await step(page, 300); expect(r.onHill).toBe(false);
  await page.keyboard.up('ArrowDown');

  // Nút + / − / ◎
  const dist = () => page.evaluate(() => { const W = window.__app.world; W.tween && (W.tween.k = 0.999); return +W.camera.position.distanceTo(W.controls.target).toFixed(2); });
  await page.locator('#cam [data-cam="me"]').click();
  await slow.poll(() => page.evaluate(() => { const W = window.__app.world, A = W.av; return W.controls.target.distanceTo(new W.constructor.V3(A.pos.x, W.controls.target.y, A.pos.z)) < 2; })).toBe(true);
  const d0 = await dist();
  await page.locator('#cam [data-cam="in"]').click();
  await slow.poll(dist).toBeLessThan(d0 * 0.8);
  const d1 = await dist();
  await page.locator('#cam [data-cam="out"]').click();
  await slow.poll(dist).toBeGreaterThan(d1 * 1.2);
});

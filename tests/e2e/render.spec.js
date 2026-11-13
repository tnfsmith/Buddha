import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// §12.3 mục 4–6 (T1.2 đợt 2): biên dịch shader trước, độ phân giải động, dừng vẽ khi tab ẩn, chọn mức chất lượng theo thiết bị.
const BASE = process.env.E2E_BASE_URL || pathToFileURL(resolve('apps/web/dist/van-dao.html')).href;
const url = (hash) => `${BASE.replace(/#.*$/, '')}#${hash}`;
const ready = (page) => page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
const frames = (n) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });

test('chọn mức chất lượng theo thiết bị', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(url('snap=1'));
  await ready(page);
  const r = await page.evaluate(() => {
    const W = window.__app.world, pick = W.constructor.pickQuality, gl = (name) => ({ getContext: () => ({ getExtension: () => null, RENDERER: 1, getParameter: () => name }) });
    localStorage.removeItem('vandao.gfx');
    const out = {
      runner: W.quality,   // runner CI vẽ bằng SwiftShader → mức 0 ngay từ đầu
      desktop: pick(gl('ANGLE (NVIDIA GeForce RTX)'), { deviceMemory: 16, hardwareConcurrency: 12 }, false),
      weakDesktop: pick(gl('ANGLE (Intel HD)'), { deviceMemory: 4, hardwareConcurrency: 4 }, false),
      phone: pick(gl('Adreno 740'), { deviceMemory: 8, hardwareConcurrency: 8 }, true),
      weakPhone: pick(gl('Mali-G52'), { deviceMemory: 3, hardwareConcurrency: 8 }, true),
      software: pick(gl('Google SwiftShader'), { deviceMemory: 16, hardwareConcurrency: 16 }, false),
    };
    localStorage.setItem('vandao.gfx', JSON.stringify({ q: 1, at: Date.now() }));
    out.rememberedDowngrade = pick(gl('ANGLE (NVIDIA GeForce RTX)'), { deviceMemory: 16, hardwareConcurrency: 12 }, false);
    localStorage.setItem('vandao.gfx', JSON.stringify({ q: 0, at: Date.now() - 15 * 24 * 3600 * 1000 }));
    out.expiredDowngrade = pick(gl('ANGLE (NVIDIA GeForce RTX)'), { deviceMemory: 16, hardwareConcurrency: 12 }, false);
    localStorage.removeItem('vandao.gfx');
    return out;
  });
  expect(r).toEqual({ runner: 0, desktop: 2, weakDesktop: 1, phone: 1, weakPhone: 0, software: 0, rememberedDowngrade: 1, expiredDowngrade: 2 });
});

test('shader biên dịch trước: đổi mức chất lượng và chuyển cảnh không dựng shader mới', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(url('q=1&snap=1'));
  await ready(page);
  await page.evaluate(() => window.__app.world.warmed);
  const r = await page.evaluate(async (fr) => {
    const W = window.__app.world, prog = () => W.renderer.info.programs.length, wait = new Function('return ' + fr)();
    await wait(3);
    const o = { start: prog() };
    await W._warm(0); o.warm0 = prog();
    W.setQuality(0); await W.hold; await wait(3); o.atQ0 = prog();
    W.setMode('hall'); await wait(3); W.setMode('overview'); await wait(3); o.modes = prog();
    return o;
  }, frames.toString());
  expect(r.warm0).toBeGreaterThan(r.start);   // biến thể mức 0 (không bóng đổ, không bloom) được dựng trước
  expect(r.atQ0).toBe(r.warm0);               // chuyển sang mức 0 dùng lại đúng các shader đã dựng
  expect(r.modes).toBe(r.atQ0);               // chuyển cảnh không dựng shader mới
});

test('tab ẩn thì không vẽ; máy chậm thì tự hạ độ phân giải', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(url('snap=1'));
  await ready(page);
  const r = await page.evaluate(async (fr) => {
    const W = window.__app.world, wait = new Function('return ' + fr)();
    let draws = 0; const r0 = W.renderer.render.bind(W.renderer); W.renderer.render = (...a) => { draws++; return r0(...a); };
    await wait(2); const visible = draws;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'));
    draws = 0; await wait(3); const hidden = draws;
    delete document.hidden; document.dispatchEvent(new Event('visibilitychange'));
    // runner vẽ bằng CPU (chậm hơn 30 fps nhiều) → độ phân giải động phải hạ dần
    const t0 = performance.now(); while (W.res > 0.6 && performance.now() - t0 < 60000) await wait(1);
    return { visible, hidden, res: W.res, perfRes: W.perf().res };
  }, frames.toString());
  expect(r.visible).toBeGreaterThan(0);
  expect(r.hidden).toBe(0);
  expect(r.res).toBe(0.6);
  expect(r.perfRes).toBe(0.6);
});

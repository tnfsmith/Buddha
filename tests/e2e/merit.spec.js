import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Issue #95: hạt công đức, Tùy Hỷ và du vân.
// - Hạt chụp xuống ngọn Bồ-đề thì có chuông gió; lần tích lũy nhỏ không dời máy quay.
// - Tùy Hỷ: tiếng ngân lúc gửi, chuông lúc tới bạn.
// - Du vân: gió mây; máy quay sà lại và bám theo nhân vật; tới nơi thì khung cả hai.
// Máy kiểm thử vẽ 3D bằng CPU nên không chờ khung hình thật: tua thẳng các bước mô phỏng (_meritStep, _avatarStep).
const BASE = process.env.E2E_BASE_URL || pathToFileURL(resolve('apps/web/dist/van-dao.html')).href;
const url = (hash) => `${BASE.replace(/#.*$/, '')}#${hash}`;
const ready = async (page) => { await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 }); await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })); };

test('hạt công đức: chuông gió đúng lúc chạm ngọn cây, lần nhỏ không dời máy quay; Tùy Hỷ: ngân lúc gửi, chuông lúc tới bạn', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(url('q=0&snap=1')); await ready(page);
  const r = await page.evaluate(() => {
    const W = window.__app.world, log = [], adv = (s) => { for (let i = 0; i < Math.round(s / 0.05); i++) { W.time += 0.05; W._meritStep(0.05); } };
    W.onSfx = (kind, o) => log.push([kind, W.time, o]); W.setMode('island'); W.tween = null; W.touch = 0; W.mcAt = -99;
    const cam0 = W.camera.position.clone(), t0 = W.time;
    W.burst(0xf3d27a, null, 0.3);   // lần nhỏ (k = 0,3): chỉ có hạt sáng
    adv(2.9); const early = log.length; adv(1.5);
    const small = log.filter((x) => x[0] === 'chime').map((x) => +(x[1] - t0).toFixed(2)), moved = +W.camera.position.distanceTo(cam0).toFixed(3), tween = !!W.tween;
    adv(3); log.length = 0; W.tween = null; const t1 = W.time; W.rejoice(0);
    const sent = log.map((x) => x[0]), far = W.burstList.at(-1).far, track = !!W.burstList.at(-1).track; adv(6);
    const land = log.filter((x) => x[0] === 'chime').map((x) => +(x[1] - t1).toFixed(2));
    return { early, small, moved, tween, sent, far, track, land };
  });
  expect(r.early, 'chưa chạm cây thì chưa có chuông').toBe(0);
  expect(r.small).toHaveLength(1); expect(r.small[0]).toBeGreaterThan(3); expect(r.small[0]).toBeLessThan(3.4);   // 1,2 + 0,35 + 1,6 giây
  expect(r.moved, 'lần nhỏ: máy quay đứng yên').toBe(0); expect(r.tween).toBe(false);
  expect(r.sent).toEqual(['gift']);
  expect(r.far, 'bạn ở đảo khác').toBe(true); expect(r.track, 'máy quay bay theo đàn hạt').toBe(true);
  expect(r.land).toHaveLength(1); expect(r.land[0]).toBeGreaterThan(3.9); expect(r.land[0]).toBeLessThan(4.2);
});

test('du vân sang đảo bạn: gió mây cả chặng, máy quay bám gần theo nhân vật, tới nơi khung cả hai', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(url('q=0&snap=1')); await ready(page);
  const r = await page.evaluate(() => {
    const W = window.__app.world, A = W.av, log = [], dist = []; W.onSfx = (kind, o) => log.push([kind, o.dur]); W.setMode('island'); W.touch = 0;
    const d0 = +W.camera.position.distanceTo(W.headPos()).toFixed(1); W.visit(0, () => {});
    for (let i = 0; i < 400 && A.state === 'travel'; i++) { W._avatarStep(0.05, { breath: 0 }); W.controls.update(); if (i % 20 === 19 && A.state === 'travel') dist.push(+W.camera.position.distanceTo(W.ride.position).toFixed(1)); }
    return { log, d0, dist, where: A.where, tween: !!W.tween };
  });
  expect(r.log).toEqual([['cloud', 8.5]]);
  expect(r.where).toBe(0);
  // sau 2 giây đầu (máy quay sà lại từ toàn cảnh), máy quay luôn trong khoảng 10–32 đơn vị quanh nhân vật
  const mid = r.dist.slice(2); expect(mid.length).toBeGreaterThan(4);
  for (const d of mid) { expect(d).toBeGreaterThan(10); expect(d).toBeLessThan(32); }
  expect(r.tween, 'tới nơi: bay tới khung cả hai').toBe(true);
});

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

test('du vân sang đảo bạn: gió mây, máy quay bám gần và cao; bạn đứng dậy đón, mỉm cười, quay về phía khách; khách về thì chắp tay tiễn rồi ngồi lại', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(url('q=0&snap=1')); await ready(page);
  const r = await page.evaluate(() => {
    const W = window.__app.world, A = W.av, f = W.friends[0], log = [], dist = [], up = []; W.onSfx = (kind, o) => log.push([kind, o.dur]); W.setMode('island'); W.touch = 0;
    const step = () => { W._avatarStep(0.05, { breath: 0 }); W._friendStep(0.05); W.time += 0.05; W._meritStep(0.05); W.controls.update(); };
    W.visit(0, () => W.greet(0)); let stood = null;
    for (let i = 0; i < 400 && A.state === 'travel'; i++) { step(); if (stood === null && f.host) stood = +A.k.toFixed(2); if (i % 20 === 19 && A.state === 'travel' && A.k < 0.8) { dist.push(+W.camera.position.distanceTo(W.ride.position).toFixed(1)); up.push(+(W.camera.position.y - W.ride.position.y).toFixed(1)); } }
    const tween = !!W.tween; for (let i = 0; i < 80; i++) step();   // chào xong, đứng chờ
    const face = Math.atan2(A.pos.x - f.pos.x, A.pos.z - f.pos.z) - f.fig.group.rotation.y, meet = { host: f.host, pose: f.fig.pose, smile: !!f.fig.joy, turn: +Math.abs(Math.atan2(Math.sin(face), Math.cos(face))).toFixed(2) };
    W.goHome(() => {}); step(); const bye = f.fig.pose; for (let i = 0; i < 60; i++) step();
    return { log, dist, up, where: 0, stood, tween, meet, bye, after: f.fig.pose, others: W.friends.slice(1).map((x) => x.fig.pose) };
  });
  expect(r.log[0]).toEqual(['cloud', 8.5]);
  expect(r.stood, 'bạn đứng dậy trước khi khách tới').toBeGreaterThan(0.7); expect(r.stood).toBeLessThan(0.8);
  // sau 2 giây đầu (máy quay sà lại từ toàn cảnh): gần (≤ 22) và cao hơn nhân vật để không bị đảo khác che
  const mid = r.dist.slice(2); expect(mid.length).toBeGreaterThan(3);
  for (const d of mid) { expect(d).toBeGreaterThan(8); expect(d).toBeLessThan(22); }
  for (const h of r.up.slice(2)) expect(h).toBeGreaterThan(5);
  expect(r.tween, 'tới nơi: góc qua vai nhìn bạn').toBe(true);
  expect(r.meet).toEqual({ host: true, pose: 'stand', smile: true, turn: expect.any(Number) }); expect(r.meet.turn, 'bạn quay về phía khách').toBeLessThan(0.3);
  expect(r.bye, 'khách về: bạn chắp tay tiễn').toBe('anjali'); expect(r.after, 'rồi ngồi lại thiền').toBe('sit');
  expect(r.others).toEqual(['sit', 'sit']);
});

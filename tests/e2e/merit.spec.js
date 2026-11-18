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

test('du vân qua Vân Môn: ra cổng, mây hạ xuống, bước lên, bay (máy quay nhìn ngang), hạ xuống trước Vân Môn đảo bạn, bước xuống, qua cổng vào; bạn đứng đón; về nhà cũng vậy', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(url('q=0&snap=1')); await ready(page);
  const r = await page.evaluate(() => {
    const W = window.__app.world, A = W.av, f = W.friends[0], log = [], st = [], st2 = [], side = [], dist = []; let stood = null, gate = 99, gate2 = 99;
    W.onSfx = (kind) => log.push(kind); W.setMode('island'); W.touch = 0;
    const step = (rec) => { W._avatarStep(0.05, { breath: 0 }); W._friendStep(0.05); W.time += 0.05; W._meritStep(0.05); W.controls.update(); const T = A.trip; if (T && rec.at(-1) !== T.st) rec.push(T.st); return T; };
    W.visit(0, () => W.greet(0));
    for (let i = 0; i < 1600 && A.state === 'travel'; i++) { const T = step(st); if (!T) break; const P = W._wp();
      if (stood === null && f.host) stood = T.st;
      if (T.st === 'fly' && T.t > 1.5 && T.t < T.fly - 1 && i % 5 === 0) { const c = W.camera.position.clone().sub(P); dist.push(+c.length().toFixed(1)); c.y = 0; side.push(+Math.abs(c.normalize().dot(W.tcDir)).toFixed(2)); }
      if (T.st === 'in') gate = Math.min(gate, Math.hypot(P.x - f.gate.x, P.z - f.gate.z)); }
    const arrived = { where: A.where, d: +Math.hypot(A.pos.x - f.arrive.x, A.pos.z - f.arrive.z).toFixed(2), tween: !!W.tween, ride: W.ride.visible };
    for (let i = 0; i < 80; i++) step([]);   // chào xong, đứng chờ
    const face = Math.atan2(A.pos.x - f.pos.x, A.pos.z - f.pos.z) - f.fig.group.rotation.y, meet = { host: f.host, pose: f.fig.pose, smile: !!f.fig.joy, turn: +Math.abs(Math.atan2(Math.sin(face), Math.cos(face))).toFixed(2) };
    W.goHome(() => {}); step(st2); const bye = f.fig.pose;
    for (let i = 0; i < 1600 && A.state === 'travel'; i++) { const T = step(st2); if (T && T.st === 'walk') gate2 = Math.min(gate2, Math.hypot(A.pos.x - f.gate.x, A.pos.z - f.gate.z)); }
    return { log, st, st2, stood, side, dist, gate, gate2, arrived, meet, bye, after: f.fig.pose, home: [A.where, +A.pos.x.toFixed(1), +A.pos.z.toFixed(1)] };
  });
  const STAGES = ['walk', 'summon', 'board', 'lift', 'fly', 'descend', 'alight', 'in'];
  expect(r.st).toEqual(STAGES);
  expect(r.log).toEqual(['summon', 'step', 'cloud', 'step', 'summon', 'step', 'cloud', 'step']);   // mây hạ xuống · bước lên · gió mây cả chặng · bước xuống (đi và về)
  expect(r.stood, 'bạn đứng dậy lúc khách còn đang bay tới').toBe('fly');
  // bay: máy quay nhìn ngang (lệch khỏi hướng bay hơn 70°) và đứng xa (16–34)
  expect(r.side.length).toBeGreaterThan(10);
  for (const s of r.side) expect(s).toBeLessThan(0.35);
  for (const d of r.dist) { expect(d).toBeGreaterThan(16); expect(d).toBeLessThan(34); }
  expect(r.gate, 'đi bộ qua Vân Môn đảo bạn').toBeLessThan(1);
  expect(r.arrived).toEqual({ where: 0, d: expect.any(Number), tween: true, ride: false }); expect(r.arrived.d).toBeLessThan(0.3);
  expect(r.meet).toEqual({ host: true, pose: 'stand', smile: true, turn: expect.any(Number) }); expect(r.meet.turn, 'bạn quay về phía khách').toBeLessThan(0.3);
  expect(r.bye, 'khách về: bạn chắp tay tiễn').toBe('anjali'); expect(r.after, 'rồi ngồi lại thiền').toBe('sit');
  expect(r.st2).toEqual(STAGES); expect(r.gate2, 'về: đi ra qua Vân Môn đảo bạn').toBeLessThan(1);
  expect(r.home).toEqual(['home', 12.5, 12.5]);
});

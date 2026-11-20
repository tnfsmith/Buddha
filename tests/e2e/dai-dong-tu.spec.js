// #151: Đài Đồng Tu ở Đại Thiền Đường. Lời mời cùng ngồi thiền đã nhận lời → hai bạn ngồi cạnh nhau trên đài mây ngay trước tòa sen,
// ngang tòa sen, cao hơn hội chúng; nhãn «Tịnh danh · mã»; góc Cùng ngồi / Toàn cảnh, xoay chậm 360°; máy quay
// không lên quá tầm mắt Tôn tượng; số lệnh vẽ vẫn trong ngân sách §12.2.
import { test, expect } from '@playwright/test';
import { slow, fakeServer, device, M } from './dong-tu-fake.js';

test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');
const SHOTS = !!process.env.DT_SHOTS;   // DT_SHOTS=1: lưu ảnh để xem bằng mắt (không chạy trong CI)
/** Vẽ bằng CPU (SwiftShader) rất chậm: sau khi đã đo lệnh vẽ thì bỏ bước vẽ, máy quay và nhãn vẫn cập nhật như thường */
const noDraw = (page) => (SHOTS ? null : page.evaluate(() => { window.__app.world.renderer.render = () => {}; }));

/** A và B đã là bạn; B mời A cùng ngồi thiền ở Đại Thiền Đường và A đã nhận lời, còn `lead` mili-giây tới giờ */
function seeded(lead) {
  const sv = fakeServer(), now = Date.now(), { a, b } = sv.U;
  sv.pairs.push({ a: b.id, b: a.id, sa: { than: true, away: false }, sb: { than: true, away: false }, at: now - 86_400_000 });
  sv.invites.push({ id: 'mt-dais', from: b.id, to: a.id, kind: 'thien', place: 'dtd', status: 'dong_y', created_at: now - 20_000, responded_at: now - 5_000, start_at: now + lead });
  sv.presence[b.id] = { state: 'thien', updated_at: now };
  return sv;
}
const daisState = (page) => page.evaluate(() => {
  const w = window.__app.world, c = w.camera.position, heads = w.daisHeads();
  return { on: !!w.dais, view: w.daisView, n: heads.length, names: heads.map((h) => h.name), me: heads.filter((h) => h.me).length,
    seats: heads.map((h) => ({ x: +h.seat.x.toFixed(1), y: h.seat.y, z: +h.seat.z.toFixed(1) })), camY: c.y, tween: !!w.tween,
    hallFig: w.hallFig.group.position.toArray().map((v) => +v.toFixed(1)), calls: w.perf().calls, tris: w.perf().triangles };
});
const labels = (page) => page.locator('#labels .zl.dais').evaluateAll((els) => els.filter((e) => e.style.opacity === '1').map((e) => e.textContent));

for (const [name, vp] of [['máy tính 1280×800', { width: 1280, height: 800 }], ['điện thoại 390×760', { width: 390, height: 760 }]]) {
  test(`${name}: hai bạn ngồi cạnh nhau trên Đài Đồng Tu, có tên, Cùng ngồi ⇄ Toàn cảnh, xoay chậm`, async ({ browser }) => {
    test.setTimeout(480_000);
    const sv = seeded(600_000);   // còn 10 phút: cả ca kiểm (vẽ bằng CPU, chậm) diễn ra trước giờ bắt đầu
    const A = await device(browser, sv, 'a', vp, 1, null, true);
    await slow(A.locator('#dt')).toBeVisible();
    await slow.poll(() => daisState(A).then((s) => s.on)).toBe(true);   // đài dựng ngay khi lời mời đã nhận (sap), tới hết thời thiền
    await slow(M(A)).toContainText('Cùng ngồi thiền với Minh An · 2210');
    await M(A).locator('[data-act="dt-go"]').click();
    await slow.poll(() => daisState(A).then((s) => s.view === 'near' && !s.tween)).toBe(true);
    let st = await daisState(A);
    // Vị trí: đài cao 100 (ngang tòa sen), cách tâm Tôn tượng 240 (ngay ngoài mũi cánh sen), chủ phiên (B) ngồi trước, mình lên đài
    expect(st.n).toBe(2);
    expect(st.names[0]).toBe('Minh An · 2210');
    expect(st.me).toBe(1);
    for (const s of st.seats) { expect(s.y).toBe(100); expect(Math.hypot(s.x, s.z + 760)).toBeCloseTo(240, 0); }
    expect(Math.abs(st.seats[0].x - st.seats[1].x)).toBeLessThan(12);   // ngồi gần nhau
    expect(st.hallFig[1]).toBeGreaterThan(100);   // nhân vật của mình đã rời hội chúng lên đài
    expect(st.camY).toBeLessThan(360);
    await slow.poll(() => labels(A)).toEqual(expect.arrayContaining(['Minh An · 2210', 'Tuệ Thái (bạn)']));
    await expect(A.locator('#cam [data-cam="dais"]')).toBeVisible();
    // Ngân sách §12.2 (mức 0): ≤ 120 lệnh vẽ, ≤ 400.000 tam giác, kể cả đài
    await A.waitForTimeout(1500); st = await daisState(A);
    expect(st.calls).toBeLessThanOrEqual(120); expect(st.tris).toBeLessThanOrEqual(400_000);
    if (SHOTS) await A.screenshot({ path: `/tmp/dais-${vp.width}-near.png` });
    await noDraw(A);

    await A.locator('#cam [data-cam="dais"]').click();
    await slow.poll(() => daisState(A).then((s) => s.view === 'far' && !s.tween)).toBe(true);
    st = await daisState(A);
    expect(st.camY).toBeLessThan(360);   // Toàn cảnh vẫn dưới tầm mắt Tôn tượng
    // thấy trọn Tôn tượng: đỉnh đầu (460) và đài đều trong khung hình. Đã tắt vẽ (noDraw) nên tự cập nhật ma trận camera
    // theo vị trí hiện tại; nếu không, phép chiếu dùng ma trận của khung hình cuối trước khi tắt vẽ (góc Cùng ngồi)
    const vis = await A.evaluate(() => { const w = window.__app.world, T = w.camera.position.constructor; w.camera.updateMatrixWorld(); return [new T(0, 455, -760), new T(0, 100, -585)].map((v) => { const p = w.project(v); return p.vis && p.y > 0 && p.y < w.h && p.x > 0 && p.x < w.w; }); });
    expect(vis).toEqual([true, true]);
    if (SHOTS) await A.screenshot({ path: `/tmp/dais-${vp.width}-far.png` });

    // Xoay chậm: góc phương vị đổi; chạm vào cảnh thì dừng
    await A.locator('#cam [data-cam="spin"]').click();
    await expect(A.locator('#cam [data-cam="spin"]')).toHaveAttribute('aria-pressed', 'true');
    const az = () => A.evaluate(() => { const w = window.__app.world, c = w.camera.position, t = w.controls.target; return Math.atan2(c.x - t.x, c.z - t.z); });
    const a0 = await az(); await A.waitForTimeout(3000);
    expect(Math.abs((await az()) - a0)).toBeGreaterThan(0.004);   // 1 vòng/2 phút; máy kiểm thử vẽ chậm nên chỉ đòi đã xoay
    expect((await daisState(A)).camY).toBeLessThan(360);
    const cv = await A.locator('canvas').first().boundingBox();
    await A.mouse.move(cv.x + cv.width / 2, cv.y + cv.height / 3); await A.mouse.down(); await A.mouse.move(cv.x + cv.width / 2 + 40, cv.y + cv.height / 3); await A.mouse.up();
    await expect(A.locator('#cam [data-cam="spin"]')).toHaveAttribute('aria-pressed', 'false');
    expect(A.errs).toEqual([]);
  });
}

test('hủy lời mời: đài tan, nhân vật về chỗ ở hội chúng, nút góc máy ẩn', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = seeded(600_000);
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 });   // không vẽ cảnh: chỉ kiểm trạng thái
  await slow.poll(() => daisState(A).then((s) => s.on)).toBe(true);
  await slow(M(A)).toContainText('Cùng ngồi thiền với Minh An · 2210');
  await M(A).locator('[data-act="dt-cancel"]').click();
  await slow.poll(() => daisState(A).then((s) => s.on)).toBe(false);
  const st = await daisState(A);
  expect(st.hallFig[1]).toBeLessThan(5); expect(st.hallFig[2]).toBe(-256);   // về chỗ SEAT ở hội chúng
  await expect(A.locator('#cam [data-cam="dais"]')).toBeHidden();
  await expect(A.locator('#labels .zl.dais').first()).toHaveCSS('opacity', '0');
  expect(sv.invites[0].status).toBe('huy');
  expect(A.errs).toEqual([]);
});

// Codex review #153: bạn vào muộn khi mình đang thiền và màn Bạn đồng tu đã đóng → ghế của bạn phải có người (danh sách tự tải lại)
test('bạn vào muộn khi mình đang cùng thiền, màn Bạn đồng tu đóng: Vân Tọa của bạn có người, nhãn bỏ «đang tới»', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = seeded(-5_000);   // đã tới giờ 5 giây
  sv.presence[sv.U.b.id] = { state: 'online', updated_at: Date.now() };   // B chưa vào
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 });
  await slow(M(A)).toContainText('Minh An · 2210 đang cùng ngồi thiền với bạn');
  await M(A).locator('[data-act="dt-join"]').click();
  await slow.poll(() => A.evaluate(() => window.__app.player.playing)).toBe(true);
  expect(await A.evaluate(() => window.__app.U.view)).not.toBe('dongtu');
  await slow.poll(() => daisState(A).then((s) => s.n)).toBe(2);
  const here = () => A.evaluate(() => window.__app.world.daisHeads().map((h) => h.here));
  expect(await here()).toEqual([false, true]);   // B «đang tới», mình đã ngồi
  sv.presence[sv.U.b.id] = { state: 'thien', updated_at: Date.now() };   // B vào thiền
  await slow.poll(here, { timeout: 30_000 }).toEqual([true, true]);
  await expect(A.locator('#labels .zl.dais', { hasText: 'Minh An · 2210' })).not.toContainText('đang tới');
  expect(A.errs).toEqual([]);
});

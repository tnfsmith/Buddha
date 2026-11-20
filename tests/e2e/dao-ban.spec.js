// #125 (T5.8): đảo bạn đồng tu thật trong cảnh 3D — docs/thiet-ke/ban-dong-tu.md §5.5–5.7, §6.5.
// Danh sách bạn đưa thẳng vào world.setCompanions như khi GET /companions về; không gọi máy chủ. Chuyến du vân chạy bằng bước tay (không chờ đồng hồ).
import { test, expect } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
const NAMES = ['Tuệ Thái', 'Minh An', 'An Hòa', 'Diệu Tâm', 'Thiện Chí', 'Quảng Đức', 'Tịnh Khiết', 'Nhật Quang', 'Hải Triều'];
const comp = (i, o = {}) => ({ id: 'u' + i, tinh_danh: NAMES[i], tag: String(1000 + i), look: { robe: i % 6, skin: i % 5 }, closeness: 'quen', presence: 'online', day: 20 + i, completed: false, open: true, me: { than: false, away: false }, them: { than: false, away: false }, accepted_at: 1000 + i, ...o });

async function open(page) {
  await page.route('**/api/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
  await page.goto(BASE + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.friends && window.__app.goMeet, null, { timeout: 150_000 });
  // bước tay cho chuyến du vân: không phụ thuộc tốc độ khung của SwiftShader
  await page.evaluate(() => {
    const W = window.__app.world, A = W.av;
    window.__step = (n) => { for (let i = 0; i < n; i++) { W._avatarStep(0.05, { breath: 0 }); W._friendStep(0.05); W.time += 0.05; if (W.tween) W.tween.k = 1; } };
    window.__run = (max = 2000) => { let i = 0; while (A.state === 'travel' && i++ < max) window.__step(1); return A.state; };
  });
}
const info = (page) => page.evaluate(() => { const W = window.__app.world; return { key: W.slotKey, pending: !!W.slotPending, lamps: W.frLamp.count, glow: W.frGlow.count, fr: W.friends.map((f) => ({ id: f.id || null, sim: f.sim ?? null, slot: f.slot, ring: f.ring, here: f.here, pose: f.fig.pose, vis: f.fig.group.visible })) }; });

test('bạn thật thay dần bạn mô phỏng; thân thiết ở vòng gần; hiện diện đổi đèn, không dựng lại đảo', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const d0 = await info(page);
  expect(d0.fr.map((f) => f.sim)).toEqual([0, 1, 2]);   // mặc định: ba bạn mô phỏng như trước, không đèn
  expect(d0.lamps).toBe(0);

  // một bạn thật (quen biết): thay một bạn mô phỏng, hai bạn mô phỏng còn lại giữ đảo cũ
  await page.evaluate((l) => window.__app.world.setCompanions(l), [comp(0)]);
  const d1 = await info(page);
  expect(d1.fr.filter((f) => f.id).map((f) => [f.id, f.ring])).toEqual([['u0', 1]]);
  expect(d1.fr.filter((f) => f.sim !== null).map((f) => f.sim).sort()).toEqual([1, 2]);

  // chín bạn: 5 thân thiết (4 ở vòng 0, người thứ 5 không có đảo), 4 quen biết ở vòng 1; đủ ba bạn thật thì hết bạn mô phỏng
  const list = Array.from({ length: 9 }, (_, i) => comp(i, { closeness: i < 5 ? 'than' : 'quen', presence: ['thien', 'online', 'vang', 'tra', 'online', 'tham', null, 'thien', 'online'][i] }));
  await page.evaluate((l) => window.__app.world.setCompanions(l), list);
  const d2 = await info(page);
  expect(d2.fr).toHaveLength(8);
  expect(d2.fr.every((f) => f.id)).toBe(true);
  expect(d2.fr.filter((f) => f.ring === 0).map((f) => f.id)).toEqual(['u0', 'u1', 'u2', 'u3']);
  expect(d2.fr.filter((f) => f.ring === 1).map((f) => f.id)).toEqual(['u5', 'u6', 'u7', 'u8']);
  expect(d2.lamps).toBe(8);
  expect(d2.glow).toBe(2);   // vầng sáng sát nền chỉ ở bạn đang thiền (u0, u7)
  const by = Object.fromEntries(d2.fr.map((f) => [f.id, f]));
  expect([by.u0.here, by.u1.here, by.u2.here, by.u3.here, by.u5.here, by.u6.here]).toEqual([true, true, false, true, false, false]);
  expect(by.u1.pose).toBe('stand');
  expect(by.u0.pose).toBe('sit');

  // chỉ đổi hiện diện: giữ nguyên đảo (cùng khóa), đèn của An Hòa sáng lên
  await page.evaluate((l) => window.__app.world.setCompanions(l.map((c) => (c.id === 'u2' ? { ...c, presence: 'online' } : c))), list);
  const d3 = await info(page);
  expect(d3.key).toBe(d2.key);
  const lamp = await page.evaluate(() => { const W = window.__app.world, f = W.friends.find((x) => x.id === 'u2'); return W.frLamp.instanceColor.getX(f.lamp); });
  expect(lamp).toBe(1);

  // hình dáng lạ từ máy chủ không làm hỏng cảnh
  await page.evaluate((l) => window.__app.world.setCompanions(l.map((c, i) => (i === 1 ? { ...c, look: { robe: 99, skin: 'x', hair: '<b>' } } : c))), list);
  expect((await info(page)).fr).toHaveLength(8);
});

test('du vân sang đảo bạn thật: có mặt thì đón và ngồi cạnh; vắng thì Vân Tọa trống; danh sách đổi lúc đi vắng thì chờ về mới dựng lại', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const list = [comp(0, { closeness: 'than', presence: 'online' }), comp(1, { closeness: 'than', presence: 'vang', day: 31 }), comp(2, { presence: 'thien', day: 33 })];
  await page.evaluate((l) => window.__app.world.setCompanions(l), list);

  // có mặt: tới nơi chủ đứng đón; ngồi cùng thì hai người ngồi cạnh nhau, cùng hướng Tôn tượng
  const r1 = await page.evaluate(() => {
    const W = window.__app.world, A = W.av, i = W.friends.findIndex((f) => f.id === 'u0'); W.visit(i, () => W.greet(i)); const st = window.__run(); window.__step(10);
    const host = W.friends[i].fig.pose; let sat = false; W.sitWith(i, 'thien', () => { sat = true; }); window.__run(); window.__step(20);
    return { st, where: A.where === i, host, sat, me: A.state, them: W.friends[i].fig.pose, gap: A.pos.distanceTo(W.friends[i].pos) };
  });
  expect(r1).toMatchObject({ st: 'idle', where: true, sat: true, me: 'sit', them: 'sit' });
  expect(['stand', 'anjali']).toContain(r1.host);
  expect(r1.gap).toBeGreaterThan(0.8);
  expect(r1.gap).toBeLessThan(2.2);

  // danh sách đổi khi đang ở đảo bạn: chưa dựng lại (chỉ số đảo đang đứng phải giữ nguyên); về Vân Đảo thì dựng
  await page.evaluate((l) => window.__app.world.setCompanions(l), [...list, comp(3, { closeness: 'than' })]);
  expect((await info(page)).pending).toBe(true);
  await page.evaluate(() => { const W = window.__app.world; W.goHome(() => {}); window.__run(); window.__step(2); });
  await expect.poll(async () => (await info(page)).pending, { timeout: 30_000 }).toBe(false);   // dựng lại ở khung hình kế tiếp trong update()
  const d = await info(page);
  expect(d.fr.map((f) => f.id)).toContain('u3');

  // vắng: không ai đón, Vân Tọa trống (nhân vật ẩn), khách vẫn tới và chắp tay
  const r2 = await page.evaluate(() => { const W = window.__app.world, i = W.friends.findIndex((f) => f.id === 'u1'); W.visit(i, () => W.greet(i)); const st = window.__run(); window.__step(4); return { st, here: W.friends[i].here, vis: W.friends[i].fig.group.visible, host: !!W.friends[i].host }; });
  expect(r2).toEqual({ st: 'idle', here: false, vis: false, host: false });
});

test('gặp trên đảo (place dao): khách du vân sang ngồi cạnh chủ; chủ ở nhà thấy khách ngồi cạnh và đối diện bàn trà', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const list = [comp(0, { closeness: 'than', presence: 'thien', day: 33 }), comp(1, { presence: 'online' })];
  await page.evaluate((l) => { const a = window.__app; a.acct.uid = 'me'; a.dongTu.list = { companions: l }; a.world.setCompanions(l); }, list);

  // mình là khách: lời mời «thien» từ chủ u0 → du vân sang, ngồi cạnh chủ
  const g = await page.evaluate(() => {
    const a = window.__app, W = a.world, A = W.av; a.goMeet({ id: 'i1', kind: 'thien', place: 'dao', from: 'u0', to: 'me' });
    const st0 = A.state, dest = W.friends[A.dest] && W.friends[A.dest].id; window.__run(); window.__step(20);
    return { st0, dest, me: A.state, where: W.friends[A.where] && W.friends[A.where].id };
  });
  expect(g).toEqual({ st0: 'travel', dest: 'u0', me: 'sit', where: 'u0' });
  await page.evaluate(() => { const W = window.__app.world; W.goHome(() => {}); window.__run(); });

  // mình là chủ: lời mời «tra» mình gửi u1 → khách ngồi đối diện bên bàn trà ở Vân Đảo của mình; «xin_tham» của u1 cũng là mình làm chủ
  const h = await page.evaluate(() => {
    const a = window.__app, W = a.world; a.goMeet({ id: 'i2', kind: 'tra', place: 'dao', from: 'me', to: 'u1' });
    const t = W.guest && { how: W.guest.how, sit: W.guest.fig.pose, inHome: W.guest.fig.group.parent === W.home.group };
    a.goMeet({ id: 'i3', kind: 'xin_tham', place: 'dao', from: 'u1', to: 'me' });
    return { t, x: W.guest && W.guest.how, where: W.av.where };
  });
  expect(h).toEqual({ t: { how: 'tra', sit: 'sit', inHome: true }, x: 'tham', where: 'home' });
  await page.evaluate(() => window.__app.world.setGuest(null));
  expect(await page.evaluate(() => window.__app.world.guest)).toBeNull();
});

test('tham quan (lời mời tham_quan): tới nơi thì giới thiệu lần lượt các phân khu bạn đã mở, có vòng đánh dấu; bấm để xem; về nhà thì tắt', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const list = [comp(0, { closeness: 'than', presence: 'online', day: 33 }), comp(1, { presence: 'online', day: 5 })];
  await page.evaluate((l) => { const a = window.__app; a.acct.uid = 'me'; a.dongTu.list = { companions: l }; a.world.setCompanions(l); }, list);
  const r = await page.evaluate(() => { const a = window.__app, W = a.world; a.goMeet({ id: 't1', kind: 'tham_quan', place: 'dao', from: 'u0', to: 'me' }); window.__run(); const i = W.friends.findIndex((f) => f.id === 'u0'), j = W.friends.findIndex((f) => f.id === 'u1'); return { i, stops: W.tourStops(i), small: W.tourStops(j) }; });
  expect(r.stops).toEqual(['mon', 'toa', 'bode', 'ao', 'tra', 'den', 'loi', 'am']);   // ngày 33: chưa có Bia nhỏ (ngày 40)
  expect(r.small).toEqual(['mon', 'toa', 'bode']);   // ngày 5: chỉ Vân Môn, Vân Tọa, cây Bồ-đề
  await expect.poll(() => page.evaluate(() => window.__app.world.tourAt && window.__app.world.tourAt.id), { timeout: 20_000 }).toBe('mon');
  await expect.poll(() => page.evaluate(() => window.__app.world.tourAt && window.__app.world.tourAt.id), { timeout: 20_000 }).toBe('toa');
  const P = page.locator('#panel');
  await expect(P.locator('[data-act="tq"]')).toHaveCount(8);
  await P.locator('[data-act="tq"][data-id="tra"]').click();
  expect(await page.evaluate(() => ({ at: window.__app.world.tourAt.id, mark: window.__app.world.tourMark.visible }))).toEqual({ at: 'tra', mark: true });
  await page.waitForTimeout(5000);
  expect(await page.evaluate(() => window.__app.world.tourAt.id)).toBe('tra');   // bấm chọn thì dừng giới thiệu lần lượt
  await page.evaluate(() => { window.__app.world.goHome(() => {}); window.__run(); });
  expect(await page.evaluate(() => ({ at: window.__app.world.tourAt, mark: window.__app.world.tourMark.visible }))).toEqual({ at: null, mark: false });
});

test.describe('ngân sách điện thoại với tám đảo bạn thật', () => {
  test.use({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  test('ngày 49, tám bạn thật đủ hiện diện, phản chiếu đầy đủ: mức 0 vẫn trong §12.2', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page);
    const p = await page.evaluate(async (l) => {
      const W = window.__app.world, s = document.querySelector('#sim');
      s.value = 49; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
      W.refTest = { lamps: 33, buds: 49, petals: Array(10).fill(1) }; W.setCompanions(l);
      await new Promise((r) => setTimeout(r, 2500)); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const m = W.perf(); return { calls: m.calls, triangles: m.triangles, quality: m.quality, friends: W.friends.length };
    }, Array.from({ length: 8 }, (_, i) => comp(i, { closeness: i < 4 ? 'than' : 'quen', presence: ['thien', 'online', 'tra', 'online'][i % 4], day: 49, completed: i % 2 === 0 })));
    console.log(`Tám đảo bạn thật, điện thoại mức ${p.quality}: ${p.calls} lệnh vẽ, ${p.triangles} tam giác`);
    expect(p).toMatchObject({ quality: 0, friends: 8 });
    expect(p.calls).toBeLessThanOrEqual(120);
    expect(p.triangles).toBeLessThanOrEqual(400_000);
  });
});

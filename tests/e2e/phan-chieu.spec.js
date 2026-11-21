// Đợt E (#104): Vân Đảo phản chiếu sổ tu tập trên máy (docs/noi-dung/nhiem-vu-so-nhap.md §8).
// Đèn mây theo số chương Đường Xưa đã nghe trọn, nụ sen theo số ngày giữ đủ năm giới, hoa sen 10 cánh trên Bia và quanh chỗ ngồi khi thiền.
// Không gọi máy chủ: dữ liệu ghi thẳng vào sổ trên máy như sau khi nghe trọn / giữ giới.
import { test, expect } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
const slow = expect.configure({ timeout: 30_000 });
const info = (page) => page.evaluate(() => window.__app.world.home.reflectInfo());

async function open(page, hash = '') {
  await page.route('**/api/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }));
  await page.goto(BASE + '#q=0&snap=1' + hash);
  await page.waitForFunction(() => window.__app?.world?.home?.reflectInfo, null, { timeout: 150_000 });
}

test('sổ trên máy hiện lên Vân Đảo: đèn mây, nụ sen, 10 cánh sen; vòng cánh chỉ khi ngồi thiền', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  // người mới: chưa đèn, chưa nụ; hoa sen trên Bia hiện các cánh nhạt để mời thực hành
  const i0 = await info(page);
  expect(i0).toMatchObject({ lamps: 0, buds: 0, stele: true, ring: 0 });
  expect(i0.lampMax).toBe(33);
  expect(i0.budMax).toBe(49);
  expect(i0.petals.split(',').map(Number)).toEqual(Array(10).fill(0));

  // nghe trọn 3 chương Đường Xưa (một chương nghe lại hai lần chỉ tính một đèn) và 1 bài Lời Phật dạy (không thắp đèn)
  // giữ đủ năm giới hai ngày, một ngày chỉ giữ bốn giới (không nở nụ)
  await page.evaluate(() => {
    const S = window.__app.state(), g = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), { parami: ['sila'] }]));
    S.tu = { ...S.tu,
      '2026-11-01': { nghe_duong_xua: { n: 2, min: 0, refs: ['dx-01', 'dx-02'] }, nghe_loi_phat_day: { n: 1, min: 0, refs: ['lpd-01'] } },
      '2026-11-02': { nghe_duong_xua: { n: 2, min: 0, refs: ['dx-02', 'dx-03'] } } };
    S.viec = { ...S.viec, '2026-11-01': { gioi: g(5) }, '2026-11-02': { gioi: g(5) }, '2026-11-03': { gioi: g(4) } };
  });
  await slow.poll(() => info(page)).toMatchObject({ lamps: 3, buds: 2 });
  const i1 = await info(page), pet = i1.petals.split(',').map(Number);
  expect(pet).toHaveLength(10);
  expect(Math.max(...pet)).toBe(20);   // cánh mạnh nhất sáng trọn (chuẩn hóa theo cánh mạnh nhất, không phải điểm)
  expect(i1.ring).toBe(0);

  // thêm một chương mới trong phiên: đèn thứ 4 sáng dần, không hiện tức thì
  await page.evaluate(() => { const S = window.__app.state(); S.tu['2026-11-03'] = { nghe_duong_xua: { n: 1, min: 0, refs: ['dx-04'] } }; });
  await slow.poll(() => info(page)).toMatchObject({ lamps: 4 });

  // ngồi thiền trên đảo: vòng 10 cánh nằm sát nền hiện dần; đứng dậy thì tan
  await page.evaluate(() => { const A = window.__app.world.av; A.state = 'sit'; });
  await slow.poll(async () => (await info(page)).ring).toBeGreaterThan(0.6);
  const y = await page.evaluate(() => { const W = window.__app.world, r = W.home.group.children.find((o) => o.isInstancedMesh && o.count === 10 && o.material.transparent); return r.getWorldPosition(new (W.av.pos.constructor)()).y - W.av.pos.y; });
  expect(y).toBeLessThan(0.3);   // ở mặt sàn, không phải vòng sau đầu
  await page.evaluate(() => { window.__app.world.av.state = 'idle'; });
  await slow.poll(async () => (await info(page)).ring).toBeLessThan(0.05);

  // vượt trần: đèn ≤ 33, nụ ≤ 49
  await page.evaluate(() => { window.__app.world.refTest = { lamps: 99, buds: 99, petals: Array(10).fill(1) }; });
  await slow.poll(() => info(page)).toMatchObject({ lamps: 33, buds: 49 });
});

test.describe('ngân sách điện thoại khi phản chiếu đầy đủ', () => {
  test.use({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  test('ngày 49, 33 đèn mây, 49 nụ sen, đủ cánh: mức 0 vẫn trong §12.2 (≤ 120 lệnh vẽ, ≤ 400.000 tam giác)', async ({ page }) => {
    test.setTimeout(240_000);
    await open(page);
    const p = await page.evaluate(async () => {
      const W = window.__app.world, s = document.querySelector('#sim');
      s.value = 49; s.dispatchEvent(new Event('input', { bubbles: true })); s.dispatchEvent(new Event('change', { bubbles: true }));
      W.refTest = { lamps: 33, buds: 49, petals: Array(10).fill(1) };
      await new Promise((r) => setTimeout(r, 2500));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const m = W.perf(); return { calls: m.calls, triangles: m.triangles, quality: m.quality, ...W.home.reflectInfo() };
    });
    console.log(`Phản chiếu đầy đủ, điện thoại mức ${p.quality}: ${p.calls} lệnh vẽ, ${p.triangles} tam giác (đèn ${p.lamps}, nụ ${p.buds})`);
    expect(p).toMatchObject({ quality: 0, lamps: 33, buds: 49 });
    expect(p.calls).toBeLessThanOrEqual(120);
    expect(p.triangles).toBeLessThanOrEqual(400_000);
  });
});

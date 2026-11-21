// #107 (hợp đồng mở Tầng 1 §1): thời thiền ghi số phút thực sự đã phát theo đồng hồ âm thanh.
// Kéo thanh thời gian tới cuối không biến thời ngắn thành «thời trọn» (≥ 12 phút).
import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE = process.env.E2E_BASE_URL || pathToFileURL(resolve('apps/web/dist/van-dao.html')).href;
const url = (hash) => `${BASE.replace(/#.*$/, '')}#${hash}`;
const ready = async (page) => {
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => { window.__app.world.update = () => {}; });   // ca chỉ kiểm âm thanh và sổ ghi nhận
};
/** Phát `ms` mili-giây, kéo tới gần cuối rồi chờ thời viên mãn; trả số giây đã phát và mục thời thiền hôm nay */
async function sitThenSkip(page, ms, preset = 0) {
  return page.evaluate(async ({ ms, preset }) => {
    const A = window.__app, P = A.player;
    await P.play(); await new Promise((r) => setTimeout(r, ms));
    P.sat += preset;   // giả lập đã ngồi trước đó (không chờ 12 phút thật)
    const done = new Promise((r) => { const prev = P.onend; P.onend = () => { prev(); r(); }; });
    P.seek(899); await done;
    const tu = A.state().tu || {}, day = tu[Object.keys(tu).sort().pop()] || {};
    return { sat: P.lastSat, entry: day.thoi_thien, time: P.time };
  }, { ms, preset });
}

test('kéo thanh tới cuối sau vài giây: ghi 0 phút, không thành thời trọn; thời mới bắt đầu đếm lại từ 0', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(url('q=0&snap=1')); await ready(page);
  const r = await sitThenSkip(page, 3000);
  expect(r.sat).toBeGreaterThan(2);
  expect(r.sat).toBeLessThan(15);
  expect(r.entry).toMatchObject({ n: 1, min: 0 });
  // tạm dừng không cộng thời gian: phát 1 giây, dừng 3 giây, phát tiếp 1 giây
  const p = await page.evaluate(async () => {
    const P = window.__app.player; await P.play(); await new Promise((r) => setTimeout(r, 1000)); P.pause();
    await new Promise((r) => setTimeout(r, 3000)); await P.play(); await new Promise((r) => setTimeout(r, 1000)); P.pause();
    return P.practiced;
  });
  expect(p).toBeGreaterThan(1.5);
  expect(p).toBeLessThan(3.5);
});

test('đã ngồi đủ 13 phút rồi mới kéo tới cuối: ghi 13 phút; tối đa 15 phút cho một thời', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto(url('q=0&snap=1')); await ready(page);
  const a = await sitThenSkip(page, 500, 13 * 60);
  expect(a.entry).toMatchObject({ n: 1, min: 13 });
  const b = await sitThenSkip(page, 500, 40 * 60);
  expect(b.entry).toMatchObject({ n: 2, min: 28 });   // 13 + 15 (trần một thời)
});

// #104: Phản tỉnh tuần — chỉ lưu trên máy, theo tài khoản và chu kỳ; không gửi đi, không tính điểm.
import { test, expect } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'chỉ chạy với bản dựng cục bộ');
const slow = expect.configure({ timeout: 60_000 });
const LOOK = { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' };
const SECRET = 'Bực khi kẹt xe sáng thứ Ba';

test('phản tỉnh tuần 1: mời ở ngày 8, giữ chữ khi chọn mức, lưu trên máy, không gửi đi, không đụng Kusala, xóa được', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'not_found' } }) }));
  await ctx.addInitScript(({ LOOK }) => {
    if (localStorage.getItem('vandao.seeded')) return; localStorage.setItem('vandao.seeded', '1');
    localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day: 8, lastDate: null, done: {}, tu: {}, viec: {}, nguyen: {}, seed: 42, totals: { duc: 12, thien: 8, tue: 5 }, sacca: 0, sessions: 0, completed: false, open: false, name: 'Tuệ Thái', look: LOOK }));
  }, { LOOK });
  const page = await ctx.newPage();
  const errs = [], sent = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('request', (r) => { const b = r.postData(); if (b) sent.push(b); if (r.url().includes(encodeURIComponent(SECRET.slice(0, 8)))) sent.push(r.url()); });
  await page.goto(BASE + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  const P = page.locator('#panel');
  await page.locator('#panel [data-act="board"]').first().click();
  await slow(P).toContainText('Phản tỉnh tuần 1.');
  const before = await page.evaluate(() => window.__app.state().totals);

  await P.locator('[data-act="pt-open"]').first().click();
  await expect(P.locator('h2')).toHaveText('Phản tỉnh tuần 1');
  await P.locator('#pt-s').fill(SECRET);
  await P.locator('[data-act="pt-lv"][data-k="s"][data-v="vua"]').click();
  await expect(P.locator('#pt-s')).toHaveValue(SECRET);   // chọn mức không làm mất chữ đang gõ
  await expect(P.locator('[data-act="pt-lv"][data-k="s"][data-v="vua"]')).toHaveClass(/on/);
  await P.locator('[data-act="pt-lv"][data-k="t"][data-v="it"]').click();
  await P.locator('#pt-giu').fill('Thở ba hơi trước khi trả lời');
  await P.locator('[data-act="pt-save"]').click();
  await expect(page.locator('#toast')).toContainText('Đã lưu phản tỉnh tuần 1');
  await expect(P).not.toContainText('Phản tỉnh tuần 1.');   // lời mời tắt khi đã làm
  await expect(P.locator('[data-act="pt-open"][data-w="1"]')).toContainText('tuần 1 ✓');

  // mở lại sau khi tải lại trang: còn nguyên
  await page.reload();
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.locator('#panel [data-act="board"]').first().click();
  await slow(P.locator('[data-act="pt-open"][data-w="1"]')).toBeVisible();
  await P.locator('[data-act="pt-open"][data-w="1"]').click();
  await expect(P.locator('#pt-s')).toHaveValue(SECRET);
  await expect(P.locator('[data-act="pt-lv"][data-k="s"][data-v="vua"]')).toHaveClass(/on/);
  await expect(P.locator('[data-act="pt-lv"][data-k="t"][data-v="it"]')).toHaveClass(/on/);
  expect(await page.evaluate(() => window.__app.state().totals)).toEqual(before);   // không tính điểm
  expect(sent.filter((b) => b.includes(SECRET) || b.includes('Thở ba hơi'))).toEqual([]);   // không gửi đi

  // xóa bản này: lời mời trở lại
  await P.locator('[data-act="pt-del"]').click();
  await expect(page.locator('#toast')).toContainText('Đã xóa phản tỉnh tuần 1');
  await expect(P).toContainText('Phản tỉnh tuần 1.');
  expect(await page.evaluate(() => localStorage.getItem('vandao.pt.v1'))).not.toContain('Bực khi');
  expect(errs).toEqual([]);
});

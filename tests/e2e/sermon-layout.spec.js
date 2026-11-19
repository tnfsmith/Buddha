// #139: bố cục khi nghe Thuyết giảng. Phụ đề (#sub) không bao giờ che bảng hay nút «Thu gọn»; trên điện thoại bảng sát
// cuối màn hình kể cả khi thanh nhạc đã thu nhỏ (barmin); máy tính cũng có nút Thu gọn. Ca này chạy trong CI mọi PR.
import { test, expect } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'nội dung giảng giả lập chỉ chạy với bản dựng cục bộ');
const slow = expect.configure({ timeout: 60_000 });
// Văn bản thử (không phải nội dung giáo lý), đủ dài để phụ đề xuống ba dòng như ảnh chụp lỗi
const ITEM = { id: 'bai-thu-bo-cuc', version: 1, kind: 'bai_giang', tier: 0, title: 'Bài thử bố cục', source_ref: 'Nguồn thử dài để dòng nguồn bị cắt bằng dấu ba chấm trên điện thoại · tham khảo',
  body_inline: '> Câu Pāli thử khá dài để phụ đề xuống hai dòng trên màn hình điện thoại hẹp.\nLời dịch thử cũng khá dài để chiếm thêm một dòng nghiêng nữa.\n\nÝ thử thứ hai.' };

async function open(browser, vp) {
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block', isMobile: vp.width <= 820, hasTouch: vp.width <= 820 });
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
  await page.route('**/api/v1/content**', (r) => r.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ items: new URL(r.request().url()).searchParams.get('kind') === 'bai_giang' ? [ITEM, { ...ITEM, id: 'bai-thu-bo-cuc-2' }] : [] }) }));
  await page.goto(BASE + '#q=0&snap=1&sermon=1&sk=8');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await slow(page.locator('#sub')).toContainText('Câu Pāli thử');
  return page;
}
const boxes = (page) => page.evaluate(() => {
  const r = (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, h: b.height, cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2 }; };
  return { vh: document.querySelector('#ui').getBoundingClientRect().bottom, vw: innerWidth, sub: r('#sub'), panel: r('#panel'), pm: r('#panel .pm'), cls: document.body.className };
});
/** Nút ở tâm của nó có thật sự nhận chạm không (không bị phần tử khác che) */
const hit = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel), b = el.getBoundingClientRect(); const top = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2); return !!top && (top === el || el.contains(top)); }, sel);

for (const vp of [{ width: 412, height: 860 }, { width: 360, height: 700 }]) {
  test(`điện thoại ${vp.width}×${vp.height}: bảng sát cuối kể cả khi thanh nhạc thu nhỏ, phụ đề không che nút Thu gọn`, async ({ browser }) => {
    test.setTimeout(300_000);
    const page = await open(browser, vp);
    if (await page.evaluate(() => document.body.classList.contains('pmin'))) await page.locator('#panel .pm').click();   // điện thoại tự thu gọn bảng ở Đại Thiền Đường
    await expect(page.locator('#panel .pm')).toHaveText('Thu gọn');
    // người dùng đã thu nhỏ thanh nhạc từ trước (ca của ảnh chụp lỗi): bảng vẫn phải sát cuối màn hình
    for (const barmin of [false, true]) {
      await page.evaluate((on) => document.body.classList.toggle('barmin', on), barmin);
      await expect.poll(async () => { const b = await boxes(page); return b.vh - b.panel.bottom; }).toBeLessThanOrEqual(12);
      const b = await boxes(page);
      expect(b.sub.bottom, `phụ đề (${b.cls})`).toBeLessThanOrEqual(b.panel.top + 1);   // phụ đề nằm trọn trên bảng
      expect(await hit(page, '#panel .pm')).toBe(true);                                 // nút Thu gọn bấm được
    }
    // Thu gọn → phụ đề vẫn ở trên bảng thu gọn; Mở bảng → trở lại
    await page.locator('#panel .pm').click();
    await expect(page.locator('#panel .pm')).toHaveText('Mở bảng');
    await expect.poll(async () => (await boxes(page)).panel.h).toBeLessThanOrEqual(60);
    let b = await boxes(page);
    expect(b.sub.bottom).toBeLessThanOrEqual(b.panel.top + 1);
    expect(await hit(page, '#panel .pm')).toBe(true);
    await page.locator('#panel .pm').click();
    await expect(page.locator('#panel .pm')).toHaveText('Thu gọn');
    b = await boxes(page);
    expect(b.sub.bottom).toBeLessThanOrEqual(b.panel.top + 1);
    // phụ đề chỉ là chữ: không nhận chạm
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('#sub')).pointerEvents)).toBe('none');
    expect(page.errs).toEqual([]);
  });
}

test('máy tính 1280×800: có nút Thu gọn; thu gọn thì phụ đề căn giữa; phụ đề không đè bảng', async ({ browser }) => {
  test.setTimeout(300_000);
  const page = await open(browser, { width: 1280, height: 800 });
  await expect(page.locator('#panel .pm')).toBeVisible();
  await expect(page.locator('#panel .pm')).toHaveText('Thu gọn');
  const overlap = (b) => !(b.sub.right <= b.panel.left || b.sub.left >= b.panel.right || b.sub.bottom <= b.panel.top || b.sub.top >= b.panel.bottom);
  let b = await boxes(page);
  expect(overlap(b)).toBe(false);
  await page.locator('#panel .pm').click();
  await expect(page.locator('#panel .pm')).toHaveText('Mở bảng');
  await expect.poll(async () => (await boxes(page)).panel.h).toBeLessThanOrEqual(60);
  b = await boxes(page);
  expect(Math.abs(b.sub.cx - b.vw / 2)).toBeLessThan(4);   // bảng thu gọn: phụ đề căn giữa
  expect(overlap(b)).toBe(false);
  expect(await hit(page, '#panel .pm')).toBe(true);
  await page.locator('#panel .pm').click();
  await expect(page.locator('#panel .pm')).toHaveText('Thu gọn');
  expect(overlap(await boxes(page))).toBe(false);
  expect(page.errs).toEqual([]);
});

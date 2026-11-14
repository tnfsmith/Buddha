import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Issue #39: Thuyết giảng chỉ phát bài đã được Hội đồng cố vấn Pháp học duyệt (AGENTS.md mục 1.6).
// API được giả lập; bài trong các ca này là văn bản thử, không phải nội dung giáo lý và không vào D1.
const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
const DRAFT = 'Có hai cực đoan người tu không nên theo';   // một câu của bảy bài tóm lược cũ (bản nháp, chưa duyệt)
const slow = expect.configure({ timeout: 60_000 });
const OK = { id: 'bai-thu', version: 2, kind: 'bai_giang', tier: 0, title: 'Bài thử đã duyệt', source_ref: 'Nguồn thử 1.1', reviewed_at: 1763100000000, body_inline: 'Ý thử thứ nhất.\n> Câu Pāli thử.\n\nÝ thử thứ hai.' };
const ITEMS = [
  OK,
  { ...OK, version: 1, title: 'Phiên bản cũ', body_inline: 'Ý của phiên bản cũ.' },   // cùng id, version thấp hơn: không hiện
  { ...OK, id: 'chua-duyet', title: 'Thiếu dấu duyệt', reviewed_at: null },
  { ...OK, id: 'khong-noi-dung', title: 'Không có nội dung', body_inline: null, body_r2_key: 'r2/x' },
  { ...OK, id: 'khong-nguon', title: 'Không có nguồn kinh', source_ref: '' },
  { ...OK, id: 'bai-thien', kind: 'bai_thien', title: 'Không phải bài giảng' },
];

/** Giả lập GET /api/v1/content; trả mảng các URL đã gọi để kiểm tham số */
async function mock(page, reply) {
  const calls = [];
  await page.route('**/api/v1/content**', (route) => { calls.push(route.request().url()); return typeof reply === 'function' ? reply(route) : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: reply }) }); });
  return calls;
}
// Chờ dựng xong cảnh rồi cho ngừng vẽ (như tab ẩn): các ca này kiểm bảng chữ và tiến trình giảng, không kiểm hình
async function open(page, hash) {
  await page.goto(BASE + '#q=0&snap=1&' + hash);
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
}
const panel = (page) => page.locator('#panel');
const live = (page) => page.evaluate(() => ({ on: window.__app.sermon.on, sub: document.querySelector('#sub')?.textContent || '', state: window.__app.library.state }));
/** Tua tiến trình giảng (đảnh lễ 6,5 giây) để tới ý đầu tiên */
const skip = (page, sec) => page.evaluate((n) => { for (let i = 0; i < n * 20; i++) window.__app.sermon.tick(0.05); }, sec);

test('bản dựng không còn chứa bảy bài tóm lược chưa duyệt', async ({ request }) => {
  const html = await (await request.get(BASE)).text();
  expect(html).toContain('Vân Đạo');
  expect(html).not.toContain(DRAFT);
  const dist = resolve('apps/web/dist/van-dao.html');
  if (!process.env.E2E_BASE_URL && existsSync(dist)) expect(readFileSync(dist, 'utf8')).not.toContain(DRAFT);
});

test('chưa có bài nào được duyệt: trạng thái trống, không có nút giảng, #sermon=… không phát gì', async ({ page }) => {
  test.setTimeout(240_000);
  const calls = await mock(page, []);
  await open(page, 'sermon=1');
  await slow(panel(page)).toContainText('Chưa có bài giảng nào được Hội đồng cố vấn Pháp học duyệt');
  expect(calls.length).toBeGreaterThan(0); expect(new URL(calls[0]).searchParams.get('kind')).toBe('bai_giang');
  await expect(panel(page).locator('[data-act="sermon-go"], [data-sut]')).toHaveCount(0);
  expect(await live(page)).toEqual({ on: false, sub: '', state: 'ok' });
  await expect(page.locator('body')).not.toContainText(DRAFT);

  // mở thẳng mã của một bài tóm lược cũ
  const p2 = await page.context().newPage(); await mock(p2, []);
  await open(p2, 'sermon=chuyen-phap-luan&sk=20');
  await slow(panel(p2)).toContainText('Chưa có bài giảng nào được Hội đồng cố vấn Pháp học duyệt');
  expect(await live(p2)).toEqual({ on: false, sub: '', state: 'ok' });
  await expect(p2.locator('body')).not.toContainText(DRAFT);
});

test('chỉ hiện và phát bài có dấu duyệt, đủ nguồn và nội dung; bản mới nhất của mỗi bài', async ({ page }) => {
  test.setTimeout(240_000);
  await mock(page, ITEMS);
  await open(page, 'sermon=khong-nguon');   // bài thiếu nguồn kinh: không phát dù mở thẳng mã
  await slow(panel(page).locator('[data-sut]')).toHaveCount(1);
  await expect(panel(page).locator('[data-sut]')).toHaveText(/Bài thử đã duyệt\s*Nguồn thử 1\.1/);
  for (const t of ['Phiên bản cũ', 'Thiếu dấu duyệt', 'Không có nội dung', 'Không có nguồn kinh', 'Không phải bài giảng']) await expect(panel(page)).not.toContainText(t);
  expect((await live(page)).on).toBe(false);
  await slow(page.locator('#toast')).toHaveText('Bài giảng này chưa được Hội đồng cố vấn Pháp học duyệt.');

  await panel(page).locator('[data-act="sermon-go"]').click();
  await slow.poll(async () => (await live(page)).on).toBe(true);
  await skip(page, 7);
  const a = await live(page);
  expect(a.sub).toContain('Ý thử thứ nhất.'); expect(a.sub).toContain('Câu Pāli thử.'); expect(a.sub).toContain('Bài thử đã duyệt · Nguồn thử 1.1 · ý 1/2');
  await panel(page).locator('[data-act="sermon-stop"]').click();
  await slow.poll(async () => (await live(page)).on).toBe(false);

  // mở thẳng mã bài đã duyệt thì phát ngay
  const p2 = await page.context().newPage(); await mock(p2, ITEMS);
  await open(p2, 'sermon=bai-thu&sk=7');
  await slow.poll(async () => (await live(p2)).sub).toContain('Ý thử thứ nhất.');
});

test('không tải được danh sách: báo lỗi an toàn, Thử lại thì tải lại', async ({ page }) => {
  test.setTimeout(240_000);
  let fail = true;
  await mock(page, (route) => (fail ? route.abort('internetdisconnected') : route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [OK] }) })));
  await open(page, 'sermon=1');
  await slow(panel(page)).toContainText('Chưa tải được danh sách bài giảng đã duyệt');
  expect(await live(page)).toEqual({ on: false, sub: '', state: 'error' });
  fail = false;
  await panel(page).locator('[data-act="sermon-reload"]').click();
  await slow(panel(page).locator('[data-sut]')).toHaveCount(1);
  expect((await live(page)).on).toBe(false);   // tải lại không tự phát
});

test('máy chủ trả lỗi hoặc không phải JSON: không hiện bài nào', async ({ page }) => {
  test.setTimeout(240_000);
  await mock(page, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>x</title>' }));
  await open(page, 'sermon=1');
  await slow(panel(page)).toContainText('Chưa tải được danh sách bài giảng đã duyệt');
  await expect(panel(page).locator('[data-sut]')).toHaveCount(0);
});

test('bản HTML đơn mở từ tệp trên máy: không gọi được máy chủ nên không có bài giảng', async ({ page }) => {
  test.skip(!!process.env.E2E_BASE_URL || !existsSync(resolve('apps/web/dist/van-dao.html')), 'chỉ chạy khi có bản HTML đơn cục bộ');
  test.setTimeout(240_000);
  await page.goto(pathToFileURL(resolve('apps/web/dist/van-dao.html')).href + '#q=0&snap=1&sermon=1');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await slow(panel(page)).toContainText('bản HTML đơn mở từ tệp trên máy không tải được bài giảng');
  expect(await live(page)).toEqual({ on: false, sub: '', state: 'error' });
});

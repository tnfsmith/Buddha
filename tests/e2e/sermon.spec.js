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

// Issue #51 / ADR 0002: bài có giọng đọc (MP3 trên R2 qua /media) và loạt bài theo thứ tự chương.
// /media được giả lập bằng một tệp WAV ngắn sinh tại chỗ; không gọi R2 hay OpenAI thật.
const KEY = 'bai-giang/duong-xua/co-tieng/v1-aaaa1111/vi-cedar.mp3';
const VOICED = { ...OK, id: 'co-tieng', title: 'Bài có giọng đọc', body_inline: 'Ý một có tiếng.\nÝ hai có tiếng.', body_r2_key: KEY, meta: { loat: 'duong-xua', phan: 1, thu_tu: 80 } };
const EARLY = { ...OK, id: 'chuong-dau', title: 'Bài chương đầu', meta: JSON.stringify({ loat: 'duong-xua', phan: 1, thu_tu: 20 }) };
const CUES = { v: 1, id: 'co-tieng', version: 2, dur: 2.4, cues: [{ i: 0, t: 0, e: 1.0 }, { i: 1, t: 1.2, e: 2.2 }] };
const AI = 'Giọng đọc do AI tạo (OpenAI)';
/** WAV mono 16 bit, tiếng 220 Hz khẽ, dài sec giây */
function wav(sec = 2.4, sr = 8000) {
  const n = Math.round(sec * sr), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((i / sr) * 2 * Math.PI * 220) * 1200), 44 + i * 2);
  return b;
}
async function media(page, { mp3 = 200, cues = CUES } = {}) {
  const hits = [];
  await page.route('**/media/**', (route) => {
    const u = route.request().url(); hits.push(new URL(u).pathname);
    if (u.endsWith('.cues.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cues) });
    return mp3 === 200 ? route.fulfill({ status: 200, contentType: 'audio/wav', body: wav() }) : route.fulfill({ status: mp3, body: '' });
  });
  return hits;
}
/** Chạy tiến trình giảng từng bước 0,05 giây (vòng vẽ đã dừng) cho tới khi tới pha mong muốn */
const until = (page, phase) => slow.poll(() => page.evaluate(() => { window.__app.sermon.tick(0.05); return window.__app.sermon.phase; }), { intervals: [50] }).toBe(phase);
async function begin(page, id) {
  await open(page, 'sermon=khong-co');
  await slow(panel(page).locator(`[data-sut="${id}"]`)).toHaveCount(1);
  await panel(page).locator(`[data-sut="${id}"]`).click();
  await panel(page).locator('[data-act="sermon-go"]').click();
  await slow.poll(async () => (await live(page)).on).toBe(true);
  await skip(page, 7);
}

test('service worker không đụng tới /media/ (phản hồi 206 không lưu cache được)', async ({ request }) => {
  const sw = await (await request.get(BASE + 'sw.js')).text();
  expect(sw).toContain("url.pathname.startsWith('/media/')");
});

test('bài có giọng đọc: xếp theo loạt và thứ tự chương, phát tiếng theo cues, có nhãn giọng AI, điều khiển được', async ({ page }) => {
  test.setTimeout(240_000);
  await mock(page, [VOICED, OK, EARLY]);
  const hits = await media(page);
  await open(page, 'sermon=khong-co');
  // menu riêng cho từng loạt: bài chưa có meta vào «Lời Phật dạy» (thẻ đầu), loạt Đường Xưa xếp theo thu_tu
  const tabs = panel(page).locator('[data-opt="loat"] button');
  await slow(tabs).toHaveText(['Lời Phật dạy', 'Đường Xưa Mây Trắng']);
  await expect(panel(page).locator('[data-opt="loat"] .on')).toHaveText('Lời Phật dạy');
  await expect(panel(page).locator('[data-sut]')).toHaveCount(1); await expect(panel(page).locator('[data-sut="bai-thu"]')).toHaveCount(1);
  await tabs.nth(1).click();
  expect(await panel(page).locator('[data-sut]').evaluateAll((els) => els.map((e) => e.dataset.sut))).toEqual(['chuong-dau', 'co-tieng']);
  for (const t of ['Phần Một — Ánh sao mai', 'Nguồn thử 1.1 · có giọng đọc']) await expect(panel(page)).toContainText(t);

  await panel(page).locator('[data-sut="co-tieng"]').click();
  await panel(page).locator('[data-act="sermon-go"]').click();
  await slow.poll(async () => (await live(page)).on).toBe(true);
  await skip(page, 7);
  await until(page, 'audio');
  let a = await live(page);
  expect(a.sub).toContain('Ý một có tiếng.'); expect(a.sub).toContain(AI); expect(a.sub).toContain('ý 1/2');
  expect(hits).toEqual(expect.arrayContaining(['/media/' + KEY, '/media/' + KEY.replace(/\.mp3$/, '.cues.json')]));
  await slow.poll(() => page.evaluate(() => window.__app.sermon.au?.el.currentTime || 0)).toBeGreaterThan(0.1);

  await panel(page).locator('[data-act="sermon-pause"]').click();
  expect(await page.evaluate(() => [window.__app.sermon.paused, window.__app.sermon.au.el.paused])).toEqual([true, true]);
  await expect(panel(page).locator('[data-act="sermon-pause"]')).toHaveText('Tiếp tục');
  await panel(page).locator('[data-act="sermon-pause"]').click();
  expect(await page.evaluate(() => window.__app.sermon.paused)).toBe(false);

  await panel(page).locator('[data-act="sermon-next"]').click();
  a = await live(page); expect(a.sub).toContain('Ý hai có tiếng.'); expect(a.sub).toContain('ý 2/2');
  await until(page, 'sadhu');   // hết tệp thì sang đảnh lễ kết thúc
  expect(await page.evaluate(() => window.__app.sermon.au)).toBeNull();
  await panel(page).locator('[data-act="sermon-stop"]').click();
});

test('giọng đọc lỗi (thiếu tệp, cues lệch số ý): vẫn giảng bằng chữ, không có nhãn giọng AI', async ({ page }) => {
  test.setTimeout(240_000);
  await mock(page, [VOICED]); await media(page, { mp3: 404 });
  await begin(page, 'co-tieng');
  await until(page, 'line');
  let a = await live(page); expect(a.sub).toContain('Ý một có tiếng.'); expect(a.sub).not.toContain(AI);

  const p2 = await page.context().newPage(); await mock(p2, [VOICED]); await media(p2, { cues: { v: 1, cues: [{ i: 0, t: 0, e: 1 }] } });
  await begin(p2, 'co-tieng');
  await until(p2, 'line');
  a = await live(p2); expect(a.sub).toContain('Ý một có tiếng.'); expect(a.sub).not.toContain(AI);
});

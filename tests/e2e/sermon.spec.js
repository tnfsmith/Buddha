import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Issue #39: Thuyết giảng chỉ phát bài máy chủ trả về (đã phát hành). #55: Hội đồng không bắt buộc, reviewed_at không là điều kiện ở client.
// API được giả lập; bài trong các ca này là văn bản thử, không phải nội dung giáo lý và không vào D1.
const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
const DRAFT = 'Có hai cực đoan người tu không nên theo';   // một câu của bảy bài tóm lược cũ (bản nháp, chưa duyệt)
const slow = expect.configure({ timeout: 60_000 });
const OK = { id: 'bai-thu', version: 2, kind: 'bai_giang', tier: 0, title: 'Bài thử đã duyệt', source_ref: 'Nguồn thử 1.1', reviewed_at: 1763100000000, body_inline: 'Ý thử thứ nhất.\n> Câu Pāli thử.\n\nÝ thử thứ hai.' };
const ITEMS = [
  OK,
  { ...OK, version: 1, title: 'Phiên bản cũ', body_inline: 'Ý của phiên bản cũ.' },   // cùng id, version thấp hơn: không hiện
  { ...OK, id: 'khong-dau-duyet', title: 'Không có dấu thời gian duyệt', reviewed_at: null },   // #55: vẫn hiện
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

test('chưa có bài nào được phát hành: trạng thái trống, không có nút giảng, #sermon=… không phát gì', async ({ page }) => {
  test.setTimeout(240_000);
  const calls = await mock(page, []);
  await open(page, 'sermon=1');
  await slow(panel(page)).toContainText('Chưa có bài chia sẻ. Nội dung đang được cập nhật.');
  expect(calls.length).toBeGreaterThan(0); expect(new URL(calls[0]).searchParams.get('kind')).toBe('bai_giang');
  await expect(panel(page).locator('[data-act="sermon-go"], [data-sut]')).toHaveCount(0);
  expect(await live(page)).toEqual({ on: false, sub: '', state: 'ok' });
  await expect(page.locator('body')).not.toContainText(DRAFT);

  // mở thẳng mã của một bài tóm lược cũ
  const p2 = await page.context().newPage(); await mock(p2, []);
  await open(p2, 'sermon=chuyen-phap-luan&sk=20');
  await slow(panel(p2)).toContainText('Chưa có bài chia sẻ. Nội dung đang được cập nhật.');
  expect(await live(p2)).toEqual({ on: false, sub: '', state: 'ok' });
  await expect(p2.locator('body')).not.toContainText(DRAFT);
});

test('chỉ hiện và phát bài đủ nguồn và nội dung (không bắt buộc dấu duyệt); bản mới nhất của mỗi bài', async ({ page }) => {
  test.setTimeout(240_000);
  await mock(page, ITEMS);
  await open(page, 'sermon=khong-nguon');   // bài thiếu nguồn kinh: không phát dù mở thẳng mã
  await slow(panel(page).locator('[data-sut]')).toHaveCount(2);
  await expect(panel(page).locator('[data-sut]').first()).toHaveText(/Bài thử đã duyệt\s*Nguồn thử 1\.1/);
  await expect(panel(page).locator('[data-sut="khong-dau-duyet"]')).toHaveCount(1);
  for (const t of ['Phiên bản cũ', 'Không có nội dung', 'Không có nguồn kinh', 'Không phải bài giảng']) await expect(panel(page)).not.toContainText(t);
  expect((await live(page)).on).toBe(false);
  await slow(page.locator('#toast')).toHaveText('Bài giảng này chưa được phát hành.');

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
  await slow(panel(page)).toContainText('Chưa tải được danh sách bài giảng');
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
  await slow(panel(page)).toContainText('Chưa tải được danh sách bài giảng');
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
const CUES = { v: 1, id: 'co-tieng', version: 2, provider: 'google', voice: 'vi-VN-Chirp3-HD-Charon', dur: 14, cues: [{ i: 0, t: 0, e: 7.5 }, { i: 1, t: 8, e: 13.5 }] };   // đủ dài để bấm nút trước khi hết ý 1, kể cả trên máy chậm
const AI = 'Giọng đọc do AI tạo';   // #63: nhãn theo nhà cung cấp trong cues.json; #79: không còn hiện dưới chữ khi giảng
/** WAV mono 16 bit, tiếng 220 Hz khẽ, dài sec giây */
function wav(sec = 14, sr = 8000) {
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
    if (u.endsWith('.cues.json')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(typeof cues === 'function' ? cues(u) : cues) });
    if (mp3 !== 200) return route.fulfill({ status: mp3, body: '' });
    // như /media thật (ADR 0002 mục 4): hỗ trợ Range để tua được
    const body = wav(), m = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range || '');
    if (!m) return route.fulfill({ status: 200, contentType: 'audio/wav', headers: { 'accept-ranges': 'bytes' }, body });
    const a = +m[1], z = m[2] ? Math.min(+m[2], body.length - 1) : body.length - 1;
    return route.fulfill({ status: 206, contentType: 'audio/wav', headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${z}/${body.length}` }, body: body.subarray(a, z + 1) });
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

test('bài có giọng đọc: xếp theo loạt và thứ tự chương, phát tiếng theo cues, điều khiển được; nhãn giọng AI ở chú thích bảng, không dưới chữ (#79)', async ({ page }) => {
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
  for (const t of ['Phần Một — Ánh sao mai', 'Nguồn thử 1.1 · có giọng đọc', 'Giọng đọc được tạo bằng AI.']) await expect(panel(page)).toContainText(t);

  // nhãn giọng AI theo nhà cung cấp khai trong cues.json, hoặc suy từ tên giọng / mô hình (#63)
  expect(await page.evaluate(() => [{ provider: 'google' }, { voice: 'vi-VN-Chirp3-HD-Orus' }, { model: 'gpt-4o-mini-tts', voice: 'cedar' }, { voice: 'la' }].map(window.__app.voiceLabel)))
    .toEqual(['Giọng đọc do AI tạo (Google)', 'Giọng đọc do AI tạo (Google)', 'Giọng đọc do AI tạo (OpenAI)', 'Giọng đọc do AI tạo']);
  await panel(page).locator('[data-sut="co-tieng"]').click();
  await panel(page).locator('[data-act="sermon-go"]').click();
  await slow.poll(async () => (await live(page)).on).toBe(true);
  await skip(page, 7);
  await until(page, 'audio');
  let a = await live(page);
  expect(a.sub).toContain('Ý một có tiếng.'); expect(a.sub).not.toContain(AI); expect(a.sub).toContain('ý 1/2');
  expect(hits).toEqual(expect.arrayContaining(['/media/' + KEY, '/media/' + KEY.replace(/\.mp3$/, '.cues.json')]));
  await slow.poll(() => page.evaluate(() => window.__app.sermon.au?.el.currentTime || 0)).toBeGreaterThan(0.1);

  // tạm dừng rồi mới sang ý sau: tiếng đứng yên nên không phụ thuộc tốc độ máy chạy kiểm thử
  await panel(page).locator('[data-act="sermon-pause"]').click();
  expect(await page.evaluate(() => [window.__app.sermon.paused, window.__app.sermon.au.el.paused])).toEqual([true, true]);
  await expect(panel(page).locator('[data-act="sermon-pause"]')).toHaveText('Tiếp tục');
  await panel(page).locator('[data-act="sermon-next"]').click();
  a = await live(page); expect(a.sub).toContain('Ý hai có tiếng.'); expect(a.sub).toContain('ý 2/2');
  expect(await page.evaluate(() => window.__app.sermon.au.el.currentTime)).toBeGreaterThanOrEqual(7.9);
  await panel(page).locator('[data-act="sermon-pause"]').click();
  expect(await page.evaluate(() => window.__app.sermon.paused)).toBe(false);
  await until(page, 'sadhu');   // hết tệp thì sang đảnh lễ kết thúc
  expect(await page.evaluate(() => window.__app.sermon.au)).toBeNull();
  await panel(page).locator('[data-act="sermon-stop"]').click();
});

test('giọng đọc lỗi (thiếu tệp, cues lệch số ý): vẫn giảng bằng chữ, không có nhãn giọng AI', async ({ page }) => {
  test.setTimeout(240_000);
  await mock(page, [VOICED, RITE_MO, RITE_KET]); await media(page, { mp3: 404, cues: riteCues });   // cả lời mở đầu / lời kết cũng lỗi: đảnh lễ bằng chữ như cũ
  await begin(page, 'co-tieng');
  await until(page, 'line');
  let a = await live(page); expect(a.sub).toContain('Ý một có tiếng.'); expect(a.sub).not.toContain('Giọng đọc do AI tạo');

  const p2 = await page.context().newPage(); await mock(p2, [VOICED]); await media(p2, { cues: { v: 1, cues: [{ i: 0, t: 0, e: 1 }] } });
  await begin(p2, 'co-tieng');
  await until(p2, 'line');
  a = await live(p2); expect(a.sub).toContain('Ý một có tiếng.'); expect(a.sub).not.toContain('Giọng đọc do AI tạo');

  // mất tiếng ngay khi vừa vào bài (bị chặn phát, tệp hỏng): đọc lại ý đang dở bằng chữ, không bỏ sót ý 1
  const p3 = await page.context().newPage(); await mock(p3, [VOICED]); await media(p3);
  await begin(p3, 'co-tieng');
  await until(p3, 'audio');
  await p3.evaluate(() => window.__app.sermon.au.fail('play'));
  await until(p3, 'line');
  a = await live(p3); expect(a.sub).toContain('Ý một có tiếng.'); expect(a.sub).toContain('ý 1/2'); expect(a.sub).not.toContain('Giọng đọc do AI tạo');
});

// #79/#80: lời mở đầu và hồi hướng có giọng đọc (mục nghi thức, meta.vai). Không nằm trong danh sách; loạt có bản riêng thì dùng bản riêng.
// Chủ dự án chốt 15/11/2026: Namo và Sādhu chỉ bằng chữ + hội chúng đảnh lễ (không có trong MP3); tiếng chỉ có lời Việt.
const RITE_MO = { ...OK, id: 'nghi-thuc-mo-dau', version: 1, title: 'Lời mở đầu', source_ref: 'Lời Việt biên soạn', meta: { loat: 'nghi-thuc', vai: 'mo-dau' },
  body_inline: 'Lời chào thử.\nLời mời lắng nghe thử.', body_r2_key: 'bai-giang/nghi-thuc/nghi-thuc-mo-dau/v1-bbbb2222/vi-sadaltager.mp3' };
const RITE_KET = { ...OK, id: 'nghi-thuc-ket-thuc', version: 1, title: 'Lời kết và hồi hướng', source_ref: 'Lời hồi hướng biên soạn', meta: JSON.stringify({ loat: 'nghi-thuc', vai: 'ket-thuc' }),
  body_inline: 'Lời hồi hướng thử.\n> Idaṃ me ñātīnaṃ hotu.', body_r2_key: 'bai-giang/nghi-thuc/nghi-thuc-ket-thuc/v1-cccc3333/vi-puck.mp3' };
const RITE_DX = { ...RITE_MO, id: 'duong-xua-mo-dau', title: 'Lời mở đầu Đường Xưa', meta: { loat: 'duong-xua', vai: 'mo-dau' }, body_inline: 'Lời mở đầu riêng của loạt.\nMời bạn cùng đi.', body_r2_key: 'bai-giang/duong-xua/duong-xua-mo-dau/v1-dddd4444/vi-sadaltager.mp3' };
const RC = (id, n) => ({ v: 1, id, version: 1, provider: 'google', voice: 'vi-VN-Chirp3-HD-Sadaltager', dur: 14, cues: n === 1 ? [{ i: 0, t: 0, e: 13 }] : [{ i: 0, t: 0, e: 6.5 }, { i: 1, t: 7, e: 13.5 }] });
const riteCues = (u) => (u.includes('nghi-thuc-mo-dau') ? RC('nghi-thuc-mo-dau', 2) : u.includes('nghi-thuc-ket-thuc') ? RC('nghi-thuc-ket-thuc', 1) : u.includes('duong-xua-mo-dau') ? RC('duong-xua-mo-dau', 2) : CUES);
const next = (page) => panel(page).locator('[data-act="sermon-next"]').click();
const ph = (page) => page.evaluate(() => window.__app.sermon.phase);

test('lời mở đầu và hồi hướng có giọng đọc: đảnh lễ Namo bằng chữ trước lời mở đầu; Sādhu và ba lần lạy trước hồi hướng; không vào danh sách', async ({ page }) => {
  test.setTimeout(300_000);
  // RITE_KET thiếu meta (API trước 0008): vẫn nhận ra theo mã nghi-thuc-ket-thuc
  await mock(page, [VOICED, OK, RITE_MO, { ...RITE_KET, meta: undefined }, RITE_DX]); const hits = await media(page, { cues: riteCues });
  await open(page, 'sermon=khong-co');
  await slow(panel(page).locator('[data-sut]')).toHaveCount(1);   // thẻ «Lời Phật dạy»: chỉ bai-thu
  for (const t of ['Lời mở đầu', 'Lời kết và hồi hướng']) await expect(panel(page)).not.toContainText(t);
  expect(await page.evaluate(() => Object.keys(window.__app.library.rite).sort())).toEqual(['duong-xua:mo-dau', 'nghi-thuc:ket-thuc', 'nghi-thuc:mo-dau']);

  // bài loạt «Lời Phật dạy» (không có giọng đọc): đảnh lễ Namo bằng chữ dù lời mở đầu đã tải xong, rồi mới phát lời mở đầu chung
  await panel(page).locator('[data-act="sermon-go"]').click();
  await slow.poll(async () => (await live(page)).on).toBe(true);
  await slow.poll(() => page.evaluate(() => window.__app.sermon.oa && window.__app.sermon.oa.state)).toBe('ready');
  await page.evaluate(() => { for (let i = 0; i < 40; i++) window.__app.sermon.tick(0.05); });   // giây thứ 2 của đảnh lễ
  let a = await live(page); expect(a.sub).toContain('Namo tassa');
  expect(await page.evaluate(() => { const s = window.__app.sermon; return [s.phase, s.cam, s.st.bow > 0.2]; })).toEqual(['homage', 'wide', true]);
  await until(page, 'mo-dau');
  a = await live(page); expect(a.sub).toContain('Lời mở đầu'); expect(a.sub).toContain('Lời chào thử.'); expect(a.sub).not.toContain('Namo');
  expect(await page.evaluate(() => window.__app.sermon.cam)).toBe('close');
  await panel(page).locator('[data-act="sermon-pause"]').click();
  expect(await page.evaluate(() => window.__app.sermon.oa.el.paused)).toBe(true);
  await next(page); a = await live(page); expect(a.sub).toContain('Lời mời lắng nghe thử.');
  await panel(page).locator('[data-act="sermon-pause"]').click();
  await next(page);   // hết lời mở đầu: vào bài
  await until(page, 'line'); a = await live(page); expect(a.sub).toContain('Ý thử thứ nhất.');
  await panel(page).locator('[data-act="sermon-stop"]').click();
  await slow.poll(async () => (await live(page)).on).toBe(false);

  // bài loạt «Đường Xưa»: bản mở đầu riêng; hết bài thì Sādhu bằng chữ, hội chúng lạy (toàn cảnh), rồi hồi hướng có tiếng (cận cảnh, công đức)
  const before = await page.evaluate(() => window.__app.state().sermons || 0);
  await panel(page).locator('[data-opt="loat"] button').nth(1).click();
  await panel(page).locator('[data-sut="co-tieng"]').click();
  await panel(page).locator('[data-act="sermon-go"]').click();
  await until(page, 'mo-dau');
  a = await live(page); expect(a.sub).toContain('Lời mở đầu riêng của loạt.');
  expect(hits).toEqual(expect.arrayContaining(['/media/' + RITE_DX.body_r2_key, '/media/' + RITE_KET.body_r2_key]));
  await next(page); await next(page);
  await until(page, 'audio');
  await panel(page).locator('[data-act="sermon-pause"]').click();
  await next(page); await next(page);   // ý 2 rồi hết bài
  await panel(page).locator('[data-act="sermon-pause"]').click();
  await until(page, 'sadhu');
  a = await live(page); expect(a.sub).toContain('Sādhu! Sādhu! Sādhu!');
  expect(await page.evaluate(() => { const s = window.__app.sermon; for (let i = 0; i < 30; i++) s.tick(0.05); return [s.phase, s.cam, s.st.bow > 0.5]; })).toEqual(['sadhu', 'wide', true]);
  await until(page, 'ket-thuc');
  a = await live(page); expect(a.sub).toContain('Lời hồi hướng thử.'); expect(a.sub).toContain('Idaṃ me ñātīnaṃ hotu.');
  expect(await page.evaluate(() => { const s = window.__app.sermon; s.tick(0.05); return [s.cam, s.st.merit]; })).toEqual(['close', 1]);
  await next(page);   // hết hồi hướng: viên mãn
  await slow.poll(async () => (await live(page)).on).toBe(false);
  expect(await page.evaluate(() => window.__app.state().sermons)).toBe(before + 1);
});

test('điện thoại: chữ khi giảng nằm sát đáy dưới Tôn tượng, bảng thu gọn vẫn có nút điều khiển, nút máy quay nhỏ gọn (#79)', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), page = await ctx.newPage();
  await mock(page, [{ ...OK, body_inline: 'Một ý thử khá dài để chữ xuống hai ba dòng trên màn hình điện thoại, giống một ý thật của bài giảng tóm lược.\n> Câu Pāli thử.\nÝ thử thứ hai.' }]);
  await page.goto(BASE + '#q=0&snap=1&sermon=bai-thu&sk=8');
  await page.waitForFunction(() => window.__app?.world?.renderer && window.__app.sermon.on && window.__app.sermon.phase === 'line', null, { timeout: 200_000 });
  await slow.poll(() => page.evaluate(() => !window.__app.world.tween && window.__app.U.sCam === 'close')).toBe(true);
  await page.evaluate(() => window.__app.sermon.pause());
  const m = await page.evaluate(() => {
    const r = (q) => document.querySelector(q).getBoundingClientRect(), w = window.__app.world, V = w.camera.position.constructor, H = innerHeight;
    const y = (h) => ((1 - new V(0, h, -760).project(w.camera).y) / 2) * H;
    return { H, pmin: document.body.classList.contains('pmin'), sub: r('#sub').toJSON(), panel: r('#panel').toJSON(), tabs: r('#tabs').toJSON(), stop: r('#panel [data-act="sermon-stop"]').toJSON(), cam: r('#cam button').toJSON(), head: y(460), shoulder: y(305) };
  });
  expect(m.pmin).toBe(true);
  expect(m.sub.top).toBeGreaterThan(m.H * 0.55); expect(m.sub.bottom).toBeLessThanOrEqual(m.panel.top + 1);
  expect(m.stop.height).toBeGreaterThan(0); expect(m.stop.top).toBeGreaterThanOrEqual(m.panel.top); expect(m.stop.bottom).toBeLessThanOrEqual(m.panel.bottom);
  expect(m.cam.width).toBeLessThanOrEqual(30);
  expect(m.head).toBeGreaterThan(m.tabs.bottom); expect(m.shoulder).toBeLessThan(m.sub.top);   // đỉnh đầu dưới thanh tab, vai trên vùng chữ: không che Tôn tượng
  await expect(page.locator('#sub')).not.toContainText(AI);
  await ctx.close();
});

// #79: nghe lần lượt cả loạt — lời mở đầu trước bài đầu, giữa các bài chỉ gật đầu báo bài tiếp, lời kết sau bài cuối
test('nghe lần lượt: phát hết các bài của loạt từ bài đang chọn, mở đầu một lần, kết một lần', async ({ page }) => {
  test.setTimeout(300_000);
  const TWO = { ...OK, id: 'bai-hai', title: 'Bài thứ hai', body_inline: 'Ý bài hai thứ nhất.\nÝ bài hai thứ hai.' };
  await mock(page, [OK, TWO, RITE_MO, RITE_KET]); await media(page, { cues: riteCues });
  await open(page, 'sermon=khong-co');
  await slow(panel(page).locator('[data-sut]')).toHaveCount(2);
  for (const t of ['Chọn một bài. Khi giảng', 'Đọc thành tiếng bằng giọng máy']) await expect(panel(page)).not.toContainText(t);   // #79: bỏ cho gọn
  const before = await page.evaluate(() => window.__app.state().sermons || 0);
  await panel(page).locator('[data-act="sermon-all"]').click();
  expect(await ph(page)).toBe('homage');   // bài đầu: đảnh lễ bằng chữ rồi lời mở đầu
  await until(page, 'mo-dau');
  await expect(panel(page).locator('.sq')).toHaveText('Nghe lần lượt · bài 1/2');
  await next(page); await next(page);   // hết lời mở đầu
  await until(page, 'line'); let a = await live(page); expect(a.sub).toContain('Ý thử thứ nhất.');
  await next(page); await next(page);   // hết bài 1: không Sādhu, báo bài tiếp
  expect(await page.evaluate(() => window.__app.sermon.phase)).toBe('tiep');
  a = await live(page); expect(a.sub).toContain('Bài tiếp theo: Bài thứ hai'); expect(a.sub).not.toContain('Sādhu');
  await next(page);   // sang bài 2 ngay, không có lời mở đầu
  await slow.poll(() => page.evaluate(() => window.__app.sermon.s.id)).toBe('bai-hai');
  expect(await page.evaluate(() => [window.__app.sermon.phase, window.__app.sermon.oa])).toEqual(['gap', null]);
  await expect(panel(page).locator('.sq')).toHaveText('Nghe lần lượt · bài 2/2');
  await until(page, 'line'); a = await live(page); expect(a.sub).toContain('Ý bài hai thứ nhất.');
  await next(page); await next(page);   // hết bài cuối: Sādhu bằng chữ rồi hồi hướng có tiếng
  expect(await ph(page)).toBe('sadhu'); a = await live(page); expect(a.sub).toContain('Sādhu! Sādhu! Sādhu!');
  await until(page, 'ket-thuc'); a = await live(page); expect(a.sub).toContain('Lời hồi hướng thử.');
  await next(page);
  await slow.poll(async () => (await live(page)).on).toBe(false);
  expect(await page.evaluate(() => [window.__app.state().sermons, window.__app.U.queue])).toEqual([before + 2, null]);
  await slow(page.locator('#toast')).toHaveText('Đã nghe trọn cả loạt. Sādhu!');
});

test('thanh phát thời thiền: ẩn ở thẻ Thuyết giảng, hiện ở Thời thiền; thu nhỏ / mở rộng và nhớ lựa chọn (#79)', async ({ page }) => {
  test.setTimeout(240_000);
  await mock(page, [OK]);
  await open(page, 'mode=hall');
  const bar = page.locator('#bar');
  await expect(bar).toBeVisible(); await expect(page.locator('#barmin')).toHaveText('▾');
  const wide = (await bar.boundingBox()).width;
  await page.locator('#barmin').click();
  await expect(page.locator('#barmin')).toHaveText('▴'); await expect(page.locator('#track')).toBeHidden();
  expect((await bar.boundingBox()).width).toBeLessThan(wide / 2);
  expect(await page.evaluate(() => window.__app.state().barmin)).toBe(true);
  await page.locator('#barmin').click(); await expect(page.locator('#track')).toBeVisible();
  await panel(page).locator('[data-opt="htab"] button[data-v="sermon"]').click();
  await expect(bar).toBeHidden();
  await panel(page).locator('[data-opt="htab"] button[data-v="sit"]').click();
  await expect(bar).toBeVisible();
});

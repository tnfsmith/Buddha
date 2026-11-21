// «Tự ghi nhận» và «Tích lũy tu học» của hành trình Sơ nhập (#85/#88, docs/noi-dung/nhiem-vu-so-nhap.md).
// API và /media giả lập; không gọi máy chủ thật.
import { test, expect } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
const slow = expect.configure({ timeout: 60_000 });
const KEY = 'bai-giang/duong-xua/co-tieng/v1-aaaa1111/vi-cedar.mp3';
const BAI = { id: 'co-tieng', version: 1, kind: 'bai_giang', tier: 0, title: 'Bài có giọng đọc', source_ref: 'Nguồn thử', body_inline: 'Ý một có tiếng.\nÝ hai có tiếng.', body_r2_key: KEY, meta: { loat: 'duong-xua', phan: 1, thu_tu: 10 } };
const KET = { id: 'nghi-thuc-ket-thuc', version: 1, kind: 'bai_giang', tier: 0, title: 'Lời kết và hồi hướng', source_ref: 'Lời hồi hướng biên soạn', body_inline: 'Lời hồi hướng thử.', body_r2_key: 'bai-giang/nghi-thuc/nghi-thuc-ket-thuc/v1-cccc3333/vi-puck.mp3', meta: { loat: 'nghi-thuc', vai: 'ket-thuc' } };
const DUR = 6;   // giây: tệp ngắn để nghe trọn thật trong kiểm thử

/** WAV câm DUR giây, hỗ trợ Range để trình duyệt tua và ghi khoảng đã phát */
function wav() {
  const rate = 8000, n = rate * DUR, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  return b;
}
const WAV = wav();
const cues = (n) => ({ v: 1, provider: 'google', dur: DUR, cues: Array.from({ length: n }, (_, i) => ({ i, t: (i * DUR) / n, e: ((i + 1) * DUR) / n - 0.2 })) });
async function mock(page) {
  await page.route('**/api/v1/content**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [BAI, KET] }) }));
  await page.route('**/media/**', (r) => {
    const u = r.request().url();
    if (u.endsWith('.cues.json')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cues(u.includes('nghi-thuc') ? 1 : 2)) });
    const m = /bytes=(\d*)-(\d*)/.exec(r.request().headers().range || '');
    if (!m) return r.fulfill({ status: 200, headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes' }, body: WAV });
    const a = +m[1] || 0, e = m[2] ? Math.min(+m[2], WAV.length - 1) : WAV.length - 1;
    return r.fulfill({ status: 206, headers: { 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'content-range': `bytes ${a}-${e}/${WAV.length}` }, body: WAV.subarray(a, e + 1) });
  });
}
async function open(page, extra = '') {
  await page.goto(BASE + '#q=0&snap=1' + extra);
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** Cho phiên giảng chạy theo thời gian thật (tiếng phát thật) tới khi xong */
const runToEnd = (page, ms = 90_000) => page.waitForFunction(() => { const s = window.__app.sermon; if (!s.on) return true; s.tick(0.05); return false; }, null, { timeout: ms, polling: 50 });

test('sổ tự ghi nhận: nghe trọn ghi nhận, nghe lướt (tua qua) không ghi; thời thiền viên mãn ghi 15 phút; Bia Tích Lũy hiển thị', async ({ page }) => {
  test.setTimeout(300_000);
  await mock(page);
  await open(page, '&mode=hall');
  await page.click('[data-opt="htab"] button[data-v="sermon"]');
  await slow.poll(() => page.evaluate(() => window.__app.library.state)).toBe('ok');
  // nghe lướt: bấm › qua hết bài → không ghi nhận nghe
  await page.locator('#panel [data-act="sermon-go"]').click();
  await slow.poll(() => page.evaluate(() => { const s = window.__app.sermon; s.tick(0.05); return s.phase; }), { intervals: [50] }).toBe('audio');
  await page.evaluate(() => { const s = window.__app.sermon; s.step(1); s.step(1); });
  await runToEnd(page);
  expect(await page.evaluate(() => window.__app.sermon.report.ratio)).toBeLessThan(0.7);
  expect(await page.evaluate((t) => Object.keys(window.__app.state().tu[t] || {}), today())).not.toContain('nghe_duong_xua');
  // nghe trọn bằng tiếng thật
  await page.locator('#panel [data-act="sermon-go"]').click();
  await slow.poll(() => page.evaluate(() => { const s = window.__app.sermon; s.tick(0.05); return s.phase; }), { intervals: [50] }).toBe('audio');
  await runToEnd(page);
  const day = await page.evaluate((t) => window.__app.state().tu[t], today());
  expect(day.nghe_duong_xua.refs).toEqual(['co-tieng']); expect(day.hoi_huong.n).toBeGreaterThanOrEqual(1);
  await slow(page.locator('#panel [data-sut="co-tieng"] .heard')).toHaveText('❀ đã nghe');
  // thời thiền viên mãn
  await page.evaluate(() => { const P = window.__app.player; P.lastSat = 900; P.onend(); });   // thời trọn 15 phút (#107: onend ghi số phút đã phát)
  expect(await page.evaluate((t) => window.__app.state().tu[t].thoi_thien, today())).toMatchObject({ n: 1, min: 15 });
  // Bia Tích Lũy (mở lại trang, dữ liệu còn trên máy): bằng chứng ở trục Tuệ (không tự hoàn thành), tự ghi nhận hôm nay, hoa sen, lịch, sổ nghe
  await page.goto('about:blank'); await open(page);
  await page.locator('#panel [data-act="board"]').first().click();
  const P = page.locator('#panel');
  await slow(P).toContainText('Tự ghi nhận hôm nay');
  for (const t of ['Thời thiền 15 phút', 'Nghe Đường Xưa', 'Hồi hướng', 'Tích lũy tu học', 'đã nghe trọn: Lời Phật dạy 0, Đường Xưa 1/1', 'nhịp thiền 7 ngày: 15 phút']) await expect(P).toContainText(t);
  await expect(P.locator('.task[data-p="tue"] .ev')).toContainText('Đã tự ghi nhận hôm nay');
  expect(await page.evaluate(() => { const S = window.__app.state(); return S.done[S.day] && S.done[S.day].tue; })).toBeFalsy();   // quyết định 3: không tự hoàn thành trục Tuệ
  await expect(P.locator('svg.lotus ellipse')).toHaveCount(10);
  await expect(P.locator('.cal i')).toHaveCount(49);
  await expect(P.locator('.cal i.on')).toHaveCount(1);
});

import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Issue #28: Vân Nhạc. Thanh nhạc thu gọn / mở rộng, thể loại, thời lượng 5–60 phút, lặp lại / lần lượt / ngẫu nhiên / phát 1 lần.
const BASE = process.env.E2E_BASE_URL || pathToFileURL(resolve('apps/web/dist/van-dao.html')).href;
const url = (hash) => `${BASE.replace(/#.*$/, '')}#${hash}`;
// Chờ dựng xong cảnh rồi cho ngừng vẽ (như tab ẩn): ca này chỉ kiểm âm thanh và giao diện 2D
const ready = async (page) => { await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 }); await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })); };
const slow = expect.configure({ timeout: 30_000 });
const amb = (page) => page.evaluate(() => { const a = window.__app.amb, M = window.__app.state().music; return { on: a.on, cur: a.cur, min: +a.minutes.toFixed(2), left: a.left === null ? null : Math.round(a.left), order: M.order, len: M.len, saved: M.on }; });
/** Tua thời gian đã phát của khúc hiện tại; nhịp kiểm 5 giây của ứng dụng sẽ thấy khúc đã hết */
const elapse = (page, minutes) => page.evaluate((m) => { window.__app.amb.since -= m * 60000; }, minutes);

test('mọi khúc Vân Nhạc: không tiếng tạch, không vỡ tiếng, âm lượng đồng đều, tắt về 0', async ({ page }) => {
  test.setTimeout(420_000);
  await page.goto(url('q=0&snap=1')); await ready(page);
  const ids = await page.evaluate(() => window.__app.SONGS.map((s) => s.id));
  expect(ids).toHaveLength(13);
  for (const id of ids) {
    const r = await page.evaluate((id) => window.__app.probeSong(id, 60), id);
    expect(r.clicks, id + ' tiếng tạch').toBe(0);
    expect(r.peak, id + ' đỉnh').toBeLessThan(0.62);
    expect(r.rms, id + ' RMS').toBeGreaterThan(0.06); expect(r.rms, id + ' RMS').toBeLessThan(0.105);
    expect(r.tail, id + ' đuôi').toBeLessThan(0.02);
  }
});

test('hiệu ứng âm của cảnh (chuông gió, Tùy Hỷ, gió mây, mây hạ xuống, bước lên mây): không tiếng tạch, không vỡ tiếng, tắt về 0', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto(url('q=0&snap=1')); await ready(page);
  for (const kind of ['chime', 'gift', 'cloud']) {
    const r = await page.evaluate((k) => window.__app.probeSfx(k, 7), kind);
    expect(r.clicks, kind + ' tiếng tạch').toBe(0);
    expect(r.peak, kind + ' đỉnh').toBeLessThan(0.5);
    expect(r.rms, kind + ' RMS').toBeGreaterThan(0.002);
    expect(r.tail, kind + ' đuôi').toBeLessThan(0.003);
  }
});

test('thanh nhạc: mở rộng, thu gọn; thời lượng 30 phút; phát 1 lần thì dừng, lặp lại thì phát lại, ngẫu nhiên trong thể loại', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto(url('q=0&snap=1')); await ready(page);
  const dock = page.locator('#mdock');
  await expect(dock).toBeHidden();
  await page.locator('#mus').click();
  await slow(dock).toBeVisible(); await expect(dock).toHaveClass(/open/);
  // bảng bên phải không bị chiếm: vẫn là Vân Đảo
  await expect(page.locator('#panel h2')).toContainText('Vân Đảo của');

  await dock.locator('[data-opt="mgenre"] [data-v="bell"]').click();
  await expect(dock.locator('.songs .chip')).toHaveText(['Đêm Tịnh', 'Chuông Bát', 'Trầm An', 'Chuông Mõ']);
  await dock.locator('[data-song="chuong-bat"]').click();
  await slow.poll(() => amb(page)).toMatchObject({ on: true, cur: 'chuong-bat', left: null, saved: true });
  await dock.locator('[data-opt="mlen"] [data-v="30"]').click();
  await slow.poll(() => amb(page)).toMatchObject({ on: true, cur: 'chuong-bat', left: 30, len: 30 });
  await slow(dock.locator('.np')).toContainText('còn 30 phút');

  // Phát 1 lần: hết 30 phút thì ba tiếng chuông rồi dừng hẳn
  await dock.locator('[data-opt="morder"] [data-v="once"]').click();
  await elapse(page, 30.5);
  await slow.poll(() => amb(page)).toMatchObject({ on: false, saved: false });
  await slow(page.locator('#toast')).toHaveText('Khúc nhạc đã trọn.');

  // Lặp lại: hết khúc thì chính khúc đó phát lại từ đầu
  await dock.locator('[data-opt="morder"] [data-v="loop"]').click();
  await dock.locator('[data-act="mus-toggle"]').click();
  await slow.poll(() => amb(page)).toMatchObject({ on: true, cur: 'chuong-bat' });
  await elapse(page, 30.5);
  await slow.poll(async () => { const a = await amb(page); return a.on && a.cur === 'chuong-bat' && a.min < 1; }).toBe(true);

  // Ngẫu nhiên: sang một khúc khác trong cùng thể loại
  await dock.locator('[data-opt="morder"] [data-v="shuf"]').click();
  await elapse(page, 30.5);
  await slow.poll(async () => { const a = await amb(page); return a.on && a.cur !== 'chuong-bat' && ['dem-tinh', 'tram-an', 'chuong-mo'].includes(a.cur); }).toBe(true);

  // Thu gọn: còn một dải nhỏ có tên khúc và nút dừng; dừng nhạc thì dải cũng ẩn
  await dock.locator('[data-act="mus-min"]').click();
  await expect(dock).not.toHaveClass(/open/); await expect(dock.locator('.mt')).toContainText('còn');
  await dock.locator('[data-act="mus-toggle"]').click();
  await slow(dock).toBeHidden(); expect((await amb(page)).on).toBe(false);
});

test('Tịnh Thất mở được nhạc thiền; cài đặt nhạc bản cũ được chuyển đúng', async ({ page, context }) => {
  test.setTimeout(240_000);
  await context.addInitScript(() => { if (!localStorage.getItem('vandao.v1')) localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day: 1, music: { on: false, source: 'pick', song: 'tu-tam', mood: 'an', order: 'seq', span: 10, vol: 0.5 } })); });
  await page.goto(url('q=0&snap=1&zone=kuti')); await ready(page);
  expect(await page.evaluate(() => window.__app.state().music)).toMatchObject({ order: 'seq', len: 15, genre: 'all', song: 'tu-tam', vol: 0.5 });
  await page.locator('#panel [data-act="mus-toggle"]').click();
  await slow.poll(() => amb(page)).toMatchObject({ on: true, cur: 'tu-tam', left: 15 });
  await slow(page.locator('#panel')).toContainText('Đang phát: Từ Tâm');
  await page.locator('#panel [data-act="mus-open"]').click();
  await slow(page.locator('#mdock')).toHaveClass(/open/);
  await page.locator('#panel [data-act="mus-toggle"]').click();
  await slow.poll(() => amb(page)).toMatchObject({ on: false });
});

import { test, expect } from '@playwright/test';

// #63: kiểm bài giảng có giọng đọc THẬT trên bản đã deploy (staging/production) trước khi gắn tag.
// Chỉ chạy khi đặt E2E_BASE_URL và E2E_LIVE_SERMON=1; CI thường bỏ qua. Chỉ đọc, không ghi dữ liệu gì.
//   E2E_LIVE_MIN=7     số mục tối thiểu API phải trả (mặc định 7, bảy bài «Lời Phật dạy»; tính cả 2 mục nghi thức)
//   E2E_LIVE_AUDIO=all mọi bài đều phải có giọng đọc
//   E2E_LIVE_LOAT=loi-phat-day=7,duong-xua=21,nghi-thuc=2   số mục đúng theo loạt (meta.loat), tùy chọn
// Ví dụ: E2E_BASE_URL=https://vandao-staging.vandao-staging.workers.dev/ E2E_LIVE_SERMON=1 E2E_LIVE_AUDIO=all \
//        npx playwright test tests/e2e/live-sermon.spec.js
const BASE = (process.env.E2E_BASE_URL || '').replace(/#.*$/, '').replace(/\/?$/, '/');
const LIVE = !!process.env.E2E_BASE_URL && process.env.E2E_LIVE_SERMON === '1';
const MIN = Number(process.env.E2E_LIVE_MIN || 7);
test.skip(!LIVE, 'chỉ chạy khi đặt E2E_BASE_URL và E2E_LIVE_SERMON=1');

/** Bài đang phát hành, mỗi id lấy phiên bản mới nhất (máy chủ xếp version giảm dần) */
async function published(request) {
  const r = await request.get(BASE + 'api/v1/content?kind=bai_giang');
  expect(r.status()).toBe(200);
  const seen = new Set();
  return ((await r.json()).items || []).filter((x) => !seen.has(x.id) && seen.add(x.id));
}
const ideas = (x) => x.body_inline.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('>')).length;
const metaOf = (x) => { let m = x.meta; if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = null; } } return m && typeof m === 'object' ? m : {}; };
/** Mục nghi thức (lời mở đầu / hồi hướng, #79/#80): không phải bài, không hiện trong danh sách */
const isRite = (x) => !!metaOf(x).vai || /^nghi-thuc-/.test(x.id);

test('API trả đủ bài; mỗi giọng đọc phát được qua /media (Range) và cues khớp số ý', async ({ request }) => {
  const items = await published(request);
  expect(items.length).toBeGreaterThanOrEqual(MIN);
  if (process.env.E2E_LIVE_LOAT) {
    const want = Object.fromEntries(process.env.E2E_LIVE_LOAT.split(',').map((kv) => kv.split('=')).map(([k, v]) => [k.trim(), Number(v)]));
    const got = {}; for (const x of items) { const k = metaOf(x).loat || 'loi-phat-day'; got[k] = (got[k] || 0) + 1; }
    expect(got).toEqual(want);
  }
  if (process.env.E2E_LIVE_AUDIO === 'all') expect(items.filter((x) => !x.body_r2_key).map((x) => x.id)).toEqual([]);
  const voiced = items.filter((x) => x.body_r2_key);
  expect(voiced.length).toBeGreaterThan(0);
  for (const x of voiced) {
    const url = BASE + 'media/' + x.body_r2_key;
    const h = await request.head(url);
    expect(h.status(), x.id).toBe(200);
    expect(h.headers()['content-type'], x.id).toContain('audio/mpeg');
    expect(h.headers()['accept-ranges'], x.id).toBe('bytes');
    const part = await request.get(url, { headers: { Range: 'bytes=0-1023' } });
    expect(part.status(), x.id).toBe(206);
    expect(part.headers()['content-range'], x.id).toMatch(/^bytes 0-1023\/\d+$/);
    const c = await request.get(url.replace(/\.mp3$/, '.cues.json'));
    expect(c.status(), x.id).toBe(200);
    const j = await c.json();
    expect(j.cues.length, `${x.id}: số cues phải bằng số ý`).toBe(ideas(x));
    j.cues.forEach((q, i) => { expect(q.i, x.id).toBe(i); expect(q.e, x.id).toBeGreaterThan(q.t); if (i) expect(q.t, x.id).toBeGreaterThanOrEqual(j.cues[i - 1].e); });
    expect(j.dur, x.id).toBeGreaterThanOrEqual(j.cues[j.cues.length - 1].e);
  }
  // mẫu giọng và khóa không thuộc bài nào đang phát hành: không phục vụ
  expect((await request.get(BASE + 'media/bai-giang/_mau-giong/khong-co.mp3')).status()).toBe(404);
  expect((await request.get(BASE + 'media/bai-giang/loi-phat-day/khong-co/v1-00000000/vi-x.mp3')).status()).toBe(404);
});

test('trong app: bài có giọng đọc phát tiếng, chữ chạy theo cues, đúng nhà cung cấp giọng và không còn nhãn AI dưới chữ (#79/#83)', async ({ page, request }) => {
  test.setTimeout(240_000);
  const x = (await published(request)).find((y) => y.body_r2_key && !isRite(y));
  test.skip(!x, 'chưa có bài nào có giọng đọc');
  await page.goto(BASE + '#q=0&snap=1&sermon=' + x.id);
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await expect.poll(() => page.evaluate(() => window.__app.sermon.on), { timeout: 30_000 }).toBe(true);
  await page.evaluate(() => { for (let i = 0; i < 140; i++) window.__app.sermon.tick(0.05); });   // qua phần đảnh lễ
  await expect.poll(() => page.evaluate(() => { window.__app.sermon.tick(0.05); return window.__app.sermon.phase; }), { timeout: 60_000, intervals: [100] }).toBe('audio');
  await expect.poll(() => page.evaluate(() => window.__app.sermon.au?.el.currentTime || 0), { timeout: 30_000 }).toBeGreaterThan(0.5);
  const sub = await page.locator('#sub').textContent();
  expect(sub).not.toContain('Giọng đọc do AI tạo');   // #79: chủ dự án bỏ nhãn dưới chữ
  expect(sub).toContain('ý 1/');
  const cueResponse = await request.get(BASE + 'media/' + x.body_r2_key.replace(/\.mp3$/, '.cues.json'));
  expect(cueResponse.status()).toBe(200);
  const { provider } = await cueResponse.json();
  expect(['google', 'openai']).toContain(provider);
  expect(await page.evaluate(() => window.__app.sermon.au?.provider)).toBe(provider);
  await page.evaluate(() => window.__app.sermon.stop());
});

test('trong app: đảnh lễ Namo bằng chữ rồi lời mở đầu có tiếng; Sādhu và ba lần lạy (toàn cảnh) rồi hồi hướng có tiếng (cận cảnh) (#80)', async ({ page, request }) => {
  test.setTimeout(300_000);
  const items = await published(request), rite = (v) => items.find((y) => metaOf(y).vai === v && metaOf(y).loat === 'nghi-thuc');
  const mo = rite('mo-dau'), ket = rite('ket-thuc'), x = items.find((y) => y.body_r2_key && !isRite(y) && (metaOf(y).loat || 'loi-phat-day') === 'loi-phat-day');
  test.skip(!mo || !ket || !x, 'chưa phát hành lời mở đầu / hồi hướng');
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(BASE + '#q=0&snap=1&sermon=' + x.id);
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await expect.poll(() => page.evaluate(() => window.__app.sermon.on), { timeout: 30_000 }).toBe(true);
  const S = (f) => page.evaluate(f);
  expect(await S(() => [window.__app.sermon.phase, window.__app.sermon.cam])).toEqual(['homage', 'wide']);
  expect(await page.locator('#sub').textContent()).toContain('Namo tassa');
  // lời mở đầu: chỉ phát sau đảnh lễ bằng chữ
  await expect.poll(() => S(() => { const s = window.__app.sermon; s.tick(0.05); return s.phase; }), { timeout: 60_000, intervals: [50] }).toBe('mo-dau');
  expect(await S(() => window.__app.sermon.oa.el.src)).toContain(mo.body_r2_key);
  await expect.poll(() => S(() => window.__app.sermon.oa?.el.currentTime || 0), { timeout: 30_000 }).toBeGreaterThan(0.5);
  expect(await S(() => window.__app.sermon.cam)).toBe('close');
  expect(await page.locator('#sub').textContent()).toContain(mo.body_inline.split('\n')[0].replace(/\[\[([^|\]]*)\|[^\]]*\]\]/g, '$1').slice(0, 20));
  // bỏ qua phần còn lại của lời mở đầu và của bài
  await S(() => { const s = window.__app.sermon; for (let i = 0; i < 12; i++) s.step(1); });
  await expect.poll(() => S(() => { const s = window.__app.sermon; s.tick(0.05); if (s.phase === 'audio' || s.phase === 'line') s.step(1); return s.phase; }), { timeout: 90_000, intervals: [50] }).toBe('sadhu');
  expect(await page.locator('#sub').textContent()).toContain('Sādhu! Sādhu! Sādhu!');
  expect(await S(() => { const s = window.__app.sermon; for (let i = 0; i < 30; i++) s.tick(0.05); return [s.cam, s.st.bow > 0.5]; })).toEqual(['wide', true]);
  // hồi hướng có tiếng sau ba lần lạy
  await expect.poll(() => S(() => { const s = window.__app.sermon; s.tick(0.05); return s.phase; }), { timeout: 60_000, intervals: [50] }).toBe('ket-thuc');
  expect(await S(() => window.__app.sermon.ca.el.src)).toContain(ket.body_r2_key);
  await expect.poll(() => S(() => window.__app.sermon.ca?.el.currentTime || 0), { timeout: 30_000 }).toBeGreaterThan(0.5);
  expect(await S(() => { const s = window.__app.sermon; s.tick(0.05); return [s.cam, s.st.merit]; })).toEqual(['close', 1]);
  await expect.poll(() => S(() => { const s = window.__app.sermon; s.tick(0.05); return s.on; }), { timeout: 60_000, intervals: [100] }).toBe(false);
  expect(errs).toEqual([]);
});

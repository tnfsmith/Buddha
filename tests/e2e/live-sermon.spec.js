import { test, expect } from '@playwright/test';

// #63: kiểm bài giảng có giọng đọc THẬT trên bản đã deploy (staging/production) trước khi gắn tag.
// Chỉ chạy khi đặt E2E_BASE_URL và E2E_LIVE_SERMON=1; CI thường bỏ qua. Chỉ đọc, không ghi dữ liệu gì.
//   E2E_LIVE_MIN=7     số bài tối thiểu API phải trả (mặc định 7, bảy bài «Lời Phật dạy»)
//   E2E_LIVE_AUDIO=all mọi bài đều phải có giọng đọc
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

test('API trả đủ bài; mỗi giọng đọc phát được qua /media (Range) và cues khớp số ý', async ({ request }) => {
  const items = await published(request);
  expect(items.length).toBeGreaterThanOrEqual(MIN);
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

test('trong app: bài có giọng đọc phát tiếng, chữ chạy theo cues, có nhãn giọng AI', async ({ page, request }) => {
  test.setTimeout(240_000);
  const x = (await published(request)).find((y) => y.body_r2_key);
  test.skip(!x, 'chưa có bài nào có giọng đọc');
  await page.goto(BASE + '#q=0&snap=1&sermon=' + x.id);
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await expect.poll(() => page.evaluate(() => window.__app.sermon.on), { timeout: 30_000 }).toBe(true);
  await page.evaluate(() => { for (let i = 0; i < 140; i++) window.__app.sermon.tick(0.05); });   // qua phần đảnh lễ
  await expect.poll(() => page.evaluate(() => { window.__app.sermon.tick(0.05); return window.__app.sermon.phase; }), { timeout: 60_000, intervals: [100] }).toBe('audio');
  await expect.poll(() => page.evaluate(() => window.__app.sermon.au?.el.currentTime || 0), { timeout: 30_000 }).toBeGreaterThan(0.5);
  const sub = await page.locator('#sub').textContent();
  expect(sub).toContain('Giọng đọc do AI tạo');
  expect(sub).toContain('ý 1/');
  await page.evaluate(() => window.__app.sermon.stop());
});

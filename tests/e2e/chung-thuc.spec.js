// #104: Chứng thực cuối tuần — hợp đồng docs/contracts/practice-gd3.md «Chứng thực cuối tuần» (API #146). Máy chủ giả; không gọi máy chủ thật.
// Mã mời chỉ nằm trong fragment: script đầu trang lấy mã rồi xóa khỏi URL, mã đi qua Authorization, không vào URL request hay localStorage.
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
const booted = async (p) => {
  await p.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await p.evaluate(() => { window.__app.world.update = () => {}; });
};
closeContextsAfterEach();
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'chỉ chạy với bản dựng cục bộ');
const slow = expect.configure({ timeout: 60_000 });
const CODE = 'Zx9_k-Ab3dEf5gHi7jKl9mNo1pQr3sTu5vWx7yZa9bC';   // 43 ký tự base64url như máy chủ tạo
const LOOK = { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' };
const seed = (day) => ({ v: 1, day, lastDate: null, done: {}, tu: {}, viec: {}, nguyen: {}, seed: 42, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: 'Tuệ Thái', look: LOOK });
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function owner(browser, day, sent) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await ctx.route('**/api/**', (r) => {
    if (r.request().url().endsWith('/api/v1/attest/invite')) { sent.push(JSON.parse(r.request().postData())); return r.fulfill({ status: sent.length > 1 ? 200 : 201, contentType: 'application/json', body: JSON.stringify({ week: day / 7, expires_at: Date.now() + 7 * 86_400_000, link: '/#attest=' + CODE }) }); }
    return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'not_found' } }) });
  });
  await ctx.addInitScript((s) => { if (!localStorage.getItem('vandao.seeded')) { localStorage.setItem('vandao.seeded', '1'); localStorage.setItem('vandao.v1', JSON.stringify(s)); } }, seed(day));
  const page = await ctx.newPage();
  return { ctx, page };
}
const signIn = (page) => page.evaluate(() => Object.assign(window.__app.acct, { on: true, uid: 'me', cycle: 3 }));
const openBia = async (page) => { await page.locator('#panel [data-act="board"]').first().click(); };

test('chủ: ngày 14 tạo liên kết chứng thực tuần 2, mở lại bằng cùng op_id; trên máy không giữ mã; ngày 13 không có thẻ', async ({ browser }) => {
  test.setTimeout(300_000);
  const sent = [], { page } = await owner(browser, 14, sent), P = page.locator('#panel');
  await page.goto(BASE + '#q=0&snap=1'); await booted(page); await signIn(page); await openBia(page);
  await slow(P).toContainText('Chứng thực tuần 2');
  await P.locator('[data-act="at-invite"]').click();
  await slow(P.locator('input.at-url')).toHaveValue(BASE.replace(/\/$/, '') + '/#attest=' + CODE);
  expect(sent).toHaveLength(1);
  expect(sent[0].week).toBe(2);
  expect(sent[0].op_id).toMatch(UUID4);
  expect(Object.keys(sent[0]).sort()).toEqual(['op_id', 'week']);
  const kept = await page.evaluate(() => localStorage.getItem('vandao.attest.v1'));
  expect(kept).not.toContain(CODE);   // chỉ op_id và băm của mã
  expect(kept).toContain(sent[0].op_id);

  await page.reload(); await booted(page); await signIn(page); await openBia(page);
  await slow(P.locator('[data-act="at-invite"]')).toHaveText('Mở lại liên kết');
  await P.locator('[data-act="at-invite"]').click();
  await slow(P.locator('input.at-url')).toBeVisible();
  expect(sent).toHaveLength(2);
  expect(sent[1].op_id).toBe(sent[0].op_id);   // cùng lời mời đang hiệu lực, không tạo lời mới

  // chủ mở nhầm liên kết của chính mình: nhận ra bằng băm, không gọi máy chủ
  const linkCalls = []; page.on('request', (r) => { if (r.url().includes('/attest/link')) linkCalls.push(r.url()); });
  await page.goto(BASE + '#attest=' + CODE + '&q=0&snap=1'); await page.reload(); await booted(page);
  await slow(P).toContainText('liên kết chứng thực bạn đã tạo');
  expect(linkCalls).toEqual([]);

  const day13 = await owner(browser, 13, []);
  await day13.page.goto(BASE + '#q=0&snap=1'); await booted(day13.page); await signIn(day13.page); await openBia(day13.page);
  await slow(day13.page.locator('#panel')).toContainText('Bia Tích Lũy');
  await expect(day13.page.locator('#panel')).not.toContainText('Chứng thực tuần');
});

test('người nhận: mã lấy khỏi URL trước khi tải, đi qua Authorization; chọn mình là ai, câu mẫu, xác nhận một lần', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  const urls = [], posts = [], auth = [];
  await ctx.route('**/api/**', (r) => {
    const q = r.request();
    if (q.url().endsWith('/api/v1/attest/link')) {
      auth.push(q.headers().authorization);
      if (q.method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ week: 3, expires_at: Date.now() + 5 * 86_400_000 }) });
      posts.push(JSON.parse(q.postData())); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'da_xac_nhan' }) });
    }
    return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'not_found' } }) });
  });
  const page = await ctx.newPage(), P = page.locator('#panel');
  page.on('request', (r) => urls.push(r.url()));
  await page.goto(BASE + '#attest=' + CODE + '&q=0&snap=1'); await booted(page);
  const loc = await page.evaluate(() => ({ hash: location.hash, left: window.__vdAttest }));
  expect(loc.hash).not.toContain('attest');
  expect(loc.hash).toContain('snap=1');   // các tham số khác giữ nguyên
  expect(loc.left).toBeNull();
  await slow(P.locator('h2')).toHaveText('Chứng thực tuần 3');
  await P.locator('[data-act="at-label"][data-v="nguoi_than"]').click();
  await P.locator('[data-act="at-line"][data-i="0"]').click();
  await expect(P.locator('[data-act="at-line"][data-i="0"]')).toHaveClass(/on/);
  await P.locator('[data-act="at-yes"]').click();
  await slow(P.locator('h2')).toHaveText('Cảm ơn bạn');
  expect(posts).toEqual([{ accept: true, attester_label: 'nguoi_than', note: 'Tôi thấy bạn giữ lời và nói năng nhẹ nhàng hơn trong tuần qua.' }]);
  expect(auth.every((a) => a === 'Bearer ' + CODE)).toBe(true);
  expect(urls.filter((u) => u.includes('/api/') && u.includes(CODE))).toEqual([]);   // mã chỉ đi trong Authorization
  expect(page.url()).not.toContain(CODE);
});

test('người nhận: liên kết hết hạn hoặc đã dùng thì báo không còn hiệu lực; tự gõ vài dòng và không xác nhận', async ({ browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  let gone = true; const posts = [];
  await ctx.route('**/api/**', (r) => {
    const q = r.request();
    if (q.url().endsWith('/api/v1/attest/link')) {
      if (gone) return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'attest_not_found', message: 'x' } }) });
      if (q.method() === 'GET') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ week: 1, expires_at: Date.now() + 86_400_000 }) });
      posts.push(JSON.parse(q.postData())); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'tu_choi' }) });
    }
    return r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'not_found' } }) });
  });
  const page = await ctx.newPage(), P = page.locator('#panel');
  await page.goto(BASE + '#attest=' + CODE + '&q=0&snap=1'); await booted(page);
  await slow(P).toContainText('không còn hiệu lực');

  gone = false;
  await page.goto(BASE + '#attest=' + CODE + '&q=0&snap=1'); await page.reload(); await booted(page);
  await slow(P.locator('h2')).toHaveText('Chứng thực tuần 1');
  await P.locator('#at-note').fill('Mình chưa gặp bạn tuần này.');
  await P.locator('[data-act="at-label"][data-v="ban_be"]').click();
  await expect(P.locator('#at-note')).toHaveValue('Mình chưa gặp bạn tuần này.');   // chọn nhãn không làm mất chữ đang gõ
  await P.locator('[data-act="at-no"]').click();
  await slow(P.locator('h2')).toHaveText('Cảm ơn bạn');
  expect(posts).toEqual([{ accept: false, attester_label: 'ban_be' }]);   // không xác nhận thì không gửi lời nhắn
});

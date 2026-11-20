// #107: cổng mở Tầng 1 theo hợp đồng docs/contracts/tier-unlock.md (#169), với máy chủ giả theo đúng wire §3.
// Ba điều kiện do máy chủ xét; máy khách hiện điều kiện còn thiếu, gửi cờ tự vấn, mở cổng, giữ ảnh chụp khi mất mạng.
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
const slow = expect.configure({ timeout: 60_000 });
const LOOK = { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' };
const UID = 'u-tue-thai-0001';
closeContextsAfterEach();
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');

/** Máy chủ giả: tài khoản, đồng bộ và ba đường dẫn tier-progress. sv.full / sv.done49 / sv.reflected điều khiển điều kiện. */
function fake(day) {
  const sv = { day, full: 29, done49: day >= 49, reflected: false, opened: null, cycle: 1, calls: [], offline: false };
  const snap = () => {
    const ok = sv.done49 && sv.full >= 30 && sv.reflected;
    return { tier: 1, cycle: sv.cycle, status: sv.opened ? 'da_mo' : ok ? 'du_dieu_kien' : 'dang_tu',
      criteria: { journey_completed: sv.done49, full_sessions: sv.full, min_full_sessions: 30, week_7_reflected: sv.reflected }, opened_at: sv.opened };
  };
  sv.handle = async (route) => {
    const req = route.request(), p = new URL(req.url()).pathname, m = req.method();
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const err = (code, status) => json({ error: { code, message: code } }, status);
    if (sv.offline && p.startsWith('/api/')) return route.abort('internetdisconnected');
    const body = () => { try { return req.postDataJSON() || {}; } catch { return {}; } };
    const journey = { program: 'so-nhap-49', cycle: sv.cycle, day: sv.day, started_on: '2026-10-01', last_done_on: null, completed_at: sv.done49 ? 1 : null, sacca_count: 0, sessions_done: 0, sermons_done: 0, rev: 1 };
    const prof = { id: UID, tinh_danh: 'Tuệ Thái', tag: '5696', look: LOOK, settings: {}, island: {}, tz: 'Asia/Ho_Chi_Minh', visibility: 'dong_tu', rev: 3 };
    if (p === '/api/auth/get-session') return json({ user: { id: UID, isAnonymous: false }, session: {} });
    if (p === '/api/auth/recovery-code/status') return json({ has_code: true, created_at: Date.now() });
    if (p === '/api/auth/list-sessions') return json([{}]);
    if (p === '/api/v1/me') return json({ user: { id: UID, isAnonymous: false }, practice: 1, profile: prof, journey, totals: { duc: 0, thien: 0, tue: 0, all: 0 }, unlocked_zones: {}, server_now: Date.now() });
    if (p === '/api/v1/sync') return json({ applied: (body().ops || []).map((o) => o.id), rejected: [], state: { profile: prof, journey, totals: { duc: 0, thien: 0, tue: 0, all: 0 }, unlocked_zones: {}, server_now: Date.now(), practice: 1 } });
    if (p === '/api/v1/content') return json({ items: [] });
    if (p.startsWith('/api/v1/tier-progress/1')) {
      sv.calls.push(`${m} ${p.slice(23) || '/'}`);
      if (m === 'GET') return json(snap());
      const b = body();
      if (b.cycle !== sv.cycle) return err('cycle_conflict', 409);
      if (p.endsWith('/reflection')) { if (!sv.done49) return err('reflection_too_early', 409); sv.reflected = true; return json(snap()); }
      if (p.endsWith('/open')) { if (snap().status === 'dang_tu') return err('tier_not_ready', 409); sv.opened = sv.opened || Date.now(); return json(snap()); }
    }
    if (p.startsWith('/api/')) return err('not_found', 404);
    return route.fallback();
  };
  return sv;
}

/** S: trạng thái trên máy; account: có giữ hành trình; reflected7: đã lưu tự vấn tuần 7 trên máy */
async function open(browser, sv, { S = {}, account = true, reflected7 = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  await ctx.route('**/api/**', (r) => sv.handle(r));
  await ctx.addInitScript(({ LOOK, S, account, reflected7, UID }) => {
    if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1');
    localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, lastDate: null, done: {}, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: 'Tuệ Thái', look: LOOK, seed: 1, ...S }));
    if (account) localStorage.setItem('vandao.acct', JSON.stringify({ uid: UID, guest: false, cycle: 1 }));
    if (reflected7) localStorage.setItem('vandao.pt.v1', JSON.stringify({ [`${UID}|c1`]: { w: { 7: { t: 'it', s: null, si: null, x: {}, at: '2026-11-19' } }, skip: null } }));
  }, { LOOK, S, account, reflected7, UID });
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
  await page.goto(BASE + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => { window.__app.world.update = () => {}; });
  return page;
}
const P = (page) => page.locator('#panel');
const bia = async (page) => { await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'board'; document.querySelector('#panel').append(b); b.click(); b.remove(); }); await slow(P(page).locator('h2')).toHaveText('Bia Tích Lũy'); };

test('ngày 49, 29/30 thời trọn: hiện điều kiện còn thiếu, chưa có nút mở; đủ 30 và xác nhận tự vấn thì mở cổng, Tầng 1 giữ khi mất mạng', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fake(49);
  const page = await open(browser, sv, { S: { day: 49, completed: true, tier1v: 1 }, reflected7: true });
  await bia(page);
  const tg = P(page).locator('.tg');
  await slow(tg).toContainText('Thời thiền trọn từ 12 phút: 29/30');
  await expect(tg).toContainText('✓ Hoàn tất 49 ngày Sơ nhập');
  await expect(tg).toContainText('○ Tự vấn tuần 7');
  await expect(tg.locator('[data-act="tg-open"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__app.tier())).toBe(0);
  // đã lưu tự vấn tuần 7 trên máy → chỉ gửi một cờ, không gửi câu trả lời
  await tg.locator('[data-act="tg-reflect"]').click();
  await slow(tg).toContainText('✓ Tự vấn tuần 7');
  expect(sv.calls).toContain('POST /reflection');
  sv.full = 30;
  await page.evaluate(() => { const b = document.createElement('button'); b.dataset.act = 'tg-reload'; document.querySelector('#panel').append(b); b.click(); b.remove(); });
  await slow(tg.locator('[data-act="tg-open"]')).toBeVisible();
  await tg.locator('[data-act="tg-open"]').click();
  await slow(page.locator('#toast')).toContainText('Đã hoàn thành chương trình Sơ nhập. Cổng Nhập Lưu Tịnh Cảnh đã mở.');
  expect(await page.evaluate(() => window.__app.tier())).toBe(1);
  await expect(P(page)).not.toContainText('chứng đắc');
  // mất mạng, mở lại trang: ảnh chụp theo tài khoản giữ Tầng 1 đã mở
  sv.offline = true;
  await page.reload();
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  expect(await page.evaluate(() => window.__app.tier())).toBe(1);
  expect(page.errs).toEqual([]);
});

test('chưa giữ hành trình: cổng ghi «Giữ hành trình để mở Tầng 1», không gọi API, Tầng 1 vẫn khóa', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fake(49);
  const page = await open(browser, sv, { S: { day: 49, completed: true, tier1v: 1 }, account: false });
  await bia(page);
  await slow(P(page).locator('.tg')).toContainText('Giữ hành trình để mở Tầng 1');
  await expect(P(page).locator('.tg [data-act="acct-open"]')).toBeVisible();
  expect(await page.evaluate(() => window.__app.tier())).toBe(0);
  expect(sv.calls).toEqual([]);
});

test('máy đã hoàn thành chương trình trước khi có cổng: giữ Tầng 1 đã mở (#169 điểm 3); trước tuần 7 không hiện khối cổng', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fake(49);
  const page = await open(browser, sv, { S: { day: 49, completed: true }, account: false });   // chưa có tier1v: bản cũ
  expect(await page.evaluate(() => window.__app.tier())).toBe(1);
  expect(await page.evaluate(() => window.__app.state().tier1Legacy)).toBe(true);
  await bia(page);
  await slow(P(page).locator('.tg')).toContainText('Đã hoàn thành chương trình Sơ nhập.');

  const sv2 = fake(20);
  const p2 = await open(browser, sv2, { S: { day: 20, tier1v: 1 } });
  await bia(p2);
  await expect(P(p2).locator('.tg')).toHaveCount(0);
  expect(await p2.evaluate(() => window.__app.tier())).toBe(0);
});

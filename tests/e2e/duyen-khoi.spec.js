// #104: Duyên khởi hành trình và gợi ý biến thể theo trục ở Bia Tích Lũy (hợp đồng #111 hồ sơ, #112 biến thể).
// Máy chủ giả lập: /content trả biến thể kind=chuong_trinh; /practice/profile làm đúng GET/PUT + rev + 409 của #111.
import { test, expect } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');
const slow = expect.configure({ timeout: 60_000 });

const V = (p, k, level, minutes, money, at_home) => ({
  id: `sn49-w1-${p}-${k}`, version: 1, kind: 'chuong_trinh', tier: 0, lang: 'vi', title: `Tiêu đề ${p} ${k}`, body_inline: `Việc ${p} ${k}.`,
  body_r2_key: null, source_ref: 'Vân Đạo tự biên soạn; nguồn thử',
  meta: JSON.stringify({ program: 'so-nhap-49', schema: 1, week: 1, pillar: p, level, minutes, money, at_home, outdoors: !at_home, needs_others: false, punna: 'sila', parami: ['sila'], scope: 'doi_thuc' }),
});
// Mỗi trục tuần 1: a, b hợp với hồ sơ «10 phút, nhẹ, miễn phí, tại nhà»; c, d thì không
const VARIANTS = ['duc', 'thien', 'tue'].flatMap((p) => [V(p, 'a', 'nhe', 3, false, true), V(p, 'b', 'nhe', 5, false, true), V(p, 'c', 'vua', 15, 'optional', false), V(p, 'd', 'sau', 30, false, false)]);
const LOOK = { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' };
const ymd = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function fakeServer() {
  // Hồ sơ theo từng tài khoản; `cur` là tài khoản của phiên đang mở (đổi khi giả lập đăng nhập tài khoản khác)
  const sv = { cur: 'u-tue-thai', profs: {}, revs: {}, gets: [], puts: [], account: true, variants: VARIANTS,
    get prof() { return this.profs[this.cur] || null; }, set prof(v) { this.profs[this.cur] = v; },
    get rev() { return this.revs[this.cur] || 0; }, set rev(v) { this.revs[this.cur] = v; },
    journey: { program: 'so-nhap-49', cycle: 1, day: 1, started_on: ymd(), last_done_on: null, completed_at: null, sacca_count: 0, sessions_done: 0, sermons_done: 0, rev: 1 },
    profile: { tinh_danh: 'Tuệ Thái', tag: '5696', look: LOOK, settings: {}, island: {}, tz: 'Asia/Ho_Chi_Minh', visibility: 'dong_tu', pref_seat: null, rev: 3 } };
  const state = () => ({ profile: sv.profile, journey: { ...sv.journey }, totals: { duc: 0, thien: 0, tue: 0, all: 0 }, unlocked_zones: {}, server_now: Date.now(), practice: 1 });
  sv.handle = async (route) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname, json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(b) });
    if (p === '/api/v1/content') return json({ items: u.searchParams.get('kind') === 'chuong_trinh' ? sv.variants : [] });
    if (p === '/api/v1/practice/profile') {
      if (!sv.account) return json({ error: { code: 'unauthorized', message: 'Cần phiên' } }, 401);
      if (req.method() === 'GET') { sv.gets.push(sv.cur); return json({ profile: sv.prof, rev: sv.rev }); }
      const body = req.postDataJSON(); sv.puts.push({ ...body, uid: sv.cur });
      const same = sv.prof && JSON.stringify(sv.prof) === JSON.stringify(body.profile);
      if (same) return json({ profile: sv.prof, rev: sv.rev });
      if (body.rev !== sv.rev) return json({ error: { code: 'practice_profile_conflict', message: 'rev cũ' } }, 409);
      sv.prof = body.profile; sv.rev += 7; return json({ profile: sv.prof, rev: sv.rev });
    }
    if (p === '/api/v1/me') return json({ user: { id: sv.cur, isAnonymous: false }, ...state(), guest_purge_after: null, ...(u.searchParams.get('entries') ? { entries: [], events: [] } : {}) });
    if (p === '/api/v1/sync') return json({ applied: (req.postDataJSON().ops || []).map((o) => o.id), rejected: [], state: state() });
    if (p === '/api/v1/profile') return json({ success: true, profile: sv.profile });
    if (p.startsWith('/api/')) return json({ error: { code: 'not_found', message: 'không có' } }, 404);
    return route.continue();
  };
  return sv;
}

async function device(browser, sv, { account = true, viewport = { width: 390, height: 760 }, seed = 1 } = {}) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await ctx.route('**/api/**', (r) => sv.handle(r));
  await ctx.addInitScript(({ LOOK, account, seed }) => {
    if (localStorage.getItem('vandao.seeded')) return; localStorage.setItem('vandao.seeded', '1');
    localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day: 1, lastDate: null, done: {}, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: 'Tuệ Thái', look: LOOK, seed }));
    if (account) localStorage.setItem('vandao.acct', JSON.stringify({ uid: 'u-tue-thai', guest: false, cycle: 1 }));
  }, { LOOK, account, seed });
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
  await page.goto(BASE + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  return page;
}
const P = (page) => page.locator('#panel');
const openBia = async (page) => { await page.locator('#panel [data-act="board"]').first().click(); if (await page.evaluate(() => document.body.classList.contains('pmin'))) await P(page).locator('[data-act="pmin"]').click(); await slow(P(page)).toContainText('Bia Tích Lũy'); };
const texts = (page) => P(page).locator('.task').evaluateAll((els) => els.map((e) => e.querySelector('p')?.textContent || ''));
/** Trả lời Duyên khởi: 10 phút (sức tự thành «nhẹ»), 2 ngày trai, miễn phí + tại nhà */
async function answer(page) {
  await P(page).locator('[data-act="dk-open"]').first().click();
  await expect(P(page)).toContainText('Duyên khởi hành trình');
  await P(page).locator('[data-act="dk-set"][data-k="minutes"][data-v="10"]').click();
  await expect(P(page).locator('[data-act="dk-set"][data-k="level"][data-v="nhe"]')).toHaveClass(/on/);
  await P(page).locator('[data-act="dk-set"][data-k="uposatha"][data-v="vn_2"]').click();
  await P(page).locator('[data-act="dk-lim"][data-v="no_money"]').click();
  await P(page).locator('[data-act="dk-lim"][data-v="at_home"]').click();
  await expect(P(page).locator('[data-act="dk-gioi"][aria-pressed="true"]')).toHaveCount(5);   // mặc định khuyến khích đủ năm giới
  await P(page).locator('[data-act="dk-save"]').click();
  await slow(P(page)).toContainText('Gợi ý hôm nay theo Duyên khởi');
}

test('chưa giữ hành trình: Duyên khởi lọc gợi ý theo hồ sơ, đổi một lần mỗi trục, giữ qua lần mở lại, không đụng Kusala, không gửi máy chủ', async ({ browser }) => {
  test.setTimeout(300_000);
  const sv = fakeServer();
  const A = await device(browser, sv, { account: false });
  await openBia(A);
  // chưa trả lời: lời mời Duyên khởi, thẻ trục dùng gợi ý chung của tuần
  await expect(P(A).locator('[data-act="dk-skip"]')).toBeVisible();
  await expect(P(A)).not.toContainText('Gợi ý hôm nay theo Duyên khởi');
  const before = await A.evaluate(() => window.__app.state());
  await answer(A);
  await expect(P(A).locator('[data-act="dk-skip"]')).toHaveCount(0);
  let t = await texts(A);
  expect(t).toHaveLength(3);
  for (const x of t) expect(x).toMatch(/^Việc (duc|thien|tue) [ab]\.$/);   // chỉ mục nhẹ, ≤ 10 phút, miễn phí, tại nhà
  await expect(P(A).locator('.task details').first()).toContainText('Nguồn');
  // đổi gợi ý trục Đức: sang mục hợp lệ còn lại, rồi hết lượt trong ngày
  const duc0 = t[0];
  await P(A).locator('[data-act="dk-swap"][data-p="duc"]').click();
  t = await texts(A);
  expect(t[0]).not.toBe(duc0);
  expect(t[0]).toMatch(/^Việc duc [ab]\.$/);
  await expect(P(A).locator('[data-act="dk-swap"][data-p="duc"]')).toHaveCount(0);
  await expect(P(A).locator('[data-act="dk-swap"]')).toHaveCount(2);
  // hồi quy #129: mở Duyên khởi rồi Lưu (không đổi gì) trong cùng ngày không cấp lại lượt đổi, không đổi gợi ý
  await P(A).locator('[data-act="dk-open"]').first().click();
  await P(A).locator('[data-act="dk-save"]').click();
  await slow(P(A)).toContainText('Gợi ý hôm nay theo Duyên khởi');
  expect(await texts(A)).toEqual(t);
  await expect(P(A).locator('[data-act="dk-swap"][data-p="duc"]')).toHaveCount(0);
  await expect(P(A).locator('[data-act="dk-swap"]')).toHaveCount(2);
  // đổi hồ sơ (bỏ cờ miễn phí, nâng thời lượng): gợi ý cũ vẫn hợp thì giữ; trục Đức vẫn hết lượt đổi
  await P(A).locator('[data-act="dk-open"]').first().click();
  await P(A).locator('[data-act="dk-set"][data-k="minutes"][data-v="30"]').click();
  await P(A).locator('[data-act="dk-save"]').click();
  await slow(P(A)).toContainText('Gợi ý hôm nay theo Duyên khởi');
  expect(await texts(A)).toEqual(t);
  await expect(P(A).locator('[data-act="dk-swap"][data-p="duc"]')).toHaveCount(0);
  const s = await A.evaluate(() => window.__app.state());
  expect(s.uposatha).toBe('vn_2');
  expect(s.totals).toEqual(before.totals);   // gợi ý và đổi gợi ý không cộng Kusala
  expect(s.done).toEqual(before.done);
  // mở lại: cùng gợi ý, vẫn hết lượt đổi ở trục Đức
  await A.reload();
  await A.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await openBia(A);
  await slow(P(A)).toContainText('Gợi ý hôm nay theo Duyên khởi');
  expect(await texts(A)).toEqual(t);
  await expect(P(A).locator('[data-act="dk-swap"][data-p="duc"]')).toHaveCount(0);
  expect(sv.puts).toHaveLength(0);   // chưa có phiên: không gửi gì
  expect(A.errs).toEqual([]);
});

test('cùng tài khoản: máy A lưu Duyên khởi → máy B cùng hồ sơ, cùng gợi ý; B sửa trên rev cũ → 409, tải bản mới', async ({ browser }) => {
  test.setTimeout(420_000);
  const sv = fakeServer();
  const A = await device(browser, sv);
  await openBia(A);
  await answer(A);
  await slow.poll(() => sv.rev).toBeGreaterThan(0);
  expect(sv.puts[0]).toMatchObject({ uid: 'u-tue-thai', rev: 0, profile: { level: 'nhe', minutes: 10, uposatha: 'vn_2', no_money: true, at_home: true, precepts: [1, 2, 3, 4, 5], familiarity: null } });
  expect(Object.keys(sv.puts[0].profile).sort()).toEqual(['at_home', 'familiarity', 'level', 'minutes', 'no_money', 'precepts', 'time_window', 'uposatha']);
  const tA = await texts(A);

  const B = await device(browser, sv, { viewport: { width: 1280, height: 760 } });
  await openBia(B);
  await slow(P(B)).toContainText('Gợi ý hôm nay theo Duyên khởi');   // mở Bia là đọc hồ sơ từ máy chủ
  expect(await texts(B)).toEqual(tA);   // cùng người, chu kỳ, ngày, danh mục → cùng gợi ý
  expect(await B.evaluate(() => window.__app.state().uposatha)).toBe('vn_2');

  // A đổi lựa chọn (rev mới trên máy chủ); B vẫn giữ rev cũ rồi sửa → 409 → B tải bản của A
  await P(A).locator('[data-act="dk-open"]').first().click();
  await P(A).locator('[data-act="dk-set"][data-k="time_window"][data-v="sang"]').click();
  await P(A).locator('[data-act="dk-save"]').click();
  await slow.poll(() => sv.prof && sv.prof.time_window).toBe('sang');
  await P(B).locator('[data-act="dk-open"]').first().click();
  await P(B).locator('[data-act="dk-set"][data-k="time_window"][data-v="toi"]').click();
  await P(B).locator('[data-act="dk-save"]').click();
  await slow(B.locator('#toast')).toContainText('Thiết bị khác vừa lưu');
  expect(sv.prof.time_window).toBe('sang');
  await P(B).locator('[data-act="dk-open"]').first().click();
  await expect(P(B).locator('[data-act="dk-set"][data-k="time_window"][data-v="sang"]')).toHaveClass(/on/);
  expect(A.errs).toEqual([]); expect(B.errs).toEqual([]);
});

/** Giả lập đăng nhập tài khoản khác trên cùng trình duyệt rồi mở lại app */
async function switchTo(page, sv, uid) {
  sv.cur = uid;
  await page.evaluate((uid) => localStorage.setItem('vandao.acct', JSON.stringify({ uid, guest: false, cycle: 1 })), uid);
  await page.reload();
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
}

test('hai tài khoản cùng trình duyệt và hồ sơ trên máy: không chép hồ sơ sang tài khoản khác, đọc không tự ghi', async ({ browser }) => {
  test.setTimeout(600_000);
  const sv = fakeServer();
  // Máy chưa giữ hành trình lưu Duyên khởi trên máy
  const P0 = await device(browser, sv, { account: false });
  await openBia(P0);
  await answer(P0);
  expect(sv.puts).toHaveLength(0);
  // Đăng nhập tài khoản A: hồ sơ trên máy không được chép sang, không có PUT; Bia mời trả lời lại
  await switchTo(P0, sv, 'u-a');
  await openBia(P0);
  await slow.poll(() => sv.gets.filter((u) => u === 'u-a').length).toBeGreaterThan(0);
  await expect(P0.locator('#panel [data-act="dk-skip"]')).toBeVisible();
  await expect(P0.locator('#panel')).not.toContainText('Gợi ý hôm nay theo Duyên khởi');
  expect(await P0.evaluate(() => window.__app.state().uposatha)).toBeUndefined();
  // A tự bấm Lưu → chỉ khi đó mới PUT cho A
  await answer(P0);
  await slow.poll(() => sv.puts.filter((x) => x.uid === 'u-a').length).toBe(1);
  // Đổi sang tài khoản B trên cùng trình duyệt: không nhận hồ sơ của A, không PUT cho B
  await switchTo(P0, sv, 'u-b');
  await openBia(P0);
  await slow.poll(() => sv.gets.filter((u) => u === 'u-b').length).toBeGreaterThan(0);
  await expect(P0.locator('#panel [data-act="dk-skip"]')).toBeVisible();
  await expect(P0.locator('#panel')).not.toContainText('Gợi ý hôm nay theo Duyên khởi');
  expect(await P0.evaluate(() => window.__app.state().uposatha)).toBeUndefined();
  await P0.waitForTimeout(1500);
  expect(sv.puts.filter((x) => x.uid === 'u-b')).toHaveLength(0);
  expect(sv.profs['u-b']).toBeUndefined();
  // Sổ trên máy tách theo tài khoản: A còn nguyên hồ sơ của A, máy chưa giữ hành trình còn bản của nó, B không có
  const book = await P0.evaluate(() => JSON.parse(localStorage.getItem('vandao.dk.v1')));
  expect(book['u-a'].prof).toMatchObject({ minutes: 10, uposatha: 'vn_2' });
  expect(book['u-a'].dirty).toBe(false);
  expect(book.local.prof).toMatchObject({ minutes: 10 });
  expect(book['u-b']?.prof ?? null).toBeNull();   // B chưa lưu gì: không có sổ hoặc sổ rỗng
  expect(sv.puts.filter((x) => x.uid === 'u-a')).toHaveLength(1);
  expect(P0.errs).toEqual([]);
});

test('đổi Duyên khởi trong ngày (#132 mục 2): lựa chọn còn hợp thì giữ, không còn hợp thì về gợi ý tuần, lượt đổi giữ nguyên', async ({ browser }) => {
  test.setTimeout(300_000);
  const sv = fakeServer();
  // seed 2024 với hồ sơ rộng (45 phút, sâu hơn): Đức chọn mục c (vừa, 15 phút, ngoài trời), Thiện và Tuệ chọn mục a (nhẹ, tại nhà)
  const A = await device(browser, sv, { account: false, seed: 2024 });
  await openBia(A);
  await P(A).locator('[data-act="dk-open"]').first().click();
  await P(A).locator('[data-act="dk-set"][data-k="minutes"][data-v="45"]').click();
  await expect(P(A).locator('[data-act="dk-set"][data-k="level"][data-v="sau"]')).toHaveClass(/on/);
  await P(A).locator('[data-act="dk-save"]').click();
  await slow(P(A)).toContainText('Gợi ý hôm nay theo Duyên khởi');
  expect(await texts(A)).toEqual(['Việc duc c.', 'Việc thien a.', 'Việc tue a.']);
  // đổi trục Tuệ một lần
  await P(A).locator('[data-act="dk-swap"][data-p="tue"]').click();
  const tue = (await texts(A))[2];
  expect(tue).toMatch(/^Việc tue [bcd]\.$/);
  // thu hẹp hồ sơ: nhẹ, 10 phút, tại nhà, miễn phí
  await P(A).locator('[data-act="dk-open"]').first().click();
  await P(A).locator('[data-act="dk-set"][data-k="minutes"][data-v="10"]').click();
  await P(A).locator('[data-act="dk-set"][data-k="level"][data-v="nhe"]').click();
  await P(A).locator('[data-act="dk-lim"][data-v="no_money"]').click();
  await P(A).locator('[data-act="dk-lim"][data-v="at_home"]').click();
  await P(A).locator('[data-act="dk-save"]').click();
  await slow(P(A)).toContainText('Gợi ý hôm nay theo Duyên khởi');
  const t = await texts(A);
  expect(t[0]).not.toMatch(/^Việc duc/);   // Đức: mục c không còn hợp → thẻ gợi ý chung của tuần, không tự chọn lại
  expect(t[1]).toBe('Việc thien a.');      // Thiện: mục a còn hợp → giữ nguyên
  if (/^Việc tue [b]\.$/.test(tue)) expect(t[2]).toBe(tue); else expect(t[2]).not.toMatch(/^Việc tue/);
  await expect(P(A).locator('[data-act="dk-swap"][data-p="tue"]')).toHaveCount(0);   // lượt đổi Tuệ đã dùng vẫn giữ
  await expect(P(A).locator('[data-act="dk-swap"][data-p="duc"]')).toHaveCount(0);   // thẻ tuần không có nút đổi
  expect(A.errs).toEqual([]);
});

test('lựa chọn đã lưu theo đúng phiên bản (#46/#132): v1 bị rút khi có v3 → gợi ý tuần; v1 còn công khai cùng v3 → giữ v1; lượt đổi giữ nguyên', async ({ browser }) => {
  test.setTimeout(420_000);
  const sv = fakeServer();
  const A = await device(browser, sv, { account: false, seed: 2024 });   // hồ sơ rộng: Đức chọn sn49-w1-duc-c (v1)
  const reopen = async () => { await A.reload(); await A.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 }); await openBia(A); await slow(P(A)).toContainText('Gợi ý hôm nay theo Duyên khởi'); };
  await openBia(A);
  await P(A).locator('[data-act="dk-open"]').first().click();
  await P(A).locator('[data-act="dk-set"][data-k="minutes"][data-v="45"]').click();
  await P(A).locator('[data-act="dk-save"]').click();
  await slow(P(A)).toContainText('Gợi ý hôm nay theo Duyên khởi');
  expect((await texts(A))[0]).toBe('Việc duc c.');
  await P(A).locator('[data-act="dk-swap"][data-p="duc"]').click();   // dùng lượt đổi Đức
  const swapped = (await texts(A))[0];
  await P(A).locator('[data-act="dk-open"]').first().click();
  await P(A).locator('[data-act="dk-save"]').click();
  // đưa lựa chọn về c v1 để kiểm phiên bản: ghi thẳng sổ trên máy như một lựa chọn đã lưu từ trước
  await A.evaluate(() => { const b = JSON.parse(localStorage.getItem('vandao.dk.v1')); const day = Object.values(b.local.pick).pop(); day.duc = { id: 'sn49-w1-duc-c', v: 1, t: 'Tiêu đề duc c', x: 'Việc duc c.', s: 'nguồn' }; localStorage.setItem('vandao.dk.v1', JSON.stringify(b)); });
  const v3 = { ...VARIANTS.find((r) => r.id === 'sn49-w1-duc-c'), version: 3, body_inline: 'Việc duc c bản 3.' };
  // 1) Danh mục chỉ còn v3 (v2 đã ngừng, v1 không còn công khai) → về gợi ý tuần, không hiện câu v1, không tự chọn lại
  sv.variants = [...VARIANTS.filter((r) => r.id !== 'sn49-w1-duc-c'), v3];
  await reopen();
  expect((await texts(A))[0]).not.toMatch(/^Việc duc/);
  await expect(P(A).locator('[data-act="dk-swap"][data-p="duc"]')).toHaveCount(0);
  // 2) v1 vẫn công khai cùng v3 → giữ đúng câu v1 đã chọn; lượt đổi Đức vẫn đã dùng
  sv.variants = [...VARIANTS, v3];
  await reopen();
  expect((await texts(A))[0]).toBe('Việc duc c.');
  await expect(P(A).locator('[data-act="dk-swap"][data-p="duc"]')).toHaveCount(0);
  expect(swapped).not.toBe('Việc duc c.');
  expect(A.errs).toEqual([]);
});

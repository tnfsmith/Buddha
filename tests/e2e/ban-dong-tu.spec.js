// #124: giao diện Bạn đồng tu trên hai thiết bị thật (hai trình duyệt, hai tài khoản), máy chủ giả lập theo hợp đồng #126.
// Nghiệm thu: tìm đúng «Tịnh danh · mã» (người gửi không nhận tín hiệu từ chối), kết nối bằng liên kết mời, lời mời cùng ngồi thiền
// ẩn khi người nhận đang thiền và hiện lại sau thời thiền, đếm ngược chung theo giờ máy chủ rồi cả hai cùng bắt đầu.
import { test, expect } from '@playwright/test';
import { canMeet, meetPhase, parseFriendQuery, presenceOf, seenBucket, closenessOf } from '../../packages/shared/src/dong-tu.js';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');
const slow = expect.configure({ timeout: 60_000 });
const LOOK = { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' };
const ymd = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// Máy chủ thật hẹn giờ bắt đầu sau MEET_LEAD_MS (60 giây); bản giả rút còn 25 giây cho kiểm thử nhanh, vẫn dài hơn nhịp tải lại 10 giây
const LEAD = 25_000;

function fakeServer(day = 1) {
  const U = {
    a: { id: 'u-tue-thai-0001', tinh_danh: 'Tuệ Thái', tag: '5696' },
    b: { id: 'u-minh-an-00002', tinh_danh: 'Minh An', tag: '2210' },
  };
  const sv = { U, settings: {}, island: {}, presence: {}, links: {}, pairs: [], requests: [], invites: [], log: [], n: 0 };
  const byId = (id) => Object.values(U).find((u) => u.id === id);
  const prof = (id) => ({ ...byId(id), look: LOOK, settings: sv.settings[id] || {}, island: sv.island[id] || {}, tz: 'Asia/Ho_Chi_Minh', visibility: 'dong_tu', pref_seat: null, rev: 3 });
  const journey = { program: 'so-nhap-49', cycle: 1, day, started_on: ymd(), last_done_on: null, completed_at: null, sacca_count: 0, sessions_done: 0, sermons_done: 0, rev: 1 };
  const pairOf = (a, b) => sv.pairs.find((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
  const live = (inv, now) => !['het_han', 'xong', 'tu_choi', 'huy'].includes(meetPhase(inv, now).phase);
  const incomingReq = (me, now) => sv.requests.filter((r) => r.to_id === me && !r.declined_at && r.expires_at > now);
  const shared = (id) => (sv.settings[id] && sv.settings[id].dong_tu) || {};
  function list(me, now) {
    const companions = sv.pairs.filter((p) => p.a === me || p.b === me).map((p) => {
      const o = p.a === me ? p.b : p.a, mine = p.a === me ? p.sa : p.sb, theirs = p.a === me ? p.sb : p.sa, hide = shared(o).hien_trang_thai === false;
      return { id: o, tinh_danh: byId(o).tinh_danh, tag: byId(o).tag, look: LOOK, closeness: closenessOf(mine.than, theirs.than), me: mine, them: theirs,
        presence: hide ? null : presenceOf(sv.presence[o], now), seen: hide ? null : seenBucket(sv.presence[o] && sv.presence[o].updated_at, now),
        day: 1, completed: false, open: (sv.island[o] || {}).open === true, accepted_at: p.at };
    });
    return {
      companions,
      incoming: incomingReq(me, now).map((r) => ({ id: r.id, from: { tinh_danh: byId(r.from).tinh_danh, tag: byId(r.from).tag }, at: r.at })),
      outgoing: sv.requests.filter((r) => r.from === me && r.expires_at > now).map((r) => ({ id: r.id, tinh_danh: r.tinh_danh, tag: r.tag, at: r.at, expires_at: r.expires_at })),
      invites: sv.invites.filter((i) => (i.from === me || i.to === me) && live(i, now)),
      visits: [], server_now: now,
    };
  }
  // who: id cố định, hoặc hàm trả về người đang đăng nhập trên trang (null khi đã đăng xuất), cho ca đổi tài khoản
  sv.handle = async (route, who) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method(), now = Date.now();
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: b === null ? '' : JSON.stringify(b) });
    const err = (code, status) => json({ error: { code, message: code } }, status);
    const body = () => { try { return req.postDataJSON() || {}; } catch { return {}; } };
    const me = typeof who === 'function' ? who() : who;
    if (p === '/api/auth/get-session') return json(me ? { user: { id: me, isAnonymous: false }, session: {} } : null);
    if (p === '/api/auth/sign-out') { if (typeof who === 'function') who(null); return json({ success: true }); }
    if (p === '/api/auth/sign-in/anonymous') { const id = typeof who === 'function' ? who('next') : me; return json({ token: 't', user: { id, isAnonymous: true } }); }
    if (p === '/api/auth/recovery-code/status') return json({ has_code: true, created_at: now });
    if (p === '/api/auth/list-sessions') return json([{}]);
    if (p === '/api/auth/passkey/list-user-passkeys') return json([]);
    if (p.startsWith('/api/v1/') && !me) return err('unauthorized', 401);
    if (p.startsWith('/api/v1/')) sv.log.push(`${me.slice(2, 5)} ${m} ${p.slice(7)}`);
    if (p === '/api/v1/me') {
      return json({ user: { id: me, isAnonymous: false }, practice: 1, profile: prof(me), journey: { ...journey }, totals: { duc: 0, thien: 0, tue: 0, all: 0 },
        unlocked_zones: {}, guest_purge_after: null, dong_tu: 1, server_now: now,
        social: { requests: incomingReq(me, now).length, invites: sv.invites.filter((i) => i.to === me && meetPhase(i, now).phase === 'cho').length } });
    }
    if (p === '/api/v1/sync') return json({ applied: (body().ops || []).map((o) => o.id), rejected: [], state: { profile: prof(me), journey: { ...journey }, totals: { duc: 0, thien: 0, tue: 0, all: 0 }, unlocked_zones: {}, server_now: now, practice: 1 } });
    if (p === '/api/v1/profile') { const b = body(); if (b.settings) sv.settings[me] = { ...(sv.settings[me] || {}), ...b.settings }; if (b.island) sv.island[me] = b.island; return json({ success: true, profile: prof(me) }); }
    if (p === '/api/v1/content') return json({ items: [] });
    if (p === '/api/v1/practice/profile') return json({ profile: null, rev: 0 });
    if (p === '/api/v1/companions' && m === 'GET') return json(list(me, now));
    if (p === '/api/v1/companions/link' && m === 'POST') {
      let k = Object.values(sv.links).find((l) => l.owner === me && l.uses_left > 0);
      if (!k || body().renew) { if (k) delete sv.links[k.code]; k = { code: me === U.a.id ? 'K7M2QX9A' : 'P3R8TW6H', owner: me, uses_left: 5, expires_at: now + 7 * 86_400_000 }; sv.links[k.code] = k; }
      return json({ code: k.code, uses_left: k.uses_left, expires_at: k.expires_at });
    }
    let r = /^\/api\/v1\/companions\/link\/([^/]+)(\/accept)?$/.exec(p);
    if (r) {
      const k = sv.links[r[1]];
      if (!k || k.uses_left <= 0) return err('link_invalid', 404);
      if (!r[2]) return json({ owner: { tinh_danh: byId(k.owner).tinh_danh, tag: byId(k.owner).tag }, valid: true });
      if (k.owner === me) return err('self', 409);
      if (pairOf(me, k.owner)) return err('already_companion', 409);
      k.uses_left--; sv.pairs.push({ a: k.owner, b: me, sa: { than: false, away: false }, sb: { than: false, away: false }, at: now });
      return json({ companion: { id: k.owner } }, 201);
    }
    if (p === '/api/v1/companions/request') {
      const q = parseFriendQuery(body().query); if (!q) return err('invalid_payload', 400);
      // luôn 202 cùng một dạng; to_id chỉ điền khi người ấy có thật và chưa là bạn (hợp đồng §3.3)
      const to = Object.values(U).find((x) => x.tinh_danh === q.tinh_danh && x.tag === q.tag && x.id !== me && !pairOf(x.id, me));
      const row = { id: 'rq-' + ++sv.n, from: me, to_id: to ? to.id : null, tinh_danh: q.tinh_danh, tag: q.tag, at: now, expires_at: now + 14 * 86_400_000, declined_at: null };
      sv.requests.push(row);
      return json({ request: { id: row.id, tinh_danh: row.tinh_danh, tag: row.tag, at: row.at, expires_at: row.expires_at } }, 202);
    }
    r = /^\/api\/v1\/companions\/requests\/([^/]+)(\/respond)?$/.exec(p);
    if (r) {
      const row = sv.requests.find((x) => x.id === r[1]);
      if (!r[2]) { sv.requests = sv.requests.filter((x) => !(x.id === r[1] && x.from === me)); return json(null, 204); }
      if (!row || row.to_id !== me || row.declined_at) return err('not_found', 404);
      if (body().accept) { sv.requests = sv.requests.filter((x) => x !== row); sv.pairs.push({ a: row.from, b: me, sa: { than: false, away: false }, sb: { than: false, away: false }, at: now }); }
      else row.declined_at = now;   // người gửi không được báo
      return json({ ok: true });
    }
    if (p === '/api/v1/presence') { sv.presence[me] = { state: body().state, updated_at: now }; return json(null, 204); }
    if (p === '/api/v1/meet') {
      const b = body(), pr = pairOf(me, b.to); if (!pr) return err('not_companion', 409);
      const hide = shared(b.to).hien_trang_thai === false, fp = hide ? 'online' : presenceOf(sv.presence[b.to], now);
      const chk = canMeet(b.kind, { day: 1, completed: false, open: (sv.island[me] || {}).open === true }, { day: 1, completed: false, open: (sv.island[b.to] || {}).open === true, presence: fp }, { accepted: true }, b.place);
      if (!chk.ok) return err(chk.code, 409);
      sv.invites = sv.invites.filter((i) => !(i.from === me && i.to === b.to && i.status === 'cho'));
      const inv = { id: 'mt-' + ++sv.n, from: me, to: b.to, kind: b.kind, place: chk.place, status: 'cho', created_at: now, responded_at: null, start_at: null };
      sv.invites.push(inv); return json({ invite: inv }, 201);
    }
    r = /^\/api\/v1\/meet\/([^/]+)\/(respond|cancel)$/.exec(p);
    if (r) {
      const inv = sv.invites.find((i) => i.id === r[1] && (i.from === me || i.to === me)); if (!inv) return err('not_found', 404);
      if (r[2] === 'cancel') { inv.status = 'huy'; return json({ invite: inv }); }
      if (inv.to !== me || inv.status !== 'cho') return err('invite_not_pending', 409);
      if (body().accept) Object.assign(inv, { status: 'dong_y', responded_at: now, start_at: now + LEAD }); else inv.status = 'tu_choi';
      return json({ invite: inv });
    }
    if (p === '/api/v1/blocks') return json({ blocks: [] });
    if (p.startsWith('/api/')) return err('not_found', 404);
    return route.continue();
  };
  return sv;
}

async function device(browser, sv, who, viewport, day = 1, session = null) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', isMobile: viewport.width <= 820, hasTouch: viewport.width <= 820 });
  const me = sv.U[who];
  await ctx.route('**/api/**', (r) => sv.handle(r, session || me.id));
  await ctx.addInitScript(({ LOOK, me, day }) => {
    if (localStorage.getItem('vandao.seeded')) return; localStorage.setItem('vandao.seeded', '1');
    localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day, lastDate: null, done: {}, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: me.tinh_danh, look: LOOK, seed: 1 }));
    localStorage.setItem('vandao.acct', JSON.stringify({ uid: me.id, guest: false, cycle: 1 }));
  }, { LOOK, me, day });
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
  await page.goto(BASE + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  // Hai trình duyệt cùng dựng cảnh 3D bằng SwiftShader thì rất chậm; ca này chỉ kiểm giao diện nên dừng vẽ cảnh
  await page.evaluate(() => { window.__app.world.update = () => {}; });
  return page;
}
const P = (page) => page.locator('#panel');
const M = (page) => page.locator('#dtm');
/** Hỏi máy chủ ngay như khi người dùng quay lại cửa sổ (net/account.js: focus → GET /me → me.social đổi thì tải danh sách) */
const nudge = (page) => page.evaluate(() => window.dispatchEvent(new Event('focus')));
const badge = (page, n) => expect.poll(async () => { await nudge(page); return page.locator('#dt .n').textContent(); }, { timeout: 60_000, intervals: [1000, 2000, 5000] }).toBe(n);
/** Đóng rồi mở lại màn Bạn đồng tu: danh sách tải lại từ máy chủ */
async function relist(page) {
  if (await page.evaluate(() => window.__app.U.view === 'dongtu')) await page.locator('#dt').click();
  await openList(page);
}
const listUntil = (page, text) => expect.poll(async () => { await relist(page); await page.waitForTimeout(400); return P(page).textContent(); }, { timeout: 60_000, intervals: [1000, 2000, 4000] }).toContain(text);
async function openList(page) {
  await page.locator('#dt').click();
  await expect(P(page).locator('h2')).toHaveText('Bạn đồng tu');
}
const closeView = (page) => P(page).locator('[data-act="dt-close"]').click();
const secs = (s) => { const [m, x] = s.trim().split(':').map(Number); return m * 60 + x; };

test('hai thiết bị: tìm bạn, kết nối bằng liên kết, mời cùng ngồi thiền khi bạn đang thiền rồi cùng bắt đầu', async ({ browser }) => {
  test.setTimeout(420_000);
  const sv = fakeServer();
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 });
  const B = await device(browser, sv, 'b', { width: 360, height: 740 });
  // Nút chỉ hiện khi máy chủ báo dong_tu: 1
  await slow(A.locator('#dt')).toBeVisible();
  await slow(B.locator('#dt')).toBeVisible();

  // ── 1. Tìm đúng «Tịnh danh · mã». Người nhận bỏ qua: người gửi vẫn chỉ thấy «đã gửi», không có tín hiệu từ chối.
  await openList(A);
  await expect(P(A)).toContainText('Chưa có bạn đồng tu');
  await P(A).locator('[data-act="dt-tab"][data-v="tim"]').click();
  await P(A).locator('#dtFind').fill('minh an 22');
  await P(A).locator('[data-act="dt-find"]').click();
  await expect(P(A).locator('[role="alert"]')).toContainText('Tịnh danh · mã');
  await P(A).locator('#dtFind').fill('minh an · 2210');
  await P(A).locator('[data-act="dt-find"]').click();
  await slow(P(A)).toContainText('Đã gửi lời kết nối tới Minh An · 2210');
  await P(A).locator('[data-act="dt-tab"][data-v="list"]').click();
  await slow(P(A)).toContainText('Đang chờ');
  await expect(P(A)).toContainText('Đã gửi lời kết nối · chờ người ấy đồng ý');

  await badge(B, '1');   // chấm số: một lời kết nối đang chờ (không phải số bạn)
  await openList(B);
  await slow(P(B)).toContainText('Lời kết nối (1)');
  await expect(P(B)).toContainText('Tuệ Thái · 5696');
  await P(B).locator('[data-act="dt-req-no"]').click();
  await slow(P(B)).toContainText('Đã bỏ qua lời kết nối.');
  await relist(A);
  await slow(P(A)).toContainText('Đã gửi lời kết nối · chờ người ấy đồng ý');   // vẫn y như trước
  await P(A).locator('[data-act="dt-withdraw"]').click();
  await slow(P(A)).toContainText('Chưa có bạn đồng tu');

  // ── 2. Kết nối bằng liên kết mời: mã + QR + chia sẻ; người kia mở …/#ban=MÃ
  await P(A).locator('[data-act="dt-tab"][data-v="moi"]').click();
  await slow(P(A).locator('[data-dt-code]')).toHaveText('K7M2-QX9A');
  await expect(P(A).locator('svg.qr')).toHaveAttribute('aria-label', 'Mã QR mời bạn tu cùng');
  await expect(P(A)).toContainText('Còn 5 lượt');
  await closeView(B);
  await B.evaluate(() => { location.hash = '#ban=K7M2-QX9A'; });
  await slow(B.locator('#toast')).toContainText('Đã kết nối đồng tu với Tuệ Thái · 5696');
  await slow.poll(() => B.evaluate(() => location.hash)).not.toContain('ban=');   // mã đã dùng thì rời khỏi địa chỉ
  await listUntil(A, 'Minh An · 2210');
  await expect(P(A)).toContainText('Quen biết');

  // ── 3. B đang thiền: A thấy ghi chú, lời mời không hiện và không có âm ở B cho tới khi xuất thiền
  await B.evaluate(() => window.__app.player.play());
  await slow.poll(() => sv.presence[sv.U.b.id]?.state).toBe('thien');
  await listUntil(A, 'Đang tọa thiền');
  await expect(P(A)).toContainText('lời mời sẽ hiện khi bạn ấy xuất thiền');
  await P(A).locator('[data-act="dt-meet"]').click();
  await slow(P(A)).toContainText('Đã mời cùng ngồi thiền · chờ trả lời');
  await badge(B, '1');
  await B.waitForTimeout(1500);
  await expect(M(B)).toBeHidden();
  await B.evaluate(() => window.__app.player.pause());
  await slow(M(B)).toBeVisible();
  await expect(M(B)).toContainText('Tuệ Thái · 5696');
  await expect(M(B)).toContainText('Mời bạn cùng ngồi một thời thiền 15 phút.');
  await expect(M(B)).toContainText('Lời mời đến trong lúc bạn thiền.');
  // #139: trên điện thoại thẻ nằm trên mép trên đo được của bảng, không che nút Thu gọn
  const box = await B.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const pm = r('#panel .pm'), top = document.elementFromPoint((pm.left + pm.right) / 2, (pm.top + pm.bottom) / 2);
    return { card: r('#dtm').bottom, panel: r('#panel').top, pm: !!top && !!top.closest('.pm') }; });
  expect(box.card).toBeLessThanOrEqual(box.panel + 1);
  expect(box.pm).toBe(true);

  // ── 4. Nhận lời: đếm ngược chung theo giờ máy chủ ở cả hai máy, tới giờ cả hai cùng bắt đầu ở Đại Thiền Đường
  await M(B).locator('[data-act="dt-yes"]').click();
  await slow(M(B)).toContainText('bắt đầu sau');
  await slow(M(A)).toContainText('Cùng ngồi thiền với Minh An · 2210', { timeout: 20_000 });
  await expect(M(A)).toContainText('Tại Đại Thiền Đường');
  // cùng một mốc giờ máy chủ ở hai máy; số giây hiện ra lệch nhau không quá nhịp cập nhật 1 giây (cộng sai số đọc)
  const ends = await Promise.all([A, B].map((pg) => M(pg).locator('[data-dt-end]').getAttribute('data-dt-end')));
  expect(ends[0]).toBe(String(sv.invites.find((i) => i.status === 'dong_y').start_at));
  expect(ends[1]).toBe(ends[0]);
  const [ta, tb] = await Promise.all([A, B].map((pg) => M(pg).locator('[data-dt-end]').textContent()));
  expect(Math.abs(secs(ta) - secs(tb))).toBeLessThanOrEqual(2);
  await slow.poll(() => Promise.all([A, B].map((pg) => pg.evaluate(() => window.__app.player.playing))), { timeout: LEAD + 15_000 }).toEqual([true, true]);
  const st = await Promise.all([A, B].map((pg) => pg.evaluate(() => ({ t: window.__app.player.time, mode: document.body.classList.contains('hall') }))));
  for (const s of st) { expect(s.mode).toBe(true); expect(s.t).toBeLessThan(8); }
  await expect(M(A)).toBeHidden();   // đang thiền: không còn thẻ nào
  await expect(M(B)).toBeHidden();

  expect(A.errs).toEqual([]);
  expect(B.errs).toEqual([]);
});

test('quyền riêng tư và chế độ Cổng Vân Môn đồng bộ lên hồ sơ', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(29);
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 29);
  await slow(A.locator('#dt')).toBeVisible();
  await openList(A);
  await P(A).locator('[data-act="dt-tab"][data-v="rieng"]').click();
  await slow(P(A).locator('[data-dt="hien_ngay"]')).toBeChecked();
  await expect(P(A).locator('[data-dt="hien_trang_thai"]')).toBeChecked();
  await expect(P(A)).toContainText('Chưa chặn ai.');
  await P(A).locator('[data-dt="hien_ngay"]').uncheck();
  // settings gộp ở mức trên cùng nên luôn gửi đủ đối tượng dong_tu (hợp đồng §2)
  await slow.poll(() => sv.settings[sv.U.a.id]?.dong_tu).toEqual({ hien_trang_thai: true, cho_tim: true, hien_ngay: false });
  await expect(P(A).locator('[data-dt="hien_ngay"]')).not.toBeChecked();
  // Cổng Vân Môn (mở nửa từ ngày 29): đổi sang Nghênh khách thì hồ sơ máy chủ có island.open, máy chủ dùng để kiểm quyền ghé thăm
  await P(A).locator('[data-act="dt-tab"][data-v="list"]').click();
  await P(A).locator('[data-act="dt-close"]').click();
  await A.evaluate(() => { location.hash = ''; });
  await A.locator('.zl', { hasText: 'Cổng Vân Môn' }).click();
  await slow(P(A).locator('[data-act="gate"]')).toBeVisible();
  await expect(P(A)).toContainText('Bạn đồng tu (0 đang ở Vân Đạo)');
  await P(A).locator('[data-act="gate"]').click();
  await slow.poll(() => sv.island[sv.U.a.id]?.open).toBe(true);
  expect(sv.settings[sv.U.a.id].dong_tu.hien_ngay).toBe(false);   // đổi cổng không ghi đè quyền riêng tư
  expect(A.errs).toEqual([]);
});

test('đổi tài khoản trên cùng trang: mã mời và dữ liệu của người trước không lọt sang người sau', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer();
  // A đang đăng nhập; đăng xuất thì không còn phiên; «Giữ hành trình» lần sau tạo phiên của B
  let cur = sv.U.a.id;
  const session = (v) => { if (v === null) cur = null; else if (v === 'next') cur = sv.U.b.id; return cur; };
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 1, session);
  await slow(A.locator('#dt')).toBeVisible();
  await openList(A);
  await P(A).locator('[data-act="dt-tab"][data-v="moi"]').click();
  await slow(P(A).locator('[data-dt-code]')).toHaveText('K7M2-QX9A');
  await P(A).locator('[data-act="dt-tab"][data-v="list"]').click();
  await closeView(A);
  // Đăng xuất (bấm hai lần) rồi giữ hành trình thành tài khoản B, không tải lại trang
  await P(A).locator('[data-act="acct-open"]').first().click();
  await slow(P(A).locator('[data-act="acct-out"]')).toBeVisible();
  await P(A).locator('[data-act="acct-out"]').click();
  await P(A).locator('[data-act="acct-out"]').click();
  await slow(A.locator('#dt')).toBeHidden();
  await slow(P(A).locator('[data-act="acct-keep"]')).toBeVisible();
  await P(A).locator('[data-act="acct-keep"]').click();
  await slow(A.locator('#dt')).toBeVisible();
  expect(await A.evaluate(() => performance.getEntriesByType('navigation')[0].type)).not.toBe('reload');
  await openList(A);
  await P(A).locator('[data-act="dt-tab"][data-v="moi"]').click();
  await slow(P(A).locator('[data-dt-code]')).toHaveText('P3R8-TW6H');   // mã của B, không dùng lại mã của A
  expect(Object.values(sv.links).map((k) => k.owner).sort()).toEqual([sv.U.a.id, sv.U.b.id].sort());
  expect(A.errs).toEqual([]);
});

// Codex review #148: ở Đại Thiền Đường trên điện thoại, thẻ hẹn cùng thiền phải neo theo mép bảng đo được (--subb, #139),
// không chồng lên bảng (thu gọn hay mở), cả màn dọc lẫn ngang
for (const [name, vp] of [['dọc 390×760', { width: 390, height: 760 }], ['ngang 740×360', { width: 740, height: 360 }]]) {
  test(`Đại Thiền Đường, điện thoại ${name}: thẻ hẹn cùng thiền nằm trên mép bảng, không che bảng`, async ({ browser }) => {
    test.setTimeout(240_000);
    const sv = fakeServer(), now = Date.now(), { a, b } = sv.U;
    sv.pairs.push({ a: b.id, b: a.id, sa: { than: false, away: false }, sb: { than: false, away: false }, at: now - 86_400_000 });
    sv.invites.push({ id: 'mt-hall', from: b.id, to: a.id, kind: 'thien', place: 'dtd', status: 'dong_y', created_at: now - 20_000, responded_at: now - 5_000, start_at: now + 600_000 });
    const A = await device(browser, sv, 'a', vp);
    await slow(M(A)).toContainText('Cùng ngồi thiền với Minh An · 2210');
    await A.locator('#tabs [data-m="hall"]').click();
    await slow.poll(() => A.evaluate(() => document.body.classList.contains('hall'))).toBe(true);
    const box = () => A.evaluate(() => {
      const el = document.querySelector('#dtm'), c = el.getBoundingClientRect(), p = document.querySelector('#panel').getBoundingClientRect();
      const hit = document.elementFromPoint(p.left + p.width / 2, p.top + 6);
      return { shown: getComputedStyle(el).display !== 'none', cardTop: c.top, cardBottom: c.bottom, panelTop: p.top, panelHit: !!hit && !!hit.closest('#panel'), pmin: document.body.classList.contains('pmin') };
    });
    for (let i = 0; i < 2; i++) {   // bảng thu gọn và mở
      await A.waitForTimeout(400);
      const r = await box();
      // màn thấp, bảng đang mở: không còn chỗ trên mép bảng nên thẻ tạm ẩn; mọi trường hợp khác thẻ phải hiện trọn trên mép bảng
      if (vp.height > 500 || r.pmin) expect(r.shown).toBe(true); else expect(r.shown).toBe(false);
      if (r.shown) { expect(r.cardBottom, `thẻ không chồng bảng (pmin=${r.pmin})`).toBeLessThanOrEqual(r.panelTop + 1); expect(r.cardTop).toBeGreaterThanOrEqual(0); }
      expect(r.panelHit, 'chạm mép trên bảng vào bảng').toBe(true);
      await A.locator('#panel .pm').click();
    }
    expect(A.errs).toEqual([]);
  });
}

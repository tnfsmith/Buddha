// Máy chủ giả lập Bạn đồng tu theo hợp đồng #126 và các tiện ích kiểm thử dùng chung (#124, #151).
import { expect } from '@playwright/test';
import { SESSION_AHEAD_MS, SESSION_MAX, SESSION_OPEN_MAX, SESSION_STEP_MS, canMeet, meetPhase, parseFriendQuery, presenceOf, seenBucket, closenessOf, sessionPhase } from '../../packages/shared/src/dong-tu.js';

export const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
export const slow = expect.configure({ timeout: 60_000 });
export const LOOK = { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' };
const ymd = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
// Máy chủ thật hẹn giờ bắt đầu sau MEET_LEAD_MS (60 giây); bản giả rút còn 25 giây cho kiểm thử nhanh, vẫn dài hơn nhịp tải lại 10 giây
export const LEAD = 25_000;

export function fakeServer(day = 1) {
  const U = {
    a: { id: 'u-tue-thai-0001', tinh_danh: 'Tuệ Thái', tag: '5696' },
    b: { id: 'u-minh-an-00002', tinh_danh: 'Minh An', tag: '2210' },
    c: { id: 'u-hai-dang-0003', tinh_danh: 'Hải Đăng', tag: '3307' },
  };
  // days: ngày hành trình bạn cho hiện (mặc định 1); blank: người chưa tạo nhân vật (#151 §7);
  // noLook: hồ sơ máy chủ có Tịnh danh nhưng chưa có hình dáng; hold[đường dẫn]: Promise thì yêu cầu đó chờ đến khi nó xong (máy chủ chậm)
  const sv = { U, settings: {}, island: {}, presence: {}, links: {}, pairs: [], requests: [], invites: [], log: [], n: 0, days: {}, blank: new Set(), noLook: new Set(), hold: {}, profiles: [], sessions: [], sessionPosts: [] };
  const byId = (id) => Object.values(U).find((u) => u.id === id);
  const prof = (id) => ({ ...byId(id), ...(sv.blank.has(id) ? { tinh_danh: null } : {}), look: sv.blank.has(id) || sv.noLook.has(id) ? {} : LOOK, settings: sv.settings[id] || {}, island: sv.island[id] || {}, tz: 'Asia/Ho_Chi_Minh', visibility: 'dong_tu', pref_seat: null, rev: 3 });
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
        day: sv.days[o] ?? 1, completed: false, open: (sv.island[o] || {}).open === true, accepted_at: p.at };
    });
    return {
      companions,
      incoming: incomingReq(me, now).map((r) => ({ id: r.id, from: { tinh_danh: byId(r.from).tinh_danh, tag: byId(r.from).tag }, at: r.at })),
      outgoing: sv.requests.filter((r) => r.from === me && r.expires_at > now).map((r) => ({ id: r.id, tinh_danh: r.tinh_danh, tag: r.tag, at: r.at, expires_at: r.expires_at })),
      invites: sv.invites.filter((i) => (i.from === me || i.to === me) && live(i, now)),
      // §9.3: phiên mình chủ trì hoặc có ghế, còn hẹn, start_at > now − 15 phút
      sessions: sv.sessions.filter((x) => x.status === 'hen' && x.start_at > now - 15 * 60_000 && (x.host === me || x.seats.some((q) => q.id === me))).map(sessionView),
      visits: [], server_now: now,
    };
  }
  const person = (id) => ({ id, tinh_danh: byId(id).tinh_danh, tag: byId(id).tag, look: LOOK });
  const sessionView = (x) => ({ id: x.id, host: person(x.host), kind: 'thien', place: 'dtd', start_at: x.start_at, created_at: x.created_at, status: x.status, seats: x.seats.map((q) => ({ ...person(q.id), status: q.status })) });
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
    if (sv.hold[p]) await sv.hold[p];
    if (p === '/api/v1/me') {
      return json({ user: { id: me, isAnonymous: false }, practice: 1, profile: prof(me), journey: { ...journey }, totals: { duc: 0, thien: 0, tue: 0, all: 0 },
        unlocked_zones: {}, guest_purge_after: null, dong_tu: 1, server_now: now,
        social: { requests: incomingReq(me, now).length, invites: sv.invites.filter((i) => i.to === me && meetPhase(i, now).phase === 'cho').length } });
    }
    if (p === '/api/v1/sync') return json({ applied: (body().ops || []).map((o) => o.id), rejected: [], state: { profile: prof(me), journey: { ...journey }, totals: { duc: 0, thien: 0, tue: 0, all: 0 }, unlocked_zones: {}, server_now: now, practice: 1 } });
    if (p === '/api/v1/profile') { const b = body(); sv.profiles.push(b); if (b.look && Object.keys(b.look).length) sv.noLook.delete(me); if (b.tinh_danh) sv.blank.delete(me); if (b.settings) { const cur = sv.settings[me] || {}; sv.settings[me] = { ...cur, ...b.settings, dong_tu: { ...(cur.dong_tu || {}), ...((b.settings || {}).dong_tu || {}) } }; } if (b.island) sv.island[me] = b.island; return json({ success: true, profile: prof(me) }); }
    if (p === '/api/v1/content') return json({ items: [] });
    if (p === '/api/v1/practice/profile') return json({ profile: null, rev: 0 });
    if (p === '/api/v1/companions' && m === 'GET') return json(list(me, now));
    if (['/api/v1/companions/link', '/api/v1/companions/request', '/api/v1/meet'].includes(p) && m === 'POST' && (sv.blank.has(me) || sv.noLook.has(me))) return err('need_character', 409);   // hợp đồng §11
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
    r = /^\/api\/v1\/companions\/([^/]+)\/progress$/.exec(p);   // §10.2: chỉ khi đã kết nối và bạn bật chia sẻ; còn lại 404 cùng dạng
    if (r) {
      const o = decodeURIComponent(r[1]);
      const ok = pairOf(me, o) && shared(o).chia_se_tien_trinh === true;
      // progLag: Promise thì phản hồi đã tính xong của lượt này về muộn (mô phỏng 200 cũ tới sau 404 mới)
      const lag = sv.progLag; sv.progLag = null; if (lag) await lag;
      if (!ok) return err('not_found', 404);
      return json({ cycle: 1, day: sv.days[o] ?? 1, completed: false, sessions_done: 12, sermons_done: 5, last_active: 'hom_qua' });
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
    // Phiên đồng tu (§9.3). «Ngay» dùng LEAD thay cho MEET_LEAD_MS như lời mời gặp
    if (p === '/api/v1/sessions' && m === 'POST') {
      const b = body(); sv.sessionPosts.push(b);
      if (sv.blank.has(me) || sv.noLook.has(me)) return err('need_character', 409);
      const ids = Array.isArray(b.invitees) ? b.invitees : [];
      if (!ids.length || ids.length > SESSION_MAX - 1 || new Set(ids).size !== ids.length || ids.some((id) => !pairOf(me, id))) return err('invalid_payload', 400);
      const ngay = b.start_at === 'ngay', at = ngay ? now + LEAD : b.start_at;
      if (!ngay && (!Number.isInteger(at) || at % SESSION_STEP_MS || at < now + 60_000 || at > now + SESSION_AHEAD_MS)) return err('invalid_payload', 400);
      if (sv.sessions.filter((x) => x.host === me && x.status === 'hen' && x.start_at > now).length >= SESSION_OPEN_MAX) return err('session_limit', 409);
      const away = ngay ? ids.filter((id) => presenceOf(sv.presence[id], now) === 'vang') : [];
      const x = { id: 'ss-' + ++sv.n, host: me, start_at: at, created_at: now, status: 'hen', seats: ids.filter((id) => !away.includes(id)).map((id) => ({ id, status: 'moi' })) };
      sv.sessions.push(x); return json({ session: sessionView(x), skipped: away }, 201);
    }
    r = /^\/api\/v1\/sessions\/([^/]+)\/(respond|cancel)$/.exec(p);
    if (r && m === 'POST') {
      const x = sv.sessions.find((y) => y.id === r[1]); if (!x) return err('not_found', 404);
      if (r[2] === 'cancel') { if (x.host !== me) return err('not_found', 404); x.status = 'huy'; return json(null, 204); }
      const q = x.seats.find((y) => y.id === me); if (!q) return err('not_found', 404);
      const ph = sessionPhase(x, now); if (ph === 'huy' || ph === 'xong' || (ph === 'dang' && now - x.start_at > 60_000)) return err('session_closed', 409);
      const yes = body().accept === true;
      q.status = yes ? 'nhan' : q.status === 'nhan' ? 'roi' : 'tu_choi';
      return json({ session: sessionView(x) });
    }
    if (p === '/api/v1/blocks') return json({ blocks: [] });
    if (p.startsWith('/api/')) return err('not_found', 404);
    return route.continue();
  };
  return sv;
}

export async function device(browser, sv, who, viewport, day = 1, session = null, render = false) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', isMobile: viewport.width <= 820, hasTouch: viewport.width <= 820 });
  const me = sv.U[who];
  await ctx.route('**/api/**', (r) => sv.handle(r, session || me.id));
  await ctx.addInitScript(({ LOOK, me, day, blank }) => {
    if (localStorage.getItem('vandao.seeded')) return; localStorage.setItem('vandao.seeded', '1');
    localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day, lastDate: null, done: {}, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: blank ? null : me.tinh_danh, look: blank ? null : LOOK, seed: 1 }));
    localStorage.setItem('vandao.acct', JSON.stringify({ uid: me.id, guest: false, cycle: 1 }));
  }, { LOOK, me, day, blank: sv.blank.has(me.id) });
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
  await page.goto(BASE + '#' + (typeof render === 'string' ? render : 'q=0&snap=1'));   // render: true (vẽ cảnh) hoặc chuỗi hash, vd. 'q=2&snap=1'
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  // Hai trình duyệt cùng dựng cảnh 3D bằng SwiftShader thì rất chậm; ca chỉ kiểm giao diện thì dừng vẽ cảnh
  if (!render) await page.evaluate(() => { window.__app.world.update = () => {}; });
  return page;
}
export const P = (page) => page.locator('#panel');
export const M = (page) => page.locator('#dtm');
/** Hỏi máy chủ ngay như khi người dùng quay lại cửa sổ (net/account.js: focus → GET /me → me.social đổi thì tải danh sách) */
export const nudge = (page) => page.evaluate(() => window.dispatchEvent(new Event('focus')));
export const badge = (page, n) => expect.poll(async () => { await nudge(page); return page.locator('#dt .n').textContent(); }, { timeout: 60_000, intervals: [1000, 2000, 5000] }).toBe(n);
/** Đóng rồi mở lại màn Bạn đồng tu: danh sách tải lại từ máy chủ */
export async function relist(page) {
  if (await page.evaluate(() => window.__app.U.view === 'dongtu')) await page.locator('#dt').click();
  await openList(page);
}
export const listUntil = (page, text) => expect.poll(async () => { await relist(page); await page.waitForTimeout(400); return P(page).textContent(); }, { timeout: 60_000, intervals: [1000, 2000, 4000] }).toContain(text);
export async function openList(page) {
  await page.locator('#dt').click();
  await expect(P(page).locator('h2')).toHaveText('Bạn đồng tu');
}
export const closeView = (page) => P(page).locator('[data-act="dt-close"]').click();
export const secs = (s) => { const [m, x] = s.trim().split(':').map(Number); return m * 60 + x; };

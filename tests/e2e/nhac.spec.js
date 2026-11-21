// #106: màn cài đặt nhắc nhở (hợp đồng docs/contracts/reminder-clock.md §1, §6; API GET/PUT /api/v1/reminders, đăng ký push).
// Máy chủ giả lập kiểm thân PUT bằng đúng luật dùng chung (checkReminders, pauseUntil). Service worker và PushManager được giả
// lập trong trang: ca này kiểm giao diện và dữ liệu gửi đi, không kiểm việc trình duyệt nhận thông báo thật (pwa.spec.js lo phần đó).
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';
import { checkReminders, pauseUntil } from '../../packages/shared/src/reminder.js';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
closeContextsAfterEach();
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');
const slow = expect.configure({ timeout: 60_000 });
const LOOK = { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' };
const ymd = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/nhac-e2e';

function fakeServer({ push = true } = {}) {
  const sv = { push, rows: [], paused: null, subs: [], puts: [], gets: 0, deletes: [], conflict: false };
  const journey = { program: 'so-nhap-49', cycle: 1, day: 3, started_on: ymd(), last_done_on: null, completed_at: null, sacca_count: 0, sessions_done: 0, sermons_done: 0, rev: 1 };
  const profile = { tinh_danh: 'Tuệ Thái', tag: '5696', look: LOOK, settings: {}, island: {}, tz: 'Asia/Ho_Chi_Minh', visibility: 'dong_tu', pref_seat: null, rev: 3 };
  const state = () => ({ profile, journey, totals: { duc: 0, thien: 0, tue: 0, all: 0 }, unlocked_zones: {}, server_now: Date.now() });
  const view = () => ({
    reminders: sv.rows.map((r, i) => ({ id: 'r' + i, ...r, next_at: null })),
    paused_until: sv.paused && sv.paused > Date.now() ? sv.paused : null,
    subscribed: sv.subs.length > 0, push_available: sv.push, vapid_public_key: sv.push ? 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' : null,
  });
  sv.handle = async (route) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
    const json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const bad = (code, status = 400) => json({ error: { code, message: code } }, status);
    if (p === '/api/v1/me') return json({ user: { id: 'u-tue-thai', isAnonymous: false }, ...state(), guest_purge_after: null, ...(u.searchParams.get('entries') ? { entries: [] } : {}) });
    if (p === '/api/v1/sync') return json({ applied: (req.postDataJSON().ops || []).map((o) => o.id), rejected: [], state: state() });
    if (p === '/api/v1/reminders' && m === 'GET') { sv.gets += 1; return json(view()); }
    if (p === '/api/v1/reminders' && m === 'PUT') {
      const body = req.postDataJSON(); sv.puts.push(body);
      if (sv.conflict) { sv.conflict = false; return bad('reminder_conflict', 409); }
      if (Object.keys(body).some((k) => k !== 'reminders' && k !== 'pause_days')) return bad('invalid_reminder');
      const c = checkReminders(body.reminders); if (!c.ok) return bad(c.code);
      if (Object.hasOwn(body, 'pause_days')) { const q = pauseUntil(body.pause_days, Date.now()); if (!q.ok) return bad(q.code); sv.paused = q.v; }
      sv.rows = c.v; return json(view());
    }
    if (p === '/api/v1/push/subscription' && m === 'POST') { const b = req.postDataJSON(); sv.subs = [...sv.subs.filter((s) => s.endpoint !== b.endpoint), b]; return json({ ok: true }); }
    if (p === '/api/v1/push/subscription' && m === 'DELETE') { const b = req.postDataJSON(); sv.deletes.push(b); sv.subs = sv.subs.filter((s) => s.endpoint !== b.endpoint); return json({ ok: true }); }
    if (p.startsWith('/api/')) return bad('not_found', 404);
    return route.continue();
  };
  return sv;
}

/** Trang đã dựng cảnh (dừng vẽ: ca chỉ kiểm giao diện 2D). `perm`: kết quả xin quyền thông báo. */
async function open(browser, sv, { account = true, perm = 'granted', noApi = false, calls404 = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, serviceWorkers: 'block' });
  if (sv) await ctx.route('**/api/**', (r) => sv.handle(r));
  else await ctx.route('**/api/**', (r) => {
    // chưa giữ hành trình: route nhắc có (401 khi chưa đăng nhập), trừ khi `noApi` (API nhắc chưa lên → 404)
    const reminders = r.request().url().includes('/api/v1/reminders');
    if (reminders) calls404.push(r.request().url());
    return reminders && !noApi ? r.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: { code: 'unauthorized' } }) })
      : r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'not_found' } }) });
  });
  await ctx.addInitScript(({ LOOK, account, perm, ENDPOINT }) => {
    if (!localStorage.getItem('vandao.seeded')) {
      localStorage.setItem('vandao.seeded', '1');
      localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day: 3, lastDate: null, done: {}, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: 'Tuệ Thái', look: LOOK }));
      if (account) localStorage.setItem('vandao.acct', JSON.stringify({ uid: 'u-tue-thai', guest: false, cycle: 1 }));
    }
    // Giả lập Notification + service worker + PushManager của máy này
    let state = 'default';
    window.__perm = { asked: 0 };
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => state });
    Notification.requestPermission = async () => { window.__perm.asked += 1; state = perm; return state; };
    window.__sub = null;
    const mk = (key) => ({ endpoint: ENDPOINT, key, toJSON() { return { endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: 'BPnGs0Vb', auth: 'k4xw' } }; }, unsubscribe: async () => { window.__sub = null; return true; } });
    const pushManager = {
      getSubscription: async () => window.__sub,
      subscribe: async (o) => { window.__subOpts = { userVisibleOnly: o.userVisibleOnly, keyLen: o.applicationServerKey.length }; window.__sub = mk(o.applicationServerKey); return window.__sub; },
    };
    const reg = { pushManager, active: {}, scope: location.origin + '/' };
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: {
      register: async () => reg, getRegistration: async () => reg, ready: Promise.resolve(reg), controller: null,
      addEventListener() {}, removeEventListener() {},
    } });
  }, { LOOK, account, perm, ENDPOINT });
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
  await page.goto(BASE + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => { window.__app.world.update = () => {}; });
  return page;
}
const row = (P, i) => P.locator('.nh').nth(i);

test('nhắc nhở: mặc định tắt, tối đa hai nhắc, chặn giờ yên lặng, đăng ký push khi lưu, Tịnh khẩu, tắt trên máy này', async ({ browser }) => {
  test.setTimeout(300_000);
  const sv = fakeServer(), page = await open(browser, sv), P = page.locator('#panel');
  await page.locator('#panel [data-act="board"]').first().click();
  await slow(P).toContainText('Nhắc nhở: đang tắt');
  await P.locator('[data-act="nh-open"]').click();
  await expect(P.locator('h2')).toHaveText('Nhắc nhở');
  await expect(P.locator('.nh')).toHaveCount(5);
  await expect(P.locator('[data-nh="on"]:checked')).toHaveCount(0);   // mặc định tắt
  expect(await page.evaluate(() => window.__perm.asked)).toBe(0);    // chưa xin quyền khi chỉ mở màn

  // bật hai nhắc → nhắc thứ ba bị khóa
  await row(P, 0).locator('[data-nh="on"]').check();
  await row(P, 2).locator('[data-nh="on"]').check();
  await expect(row(P, 1).locator('[data-nh="on"]')).toBeDisabled();
  await expect(row(P, 1)).toContainText('Đã đủ hai nhắc');
  await row(P, 0).locator('[data-nh="hm"]').fill('05:45');
  await row(P, 4).locator('[data-nh="wd"]').selectOption('6');   // Phản tỉnh tuần: Thứ bảy

  // nhắc đang tắt mà đặt giờ yên lặng vẫn bị chặn (máy chủ kiểm mọi nhắc gửi lên)
  await row(P, 1).locator('[data-nh="hm"]').fill('22:00');
  await P.locator('[data-act="nh-save"]').click();
  await expect(P.locator('[role="alert"]')).toContainText('Việc nhỏ hôm nay: giờ này nằm trong giờ yên lặng');
  expect(sv.puts).toHaveLength(0);
  await row(P, 1).locator('[data-nh="hm"]').fill('07:30');

  await P.locator('[data-act="nh-save"]').click();
  await expect(P.locator('[role="status"]')).toHaveText('Đã lưu. Máy này sẽ nhận nhắc.');
  expect(await page.evaluate(() => window.__subOpts)).toEqual({ userVisibleOnly: true, keyLen: 65 });
  expect(sv.subs).toEqual([{ endpoint: ENDPOINT, expirationTime: null, keys: { p256dh: 'BPnGs0Vb', auth: 'k4xw' } }]);
  expect(sv.puts).toHaveLength(1);
  const put = sv.puts[0];
  expect(Object.keys(put)).toEqual(['reminders']);   // không đụng Tịnh khẩu khi người dùng không chọn
  expect(put.reminders.filter((r) => r.active).map((r) => [r.kind, r.local_hm])).toEqual([['thien', '05:45'], ['ghi_nhan', '20:30']]);
  expect(put.reminders.find((r) => r.kind === 'tong_ket_tuan').days_mask).toBe(1 << 6);
  await expect(P.locator('[data-nh="on"]:checked')).toHaveCount(2);   // vẽ lại theo dữ liệu máy chủ trả
  await expect(P.locator('[data-act="nh-off"]')).toBeVisible();

  // Tịnh khẩu 3 ngày; lần lưu sau không gửi lại pause_days
  await P.locator('[data-nh="pause"]').selectOption('3');
  await P.locator('[data-act="nh-save"]').click();
  await expect(P).toContainText('Đang Tịnh khẩu đến');
  expect(sv.puts[1].pause_days).toBe(3);
  await expect(P.locator('[data-nh="pause"] option[value="0"]')).toHaveText('Bỏ Tịnh khẩu');
  expect(await page.evaluate(() => window.__perm.asked)).toBe(1);   // đã có đăng ký: không xin quyền lại

  // lịch vừa đổi ở thiết bị khác (409) → tải lại, báo nhẹ
  sv.conflict = true;
  const gets = sv.gets;
  await P.locator('[data-act="nh-save"]').click();
  await expect(P.locator('[role="status"]')).toContainText('Lịch vừa đổi trên thiết bị khác');
  expect(sv.gets).toBe(gets + 1);
  expect(Object.keys(sv.puts[2])).toEqual(['reminders']);

  // Bia: dòng tóm tắt
  await P.locator('[data-act="board"]').last().click();
  await expect(P).toContainText('Nhắc nhở: 2 nhắc đang bật · đang Tịnh khẩu');

  // tắt trên máy này
  await P.locator('[data-act="nh-open"]').click();
  await P.locator('[data-act="nh-off"]').click();
  await expect(page.locator('#toast')).toContainText('Máy này không nhận thông báo nhắc nữa.');
  expect(sv.deletes).toEqual([{ endpoint: ENDPOINT }]);
  expect(await page.evaluate(() => window.__sub)).toBeNull();
  await expect(P.locator('[data-act="nh-off"]')).toHaveCount(0);
  expect(page.errs).toEqual([]);
});

test('nhắc nhở: máy chủ chưa bật push hoặc người dùng không cho phép → vẫn lưu lịch, không đăng ký', async ({ browser }) => {
  test.setTimeout(300_000);
  const sv = fakeServer({ push: false }), page = await open(browser, sv, { perm: 'denied' }), P = page.locator('#panel');
  await page.locator('#panel [data-act="board"]').first().click();
  await slow(P.locator('[data-act="nh-open"]')).toBeVisible();
  await P.locator('[data-act="nh-open"]').click();
  await expect(P).toContainText('Máy chủ chưa bật gửi nhắc');
  await row(P, 0).locator('[data-nh="on"]').check();
  await P.locator('[data-act="nh-save"]').click();
  await expect(P.locator('[role="status"]')).toContainText('Máy này chưa nhận thông báo');
  expect(sv.subs).toEqual([]);
  expect(await page.evaluate(() => window.__perm.asked)).toBe(0);   // không có khóa VAPID thì không xin quyền

  sv.push = true;   // máy chủ bật push, người dùng từ chối quyền
  await page.reload();
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => { window.__app.world.update = () => {}; });
  await page.locator('#panel [data-act="board"]').first().click();
  await slow(P.locator('[data-act="nh-open"]')).toBeVisible();
  await P.locator('[data-act="nh-open"]').click();
  await expect(P.locator('[data-nh="on"]:checked')).toHaveCount(1);
  await P.locator('[data-act="nh-save"]').click();
  await expect(P.locator('[role="status"]')).toContainText('Máy này chưa nhận thông báo');
  expect(await page.evaluate(() => window.__perm.asked)).toBe(1);
  expect(sv.subs).toEqual([]);
  expect(sv.puts).toHaveLength(2);
  expect(page.errs).toEqual([]);
});

test('nhắc nhở: chưa giữ hành trình → mời giữ hành trình; chỉ dò API nhắc một lần, không gọi push', async ({ browser }) => {
  test.setTimeout(300_000);
  const probes = [], page = await open(browser, null, { account: false, calls404: probes }), P = page.locator('#panel');
  const calls = []; page.on('request', (r) => { if (r.url().includes('/push/')) calls.push(r.url()); });
  await page.locator('#panel [data-act="board"]').first().click();
  await slow(P).toContainText('Nhắc nhở: giữ hành trình để bật');
  await P.locator('[data-act="nh-open"]').click();
  await expect(P).toContainText('Giữ hành trình để bật nhắc');
  await expect(P.locator('[data-act="acct-open"]').last()).toBeVisible();
  expect(calls).toEqual([]);
  expect(probes.length).toBe(1);
  expect(page.errs).toEqual([]);
});

test('nhắc nhở: API nhắc chưa lên (404) → Bia không hiện dòng nhắc, màn nhắc báo đang cập nhật, không gọi lặp', async ({ browser }) => {
  test.setTimeout(300_000);
  const probes = [], page = await open(browser, null, { account: false, noApi: true, calls404: probes }), P = page.locator('#panel');
  await page.locator('#panel [data-act="board"]').first().click();
  await slow(P.locator('h2', { hasText: 'Bia Tích Lũy' })).toBeVisible();
  await expect.poll(() => probes.length).toBe(1);
  await expect(P).not.toContainText('Nhắc nhở');
  await page.evaluate(() => window.dispatchEvent(new Event('online')));   // vẽ lại sau đồng bộ: không dò lại
  await page.waitForTimeout(3000);
  expect(probes.length).toBe(1);
  expect(page.errs).toEqual([]);
});

import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';

// T2.3 (#12): "Giữ hành trình" / "Tôi đã có hành trình" / trang Tài khoản.
//  - Nhóm 1 luôn chạy: giao diện với API giả lập (page.route), không cần máy chủ.
//  - Nhóm 2 chạy khi đặt E2E_ACCOUNT=http://localhost:8787/ (Worker thật bằng `npm run dev:api`, D1 cục bộ, không Turnstile):
//    đi trọn điện thoại → máy tính bằng mã khôi phục, liên kết thiết bị (nghiệm thu < 10 giây), passkey, xung đột.
const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
const FULL = process.env.E2E_ACCOUNT ? process.env.E2E_ACCOUNT.replace(/\/?$/, '/') : null;
const DAYMS = 86400000;
closeContextsAfterEach();
test.use({ serviceWorkers: 'block' });

// cảnh 3D vẽ bằng CPU trên máy CI nên mỗi bước giao diện có thể mất vài chục giây
const slow = expect.configure({ timeout: 60_000 });
const booted = (page) => page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
const state = (page) => page.evaluate(() => { const s = window.__app.state(); return { name: s.name, day: s.day, totals: s.totals, sessions: s.sessions, done: Object.keys(s.done).length }; });
const act = (page, name) => page.locator(`#panel [data-act="acct-${name}"]`).first().click();
const panel = (page) => page.locator('#panel');

/** Gieo hành trình trên máy một lần (không gieo lại sau khi trang tự tải lại) */
async function seed(context, { name = 'Tâm An', day = 3 } = {}) {
  await context.addInitScript(({ name, day, DAYMS }) => {
    if (localStorage.getItem('vandao.seeded')) return; localStorage.setItem('vandao.seeded', '1');
    const now = Date.now(), ymd = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const done = {}, e = (at) => ({ E: 10, pre: 1, during: 1, post: 1, wise: false, self: false, note: 'ghi chú riêng', at });
    for (let d = 1; d < day; d++) { const at = now - (day - d) * DAYMS; done[d] = { duc: e(at), thien: e(at), tue: e(at) }; }
    const t = (day - 1) * 10;
    localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day, lastDate: day > 1 ? ymd(now - DAYMS) : null, done, totals: { duc: t, thien: t, tue: t }, sacca: 1, sessions: 4, completed: false, open: false, name,
      look: { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' } }));
  }, { name, day, DAYMS });
}
/** Cho một "máy" ngừng vẽ 3D (như tab ẩn) để các máy khác trong cùng bài kiểm thử không bị tranh CPU; wake để dùng lại */
const park = (page, on = true) => page.evaluate((on) => { if (on) Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); else delete document.hidden; }, on);
/** Sau khi đăng nhập, trang ghi hành trình vào máy rồi tự tải lại: chờ tới khi trang ĐÃ tải lại và dựng xong cảnh với đúng Tịnh danh */
const restored = (page, name) => page.waitForFunction((name) => performance.getEntriesByType('navigation')[0]?.type === 'reload' && window.__app?.world?.renderer && window.__app.state().name === name, name, { timeout: 180_000 });
async function open(page, base, hash = 'q=0&snap=1') { await page.goto(base + '#' + hash); await booted(page); }

test.describe('giao diện (API giả lập)', () => {
  test('Giữ hành trình → Tài khoản → lấy mã khôi phục; gửi đúng hồ sơ và legacy.import, không gửi ghi chú', async ({ page, context }) => {
    test.setTimeout(240_000);
    await seed(context);
    const calls = [], json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    let signedIn = false, secured = false;
    const me = () => ({ user: { id: 'U1', isAnonymous: !secured }, profile: { tinh_danh: null, tag: '1234', look: {}, settings: {}, tz: 'Asia/Ho_Chi_Minh', visibility: 'dong_tu' }, journey: { program: 'so-nhap-49', cycle: 1, day: 1, completed_at: null }, totals: { duc: 0, thien: 0, tue: 0, all: 0 }, guest_purge_after: Date.now() + 90 * DAYMS });
    await page.route('**/api/**', async (route) => {
      const req = route.request(), path = new URL(req.url()).pathname, body = req.postDataJSON?.() ?? null;
      calls.push({ m: req.method(), path, body });
      if (path === '/api/auth/get-session') return json(route, signedIn ? { user: { id: 'U1', isAnonymous: !secured }, session: {} } : null);
      if (path === '/api/auth/sign-in/anonymous') { signedIn = true; return json(route, { token: 't', user: { id: 'U1', isAnonymous: true } }); }
      if (path === '/api/v1/me') return json(route, me());
      if (path === '/api/v1/profile') return json(route, { success: true });
      // lượt đồng bộ nền đầu tiên (outbox còn trống) trả lời chậm: legacy.import xếp vào trong lúc đó vẫn phải được gửi ngay sau
      if (path === '/api/v1/sync' && !body.ops.length) await new Promise((r) => setTimeout(r, 2500));
      if (path === '/api/v1/sync') return json(route, { applied: body.ops.map((o) => o.id), rejected: [], state: { journey: { cycle: 1, day: 3 }, totals: { all: 60 } } });
      if (path === '/api/auth/recovery-code/status') return json(route, { has_code: secured, created_at: secured ? Date.now() : null });
      if (path === '/api/auth/recovery-code/generate') { secured = true; return json(route, { code: 'ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-23', created_at: Date.now() }); }
      if (path === '/api/auth/list-sessions') return json(route, [{}]);
      if (path === '/api/auth/passkey/list-user-passkeys') return json(route, []);
      if (path === '/api/auth/passkey/generate-register-options') return json(route, { challenge: 'AAAA', rp: { name: 'Vân Đạo', id: 'localhost' }, user: { id: 'AAAA', name: 'x', displayName: 'x' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }], excludeCredentials: [] });
      return json(route, { error: { code: 'not_found', message: 'x' } }, 404);
    });
    await open(page, BASE); await park(page);   // ca này chỉ kiểm giao diện 2D: cho cảnh 3D ngừng vẽ để máy kiểm thử (vẽ bằng CPU) phản hồi nhanh
    await page.locator('#panel [data-act="acct-open"]').first().click();
    await slow(panel(page)).toContainText('Không cần email, không cần mật khẩu');
    await act(page, 'keep');
    await slow(panel(page).locator('h2')).toHaveText('Tài khoản', { timeout: 150_000 });   // máy kiểm thử vẽ 3D bằng CPU: mỗi lượt gọi API chờ vài giây
    await slow(panel(page)).toContainText('Chưa có cách đăng nhập lại');
    const patch = calls.find((c) => c.path === '/api/v1/profile');
    expect(patch.body).toMatchObject({ tinh_danh: 'Tâm An', look: { hair: 'ngan', robe: 1 } });
    expect(patch.body.tz).toBeUndefined();   // múi giờ gửi riêng, không kéo Tịnh danh rơi theo khi bị từ chối
    const imp = calls.filter((c) => c.path === '/api/v1/sync').flatMap((c) => c.body.ops).find((o) => o.type === 'legacy.import');
    expect(imp.payload).toMatchObject({ day: 3, sacca: 1, sessions: 4 });
    expect(Object.keys(imp.payload.done)).toEqual(['1', '2']);
    expect(JSON.stringify(calls)).not.toContain('ghi chú riêng');
    await act(page, 'code');
    await slow(panel(page).locator('.accode')).toHaveText('ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-23');
    await act(page, 'code-done');
    await slow(panel(page)).not.toContainText('Chưa có cách đăng nhập lại');
    await slow(panel(page)).toContainText('Mã khôi phục: đã tạo');
    // Thiết bị đã gắn vân tay / Face ID mà bấm gắn lại: trình duyệt ném InvalidStateError bằng tiếng Anh → phải thành câu tiếng Việt, không phải báo lỗi
    await page.evaluate(() => { navigator.credentials.create = () => Promise.reject(new DOMException('The user attempted to register an authenticator that contains one of the credentials already registered with the relying party.', 'InvalidStateError')); });
    await act(page, 'passkey');
    await slow(panel(page).locator('[role="status"]')).toContainText('đã gắn vân tay / Face ID cho hành trình này rồi, không cần gắn lại');
    await expect(panel(page)).not.toContainText('relying party'); await expect(panel(page).locator('[role="alert"]')).toHaveCount(0);
    // Hủy giữa chừng: câu báo cũng bằng tiếng Việt
    await page.evaluate(() => { navigator.credentials.create = () => Promise.reject(new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError')); });
    await act(page, 'passkey');
    await slow(panel(page).locator('[role="alert"]')).toContainText('Chưa gắn được: bạn đã hủy');
  });

  test('máy mới: màn "Tôi đã có hành trình" có đủ ba cách; mã quá ngắn báo ngay, không gọi máy chủ', async ({ page }) => {
    test.setTimeout(240_000);
    let n = 0; await page.route('**/api/**', (route) => { n++; return route.fulfill({ status: 500, body: '{}' }); });
    await open(page, BASE); await park(page);
    await page.locator('#panel [data-act="acct-open"][data-v="have"]').first().click();
    await slow(panel(page).locator('h2')).toHaveText('Tôi đã có hành trình');
    await slow(panel(page)).toContainText('Mã khôi phục');
    await slow(panel(page)).toContainText('Liên kết với máy đang giữ hành trình');
    await page.fill('#acCode', 'ABCD');
    await act(page, 'in-code');
    await slow(panel(page).locator('[role=alert]')).toHaveText('Mã khôi phục có 26 ký tự.');
    expect(n).toBe(0);
  });
});

test.describe('đầy đủ với Worker thật (E2E_ACCOUNT)', () => {
  test.skip(!FULL, 'đặt E2E_ACCOUNT=http://localhost:8787/ sau khi chạy `npm run dev:api`');
  test('điện thoại → máy tính: mã khôi phục, liên kết thiết bị < 10 giây, passkey, xung đột', async ({ browser }) => {
    test.setTimeout(900_000);
    // ── Máy A ("điện thoại"): có hành trình ngày 3 → Giữ hành trình → mã khôi phục → passkey
    const A = await browser.newContext({ viewport: { width: 390, height: 640 }, serviceWorkers: 'block' }); await seed(A);
    const a = await A.newPage(); await open(a, FULL);
    await a.locator('#panel [data-act="acct-open"]').first().click(); await act(a, 'keep');
    await slow(panel(a).locator('h2')).toHaveText('Tài khoản', { timeout: 120_000 });
    await act(a, 'code'); const code = (await panel(a).locator('.accode').textContent()).trim();
    expect(code).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{2}$/);
    await act(a, 'code-done');
    const cdp = await A.newCDPSession(a); await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
    await act(a, 'passkey'); await slow(panel(a)).toContainText('Vân tay / Face ID đã gắn: 1 thiết bị', { timeout: 90_000 });
    await act(a, 'passkey'); await slow(panel(a)).toContainText('không cần gắn lại', { timeout: 90_000 });   // gắn lần hai trên cùng thiết bị

    await park(a);

    // ── Máy B ("máy tính" mới): Tôi đã có hành trình → mã khôi phục → không phải tạo lại nhân vật
    const B = await browser.newContext({ viewport: { width: 640, height: 400 }, serviceWorkers: 'block' });
    const b = await B.newPage(); await open(b, FULL);
    await b.locator('#panel [data-act="acct-open"][data-v="have"]').first().click();
    await b.fill('#acCode', code.toLowerCase().replace(/-/g, ' ')); await act(b, 'in-code');
    await restored(b, 'Tâm An');
    expect(await state(b)).toMatchObject({ name: 'Tâm An', day: 3, totals: { duc: 20, thien: 20, tue: 20 }, sessions: 4, done: 2 });

    await park(b);

    // ── Máy C: liên kết thiết bị, máy A đồng ý; đo từ lúc A bấm Đồng ý tới lúc C có lại nhân vật trong bộ nhớ
    const C = await browser.newContext({ viewport: { width: 640, height: 400 }, serviceWorkers: 'block' });
    const c = await C.newPage(); await open(c, FULL);
    await c.locator('#panel [data-act="acct-open"][data-v="have"]').first().click(); await act(c, 'in-link');
    const lcode = (await panel(c).locator('.accode').textContent()).trim();
    await slow(panel(c).locator('svg.qr')).toBeVisible();
    await park(c);   // đo thời gian của giao thức (hỏi 2 giây/lần → đăng nhập → tải hành trình), không đo tốc độ vẽ 3D bằng CPU của máy kiểm thử
    await park(a, false); await a.fill('#acLink', lcode); await act(a, 'ask');
    await slow(panel(a)).toContainText('Thiết bị xin vào hành trình của bạn');
    // Nghiệm thu < 10 giây: từ lúc máy A gửi lời đồng ý đến lúc máy C đã ghi xong hành trình và bắt đầu tải lại trang.
    // (Không đo thời gian Playwright bấm nút hay dựng lại cảnh 3D bằng CPU: hai thứ đó là của máy kiểm thử, không phải của giao thức.)
    const approved = a.waitForResponse((r) => r.url().includes('/device-link/approve') && r.ok(), { timeout: 120_000 });
    await act(a, 'approve'); const t0 = (await approved).request().timing().startTime; await park(a);   // lúc máy A gửi lời đồng ý (giờ hệ thống, ms)
    await restored(c, 'Tâm An');
    const took = (await c.evaluate(() => performance.timeOrigin)) - t0; console.log(`Liên kết thiết bị: máy mới có lại hành trình sau ${(took / 1000).toFixed(1)} giây`);
    expect(took).toBeLessThan(10_000);
    expect(await state(c)).toMatchObject({ name: 'Tâm An', day: 3 }); await park(c);

    // ── Máy A: đăng xuất rồi vào lại bằng passkey
    await park(a, false);
    await act(a, 'out'); await act(a, 'out'); await slow(panel(a)).toContainText('Đã đăng xuất máy này', { timeout: 90_000 });
    await act(a, 'tab'); await act(a, 'in-passkey');
    await restored(a, 'Tâm An'); expect(await a.evaluate(() => JSON.parse(localStorage.getItem('vandao.acct') || 'null')?.uid)).toBeTruthy();
    expect(await state(a)).toMatchObject({ name: 'Tâm An', day: 3 });

    await park(a);

    // ── Máy D: đã có hành trình khác (ngày 2) → đăng nhập bằng mã → hỏi chọn → giữ bản đã lưu, bản trên máy được sao lưu
    const D = await browser.newContext({ viewport: { width: 640, height: 400 }, serviceWorkers: 'block' }); await seed(D, { name: 'An Nhiên', day: 2 });
    const d = await D.newPage(); await open(d, FULL);
    await d.locator('#panel [data-act="acct-open"]').first().click(); await act(d, 'tab');
    await d.fill('#acCode', code); await act(d, 'in-code');
    await slow(panel(d).locator('h2')).toHaveText('Chọn hành trình để tiếp tục', { timeout: 90_000 });
    await slow(panel(d)).toContainText('Giữ hành trình đã lưu (ngày 3)'); await slow(panel(d)).toContainText('Dùng hành trình trên máy này (ngày 2)');
    await act(d, 'use-saved');
    await restored(d, 'Tâm An'); expect(await state(d)).toMatchObject({ name: 'Tâm An', day: 3 });
    const backup = await d.evaluate(() => new Promise((res) => { const q = indexedDB.open('vandao'); q.onsuccess = () => { const g = q.result.transaction('meta').objectStore('meta').get('localBackup'); g.onsuccess = () => res(g.result && g.result.state.name); }; }));
    expect(backup).toBe('An Nhiên');
    for (const x of [A, B, C, D]) await x.close();
  });
  test('xung đột → "Dùng hành trình trên máy này": bản đã lưu thành chu kỳ cũ, bản trên máy lên chu kỳ mới và không bị ghi đè', async ({ browser }) => {
    test.setTimeout(600_000);
    const A = await browser.newContext({ viewport: { width: 390, height: 640 }, serviceWorkers: 'block' }); await seed(A, { name: 'Tịnh Lạc', day: 4 });
    const a = await A.newPage(); await open(a, FULL);
    await a.locator('#panel [data-act="acct-open"]').first().click(); await act(a, 'keep');
    await slow(panel(a).locator('h2')).toHaveText('Tài khoản', { timeout: 120_000 });
    await act(a, 'code'); const code = (await panel(a).locator('.accode').textContent()).trim();
    await A.close();

    const D = await browser.newContext({ viewport: { width: 640, height: 400 }, serviceWorkers: 'block' }); await seed(D, { name: 'An Nhiên', day: 2 });
    const d = await D.newPage(); await open(d, FULL);
    await d.locator('#panel [data-act="acct-open"]').first().click(); await act(d, 'tab');
    await d.fill('#acCode', code); await act(d, 'in-code');
    await slow(panel(d).locator('h2')).toHaveText('Chọn hành trình để tiếp tục', { timeout: 90_000 });
    // trong lúc còn chờ chọn, bản trên máy phải nguyên vẹn (không đồng bộ nền nào được kéo bản máy chủ về)
    await d.waitForTimeout(5000); expect(await state(d)).toMatchObject({ name: 'An Nhiên', day: 2, totals: { duc: 10, thien: 10, tue: 10 } });
    await act(d, 'use-local');
    await slow(panel(d)).toContainText('Đã dùng hành trình trên máy này', { timeout: 120_000 });
    expect(await state(d)).toMatchObject({ name: 'An Nhiên', day: 2, totals: { duc: 10, thien: 10, tue: 10 } });
    const me = await d.evaluate(async () => (await fetch('/api/v1/me?entries=1')).json());
    expect(me.journey).toMatchObject({ cycle: 2, day: 2 }); expect(me.totals.all).toBe(30); expect(me.profile.tinh_danh).toBe('An Nhiên'); expect(me.entries).toHaveLength(3);
    await d.waitForTimeout(8000); expect(await state(d)).toMatchObject({ name: 'An Nhiên', day: 2 });   // các lượt đồng bộ sau cũng không đổi bản trên máy
    await D.close();
  });
});

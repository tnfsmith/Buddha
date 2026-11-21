import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';
import { LOOK, P, M, slow, openList, listUntil, secs } from './dong-tu-fake.js';

// T5.7 + T5.8 (#124, #125): Bạn đồng tu với hai phiên thật trên Worker + D1 cục bộ (không máy chủ giả).
//  - Chạy khi đặt E2E_ACCOUNT, như nhóm «đầy đủ với Worker thật» của account.spec.js
//    (`node scripts/account-ci.mjs` dựng Worker/D1 riêng, hoặc `npm run dev:api` rồi E2E_ACCOUNT=http://localhost:8787/).
//  - Nghiệm thu #124: tìm đúng «Tịnh danh · mã» (người gửi không nhận tín hiệu từ chối), kết bạn bằng liên kết mời, lời mời đến lúc
//    đang thiền không hiện cho tới khi xuất thiền, cùng đếm ngược theo giờ máy chủ rồi cùng bắt đầu.
//  - Nghiệm thu #125: thân thiết hai chiều, Nghênh khách, ghé khi vắng; chủ đảo quay lại thì thấy bạn đã ghé (thiết kế ban-dong-tu §5.5).
//  - E2E_DONG_TU_UPTO=t57: dừng sau phần #124, dùng khi kiểm staging/production chưa có 3D #125. Phải đặt rõ; CI chạy đủ.
const FULL = process.env.E2E_ACCOUNT ? process.env.E2E_ACCOUNT.replace(/\/?$/, '/') : null;
const UPTO = process.env.E2E_DONG_TU_UPTO || '';
const DAYMS = 86400000;
closeContextsAfterEach();
test.use({ serviceWorkers: 'block', actionTimeout: 120_000 });   // một bước kẹt thì báo ngay, không chờ hết 15 phút

/** Hành trình trên máy: đủ ba trục các ngày trước (máy chủ nhận legacy.import khi các ngày đã qua trọn vẹn), có Tịnh danh và hình dáng */
async function seed(context, name, day) {
  await context.addInitScript(({ name, day, LOOK, DAYMS }) => {
    if (!/^https?:$/.test(location.protocol)) return;   // about:blank lúc mở trang mới không có localStorage
    if (localStorage.getItem('vandao.seeded')) return; localStorage.setItem('vandao.seeded', '1');
    const now = Date.now(), ymd = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const done = {}, e = (at) => ({ E: 10, pre: 1, during: 1, post: 1, wise: false, self: false, at });
    for (let d = 1; d < day; d++) { const at = now - (day - d) * DAYMS; done[d] = { duc: e(at), thien: e(at), tue: e(at) }; }
    const t = (day - 1) * 10;
    localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day, lastDate: ymd(now - DAYMS), done, totals: { duc: t, thien: t, tue: t }, sacca: 1, sessions: 31, completed: false, open: false, name, look: LOOK }));
  }, { name, day, LOOK, DAYMS });
}
/** Mở trang, chờ dựng xong rồi ngừng vẽ cảnh (hai trình duyệt cùng vẽ bằng SwiftShader thì quá chậm; ca này kiểm giao thức và giao diện) */
async function open(context) {
  const page = await context.newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));
  await page.goto(FULL + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => { window.__app.world.update = () => {}; });
  return page;
}
/** Thiết bị mới: Giữ hành trình → phiên thật trên Worker; nút Bạn đồng tu chỉ hiện khi /me báo dong_tu: 1 và hồ sơ máy chủ có Tịnh danh + hình dáng */
async function device(browser, name, day, viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block', isMobile: viewport.width <= 820, hasTouch: viewport.width <= 820 });
  await seed(ctx, name, day);
  const page = await open(ctx);
  // mã tài khoản và mã 4 số công khai của phiên lấy từ GET /me (bản main chưa mở window.__app.acct)
  page.tag = null; page.uid = null;
  page.on('response', (r) => { if (r.ok() && new URL(r.url()).pathname === '/api/v1/me') r.json().then((j) => { if (j && j.profile && j.profile.tag) page.tag = String(j.profile.tag); if (j && j.user && j.user.id) page.uid = String(j.user.id); }).catch(() => {}); });
  await page.locator('#panel [data-act="acct-open"]').first().click();
  await page.locator('#panel [data-act="acct-keep"]').first().click();
  await slow(P(page).locator('h2')).toHaveText('Tài khoản', { timeout: 120_000 });
  await slow(page.locator('#dt')).toBeVisible({ timeout: 120_000 });
  await slow.poll(() => page.evaluate(() => window.__app.state().day)).toBe(day);
  await slow.poll(() => page.tag).toMatch(/^\d{4}$/);
  page.ctx = ctx;
  return page;
}
const uid = (page) => page.uid;
const dot = (page) => page.evaluate(() => { window.dispatchEvent(new Event('focus')); const n = document.querySelector('#dt .n'); return n ? n.textContent : ''; });
/** Ô đảo của một bạn thật trên Vân Đảo (world.friends lấy từ GET /companions) */
const isle = (page, id) => page.evaluate((id) => window.__app.world.friends.findIndex((f) => f.id === id), id);
/** Mở thẻ một bạn đồng tu trên cảnh đảo (như bấm vào đảo bạn) */
const card = (page, i) => page.evaluate((i) => { window.__app.openFriend(i); }, i);
/** Đóng màn Bạn đồng tu ở bất kỳ màn con nào (chi tiết bạn không có nút «Đóng»; nút #dt bật/tắt màn) */
const shut = async (page) => { if (await page.evaluate(() => window.__app.U.view === 'dongtu')) await page.locator('#dt').click(); };
/** Màn Bạn đồng tu ở tab Danh sách, vừa tải lại GET /companions: đóng màn (đang ở màn con nào cũng vậy) rồi mở lại; dtOpen luôn mở tab Danh sách */
async function listView(page) {
  await shut(page);
  await page.locator('#dt').click();
  await slow(P(page).locator('h2')).toHaveText('Bạn đồng tu');
}
/** Mở chi tiết một bạn trong màn Bạn đồng tu */
async function detail(page, id) {
  await listView(page);
  const row = P(page).locator(`button.dtn[data-act="dt-ban"][data-id="${id}"]`);   // dòng tên bạn (nút «Mời khác · chi tiết» cùng data-act)
  await slow(row).toBeVisible();
  await row.click();
  await slow(P(page).locator('[data-dt="than"]')).toBeEnabled();
}

test.describe('Bạn đồng tu đầy đủ với Worker thật (E2E_ACCOUNT)', () => {
  test.skip(!FULL, 'đặt E2E_ACCOUNT=http://localhost:8787/ sau khi chạy `npm run dev:api`, hoặc chạy qua scripts/account-ci.mjs');

  test('hai phiên thật: tìm tên · mã, liên kết mời, lời mời lúc đang thiền, cùng ngồi thiền theo giờ máy chủ, thân thiết, ghé khi vắng, chủ đảo thấy bạn đã ghé', async ({ browser }) => {
    test.setTimeout(900_000);
    // Cả hai đã qua ngày 29 (Cổng Vân Môn mở nửa): được du vân sang đảo bạn
    const A = await device(browser, 'Tuệ Thái', 30, { width: 1280, height: 800 });
    const B = await device(browser, 'Minh An', 30, { width: 360, height: 740 });
    const [ida, idb] = [await uid(A), await uid(B)];
    expect(ida).toBeTruthy(); expect(idb).toBeTruthy(); expect(ida).not.toBe(idb);

    // ── 1. Kết bạn bằng liên kết mời: A lấy mã, B mở …/#ban=MÃ; máy chủ ghép đôi ngay (quen biết)
    // ── 1a. Tìm đúng «Tịnh danh · mã» (#124): gõ sai dạng thì báo ngay; người nhận bỏ qua thì người gửi vẫn chỉ thấy «đã gửi»
    await openList(A);
    await expect(P(A)).toContainText('Chưa có bạn đồng tu');
    await P(A).locator('[data-act="dt-tab"][data-v="tim"]').click();
    await P(A).locator('#dtFind').fill('minh an 22');
    await P(A).locator('[data-act="dt-find"]').click();
    await expect(P(A).locator('[role="alert"]')).toContainText('Tịnh danh · mã');
    await P(A).locator('#dtFind').fill(`minh an · ${B.tag}`);
    await P(A).locator('[data-act="dt-find"]').click();
    await slow(P(A)).toContainText(`Đã gửi lời kết nối tới Minh An · ${B.tag}`);
    await listView(A);
    await slow(P(A)).toContainText('Đã gửi lời kết nối · chờ người ấy đồng ý');
    await slow.poll(() => dot(B), { timeout: 90_000, intervals: [1000, 2000, 4000] }).toBe('1');   // chấm số: một lời kết nối đang chờ
    await listView(B);
    await slow(P(B)).toContainText('Lời kết nối (1)');
    await expect(P(B)).toContainText(`Tuệ Thái · ${A.tag}`);
    await P(B).locator('[data-act="dt-req-no"]').click();
    await slow(P(B)).toContainText('Đã bỏ qua lời kết nối.');
    await shut(B);
    await listView(A);
    await slow(P(A)).toContainText('Đã gửi lời kết nối · chờ người ấy đồng ý');   // vẫn y như trước: không có tín hiệu từ chối
    await P(A).locator('[data-act="dt-withdraw"]').click();
    await slow(P(A)).toContainText('Chưa có bạn đồng tu');

    // ── 1b. Kết bạn bằng liên kết mời
    await P(A).locator('[data-act="dt-tab"][data-v="moi"]').click();
    await slow(P(A).locator('[data-dt-code]')).toHaveText(/^[0-9A-Z]{4}-?[0-9A-Z]{4}$/);
    const code = (await P(A).locator('[data-dt-code]').textContent()).trim();
    await expect(P(A).locator('svg.qr')).toHaveAttribute('aria-label', 'Mã QR mời bạn tu cùng');
    // Thẻ chia sẻ /moi/MÃ (#160): máy chủ trả trang ứng dụng kèm og:title có tên · mã người mời và ảnh 1200×630 (chỉ đọc)
    const share = await A.request.get(FULL + 'moi/' + encodeURIComponent(code));
    expect(share.status()).toBe(200);
    const head = await share.text();
    expect(head).toContain(`<meta property="og:title" content="Tuệ Thái · ${A.tag} mời bạn tu cùng trên Vân Đạo">`);
    expect(head).toMatch(/<meta property="og:image" content="[^"]+\/media\/og\/invite-v1\.png">/);
    expect(head).toContain('<meta property="og:image:width" content="1200">');
    await B.evaluate((code) => { location.hash = '#ban=' + code; }, code);
    await slow(B.locator('#toast')).toContainText('Đã kết nối đồng tu với Tuệ Thái');
    await slow.poll(() => B.evaluate(() => location.hash)).not.toContain('ban=');
    await P(A).locator('[data-act="dt-tab"][data-v="list"]').click();
    await listUntil(A, 'Minh An');
    await expect(P(A)).toContainText('Quen biết');

    // ── 2. B đang thiền: A thấy «Đang tọa thiền»; lời mời cùng ngồi thiền gửi lúc ấy không hiện ở B cho tới khi B xuất thiền (#124).
    //       Nhận lời thì hai máy đếm ngược tới cùng một giờ máy chủ rồi cùng bắt đầu ở Đại Thiền Đường.
    await B.evaluate(() => window.__app.player.play());
    await slow.poll(async () => { await listView(A); await A.waitForTimeout(1500); return P(A).textContent(); }, { timeout: 120_000, intervals: [2000, 4000] }).toContain('Đang tọa thiền');
    await expect(P(A)).toContainText('lời mời sẽ hiện khi bạn ấy xuất thiền');
    await slow(P(A).locator('[data-act="dt-meet"][data-k="thien"][data-p="dtd"]')).toBeEnabled();
    await P(A).locator('[data-act="dt-meet"][data-k="thien"][data-p="dtd"]').click();
    await slow(P(A)).toContainText('chờ trả lời');
    await slow.poll(() => dot(B), { timeout: 90_000, intervals: [1000, 2000, 4000] }).toBe('1');   // B đã nhận lời mời (chấm số)
    await B.waitForTimeout(1500);
    await expect(M(B)).toBeHidden();   // đang thiền: không hiện thẻ lời mời
    await B.evaluate(() => window.__app.player.pause());
    await slow(M(B)).toBeVisible();
    await expect(M(B)).toContainText('Lời mời đến trong lúc bạn thiền.');
    await expect(M(B)).toContainText('Tuệ Thái');
    await expect(M(B)).toContainText('Mời bạn cùng ngồi một thời thiền 15 phút.');
    await M(B).locator('[data-act="dt-yes"]').click();
    await slow(M(B)).toContainText('bắt đầu sau');
    await slow.poll(async () => { await A.evaluate(() => window.dispatchEvent(new Event('focus'))); return (await M(A).textContent()) || ''; }, { timeout: 60_000, intervals: [1000, 2000, 4000] }).toContain('Cùng ngồi thiền với Minh An');
    await expect(M(A)).toContainText('Tại Đại Thiền Đường');
    const ends = await Promise.all([A, B].map((pg) => M(pg).locator('[data-dt-end]').getAttribute('data-dt-end')));
    expect(Number(ends[0])).toBeGreaterThan(Date.now());
    expect(ends[1]).toBe(ends[0]);   // một mốc giờ máy chủ chung
    const [ta, tb] = await Promise.all([A, B].map((pg) => M(pg).locator('[data-dt-end]').textContent()));
    expect(Math.abs(secs(ta) - secs(tb))).toBeLessThanOrEqual(3);
    await slow.poll(() => Promise.all([A, B].map((pg) => pg.evaluate(() => window.__app.player.playing))), { timeout: 120_000 }).toEqual([true, true]);
    const st = await Promise.all([A, B].map((pg) => pg.evaluate(() => ({ t: window.__app.player.time, hall: document.body.classList.contains('hall') }))));
    for (const s of st) { expect(s.hall).toBe(true); expect(s.t).toBeLessThan(10); }
    // Đã kiểm cùng bắt đầu; dừng thời thiền ở cả hai máy để tiếp các bước sau
    for (const pg of [A, B]) { await pg.evaluate(() => window.__app.player.pause()); await pg.locator('#tabs button[data-m="island"]').click(); }
    if (UPTO === 't57') {   // bản đang chạy chưa có 3D #125: dừng sau phần #124 (chỉ khi đặt rõ biến này)
      test.info().annotations.push({ type: 'phạm vi', description: 'E2E_DONG_TU_UPTO=t57: đã kiểm phần #124, bỏ phần 3D #125' });
      expect(A.errs).toEqual([]); expect(B.errs).toEqual([]);
      return;
    }

    // ── 3. Thân thiết hai chiều; A cho B ghé khi vắng và mở Cổng Vân Môn ở chế độ Nghênh khách
    await detail(A, idb);
    await P(A).locator('[data-dt="than"]').check();
    await detail(B, ida);
    await P(B).locator('[data-dt="than"]').check();
    await slow.poll(async () => { await detail(A, idb); return P(A).textContent(); }, { timeout: 60_000, intervals: [1000, 2000, 4000] }).toContain('bạn đồng tu thân thiết');
    await P(A).locator('[data-dt="away"]').check();
    await slow(P(A).locator('[data-dt="away"]')).toBeChecked();
    await slow(P(A).locator('[data-dt="away"]')).toBeEnabled();
    await shut(A);
    // cảnh đã ngừng vẽ nên nhãn phân khu không được đặt lên trên canvas: gọi đúng trình xử lý của nhãn (goZone)
    await A.evaluate(() => [...document.querySelectorAll('.zl')].find((b) => b.textContent.includes('Cổng Vân Môn')).click());
    await slow(P(A).locator('[data-act="gate"]')).toBeVisible();
    // Nghênh khách: hồ sơ máy chủ phải nhận island.open (máy chủ kiểm quyền ghé theo chế độ cổng) trước khi A rời đi
    const opened = A.waitForResponse((r) => r.url().includes('/api/v1/profile') && r.request().method() === 'PATCH' && r.ok() &&
      (() => { try { return JSON.parse(r.request().postData() || '{}').island?.open === true; } catch { return false; } })(), { timeout: 120_000 });
    expect(await A.evaluate(() => !!window.__app.state().open)).toBe(false);
    await P(A).locator('[data-act="gate"]').click();
    await opened;
    expect(await A.evaluate(() => !!window.__app.state().open)).toBe(true);

    // ── 4. A rời Vân Đạo (đóng trang). Máy chủ coi là vắng khi quá ONLINE_MS (3 phút) không có nhịp hiện diện
    const actx = A.ctx;
    expect(A.errs).toEqual([]);
    await A.close();
    await shut(B);
    let ib = -1;
    await slow.poll(async () => {
      await listView(B); await B.waitForTimeout(2000);
      ib = await isle(B, ida);
      return ib >= 0 && B.evaluate((i) => { const f = window.__app.world.friends[i]; return { here: f.here, than: f.c.closeness, away: !!(f.c.them && f.c.them.away), open: f.c.open }; }, ib);
    }, { timeout: 300_000, intervals: [15_000] }).toEqual({ here: false, than: 'than', away: true, open: true });

    // ── 5. B ghé đảo A khi A vắng: thẻ đảo bạn có «Ghé khi vắng», máy chủ ghi lượt ghé và vân mây đưa B sang
    await shut(B);
    await card(B, ib);
    await slow(P(B)).toContainText('Bạn thân thiết đã cho phép ghé khi vắng.');
    await slow(P(B).locator('[data-act="ghe-vang"]')).toBeEnabled();
    const visited = B.waitForResponse((r) => r.url().includes('/visits/away') && r.request().method() === 'POST', { timeout: 60_000 });
    await P(B).locator('[data-act="ghe-vang"]').click();
    expect((await visited).status()).toBe(200);
    await slow(B.locator('#toast')).toContainText('Du vân theo vân lộ');
    expect(B.errs).toEqual([]);

    // ── 6. A quay lại: báo một lần «Minh An đã ghé thăm Vân Đảo hôm nay khi bạn vắng»; thẻ đảo bạn ghi lần ghé
    const A2 = await open(actx);
    await slow(A2.locator('#dt')).toBeVisible({ timeout: 120_000 });
    await slow(A2.locator('#toast')).toHaveText('Minh An đã ghé thăm Vân Đảo hôm nay khi bạn vắng.', { timeout: 120_000 });
    const ia = await isle(A2, idb);
    expect(ia).toBeGreaterThanOrEqual(0);
    await card(A2, ia);
    await slow(P(A2)).toContainText('Đã ghé thăm đảo bạn hôm nay khi bạn vắng.');
    // đã báo hôm nay thì không báo lại (ghi trên máy theo tài khoản · khách · ngày)
    expect(await A2.evaluate(() => window.__app.visitToast())).toBe('');
    expect(A2.errs).toEqual([]);
  });
});

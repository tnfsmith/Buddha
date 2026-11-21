import { test, expect } from '@playwright/test';

// T1.1: PWA offline + IndexedDB. Chạy trên máy chủ http (cục bộ: tests/e2e/serve.mjs; CI preview/staging/production: E2E_BASE_URL).
const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');

const booted = (page) => page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });

test('tắt mạng vẫn mở được ứng dụng và chạy thời thiền', async ({ page, context }) => {
  test.setTimeout(240_000);
  await page.goto(BASE + '#snap=1');
  await booted(page);
  // chờ service worker kiểm soát trang và lưu xong bộ đệm
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })); });
  expect(await page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith('vandao-')))).toBe(true);
  // #161: bản web nạp mã dạng module từ /assets/, three.js, mã ứng dụng và phông nằm sẵn trong cache riêng vandao-assets
  expect(await page.evaluate(() => document.querySelector('script[type="module"]')?.getAttribute('src'))).toMatch(/^\/assets\/app-\w+\.js$/);
  const kept = await page.evaluate(async () => (await (await caches.open('vandao-assets')).keys()).map((r) => new URL(r.url).pathname));
  for (const re of [/^\/assets\/three-\w+\.js$/, /^\/assets\/app-\w+\.js$/, /^\/assets\/be-vietnam-pro-vietnamese-400-\w+\.woff2$/]) expect(kept.some((x) => re.test(x)), String(re)).toBe(true);

  await context.setOffline(true);
  const fromSw = [];
  page.on('response', (r) => { if (new URL(r.url()).pathname.startsWith('/assets/')) fromSw.push(r.fromServiceWorker()); });
  const res = await page.reload();
  expect(res?.fromServiceWorker(), 'trang phải do service worker trả khi mất mạng').toBe(true);
  await booted(page);
  expect(fromSw.length, 'tệp /assets/ nạp lại khi mất mạng').toBeGreaterThanOrEqual(2);
  expect(fromSw.every(Boolean), 'mọi tệp /assets/ do service worker trả').toBe(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  // thời thiền chạy (âm thanh sinh tại chỗ, không cần mạng)
  const t = await page.evaluate(async () => { const P = window.__app.player; await P.play(); await new Promise((r) => setTimeout(r, 3000)); const x = P.time; P.pause(); return x; });
  expect(t).toBeGreaterThan(1);
  await context.setOffline(false);
});

test('hành trình được chép sang IndexedDB và khôi phục khi localStorage bị xóa', async ({ page }) => {
  test.setTimeout(480_000); // 4 lần dựng cảnh WebGL bằng CPU; mức chất lượng 0 để khung hình nhẹ, IndexedDB trả lời sớm hơn
  await page.goto(BASE + '#q=0&snap=1');
  await booted(page);
  // giả lập hành trình đang có: đặt Tịnh danh và ngày 7 vào localStorage, tải lại để state.js đọc
  await page.evaluate(() => { const k = 'vandao.v1'; const s = JSON.parse(localStorage.getItem(k)); s.name = 'Tâm An'; s.day = 7; localStorage.setItem(k, JSON.stringify(s)); });
  await page.reload();
  await booted(page);
  expect(await page.evaluate(() => window.__app.stateReady)).toBe('mirrored');
  const inIdb = await page.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('vandao'); r.onsuccess = () => { const q = r.result.transaction('state').objectStore('state').get('vandao.v1'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }));
  expect(inIdb).toMatchObject({ name: 'Tâm An', day: 7 });
  expect(await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('vandao'); r.onsuccess = () => res([...r.result.objectStoreNames].sort()); }))).toEqual(expect.arrayContaining(['meta', 'outbox', 'state']));   // lược đồ v2 (net/idb.js) thêm store, vẫn phải giữ ba store này

  // xóa localStorage (như người dùng dọn trình duyệt một phần) → tải lại → tự khôi phục từ IndexedDB
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  // ứng dụng tự tải lại thêm một lần sau khi chép bản IndexedDB về localStorage, nên lần tải này có thể bị cắt ngang
  await page.reload({ waitUntil: 'commit' }).catch(() => {});
  // hai lần dựng cảnh liền nhau (bản rỗng → tải lại → bản khôi phục); runner CI chậm gấp vài lần máy dev nên chờ tới 3 phút
  await page.waitForFunction(() => window.__app?.state?.().name === 'Tâm An', null, { timeout: 180_000 });
  expect(await page.evaluate(() => ({ name: window.__app.state().name, day: window.__app.state().day }))).toEqual({ name: 'Tâm An', day: 7 });
});

test('nhắc Web Push (#106 §6): SW hiện câu đã biên tập theo kind, loại lạ thì không hiện; #view=board và #zone=pad mở đúng khu', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'gửi push giả qua CDP chỉ có ở Chromium');
  test.setTimeout(240_000);
  const origin = new URL(BASE).origin;
  await context.grantPermissions(['notifications'], { origin });
  await page.goto(BASE + '#q=0&snap=1');
  await booted(page);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })); });
  const cdp = await context.newCDPSession(page);
  const regs = new Promise((r) => cdp.on('ServiceWorker.workerRegistrationUpdated', (e) => { const x = e.registrations.find((g) => g.scopeURL.startsWith(origin) && !g.isDeleted); if (x) r(x.registrationId); }));
  await cdp.send('ServiceWorker.enable');
  const registrationId = await regs;
  const notes = () => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => ({ title: n.title, body: n.body, tag: n.tag })));
  await cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId, data: JSON.stringify({ v: 1, kind: 'la', at: 0 }) });
  await cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId, data: JSON.stringify({ v: 1, kind: 'thien', at: 0 }) });
  await expect.poll(notes, { timeout: 15_000 }).toEqual([{ title: 'Vân Đạo', body: 'Đến giờ ngồi thiền đã hẹn. Mời bạn về Đài Thiền.', tag: 'thien' }]);
  await cdp.send('ServiceWorker.deliverPushMessage', { origin, registrationId, data: JSON.stringify({ v: 1, kind: 'thien', at: 1 }) });
  await page.waitForTimeout(500);
  expect(await notes()).toHaveLength(1);   // cùng kind thay thông báo cũ (tag)

  // Địa chỉ mà notificationclick mở: đọc một lần rồi bỏ khỏi địa chỉ, giữ các tham số khác
  await page.evaluate(() => { location.hash = '#q=0&snap=1&view=board'; });
  await expect.poll(() => page.evaluate(() => window.__app.U.view)).toBe('board');
  expect(new URL(page.url()).hash).toBe('#q=0&snap=1');
  await page.goto(BASE + '#q=0&snap=1&zone=pad');
  await booted(page);
  await expect.poll(() => page.evaluate(() => [window.__app.U.view, window.__app.U.zone])).toEqual(['zone', 'pad']);
});

import { test, expect } from '@playwright/test';

// T1.1: PWA offline + IndexedDB. Chạy trên máy chủ http (cục bộ: tests/e2e/serve.mjs; CI preview/staging/production: E2E_BASE_URL).
const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');

const booted = (page) => page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 60_000 });

test('tắt mạng vẫn mở được ứng dụng và chạy thời thiền', async ({ page, context }) => {
  test.setTimeout(240_000);
  await page.goto(BASE + '#snap=1');
  await booted(page);
  // chờ service worker kiểm soát trang và lưu xong bộ đệm
  await page.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })); });
  expect(await page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith('vandao-')))).toBe(true);

  await context.setOffline(true);
  const res = await page.reload();
  expect(res?.fromServiceWorker(), 'trang phải do service worker trả khi mất mạng').toBe(true);
  await booted(page);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  // thời thiền chạy (âm thanh sinh tại chỗ, không cần mạng)
  const t = await page.evaluate(async () => { const P = window.__app.player; await P.play(); await new Promise((r) => setTimeout(r, 3000)); const x = P.time; P.pause(); return x; });
  expect(t).toBeGreaterThan(1);
  await context.setOffline(false);
});

test('hành trình được chép sang IndexedDB và khôi phục khi localStorage bị xóa', async ({ page }) => {
  test.setTimeout(300_000); // 3 lần dựng cảnh WebGL bằng CPU
  await page.goto(BASE + '#snap=1');
  await booted(page);
  // giả lập hành trình đang có: đặt Tịnh danh và ngày 7 vào localStorage, tải lại để state.js đọc
  await page.evaluate(() => { const k = 'vandao.v1'; const s = JSON.parse(localStorage.getItem(k)); s.name = 'Tâm An'; s.day = 7; localStorage.setItem(k, JSON.stringify(s)); });
  await page.reload();
  await booted(page);
  expect(await page.evaluate(() => window.__app.stateReady)).toBe('mirrored');
  const inIdb = await page.evaluate(() => new Promise((res, rej) => { const r = indexedDB.open('vandao'); r.onsuccess = () => { const q = r.result.transaction('state').objectStore('state').get('vandao.v1'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }; r.onerror = () => rej(r.error); }));
  expect(inIdb).toMatchObject({ name: 'Tâm An', day: 7 });
  expect(await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('vandao'); r.onsuccess = () => res([...r.result.objectStoreNames].sort()); }))).toEqual(['meta', 'outbox', 'state']);

  // xóa localStorage (như người dùng dọn trình duyệt một phần) → tải lại → tự khôi phục từ IndexedDB
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  // ứng dụng tự tải lại thêm một lần sau khi chép bản IndexedDB về localStorage, nên lần tải này có thể bị cắt ngang
  await page.reload({ waitUntil: 'commit' }).catch(() => {});
  await page.waitForFunction(() => window.__app?.state?.().name === 'Tâm An', null, { timeout: 60_000 });
  expect(await page.evaluate(() => ({ name: window.__app.state().name, day: window.__app.state().day }))).toEqual({ name: 'Tâm An', day: 7 });
});

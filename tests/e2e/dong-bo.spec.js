// #93: đồng bộ Giữ giới, Hạnh của tuần, Nguyện tuần giữa hai thiết bị của cùng một tài khoản.
// Máy chủ giả lập dùng chung cho hai "máy" (hai context trình duyệt), làm đúng hợp đồng #94: thao tác `practice.event`,
// `journey.rev` tăng sau mỗi sự kiện, `/me?entries=1` trả `events`, báo `practice: 1` khi đã hỗ trợ.
import { test, expect } from '@playwright/test';
import { checkPracticeEvent, foldPractice } from '../../packages/shared/src/practice.js';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');
const slow = expect.configure({ timeout: 60_000 });

const NAMES = ['Bảo vệ sự sống', 'Tôn trọng của người', 'Thủy chung và tôn trọng', 'Lời thật, lời lành', 'Tỉnh thức khi tiêu thụ'];
const item = (id, title, body, meta) => ({ id, version: 1, kind: 'nhiem_vu', tier: 0, lang: 'vi', title, body_inline: body, source_ref: 'Vân Đạo tự biên soạn',
  meta: JSON.stringify({ money: false, at_home: true, outdoors: false, needs_others: false, scope: 'doi_thuc', punna: 'sila', minutes: 2, gioi: null, tuan: null, ...meta }) });
const ITEMS = [
  ...NAMES.flatMap((n, i) => [1, 2, 3, 4].map((k) => item(`sn-gioi-${i + 1}-0${k}`, n, `Việc giới ${i + 1} số ${k}.`, { nhom: 'gioi', gioi: i + 1, parami: ['sila', 'metta'] }))),
  ...['viriya', 'metta'].flatMap((p) => [1, 2, 3, 4].map((k) => item(`sn-hanh-${p}-0${k}`, 'Hạnh', `Việc hạnh ${p} số ${k}.`, { nhom: 'hanh', parami: [p], punna: 'bhavana' }))),
  item('sn-nguyen-tuan-1', 'Nguyện tuần 1', 'Khi vừa thức dậy thì tôi ngồi thở mười phút.', { nhom: 'nguyen', tuan: 1, parami: ['viriya', 'metta'] }),
];
const LOOK = { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' };
const ymd = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

/** Máy chủ giả lập dùng chung cho mọi "máy" của bài kiểm thử */
function fakeServer({ practice = true } = {}) {
  const sv = { practice, ops: [], events: [], seen: new Set(),
    journey: { program: 'so-nhap-49', cycle: 1, day: 1, started_on: ymd(), last_done_on: null, completed_at: null, sacca_count: 0, sessions_done: 0, sermons_done: 0, rev: 1 },
    profile: { tinh_danh: 'Tuệ Thái', tag: '5696', look: LOOK, settings: {}, island: {}, tz: 'Asia/Ho_Chi_Minh', visibility: 'dong_tu', pref_seat: null, rev: 3 } };
  const totals = { duc: 0, thien: 0, tue: 0, all: 0 }, cap = () => (sv.practice ? { practice: 1 } : {});
  const state = () => ({ profile: sv.profile, journey: { ...sv.journey }, totals, unlocked_zones: {}, server_now: Date.now(), ...cap() });
  sv.handle = async (route) => {
    const req = route.request(), u = new URL(req.url()), p = u.pathname, json = (b, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (p === '/api/v1/content') return json({ items: u.searchParams.get('kind') === 'nhiem_vu' ? ITEMS : [] });
    if (p === '/api/v1/me') return json({ user: { id: 'u-tue-thai', isAnonymous: false }, ...state(), guest_purge_after: null, ...(u.searchParams.get('entries') ? { entries: [], ...(sv.practice ? { events: [...sv.events] } : {}) } : {}) });
    if (p === '/api/v1/sync') {
      const body = req.postDataJSON(), applied = [], rejected = [];
      for (const op of body.ops || []) {
        sv.ops.push(op);
        if (sv.seen.has(op.id)) { applied.push(op.id); continue; }
        if (op.type === 'practice.event') {
          if (!sv.practice) { rejected.push({ id: op.id, code: 'unknown_op', retry: false }); continue; }
          const c = checkPracticeEvent(op.payload); if (!c.ok) { rejected.push({ id: op.id, code: c.code, retry: false }); continue; }
          sv.events.push({ id: op.id, date: c.ev.date, kind: c.ev.kind, slot: c.ev.slot, value: c.ev.value, at: c.ev.at ?? op.at });
        }
        sv.seen.add(op.id); sv.journey.rev += 1; applied.push(op.id);
      }
      return json({ applied, rejected, state: state() });
    }
    if (p === '/api/v1/profile') return json({ success: true, profile: sv.profile });
    if (p.startsWith('/api/')) return json({ error: { code: 'not_found', message: 'không có' } }, 404);
    return route.continue();
  };
  return sv;
}

/** Một "máy" đã «Giữ hành trình» của tài khoản Tuệ Thái · 5696, ngày 1 */
async function device(browser, sv, viewport) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await ctx.route('**/api/**', (r) => sv.handle(r));
  await ctx.addInitScript(({ LOOK }) => {
    if (localStorage.getItem('vandao.seeded')) return; localStorage.setItem('vandao.seeded', '1');
    localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day: 1, lastDate: null, done: {}, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: 'Tuệ Thái', look: LOOK }));
    localStorage.setItem('vandao.acct', JSON.stringify({ uid: 'u-tue-thai', guest: false, cycle: 1 }));
  }, { LOOK });
  const page = await ctx.newPage();
  page.errs = []; page.on('pageerror', (e) => page.errs.push(e.message));   // kéo bản mới giữa lúc nhân vật đang đi tới Bia không được làm lỗi cảnh
  await page.goto(BASE + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  return page;
}
const park = (page, on = true) => page.evaluate((on) => { if (on) Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); else delete document.hidden; }, on);
const P = (page) => page.locator('#panel');
const openBia = async (page) => { await page.locator('#panel [data-act="board"]').first().click(); if (await page.evaluate(() => document.body.classList.contains('pmin'))) await P(page).locator('[data-act="pmin"]').click(); await slow(P(page)).toContainText('Giữ giới hôm nay'); };
const gioiIds = (page) => P(page).locator('button.gioi[data-act="nv-gioi"]').evaluateAll((els) => els.map((e) => e.dataset.id));
const viec = (page) => page.evaluate(() => window.__app.state().viec);
/** SHOTS=thư-mục: lưu ảnh Bia để xem bằng mắt (không bắt buộc) */
const shot = (page, name) => (process.env.SHOTS ? page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }) : null);

test('điện thoại chọn giới, hạnh, nguyện → máy tính mở Bia thấy ngay; máy tính đổi → điện thoại thấy khi quay lại', async ({ browser }) => {
  test.setTimeout(420_000);
  const sv = fakeServer(), t = ymd();
  const A = await device(browser, sv, { width: 390, height: 760 });   // điện thoại
  await slow.poll(() => A.evaluate(() => JSON.parse(localStorage.getItem('vandao.acct') || '{}').practice)).toBe(true);
  await openBia(A);
  await expect(P(A).locator('.hom-nay')).toContainText('Hôm nay còn:');
  await expect(P(A).locator('.hom-nay')).toContainText('5 giới chưa ghi nhận');
  await P(A).locator('button.gioi[data-g="1"]').click();
  await P(A).locator('button.gioi[data-g="3"]').click();
  await P(A).locator('button.hanh').first().click();
  await P(A).locator('[data-act="nv-hanh-done"]').click();
  await P(A).locator('[data-act="nv-nguyen-vow"]').click();
  await expect(P(A).locator('.hom-nay')).toContainText('3 giới chưa ghi nhận');
  // mọi thao tác lên máy chủ (gửi ngay khi có mạng), không còn gì chờ
  await slow.poll(() => sv.events.length).toBe(5);
  const fA = foldPractice(sv.events);
  expect(Object.keys(fA.viec[t].gioi).sort()).toEqual(['1', '3']);
  expect(fA.viec[t].hanh.done).toBe(true);
  expect(fA.nguyen[1].id).toBe('sn-nguyen-tuan-1');
  const idsA = await gioiIds(A);
  await park(A);

  const B = await device(browser, sv, { width: 1280, height: 760 });   // máy tính
  await openBia(B);
  // cùng tài khoản → cùng gợi ý; mở Bia là kéo bản mới nhất
  expect(await gioiIds(B)).toEqual(idsA);
  await slow(P(B).locator('button.gioi[data-g="1"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(P(B).locator('button.gioi[data-g="3"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(P(B).locator('button.gioi[data-g="2"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(P(B).locator('.hanh-done')).toContainText('✓ Đã làm:');
  await expect(P(B).locator('[data-act="nv-nguyen-keep"]')).toBeVisible();
  await expect(P(B).locator('.hom-nay')).toContainText('Đã đồng bộ lúc');
  await shot(B, 'dong-bo-may-tinh');
  expect(await viec(B)).toEqual(await viec(A));
  // máy tính giữ thêm giới 2 và giữ nguyện hôm nay
  await P(B).locator('button.gioi[data-g="2"]').click();
  await P(B).locator('[data-act="nv-nguyen-keep"]').click();
  await slow.poll(() => sv.events.length).toBe(7);
  await park(B);

  // điện thoại quay lại (cửa sổ được chọn lại): tự kéo bản mới, không cần tải lại trang
  await park(A, false);
  await A.waitForTimeout(4500);
  await A.evaluate(() => window.dispatchEvent(new Event('focus')));
  await slow(P(A).locator('button.gioi[data-g="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(P(A).locator('[data-act="nv-nguyen-keep"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(P(A).locator('.hom-nay')).toContainText('2 giới chưa ghi nhận');
  await P(A).locator('.hom-nay').evaluate((e) => e.scrollIntoView({ block: 'start' })); await shot(A, 'dong-bo-dien-thoai');
  expect(await viec(A)).toEqual(await viec(B));
  // Kusala không bị đụng; không lỗi trang nào trên cả hai máy
  expect(await A.evaluate(() => window.__app.state().done)).toEqual({});
  expect([...A.errs, ...B.errs]).toEqual([]);
  await A.context().close(); await B.context().close();
});

test('máy chủ cũ chưa nhận sổ việc: không gửi, việc giữ trên máy; máy chủ cập nhật thì đưa cả sổ lên đúng một lần', async ({ browser }) => {
  test.setTimeout(300_000);
  const sv = fakeServer({ practice: false }), t = ymd();
  const A = await device(browser, sv, { width: 390, height: 760 });
  await openBia(A);
  await expect(P(A).locator('.hom-nay')).toContainText('sẽ đồng bộ khi máy chủ cập nhật');
  await P(A).locator('button.gioi[data-g="4"]').click();
  await P(A).locator('button.hanh').nth(1).click();
  await A.waitForTimeout(1500);
  expect(sv.ops.filter((o) => o.type === 'practice.event')).toHaveLength(0);
  expect(Object.keys((await viec(A))[t].gioi)).toEqual(['4']);
  // máy chủ được cập nhật (#94): lần đồng bộ kế tiếp đưa sổ trên máy lên bằng mã cố định
  sv.practice = true;
  await A.waitForTimeout(4500);
  await A.evaluate(() => window.dispatchEvent(new Event('focus')));
  await slow.poll(() => sv.events.length).toBe(2);
  expect(sv.events.every((e) => e.id.startsWith('imp.'))).toBe(true);
  expect(foldPractice(sv.events).viec[t]).toEqual((await viec(A))[t]);
  // tải lại trang: không đưa lên lần nữa, sổ vẫn nguyên
  await A.reload(); await A.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await openBia(A);
  await slow(P(A).locator('button.gioi[data-g="4"]')).toHaveAttribute('aria-pressed', 'true');
  await A.waitForTimeout(2000);
  expect(sv.events).toHaveLength(2);
  expect(A.errs).toEqual([]);
  await A.context().close();
});

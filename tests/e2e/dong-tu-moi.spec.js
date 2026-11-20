// #151 (phần không cần API mới): chia sẻ mã mời lên Facebook / sao chép trên máy tính và điện thoại, liên kết dạng /?ban=,
// điều kiện «tạo và lưu nhân vật trước khi mời», danh sách có tên và ID, «Xem nhanh» tiến trình bạn, các kiểu mời theo canMeet.
import { test, expect } from '@playwright/test';
import { BASE, slow, fakeServer, device, P, openList } from './dong-tu-fake.js';

test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');
/** Bắt window.open thay vì mở cửa sổ thật */
const SHOTS = !!process.env.DT_SHOTS;   // DT_SHOTS=1: lưu ảnh để xem bằng mắt (không chạy trong CI)
const catchOpen = (page) => page.evaluate(() => { window.__opened = []; window.open = (u, n, f) => { window.__opened.push([u, n, f]); return null; }; });

for (const [name, vp] of [['máy tính', { width: 1280, height: 800 }], ['điện thoại', { width: 390, height: 760 }]]) {
  test(`${name}: mã mời, Sao chép (kèm tiến trình) và Facebook dùng liên kết /?ban=`, async ({ browser }) => {
    test.setTimeout(240_000);
    const sv = fakeServer(31);
    const A = await device(browser, sv, 'a', vp, 31);
    await A.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
    await slow(A.locator('#dt')).toBeVisible();
    await openList(A);
    await P(A).locator('[data-act="dt-tab"][data-v="moi"]').click();
    await slow(P(A).locator('[data-dt-code]')).toHaveText('K7M2-QX9A');
    const url = new URL(BASE).origin + '/?ban=K7M2QX9A';
    await P(A).locator('[data-act="dt-copy"]').click();
    await slow(P(A)).toContainText('Đã chép lời mời.');
    expect(await A.evaluate(() => navigator.clipboard.readText())).toBe(`Mời bạn cùng tu tập với mình trên Vân Đạo: ${url}`);
    await P(A).locator('[data-dt="kem"]').check();
    await P(A).locator('[data-act="dt-copy"]').click();
    await slow.poll(() => A.evaluate(() => navigator.clipboard.readText())).toBe(`Mình đang ở ngày 31 của hành trình 49 ngày trên Vân Đạo. Mời bạn cùng tu tập với mình trên Vân Đạo: ${url}`);
    await catchOpen(A);
    await P(A).locator('[data-act="dt-fb"]').click();
    const [[u, n, f]] = await A.evaluate(() => window.__opened);
    expect(u).toBe('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(url));
    if (vp.width > 820) { expect(n).toBe('vandao-fb'); expect(f).toContain('width=600'); } else expect(n).toBe('_blank');
    // Facebook đọc thẻ xem trước chung của trang (không theo mã, hợp đồng §12)
    await expect(A.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Mời bạn tu cùng trên Vân Đạo');
    await expect(P(A).locator('[data-act="dt-fb"]')).toBeInViewport();
    if (SHOTS) await A.screenshot({ path: `/tmp/moi-${vp.width}.png` });
    expect(A.errs).toEqual([]);
  });
}

test('mở liên kết /?ban=MÃ (dạng chia sẻ Facebook): ứng dụng đổi về #ban= và kết nối hai bạn', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer();
  sv.links.K7M2QX9A = { code: 'K7M2QX9A', owner: sv.U.a.id, uses_left: 5, expires_at: Date.now() + 86_400_000 };
  const B = await device(browser, sv, 'b', { width: 390, height: 760 });
  await B.goto(BASE + '?ban=K7M2QX9A#q=0&snap=1');
  await B.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await slow(B.locator('#toast')).toContainText('Đã kết nối đồng tu với Tuệ Thái · 5696');
  expect(new URL(B.url()).search).toBe('');
  expect(sv.pairs).toHaveLength(1);
});

test('chưa tạo nhân vật: không mời, không tìm được; nhận lời mời của người khác vẫn được', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer();
  sv.blank.add(sv.U.b.id);
  const B = await device(browser, sv, 'b', { width: 1280, height: 800 });
  await slow(B.locator('#dt')).toBeVisible();
  await openList(B);
  await slow(P(B)).toContainText('Hãy tạo nhân vật trước khi mời bạn.');
  await expect(P(B).locator('[data-act="dt-tab"][data-v="moi"]')).toBeDisabled();
  await expect(P(B).locator('[data-act="dt-tab"][data-v="tim"]')).toBeDisabled();
  await expect(P(B).locator('[data-act="dt-creator"]')).toBeVisible();
  if (SHOTS) await B.screenshot({ path: '/tmp/moi-gate.png' });
  expect(Object.keys(sv.links)).toHaveLength(0);   // không gọi tạo mã
  // Người khác mời: vẫn kết nối được
  sv.links.K7M2QX9A = { code: 'K7M2QX9A', owner: sv.U.a.id, uses_left: 5, expires_at: Date.now() + 86_400_000 };
  await B.evaluate(() => { location.hash = '#ban=K7M2QX9A'; });
  await slow(B.locator('#toast')).toContainText('Đã kết nối đồng tu với Tuệ Thái · 5696');
  await P(B).locator('[data-act="dt-creator"]').click();
  await slow(P(B).locator('h2')).toHaveText('Nhân vật của bạn');
  expect(B.errs).toEqual([]);
});

test('danh sách: tên và ID, Xem nhanh (ngày, phân khu đã mở, cổng), các kiểu mời theo điều kiện chương trình', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(30), { a, b } = sv.U;
  sv.pairs.push({ a: b.id, b: a.id, sa: { than: false, away: false }, sb: { than: false, away: false }, at: Date.now() - 86_400_000 });
  sv.days[b.id] = 30; sv.island[b.id] = { open: true }; sv.presence[b.id] = { state: 'online', updated_at: Date.now() };
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 30);
  await slow(A.locator('#dt')).toBeVisible();
  await openList(A);
  const row = P(A).locator('.dtf', { has: A.locator('.dtid') }).first();
  await slow(row).toContainText('Minh An');
  await expect(row.locator('.dtid')).toHaveText('ID 2210');
  await row.locator('[data-act="dt-peek"]').click();
  const pk = P(A).locator('.dtpk');
  await expect(pk).toContainText('Ngày 30 của hành trình 49 ngày.');
  await expect(pk).toContainText('Trà Đạo Tỉnh Thức');
  await expect(pk).toContainText('Cổng Vân Môn (mở nửa)');
  await expect(pk).toContainText('Cổng Vân Môn: Nghênh khách.');
  await expect(pk).not.toContainText('Kusala');
  if (SHOTS) await A.screenshot({ path: '/tmp/moi-peek.png' });
  // Chi tiết: kiểu mời. Đại Thiền Đường mời được; gặp trên Vân Đảo cần cổng mình mở (ngày 30 → mở nửa) và chủ Nghênh khách
  await P(A).locator('.dtn[data-act="dt-ban"]').first().click();
  await slow(P(A).locator('h2')).toHaveText('Minh An');
  await expect(P(A)).toContainText('ID 2210');
  const k = (label) => P(A).locator('.dtk', { hasText: label });
  await expect(k('Cùng ngồi thiền ở Đại Thiền Đường').locator('button')).toBeEnabled();
  await expect(k('Xin sang thăm Vân Đảo bạn')).toContainText('Sắp có (#125).');      // mình ngày 30 (cổng mở nửa), bạn Nghênh khách
  await expect(k('Thiền tọa trên Vân Đảo của mình')).toContainText('Cổng Vân Môn của chủ đảo đang ở chế độ Độc cư.');   // cổng mình Độc cư
  await expect(k('Mời Vân Mây sang thăm').locator('button')).toBeDisabled();
  if (SHOTS) await A.screenshot({ path: '/tmp/moi-kinds.png' });
  await k('Cùng ngồi thiền ở Đại Thiền Đường').locator('button').click();
  await slow.poll(() => sv.invites.map((i) => `${i.kind}@${i.place}`)).toEqual(['thien@dtd']);
  expect(A.errs).toEqual([]);
});

/** Cho một đường dẫn API chờ đến khi gọi hàm trả về (máy chủ chậm) */
const holdApi = (sv, path) => { let go; sv.hold[path] = new Promise((r) => { go = r; }); return () => { delete sv.hold[path]; go(); }; };

test('hồ sơ máy chủ tải chậm: nút mời khóa đến khi nhận Tịnh danh và hình dáng đã lưu của đúng tài khoản', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(), { a, b } = sv.U;
  sv.pairs.push({ a: b.id, b: a.id, sa: { than: false, away: false }, sb: { than: false, away: false }, at: Date.now() - 86_400_000 });
  sv.presence[b.id] = { state: 'online', updated_at: Date.now() };
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 });
  await slow(A.locator('#dt')).toBeVisible();
  const release = holdApi(sv, '/api/v1/me');
  await openList(A);
  const moi = P(A).locator('[data-act="dt-tab"][data-v="moi"]');
  await slow(P(A)).toContainText('Đang kiểm tra nhân vật đã lưu…');
  await slow(P(A)).toContainText('Minh An');
  await expect(moi).toBeDisabled();
  await expect(P(A).locator('[data-act="dt-tab"][data-v="tim"]')).toBeDisabled();
  await expect(P(A).getByRole('button', { name: 'Mời cùng ngồi thiền' })).toBeDisabled();
  expect(Object.keys(sv.links)).toHaveLength(0);
  release();
  await slow(moi).toBeEnabled();
  await expect(P(A)).not.toContainText('Đang kiểm tra nhân vật đã lưu…');
  await expect(P(A).getByRole('button', { name: 'Mời cùng ngồi thiền' })).toBeEnabled();
  await moi.click();
  await slow(P(A).locator('[data-dt-code]')).toHaveText('K7M2-QX9A');
  expect(A.errs).toEqual([]);
});

test('hồ sơ máy chủ có Tịnh danh nhưng chưa có hình dáng: «Lưu nhân vật» chờ chính yêu cầu ghi rồi mới mở nút mời', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(), { a } = sv.U;
  sv.noLook.add(a.id);
  const A = await device(browser, sv, 'a', { width: 390, height: 760 });
  await slow(A.locator('#dt')).toBeVisible();
  await openList(A);
  const moi = P(A).locator('[data-act="dt-tab"][data-v="moi"]');
  await slow(P(A)).toContainText('Nhân vật chưa lưu lên máy chủ.');
  await expect(moi).toBeDisabled();
  const release = holdApi(sv, '/api/v1/profile');
  await P(A).locator('[data-act="dt-save"]').click();
  await slow(P(A)).toContainText('Đang lưu nhân vật…');
  await expect(moi).toBeDisabled();   // chưa có phản hồi ghi hồ sơ thì chưa mở
  release();
  await slow(moi).toBeEnabled();
  const saved = sv.profiles.find((x) => x.look);
  expect(saved.tinh_danh).toBe(a.tinh_danh);
  expect(Object.keys(saved.look).length).toBeGreaterThan(0);
  await moi.click();
  await slow(P(A).locator('[data-dt-code]')).toHaveText('K7M2-QX9A');
  expect(A.errs).toEqual([]);
});

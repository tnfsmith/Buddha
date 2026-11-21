// #151 (phần không cần API mới): chia sẻ mã mời lên Facebook / sao chép trên máy tính và điện thoại, liên kết dạng /moi/MÃ (#160, hợp đồng §12) và /?ban= cũ,
// điều kiện «tạo và lưu nhân vật trước khi mời», danh sách có tên và ID, «Xem nhanh» tiến trình bạn, các kiểu mời theo canMeet.
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';
import { BASE, slow, fakeServer, device, P, openList } from './dong-tu-fake.js';

closeContextsAfterEach();
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');
/** Bắt window.open thay vì mở cửa sổ thật */
const SHOTS = !!process.env.DT_SHOTS;   // DT_SHOTS=1: lưu ảnh để xem bằng mắt (không chạy trong CI)
const catchOpen = (page) => page.evaluate(() => { window.__opened = []; window.open = (u, n, f) => { window.__opened.push([u, n, f]); return null; }; });

for (const [name, vp] of [['máy tính', { width: 1280, height: 800 }], ['điện thoại', { width: 390, height: 760 }]]) {
  test(`${name}: mã mời, Sao chép (kèm tiến trình) và Facebook dùng liên kết /moi/MÃ, ?d=1 khi kèm tiến trình`, async ({ browser }) => {
    test.setTimeout(240_000);
    const sv = fakeServer(31);
    const A = await device(browser, sv, 'a', vp, 31);
    await A.context().grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
    await slow(A.locator('#dt')).toBeVisible();
    await openList(A);
    await P(A).locator('[data-act="dt-tab"][data-v="moi"]').click();
    await slow(P(A).locator('[data-dt-code]')).toHaveText('K7M2-QX9A');
    const url = new URL(BASE).origin + '/moi/K7M2QX9A', urlD = url + '?d=1';
    await expect(P(A)).toContainText('Ai có liên kết cũng thấy Tịnh danh · mã của bạn trên thẻ xem trước.');
    await expect(P(A).locator('[data-dt="kem"]')).not.toBeChecked();   // «Kèm tiến trình» tắt mặc định (§12)
    await P(A).locator('[data-act="dt-copy"]').click();
    await slow(P(A)).toContainText('Đã chép lời mời.');
    expect(await A.evaluate(() => navigator.clipboard.readText())).toBe(`Mời bạn cùng tu tập với mình trên Vân Đạo: ${url}`);
    await P(A).locator('[data-dt="kem"]').check();
    await P(A).locator('[data-act="dt-copy"]').click();
    await slow.poll(() => A.evaluate(() => navigator.clipboard.readText())).toBe(`Mình đang ở ngày 31 của hành trình 49 ngày trên Vân Đạo. Mời bạn cùng tu tập với mình trên Vân Đạo: ${urlD}`);
    await catchOpen(A);
    await P(A).locator('[data-act="dt-fb"]').click();
    const [[u, n, f]] = await A.evaluate(() => window.__opened);
    expect(u).toBe('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(urlD));
    if (vp.width > 820) { expect(n).toBe('vandao-fb'); expect(f).toContain('width=600'); } else expect(n).toBe('_blank');
    // Facebook đọc thẻ xem trước chung của trang (không theo mã, hợp đồng §12)
    await expect(A.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Mời bạn tu cùng trên Vân Đạo');
    await expect(P(A).locator('[data-act="dt-fb"]')).toBeInViewport();
    if (SHOTS) await A.screenshot({ path: `/tmp/moi-${vp.width}.png` });
    expect(A.errs).toEqual([]);
  });
}

for (const [form, path] of [['/moi/MÃ?d=1 (liên kết mới, §12)', 'moi/K7M2QX9A?d=1'], ['/?ban=MÃ (dạng cũ)', '?ban=K7M2QX9A']]) {
  test(`mở liên kết ${form}: ứng dụng về trang gốc, đổi sang #ban= và kết nối hai bạn`, async ({ browser }) => {
    test.setTimeout(240_000);
    const sv = fakeServer();
    sv.links.K7M2QX9A = { code: 'K7M2QX9A', owner: sv.U.a.id, uses_left: 5, expires_at: Date.now() + 86_400_000 };
    const B = await device(browser, sv, 'b', { width: 390, height: 760 });
    await B.goto(BASE + path + '#q=0&snap=1');
    await B.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
    await slow(B.locator('#toast')).toContainText('Đã kết nối đồng tu với Tuệ Thái · 5696');
    const u = new URL(B.url());
    expect([u.pathname, u.search]).toEqual([new URL(BASE).pathname, '']);
    expect(sv.pairs).toHaveLength(1);
    expect(B.errs).toEqual([]);
  });
}

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

test('Xem nhanh tiến trình (§10.2): bạn bật chia sẻ thì thấy số thời thiền, bài giảng, lần tu gần nhất; chưa bật thì báo; bật chia sẻ của mình chỉ gửi đúng một khóa', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(10), { a, b } = sv.U;
  sv.pairs.push({ a: b.id, b: a.id, sa: { than: false, away: false }, sb: { than: false, away: false }, at: Date.now() - 86_400_000 });
  sv.days[b.id] = 10;
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 10);
  await slow(A.locator('#dt')).toBeVisible();
  await openList(A);
  const row = P(A).locator('.dtf', { has: A.locator('.dtid') }).first();
  await slow(row).toContainText('Minh An');
  await row.locator('[data-act="dt-peek"]').click();
  const pk = P(A).locator('.dtpk');
  await slow(pk).toContainText('Bạn ấy chưa bật chia sẻ tiến trình.');
  await expect(pk).not.toContainText('thời thiền ·');
  // bạn bật chia sẻ → mở lại Xem nhanh thì tải mới
  sv.settings[b.id] = { dong_tu: { chia_se_tien_trinh: true } };
  await row.locator('[data-act="dt-peek"]').click();
  await row.locator('[data-act="dt-peek"]').click();
  await slow(pk).toContainText('Đã ngồi 12 thời thiền · đã nghe 5 bài giảng.');
  await expect(pk).toContainText('Tu tập gần nhất: hôm qua.');
  await expect(pk).not.toContainText('Kusala');
  // bạn tắt chia sẻ trong lúc lượt tải cũ (200) còn chờ: 404 mới về trước, 200 cũ về sau không được ghi đè
  let late; sv.progLag = new Promise((r) => { late = r; });
  await row.locator('[data-act="dt-peek"]').click(); await row.locator('[data-act="dt-peek"]').click();   // lượt 1: đã tính 200, về muộn
  sv.settings[b.id] = { dong_tu: { chia_se_tien_trinh: false } };
  await row.locator('[data-act="dt-peek"]').click(); await row.locator('[data-act="dt-peek"]').click();   // lượt 2: 404 ngay
  await slow(pk).toContainText('Bạn ấy chưa bật chia sẻ tiến trình.');
  late(); await A.waitForTimeout(800);
  await expect(pk).toContainText('Bạn ấy chưa bật chia sẻ tiến trình.');
  await expect(pk).not.toContainText('thời thiền ·');
  // quyền riêng tư của mình: mặc định tắt; bật thì PATCH chỉ có khóa chia_se_tien_trinh
  await P(A).locator('[data-act="dt-tab"][data-v="rieng"]').click();
  const box = P(A).locator('[data-dt="chia_se_tien_trinh"]');
  await slow(box).not.toBeChecked();
  const n0 = sv.profiles.length;
  await box.check();
  await slow.poll(() => sv.profiles.length).toBe(n0 + 1);
  expect(sv.profiles[n0]).toEqual({ settings: { dong_tu: { chia_se_tien_trinh: true } } });
  expect(sv.settings[a.id].dong_tu).toMatchObject({ chia_se_tien_trinh: true });
  await slow(box).toBeChecked();
  expect(A.errs).toEqual([]);
});

// Hành trình Sơ nhập — đợt C (#85/#91): Giữ giới hôm nay, Hạnh của tuần, Nguyện tuần, ngày trai.
// API giả lập trả danh mục kind=nhiem_vu theo hợp đồng đợt B (#87/#90).
import { test, expect } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
const slow = expect.configure({ timeout: 60_000 });
const NAMES = ['Bảo vệ sự sống', 'Tôn trọng của người', 'Thủy chung và tôn trọng', 'Lời thật, lời lành', 'Tỉnh thức khi tiêu thụ'];
const item = (id, title, body, meta) => ({ id, version: 1, kind: 'nhiem_vu', tier: 0, lang: 'vi', title, body_inline: body, source_ref: 'Vân Đạo tự biên soạn',
  meta: JSON.stringify({ money: false, at_home: true, outdoors: false, needs_others: false, scope: 'doi_thuc', punna: 'sila', minutes: 2, gioi: null, tuan: null, ...meta }) });
const ITEMS = [
  ...NAMES.flatMap((n, i) => [1, 2].map((k) => item(`sn-gioi-${i + 1}-0${k}`, n, `Việc giới ${i + 1} số ${k}.`, { nhom: 'gioi', gioi: i + 1, parami: ['sila', 'metta'], ...(i === 4 ? { safety_note: 'Nếu đang phụ thuộc, hãy giảm dần cùng nhân viên y tế.' } : {}) }))),
  ...['viriya', 'metta', 'sacca', 'khanti'].flatMap((p) => [1, 2].map((k) => item(`sn-hanh-${p}-0${k}`, 'Hạnh', `Việc hạnh ${p} số ${k}.`, { nhom: 'hanh', parami: [p], punna: 'bhavana' }))),
  item('sn-nguyen-tuan-1', 'Nguyện tuần 1', 'Khi vừa thức dậy thì tôi ngồi thở mười phút.', { nhom: 'nguyen', tuan: 1, parami: ['viriya', 'metta'] }),
  item('sn-trai-bat-quan', 'Bát quan trai', 'Ngày trai, tự nguyện chọn thực tập Bát quan trai.', { nhom: 'trai', parami: ['sila', 'nekkhamma', 'adhitthana'], gioi_trai: ['Một', 'Hai', 'Ba', 'Bốn', 'Năm', 'Sáu', 'Bảy', 'Tám'], safety_note: 'Theo hướng dẫn y tế.' }),
];
async function mock(page, items = ITEMS) {
  await page.route('**/api/v1/content**', (r) => {
    const kind = new URL(r.request().url()).searchParams.get('kind');
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: kind === 'nhiem_vu' ? items : [] }) });
  });
}
async function openBoard(page) {
  await page.goto(BASE + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.renderer, null, { timeout: 150_000 });
  await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }));
  await page.locator('#panel [data-act="board"]').first().click();
}
const P = (page) => page.locator('#panel');
const S = (page) => page.evaluate(() => window.__app.state());

test('Giữ giới, Hạnh của tuần, Nguyện tuần: tự xác nhận, sáng hoa sen, không đụng Kusala', async ({ page }) => {
  test.setTimeout(240_000);
  await page.clock.setFixedTime(new Date(2026, 10, 16, 9));   // 8/10 âm lịch: không phải ngày trai (tứ trai)
  await mock(page);
  await openBoard(page);
  await slow(P(page)).toContainText('Giữ giới hôm nay');
  await expect(P(page).locator('.trai')).toHaveCount(0);
  await expect(P(page).locator('button.gioi[data-act="nv-gioi"]')).toHaveCount(5);
  for (const n of NAMES) await expect(P(page)).toContainText(n);
  await expect(P(page).locator('.gioi-row .safety')).toContainText('nhân viên y tế');
  const before = await S(page);
  // giới 4: chạm → đã giữ; chạm lần nữa → bỏ; chạm lại → giữ
  const g4 = P(page).locator('button.gioi[data-g="4"]');
  await g4.click(); await expect(g4).toHaveAttribute('aria-pressed', 'true');
  await g4.click(); await expect(g4).toHaveAttribute('aria-pressed', 'false');
  await g4.click();
  let s = await S(page);
  expect(Object.keys(s.viec['2026-11-16'].gioi)).toEqual(['4']);
  // Hạnh của tuần 1 (Tinh tấn · Tâm từ): 3 việc, chọn 1, làm xong
  await expect(P(page)).toContainText('Hạnh của tuần: Tinh tấn · Tâm từ');
  const opts = P(page).locator('button.hanh');
  await expect(opts).toHaveCount(3);
  for (const t of await opts.allInnerTexts()) expect(t).toMatch(/hạnh (viriya|metta)/);
  await opts.nth(1).click();
  await expect(P(page).locator('button.hanh.on')).toHaveCount(1);
  await P(page).locator('[data-act="nv-hanh-done"]').click();
  await expect(P(page).locator('.hanh-done')).toContainText('✓ Đã làm:');
  await expect(P(page).locator('button.hanh')).toHaveCount(0);   // một hạnh mỗi ngày (quyết định 2)
  // Nguyện tuần: phát nguyện rồi đánh dấu đã giữ hôm nay
  await expect(P(page)).toContainText('Khi vừa thức dậy thì tôi ngồi thở mười phút.');
  await P(page).locator('[data-act="nv-nguyen-vow"]').click();
  await P(page).locator('[data-act="nv-nguyen-keep"]').click();
  await expect(P(page).locator('[data-act="nv-nguyen-keep"]')).toHaveAttribute('aria-pressed', 'true');
  s = await S(page);
  const d = s.viec['2026-11-16'];
  expect(d.hanh.done).toBe(true); expect(['viriya', 'metta']).toContain(d.hanh.parami[0]);
  expect(d.nguyen.parami).toEqual(expect.arrayContaining(['viriya', 'metta', 'adhitthana']));
  expect(s.nguyen['1'].id).toBe('sn-nguyen-tuan-1');
  // không đụng Kusala, không mở nấc ngày
  expect(s.totals).toEqual(before.totals); expect(s.done).toEqual(before.done); expect(s.day).toBe(before.day);
  // hoa sen sáng và lịch tu có ngày hôm nay
  await expect(P(page).locator('svg.lotus title', { hasText: 'Trì giới: 1 lần' })).toHaveCount(1);
  await expect(P(page).locator('.cal i.on')).toHaveCount(1);
  // mở lại trang: vẫn giữ, cùng một bộ việc (chọn tất định)
  const picked = await P(page).locator('.gioi-row p.muted').first().innerText();
  await page.goto('about:blank'); await openBoard(page);
  await slow(P(page).locator('button.gioi[data-g="4"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await P(page).locator('.gioi-row p.muted').first().innerText()).toBe(picked);
});

test('ngày trai (rằm): thẻ Bát quan trai là lời mời tự nguyện, có tám giới và lưu ý sức khỏe', async ({ page }) => {
  test.setTimeout(200_000);
  await page.clock.setFixedTime(new Date(2026, 10, 23, 9));   // 15/10 âm lịch
  await mock(page);
  await openBoard(page);
  const tr = P(page).locator('.trai');
  await slow(tr).toContainText('Hôm nay là ngày trai (15/10 âm lịch)');
  await expect(tr.locator('ol li')).toHaveCount(8);
  await expect(tr.locator('.safety')).toContainText('hướng dẫn y tế');
  await tr.locator('[data-act="nv-trai"]').click();
  await expect(tr.locator('[data-act="nv-trai"]')).toHaveText('✓ Đã tự nguyện thọ trì hôm nay');
  expect((await S(page)).viec['2026-11-23'].trai.parami).toEqual(['sila', 'nekkhamma', 'adhitthana']);
});

test('chưa có nhiệm vụ nào được phát hành: không hiện thẻ, Bia vẫn bình thường', async ({ page }) => {
  test.setTimeout(200_000);
  await mock(page, []);
  await openBoard(page);
  await slow(P(page)).toContainText('Tích lũy tu học');
  await expect(P(page)).not.toContainText('Giữ giới hôm nay');
  await expect(P(page)).not.toContainText('Hạnh của tuần');
});

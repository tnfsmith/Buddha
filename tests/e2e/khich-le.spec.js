// #151 §8 (hợp đồng docs/contracts/ban-dong-tu.md §10.3): khích lệ bằng lời mẫu, mỗi bạn mỗi ngày một lời; lời nhận trong 7 ngày,
// «mới» theo social.cheers của GET /me, đánh dấu đã xem bằng POST /cheers/seen. Không chữ tự do, không đếm, không xếp hạng.
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';
import { P, closeView, device, fakeServer, openList, relist, slow } from './dong-tu-fake.js';

closeContextsAfterEach();
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');
const pair = (sv, a, b) => sv.pairs.push({ a, b, sa: { than: false, away: false }, sb: { than: false, away: false }, at: Date.now() - 86_400_000 });
const ymd = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

test('khích lệ: lời nhận 7 ngày có «mới» rồi đánh dấu đã xem; gửi lời mẫu một lần mỗi ngày; máy chủ báo đã gửi hôm nay', async ({ browser }) => {
  test.setTimeout(300_000);
  const sv = fakeServer(12), { a, b, c } = sv.U, t = Date.now();
  pair(sv, b.id, a.id); pair(sv, b.id, c.id);
  sv.cheers.push(
    { from: a.id, to: b.id, day: ymd(t), line: 'tuy_hy', at: t - 3_600_000 },
    { from: c.id, to: b.id, day: ymd(t - 2 * 86_400_000), line: 'tien_trinh', j_day: 12, j_done: 0, at: t - 2 * 86_400_000 },
    { from: c.id, to: b.id, day: ymd(t - 9 * 86_400_000), line: 'cam_on', at: t - 9 * 86_400_000 },   // quá 7 ngày: không hiện
    { from: b.id, to: c.id, day: ymd(t), line: 'cam_on', at: t - 600_000 },   // B đã gửi C hôm nay (từ máy khác)
  );
  const B = await device(browser, sv, 'b', { width: 412, height: 860 }, 12);

  await openList(B);
  const cl = P(B).locator('h3', { hasText: 'Lời khích lệ' });
  await slow(cl).toBeVisible();
  await slow(P(B)).toContainText('«Tùy hỷ công phu của bạn.» · hôm nay · mới');
  await expect(P(B)).toContainText('«Mình đang ở ngày 12 của hành trình 49 ngày.» · 2 ngày trước · mới');
  await expect(P(B)).not.toContainText('Cảm ơn bạn đã cùng tu tập.');
  await expect.poll(() => sv.seenPosts).toEqual([t - 3_600_000]);   // đã xem tới lời mới nhất
  await relist(B);
  await slow(P(B)).toContainText('«Tùy hỷ công phu của bạn.» · hôm nay');
  await expect(P(B)).not.toContainText('· mới');

  // gửi cho A: lời tiến trình là của mình, theo ngày hành trình
  await P(B).locator(`[data-act="dt-ban"][data-id="${a.id}"]`).first().click();
  const tien = P(B).locator('[data-act="dt-cheer"][data-v="tien_trinh"]');
  await expect(tien).toHaveText('Mình đang ở ngày 12 của hành trình 49 ngày.');
  await expect(P(B).locator('[data-act="dt-cheer"]')).toHaveCount(5);
  await P(B).locator('[data-act="dt-cheer"][data-v="cung_giu"]').click();
  await slow(P(B)).toContainText('Đã gửi lời khích lệ tới Tuệ Thái · 5696.');
  await expect(P(B).locator('[data-act="dt-cheer"]')).toHaveCount(0);
  await expect(P(B)).toContainText('Hôm nay bạn đã gửi lời khích lệ cho bạn ấy.');
  expect(sv.cheerPosts).toEqual([{ to: a.id, line: 'cung_giu' }]);

  // C: máy chủ đã có lời hôm nay → 409 cheer_today, khối chuyển sang «đã gửi»
  await P(B).locator('[data-act="dt-tab"][data-v="list"]').click();
  await P(B).locator(`[data-act="dt-ban"][data-id="${c.id}"]`).first().click();
  await P(B).locator('[data-act="dt-cheer"][data-v="tuy_hy"]').click();
  await slow(P(B).locator('[role="alert"]')).toHaveText('Hôm nay bạn đã gửi lời khích lệ cho bạn ấy.');
  await expect(P(B).locator('[data-act="dt-cheer"]')).toHaveCount(0);
  expect(sv.cheers.filter((x) => x.from === b.id && x.to === c.id)).toHaveLength(1);
  expect(B.errs).toEqual([]);
});

test('chấm khích lệ theo /me: 1 → đã xem → 0 → một lời mới → 1, kể cả khi số đếm bằng số trước (review #184)', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(12), { a, b, c } = sv.U;
  pair(sv, b.id, a.id); pair(sv, b.id, c.id);
  const B = await device(browser, sv, 'b', { width: 412, height: 860 }, 12);
  const dot = B.locator('#dt .n'), poll = () => B.evaluate(() => window.dispatchEvent(new Event('online')));
  await slow(B.locator('#dt')).toBeVisible();
  // Nhịp Codex mô tả: /me báo 1, danh sách về muộn hơn GET /me của màn, nên POST /cheers/seen đi sau mọi GET /me đang chờ
  sv.cheers.push({ from: a.id, to: b.id, day: ymd(Date.now()), line: 'tuy_hy', at: Date.now() });
  sv.listLag = 8000;
  await poll();
  await expect.poll(() => dot.textContent(), { timeout: 20_000, intervals: [250] }).toBe('1');
  await openList(B);   // danh sách tải lại còn đang chờ: GET /me của màn xong trước, POST /cheers/seen đi sau
  await expect.poll(() => sv.seenPosts.length, { timeout: 20_000 }).toBe(1);
  await slow(dot).toHaveText('');
  await closeView(B); sv.listLag = 0;
  // lời mới đến trước lần /me kế: máy chủ lại báo 1 như lần trước
  sv.cheers.push({ from: c.id, to: b.id, day: ymd(Date.now()), line: 'nho_ban', at: Date.now() });
  await expect.poll(async () => { await poll(); return dot.textContent(); }, { timeout: 40_000, intervals: [4500] }).toBe('1');
  await openList(B);
  await slow(P(B)).toContainText('«Mình nhớ bạn, khi nào rảnh mình cùng ngồi một thời nhé.» · hôm nay · mới');
  await expect.poll(() => sv.seenPosts.length).toBe(2);
  expect(B.errs).toEqual([]);
});

test('chấm khích lệ: đã xem → GET /me lỗi → tự thử lại, lời mới sau đó vẫn hiện chấm (review #151)', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(12), { a, b, c } = sv.U;
  pair(sv, b.id, a.id); pair(sv, b.id, c.id);
  sv.cheers.push({ from: a.id, to: b.id, day: ymd(Date.now()), line: 'tuy_hy', at: Date.now() - 600_000 });
  const B = await device(browser, sv, 'b', { width: 412, height: 860 }, 12);
  const dot = B.locator('#dt .n'), poll = () => B.evaluate(() => window.dispatchEvent(new Event('online')));
  await slow(dot).toHaveText('1');
  sv.failMeMs = 6000;   // GET /me ngay sau «đã xem» (và mọi lần poll trong 6 giây) đều lỗi
  await openList(B);
  await expect.poll(() => sv.seenPosts.length).toBe(1);
  await slow(dot).toHaveText('');
  await closeView(B);
  await B.waitForTimeout(6500);   // hết khoảng lỗi; các lần poll của tài khoản sau đó đều thành công
  sv.cheers.push({ from: c.id, to: b.id, day: ymd(Date.now()), line: 'cung_giu', at: Date.now() });
  await expect.poll(async () => { await poll(); return dot.textContent(); }, { timeout: 45_000, intervals: [3000] }).toBe('1');
  expect(B.errs).toEqual([]);
});

test('API chưa có khích lệ (chưa có trường cheers): ẩn khối Khích lệ, không gọi route khích lệ', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(12), { a, b } = sv.U;
  pair(sv, b.id, a.id); sv.noCheersApi = true;
  const B = await device(browser, sv, 'b', { width: 412, height: 860 }, 12);
  await openList(B);
  await P(B).locator(`[data-act="dt-ban"][data-id="${a.id}"]`).first().click();
  await slow(P(B).locator('h3', { hasText: 'Xem nhanh' })).toBeVisible();
  await expect(P(B).locator('h3', { hasText: 'Khích lệ' })).toHaveCount(0);
  await expect(P(B).locator('[data-act="dt-cheer"]')).toHaveCount(0);
  sv.noCheersApi = false;
  await relist(B);
  await P(B).locator(`[data-act="dt-ban"][data-id="${a.id}"]`).first().click();
  await slow(P(B).locator('[data-act="dt-cheer"]')).toHaveCount(5);
  expect(sv.log.some((l) => l.includes('cheer'))).toBe(false);
  expect(B.errs).toEqual([]);
});

// #151 §8 (hợp đồng docs/contracts/ban-dong-tu.md §10.3): khích lệ bằng lời mẫu, mỗi bạn mỗi ngày một lời; lời nhận trong 7 ngày,
// «mới» theo social.cheers của GET /me, đánh dấu đã xem bằng POST /cheers/seen. Không chữ tự do, không đếm, không xếp hạng.
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';
import { P, device, fakeServer, openList, relist, slow } from './dong-tu-fake.js';

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

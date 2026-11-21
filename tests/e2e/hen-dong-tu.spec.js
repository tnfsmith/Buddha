// #151 §4–§5 (hợp đồng docs/contracts/ban-dong-tu.md §9): hẹn giờ đồng tu nhóm, trả lời, hủy, tệp lịch .ics, nhắc trong ứng dụng
// lúc còn 10 phút và 1 phút, tới giờ thì cùng bắt đầu trên Đài Đồng Tu. Máy chủ giả theo đúng wire §9.3 (dong-tu-fake.js).
import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';
import { M, P, closeView, device, fakeServer, openList, relist, slow } from './dong-tu-fake.js';

closeContextsAfterEach();
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');

const pair = (sv, a, b) => sv.pairs.push({ a, b, sa: { than: false, away: false }, sb: { than: false, away: false }, at: Date.now() - 86_400_000 });
const row = (page) => P(page).locator('.dts');
const pick = (page, id) => P(page).locator(`[data-dt="hen-ban"][data-id="${id}"]`);

test('hẹn giờ nhóm: chọn 2 bạn, bước 5 phút, nhận lời, tệp lịch không ghi tên, người khác từ chối, hủy hẹn; «Ngay» bỏ qua bạn vắng', async ({ browser }) => {
  test.setTimeout(420_000);
  const sv = fakeServer(), { a, b, c } = sv.U;
  pair(sv, a.id, b.id); pair(sv, a.id, c.id);
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 }), B = await device(browser, sv, 'b', { width: 412, height: 860 });

  await openList(A);
  await P(A).locator('[data-act="dt-tab"][data-v="hen"]').click();
  await expect(P(A).locator('h2')).toHaveText('Hẹn giờ đồng tu');
  await expect(P(A).locator('[data-act="dt-hen"]')).toBeDisabled();
  await pick(A, b.id).check(); await pick(A, c.id).check();
  await expect(P(A).locator('[data-act="dt-hen"]')).toHaveText('Gửi lời hẹn tới 2 bạn');

  // giờ lẻ (không phải bội 5 phút) bị chặn ở máy khách
  const [odd, at] = await A.evaluate(() => {
    const p2 = (n) => String(n).padStart(2, '0'), f = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
    const t = Math.ceil((Date.now() + 2 * 3_600_000) / 300_000) * 300_000;
    return [f(t + 3 * 60_000), f(t)];
  });
  await P(A).locator('[data-dt="hen-at"]').fill(odd);
  await P(A).locator('[data-act="dt-hen"]').click();
  await expect(P(A).locator('[role="alert"]')).toHaveText('Hãy chọn giờ theo bước 5 phút.');
  expect(sv.sessionPosts).toHaveLength(0);

  await P(A).locator('[data-dt="hen-at"]').fill(at);
  await P(A).locator('[data-act="dt-hen"]').click();
  await slow(P(A)).toContainText('Đã gửi lời hẹn');
  const post = sv.sessionPosts[0];
  expect(post.invitees).toEqual([b.id, c.id]);
  expect(post.start_at % 300_000).toBe(0);
  expect(post.start_at).toBe(await A.evaluate((s) => new Date(s).getTime(), at));
  await expect(row(A)).toContainText('Bạn chủ trì.');
  await expect(row(A)).toContainText('Minh An · 2210 · chờ trả lời');
  await expect(row(A)).toContainText('Hải Đăng · 3307 · chờ trả lời');

  // B nhận lời; chấm trên nút đếm cả lời hẹn chờ trả lời
  await openList(B);
  await slow(row(B)).toContainText('Chủ hẹn: Tuệ Thái · 5696');
  await expect(B.locator('#dt .n')).toHaveText('1');
  await row(B).locator('[data-act="dt-s-yes"]').click();
  await slow(P(B)).toContainText('Đã nhận lời hẹn');
  await slow(row(B).locator('[data-act="dt-ics"]')).toBeVisible();
  await expect(B.locator('#dt .n')).toHaveText('');
  expect(sv.sessions[0].seats.find((q) => q.id === b.id).status).toBe('nhan');

  // tệp lịch: giờ UTC đúng, nhắc trước 10 phút, CRLF, không có tên ai
  const [dl] = await Promise.all([B.waitForEvent('download'), row(B).locator('[data-act="dt-ics"]').click()]);
  expect(dl.suggestedFilename()).toMatch(/^van-dao-dong-tu-\d{8}-\d{4}\.ics$/);
  const ics = await readFile(await dl.path(), 'utf8');
  const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  expect(ics).toContain(`DTSTART:${utc(post.start_at)}\r\n`);
  expect(ics).toContain(`DTEND:${utc(post.start_at + 15 * 60_000)}\r\n`);
  expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY\r\n');
  expect(ics).toContain('TRIGGER:-PT10M\r\n');
  expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n[\s\S]*END:VCALENDAR\r\n$/);
  for (const n of ['Tuệ Thái', 'Minh An', 'Hải Đăng', '5696', '2210']) expect(ics).not.toContain(n);
  expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);

  // C từ chối (máy chủ), A thấy trạng thái ghế
  sv.sessions[0].seats.find((q) => q.id === c.id).status = 'tu_choi';
  await relist(A);
  await slow(row(A)).toContainText('Minh An · 2210 · đã nhận lời');
  await expect(row(A)).toContainText('Hải Đăng · 3307 · không tham gia');

  // A hủy (bấm hai lần), B không còn thấy hẹn
  await row(A).locator('[data-act="dt-s-cancel"]').click();
  await expect(row(A).locator('[data-act="dt-s-cancel"]')).toHaveText('Bấm lần nữa để hủy hẹn');
  await row(A).locator('[data-act="dt-s-cancel"]').click();
  await slow(P(A)).toContainText('Đã hủy hẹn.');
  await expect(row(A)).toHaveCount(0);
  expect(sv.sessions[0].status).toBe('huy');
  await relist(B);
  await expect(row(B)).toHaveCount(0);

  // «Ngay»: C không có hiện diện (vắng) thì không được mời, máy chủ trả trong skipped. C chưa tạo nhân vật: không hiện «null»
  sv.blank.add(c.id); await relist(A);
  await P(A).locator('[data-act="dt-tab"][data-v="hen"]').click();
  await pick(A, b.id).check(); await pick(A, c.id).check();
  await P(A).locator('[data-dt="hen-when"][value="ngay"]').check();
  await expect(P(A).locator('label', { hasText: 'ID 3307 (chưa đặt Tịnh danh)' })).toContainText('đang vắng, sẽ không được mời');
  await P(A).locator('[data-act="dt-hen"]').click();
  await slow(P(A)).toContainText('Đã gửi lời hẹn cùng ngồi ngay. Chưa mời ID 3307 (chưa đặt Tịnh danh) vì đang vắng.');
  await expect(P(A)).not.toContainText('null');
  expect(sv.sessionPosts[1]).toEqual({ start_at: 'ngay', invitees: [b.id, c.id] });
  expect([...A.errs, ...B.errs]).toEqual([]);
});

test('nhắc trong ứng dụng lúc còn 10 phút và 1 phút; tới giờ tự bắt đầu thời thiền trên Đài Đồng Tu với người đã nhận lời', async ({ browser }) => {
  test.setTimeout(300_000);
  const sv = fakeServer(), { a, b, c } = sv.U;
  pair(sv, a.id, b.id); pair(sv, a.id, c.id);
  // B chủ trì, A và C đã nhận lời, còn 9 phút 30 giây
  sv.sessions.push({ id: 'ss-nhac', host: b.id, start_at: Date.now() + 570_000, created_at: Date.now() - 3_600_000, status: 'hen', seats: [{ id: a.id, status: 'nhan' }, { id: c.id, status: 'nhan' }] });
  const A = await device(browser, sv, 'a', { width: 412, height: 860 });

  await slow(M(A)).toContainText('Sắp tới giờ đồng tu');
  await expect(M(A)).toContainText('bắt đầu sau 10 phút');
  await M(A).locator('[data-act="dt-hide"]').click();
  await expect(M(A)).toBeHidden();

  // còn 40 giây: thẻ mốc 1 phút hiện lại (đã ẩn ở mốc 10 phút), đếm ngược theo giây
  sv.sessions[0].start_at = Date.now() + 40_000;
  await relist(A); await closeView(A);
  await slow(M(A)).toContainText('Đến giờ, thời thiền tự bắt đầu.');
  await expect(M(A).locator('[data-act="dt-go"]')).toHaveText('Vào Đại Thiền Đường');
  const daisN = () => A.evaluate(() => { const w = window.__app.world; return w.dais ? w.daisHeads().length : 0; });
  await slow.poll(daisN).toBe(3);   // chủ phiên + hai người đã nhận lời, đài dựng từ lúc «sắp»

  // tới giờ: tự bắt đầu ở Đại Thiền Đường
  await expect(A.locator('#toast')).toContainText('Bắt đầu thời thiền đồng tu ở Đại Thiền Đường.', { timeout: 60_000 });
  expect(await A.evaluate(() => ({ mode: window.__app.U.mode, playing: window.__app.player.playing }))).toEqual({ mode: 'hall', playing: true });
  await expect(M(A)).toBeHidden();   // đang thiền: không hiện thẻ
  expect(A.errs).toEqual([]);
});

test('API chưa có phiên (bản cũ, chưa có trường sessions): ẩn nút hẹn giờ, không gọi /api/v1/sessions', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(), { a, b } = sv.U;
  pair(sv, a.id, b.id); sv.noSessionsApi = true;
  const A = await device(browser, sv, 'a', { width: 412, height: 860 });
  await openList(A);
  await slow(P(A)).toContainText('Minh An ID 2210');
  await expect(P(A).locator('[data-act="dt-tab"][data-v="hen"]')).toHaveCount(0);
  await expect(P(A)).not.toContainText('Hẹn đồng tu');
  // máy chủ lên bản có phiên: lần tải danh sách kế tiếp nút tự hiện
  sv.noSessionsApi = false;
  await relist(A);
  await slow(P(A).locator('[data-act="dt-tab"][data-v="hen"]')).toBeVisible();
  expect(sv.log.some((l) => l.includes('/sessions'))).toBe(false);
  expect(A.errs).toEqual([]);
});

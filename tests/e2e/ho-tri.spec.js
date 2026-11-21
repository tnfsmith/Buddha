// T5.2 #195: Bảng Hộ Trì và Sự kiện ở Cổng Vân Môn với máy chủ giả theo hợp đồng #194 (docs/contracts/ho-tri-fixture.json).
// Ứng dụng khởi động với máy chủ giả Bạn đồng tu (dong-tu-fake.js); các route Hộ Trì và /me.community nằm ở route của trang.
// Kiểm: /me cũ thì không hiện bảng; xác nhận 18+ đúng phiên bản điều khoản; chữ người dùng không chạy HTML; không có mã kết bạn ở
// danh sách/chi tiết, chỉ có trong ca đã nhận; viết bài kiểm ngay trên máy; nhận giúp hai bên xác nhận, không cộng Kusala; sự kiện.
import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';
import { slow, fakeServer, device, P } from './dong-tu-fake.js';
import { HO_TRI_REASON_TEXT as R } from '../../packages/shared/src/ho-tri.js';

const FX = JSON.parse(fs.readFileSync(new URL('../../docs/contracts/ho-tri-fixture.json', import.meta.url), 'utf8'));
const clone = (x) => JSON.parse(JSON.stringify(x));
closeContextsAfterEach();
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');

/** Máy chủ giả Hộ Trì. start: khóa /me trong fixture (me, needs_consent, me_guide, me_legacy) */
function hoTri(start = 'me') {
  const S = { community: FX[start].community ? clone(FX[start].community) : null, log: [], bodies: {}, detail: { 'help-a': clone(FX.help_detail), 'help-d': clone(FX.help_phap_detail) },
    list: clone(FX.help.items), more: null, matches: clone(FX.owner_matches.items), ev: clone(FX.events.items), fail: {}, full: null };
  S.install = async (page, sv) => page.route('**/api/v1/**', async (r) => {
    const req = r.request(), u = new URL(req.url()), p = u.pathname, m = req.method();
    const json = (b, status = 200) => r.fulfill({ status, contentType: 'application/json', body: b === null ? '' : JSON.stringify(b) });
    const err = (code, status) => json({ error: { code, message: code } }, status);
    const body = () => { try { return req.postDataJSON() || {}; } catch { return {}; } };
    if (p === '/api/v1/me') {   // /me của máy chủ giả Bạn đồng tu, thêm community theo hợp đồng
      const base = await new Promise((res) => sv.handle({ request: () => req, fulfill: (o) => res(o) }, sv.U.a.id));
      const j = JSON.parse(base.body); if (S.community) j.community = S.community; else delete j.community;
      return r.fulfill({ ...base, body: JSON.stringify(j) });
    }
    const key = `${m} ${p}`, known = /^\/api\/v1\/(help|events|community)\b/.test(p);
    if (!known) return r.fallback();
    S.log.push(key + u.search); if (m !== 'GET') S.bodies[key] = [...(S.bodies[key] || []), body()];
    if (S.fail[key]) { const [code, st] = S.fail[key]; return err(code, st); }
    if (key === 'POST /api/v1/community/consent') { S.community = { ...clone(FX.me.community), help_replies: 0, help_matches: 0 }; return json({ community: S.community }); }
    if (key === 'GET /api/v1/help') return u.searchParams.get('cursor') ? json({ items: S.more || [], next_cursor: null }) : json({ items: S.list, next_cursor: S.more ? 'c2' : null });
    if (key === 'GET /api/v1/help/mine') return json(clone(FX.help_mine));
    if (key === 'POST /api/v1/help') return json(clone(FX.create_pending), 201);
    let x = /^\/api\/v1\/help\/([^/]+)$/.exec(p);
    if (x && m === 'GET') return S.detail[x[1]] ? json(S.detail[x[1]]) : err('not_found', 404);
    if (x && m === 'DELETE') return json(null, 204);
    x = /^\/api\/v1\/help\/([^/]+)\/(matches|match|reply|replies\/seen|close)$/.exec(p);
    if (x && x[2] === 'matches') return json({ items: S.matches });
    if (x && x[2] === 'reply') { const b = body(); return json({ reply: { id: 'reply-new', body: b.body, source_ref: b.source_ref || null, author: { tinh_danh: 'Tuệ Thái' }, created_at: Date.now(), status: 'cho_duyet' } }, 201); }
    if (x && (x[2] === 'replies/seen' || x[2] === 'close')) return json(null, 204);
    if (x && x[2] === 'match') {
      const b = body(), c = S.matches.find((y) => y.id === b.match_id);
      if (b.action === 'nhan' && c) Object.assign(c, { state: 'nhan', me_done: false, other_done: false, other: clone(FX.match.other) });
      if (b.action === 'xong' && c) Object.assign(c, { me_done: true });
      if (b.action === 'huy' && c) c.state = 'huy';
      return json(c || { ...clone(FX.help_detail.my_match), state: b.action === 'huy' ? 'huy' : 'de_nghi' });
    }
    if (key === 'POST /api/v1/help/reports') return json({ id: 'rep-1' }, 201);
    if (key === 'POST /api/v1/help/blocks') return json(null, 204);
    if (key === 'GET /api/v1/events') return json({ items: S.ev, next_cursor: null });
    x = /^\/api\/v1\/events\/([^/]+)\/rsvp$/.exec(p);
    if (x) {
      if (S.full === x[1]) return err('event_full', 409);
      const e = S.ev.find((y) => y.id === x[1]), st = body().state;
      if (e) { e.rsvp_count += st === 'dang_ky' && e.my !== 'dang_ky' ? 1 : st === 'huy' && e.my === 'dang_ky' ? -1 : 0; e.my = st; }
      return json({ state: st, rsvp_count: e ? e.rsvp_count : 0 });
    }
    return err('not_found', 404);
  });
  return S;
}
const gateZone = (page) => page.evaluate(() => [...document.querySelectorAll('.zl')].find((b) => b.textContent.includes('Cổng Vân Môn')).click());
async function openBoard(page) {
  await gateZone(page);
  await slow(P(page).locator('[data-act="ht-open"]')).toBeVisible();
  await P(page).locator('[data-act="ht-open"]').click();
  await slow(P(page).locator('h2')).toHaveText('Bảng Hộ Trì');
}
const tab = (page, v) => P(page).locator(`[data-act="ht-tab"][data-v="${v}"]`).first().click();

test('/me cũ chưa có community: Cổng Vân Môn không hiện Bảng Hộ Trì', async ({ browser }) => {
  test.setTimeout(180_000);
  const sv = fakeServer(30), A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 30), S = hoTri('me_legacy');
  await S.install(A, sv);
  const me = A.waitForResponse((r) => r.url().endsWith('/api/v1/me'));
  await gateZone(A);
  await me; await A.waitForTimeout(500);
  await expect(P(A).locator('h2')).toHaveText('Cổng Vân Môn');
  await expect(P(A).locator('[data-act="ht-open"]')).toHaveCount(0);
  expect(A.errs).toEqual([]);
});

test('xác nhận 18+ đúng phiên bản điều khoản; bảng, lọc, chi tiết, trả lời, báo cáo, chặn; chữ người dùng không chạy HTML, không lộ mã kết bạn', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(30), A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 30), S = hoTri('needs_consent');
  S.list.push({ ...clone(FX.help.items[0]), id: 'help-x', title: '<img src=x onerror="window.__ht=1">Thử', author: { tinh_danh: 'Minh <b>An</b>' } });
  S.more = [{ ...clone(FX.help.items[0]), id: 'help-m', title: 'Bài ở trang sau' }];
  await S.install(A, sv);
  await openBoard(A);
  // chưa xác nhận: đọc điều khoản đúng phiên bản; nút chỉ bấm được khi đã đánh dấu; không có tab Viết bài
  await expect(P(A)).toContainText(R.need_adult_confirmation);
  await expect(P(A).locator('a[href="/dieu-khoan-cong-dong/test-v1.html"]')).toContainText('bản test-v1');
  await expect(P(A).locator('[data-act="ht-consent"]')).toBeDisabled();
  await expect(P(A).locator('[data-act="ht-tab"][data-v="viet"]')).toHaveCount(0);
  await P(A).locator('[data-ht="adult"]').check();
  await P(A).locator('[data-act="ht-consent"]').click();
  await slow(P(A)).toContainText('Đã ghi xác nhận');
  expect(S.bodies['POST /api/v1/community/consent']).toEqual([{ adult_confirmed: true, terms_version: 'test-v1' }]);
  await expect(P(A).locator('[data-act="ht-tab"][data-v="viet"]')).toBeVisible();
  // danh sách: ẩn danh, tỉnh/thành; chữ người dùng hiện nguyên văn, không chạy HTML
  await expect(P(A)).toContainText('Cần người cùng học');
  await expect(P(A)).toContainText('Cần giúp · Hồ Chí Minh · Ẩn danh');
  await expect(P(A)).toContainText('<img src=x onerror="window.__ht=1">Thử');
  await expect(P(A)).toContainText('Minh <b>An</b>');
  expect(await A.evaluate(() => window.__ht === undefined && !document.querySelector('#panel img'))).toBe(true);
  await P(A).locator('[data-act="ht-more"]').click();
  await slow(P(A)).toContainText('Bài ở trang sau');
  await P(A).locator('[data-ht="kind"]').selectOption('hoi_phap');
  await slow.poll(() => S.log.some((l) => l === 'GET /api/v1/help?kind=hoi_phap')).toBe(true);
  await P(A).locator('[data-ht="area"]').selectOption('vn_01');
  await slow.poll(() => S.log.some((l) => l === 'GET /api/v1/help?kind=hoi_phap&area=vn_01')).toBe(true);
  // chi tiết «Cần giúp»: lời trả lời, ca của mình (đã đề nghị, bài ẩn danh nên chưa biết chủ bài); không có mã kết bạn
  await P(A).locator('[data-act="ht-xem"][data-id="help-a"]').click();
  await slow(P(A)).toContainText('Mình có thể hướng dẫn cách viết một ghi chú ngắn.');
  await expect(P(A)).toContainText('Minh An');
  await expect(P(A)).toContainText('Bạn đã đề nghị giúp · chờ chủ bài nhận.');
  await expect(P(A).locator('[data-act="ht-block"]')).toHaveCount(0);   // can_block: false với bài ẩn danh
  expect(await P(A).textContent()).not.toMatch(/0472|0183/);
  await P(A).locator('[data-ht="reply"]').fill('Mình cùng học nhé.');
  await P(A).locator('[data-act="ht-reply"]').click();
  await slow(P(A)).toContainText('Lời trả lời đang chờ duyệt.');
  expect(S.bodies['POST /api/v1/help/help-a/reply']).toEqual([{ body: 'Mình cùng học nhé.' }]);
  await P(A).locator('[data-act="ht-report"][data-t="post"]').click();
  await slow(P(A)).toContainText('Đã gửi báo cáo');
  expect(S.bodies['POST /api/v1/help/reports']).toEqual([{ target_type: 'post', target_id: 'help-a' }]);
  // Hỏi Pháp: lời trả lời kèm nguồn; người không phải người hướng dẫn không có ô trả lời; chặn phải bấm hai lần
  await tab(A, 'bang');
  S.list.push(clone(FX.help_phap_detail.item));
  await P(A).locator('[data-ht="kind"]').selectOption('');
  await slow(P(A).locator('[data-act="ht-xem"][data-id="help-d"]')).toBeVisible();
  await P(A).locator('[data-act="ht-xem"][data-id="help-d"]').click();
  await slow(P(A)).toContainText('Nguồn: MN 10 — Kinh Niệm Xứ');
  await expect(P(A)).toContainText('do người hướng dẫn viết');
  await expect(P(A).locator('[data-ht="reply"]')).toHaveCount(0);
  await P(A).locator('[data-act="ht-block"]').click();
  await expect(P(A).locator('[data-act="ht-block"]')).toHaveText('Bấm lần nữa để chặn');
  expect(S.bodies['POST /api/v1/help/blocks']).toBeUndefined();
  await P(A).locator('[data-act="ht-block"]').click();
  await slow(P(A)).toContainText('Đã chặn.');
  expect(S.bodies['POST /api/v1/help/blocks']).toEqual([{ target_type: 'post', target_id: 'help-d' }]);
  expect(A.errs).toEqual([]);
});

test('ngày 1, Cổng Vân Môn chưa mở: vẫn vào Bảng Hộ Trì (chủ dự án 21/11); viết bài kiểm ngay trên máy, gửi thì chờ duyệt; bài của tôi; sàng lọc gián đoạn và giới hạn lượt', async ({ browser }) => {
  test.setTimeout(180_000);
  const sv = fakeServer(1), A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 1), S = hoTri('me');
  await S.install(A, sv);
  await gateZone(A);
  await slow(P(A)).toContainText('Phân khu này mở ở ngày 29');
  await expect(P(A).locator('[data-act="gate"]')).toHaveCount(0);   // cổng chưa mở: chưa đổi Độc cư/Nghênh khách
  await expect(P(A)).toContainText('cả khi Cổng Vân Môn chưa mở');
  await openBoard(A);
  await tab(A, 'viet');
  await P(A).locator('[data-ht="title"]').fill('Cần');
  await P(A).locator('[data-ht="body"]').fill('Mình muốn học cách ghi chép sau khi đọc sách.');
  await P(A).locator('[data-act="ht-post"]').click();
  await expect(P(A).locator('[role="alert"]')).toHaveText(R.invalid_title);
  expect(S.bodies['POST /api/v1/help']).toBeUndefined();   // sai dạng: không gọi máy chủ
  await P(A).locator('[data-ht="title"]').fill('  Cần người cùng học  ');
  await P(A).locator('[data-ht="darea"]').selectOption('vn_79');
  await P(A).locator('[data-ht="anon"]').check();
  await P(A).locator('[data-act="ht-post"]').click();
  await slow(P(A)).toContainText('Bài đang chờ duyệt trước khi hiện trên bảng.');
  expect(S.bodies['POST /api/v1/help']).toEqual([clone(FX.create_post)]);
  // bài của tôi: đang chờ duyệt; bài đã ẩn ghi lý do chung
  await slow(P(A)).toContainText('Một việc nhỏ hôm nay');
  await expect(P(A)).toContainText('Đang chờ duyệt');
  await expect(P(A)).toContainText('Đã ẩn: ' + R.content_hidden);
  for (const [code, st] of [['moderation_unavailable', 503], ['rate_limited', 429]]) {
    S.fail['POST /api/v1/help'] = [code, st];
    await tab(A, 'viet');
    await P(A).locator('[data-ht="title"]').fill('Cần người cùng học');
    await P(A).locator('[data-ht="body"]').fill('Mình muốn học cách ghi chép.');
    await P(A).locator('[data-act="ht-post"]').click();
    await slow(P(A).locator('[role="alert"]')).toHaveText(R[code]);
  }
  expect(A.errs).toEqual([]);
});

test('nhận giúp: chủ bài nhận một người, mã kết bạn chỉ hiện trong ca đã nhận; mỗi bên xác nhận xong; không cộng Kusala; đóng và xóa bài', async ({ browser }) => {
  test.setTimeout(180_000);
  const sv = fakeServer(30), A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 30), S = hoTri('me');
  Object.assign(S.detail['help-a'], { actions: { ...FX.help_detail.actions, can_match: false, can_close: true, can_delete: true }, my_match: null });
  await S.install(A, sv);
  const k0 = await A.evaluate(() => JSON.stringify(window.__app.state().totals));
  await openBoard(A);
  await P(A).locator('[data-act="ht-xem"][data-id="help-a"]').click();
  await slow(P(A)).toContainText('Minh An đề nghị giúp');
  await expect(P(A)).toContainText('Tịnh An đề nghị giúp');
  await expect(P(A)).toContainText('chỉ hiện riêng cho người được nhận');
  expect(await P(A).textContent()).not.toContain('0472');
  // chủ bài đã xem lời trả lời: báo mốc để số mới ở cổng trừ đi
  await slow.poll(() => S.bodies['POST /api/v1/help/help-a/replies/seen']).toEqual([{ until: FX.help_detail.replies[0].created_at }]);
  await P(A).locator('[data-act="ht-match"][data-a="nhan"][data-id="match-a"]').click();
  await slow(P(A)).toContainText('mã 0472');
  expect(S.bodies['POST /api/v1/help/help-a/match']).toEqual([{ action: 'nhan', match_id: 'match-a' }]);
  await P(A).locator('[data-act="ht-match"][data-a="xong"]').click();
  await slow(P(A)).toContainText('Bạn đã xác nhận xong · chờ người giúp xác nhận.');
  // người giúp cũng xác nhận: ca thành xong; chỉ gợi ý tự ghi việc Thiện, không tự cộng
  Object.assign(S.matches[0], clone(FX.match_finished));
  await tab(A, 'bang');
  await P(A).locator('[data-act="ht-xem"][data-id="help-a"]').click();
  await slow(P(A)).toContainText('Đã giúp xong cùng Minh An');
  await expect(P(A)).toContainText('ứng dụng không tự cộng điểm');
  expect(await A.evaluate(() => JSON.stringify(window.__app.state().totals))).toBe(k0);
  // đóng và xóa bài của mình: bấm hai lần
  await P(A).locator('[data-act="ht-closepost"]').click();
  await P(A).locator('[data-act="ht-closepost"]').click();
  await slow(P(A)).toContainText('Đã đóng bài.');
  expect(S.log).toContain('POST /api/v1/help/help-a/close');
  await P(A).locator('[data-act="ht-del"]').click();
  await P(A).locator('[data-act="ht-del"]').click();
  await slow(P(A)).toContainText('Đã xóa bài.');
  expect(S.log).toContain('DELETE /api/v1/help/help-a');
  expect(A.errs).toEqual([]);
});

test('điện thoại 360×740: sự kiện có mô tả và nơi công cộng, đăng ký và hủy, đủ chỗ thì báo; bảng không tràn ngang', async ({ browser }) => {
  test.setTimeout(180_000);
  const sv = fakeServer(30), A = await device(browser, sv, 'a', { width: 360, height: 740 }, 30), S = hoTri('me');
  await S.install(A, sv);
  await openBoard(A);
  await expect(P(A).locator('[data-act="ht-open"]')).toHaveCount(0);
  await tab(A, 'sk');
  await slow(P(A)).toContainText('Cùng dọn rác tại công viên');
  await expect(P(A)).toContainText('Đối tác mẫu · đối tác đã xác minh');
  await expect(P(A)).toContainText('Công viên Mẫu · Hồ Chí Minh');
  await expect(P(A)).toContainText('Cùng nhặt rác quanh lối đi.');
  await expect(P(A)).toContainText('Nhóm mẫu · nhóm đồng tu');
  await expect(P(A).locator('[data-ev="event-b"]')).toContainText('bạn đã đăng ký');
  await P(A).locator('[data-ev="event-a"] [data-act="ht-rsvp"]').click();
  await slow(P(A)).toContainText('Đã đăng ký tham gia.');
  await expect(P(A).locator('[data-ev="event-a"]')).toContainText('4 người đã đăng ký · còn 6 chỗ · bạn đã đăng ký');
  await P(A).locator('[data-ev="event-b"] [data-act="ht-rsvp"]').click();
  await slow(P(A)).toContainText('Đã hủy đăng ký.');
  S.full = 'event-b';
  await P(A).locator('[data-ev="event-b"] [data-act="ht-rsvp"]').click();
  await slow(P(A).locator('[role="alert"]')).toHaveText(R.event_full);
  expect(S.bodies['POST /api/v1/events/event-a/rsvp']).toEqual([{ state: 'dang_ky' }]);
  const wide = await A.evaluate(() => { const p = document.querySelector('#panel'); return { page: document.documentElement.scrollWidth - innerWidth, panel: p.scrollWidth - p.clientWidth }; });
  expect(wide.page).toBeLessThanOrEqual(0);
  expect(wide.panel).toBeLessThanOrEqual(0);
  expect(A.errs).toEqual([]);
});

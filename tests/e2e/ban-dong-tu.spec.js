// #124: giao diện Bạn đồng tu trên hai thiết bị thật (hai trình duyệt, hai tài khoản), máy chủ giả lập theo hợp đồng #126.
// Nghiệm thu: tìm đúng «Tịnh danh · mã» (người gửi không nhận tín hiệu từ chối), kết nối bằng liên kết mời, lời mời cùng ngồi thiền
// ẩn khi người nhận đang thiền và hiện lại sau thời thiền, đếm ngược chung theo giờ máy chủ rồi cả hai cùng bắt đầu.
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';
import { slow, LEAD, fakeServer, device, P, M, badge, relist, listUntil, openList, closeView, secs } from './dong-tu-fake.js';

closeContextsAfterEach();
test.use({ serviceWorkers: 'block' });
test.skip(!!process.env.E2E_BASE_URL, 'máy chủ giả lập chỉ chạy với bản dựng cục bộ');

test('hai thiết bị: tìm bạn, kết nối bằng liên kết, mời cùng ngồi thiền khi bạn đang thiền rồi cùng bắt đầu', async ({ browser }) => {
  test.setTimeout(420_000);
  const sv = fakeServer();
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 });
  const B = await device(browser, sv, 'b', { width: 360, height: 740 });
  // Nút chỉ hiện khi máy chủ báo dong_tu: 1
  await slow(A.locator('#dt')).toBeVisible();
  await slow(B.locator('#dt')).toBeVisible();

  // ── 1. Tìm đúng «Tịnh danh · mã». Người nhận bỏ qua: người gửi vẫn chỉ thấy «đã gửi», không có tín hiệu từ chối.
  await openList(A);
  await expect(P(A)).toContainText('Chưa có bạn đồng tu');
  await P(A).locator('[data-act="dt-tab"][data-v="tim"]').click();
  await P(A).locator('#dtFind').fill('minh an 22');
  await P(A).locator('[data-act="dt-find"]').click();
  await expect(P(A).locator('[role="alert"]')).toContainText('Tịnh danh · mã');
  await P(A).locator('#dtFind').fill('minh an · 2210');
  await P(A).locator('[data-act="dt-find"]').click();
  await slow(P(A)).toContainText('Đã gửi lời kết nối tới Minh An · 2210');
  await P(A).locator('[data-act="dt-tab"][data-v="list"]').click();
  await slow(P(A)).toContainText('Đang chờ');
  await expect(P(A)).toContainText('Đã gửi lời kết nối · chờ người ấy đồng ý');

  await badge(B, '1');   // chấm số: một lời kết nối đang chờ (không phải số bạn)
  await openList(B);
  await slow(P(B)).toContainText('Lời kết nối (1)');
  await expect(P(B)).toContainText('Tuệ Thái · 5696');
  await P(B).locator('[data-act="dt-req-no"]').click();
  await slow(P(B)).toContainText('Đã bỏ qua lời kết nối.');
  await relist(A);
  await slow(P(A)).toContainText('Đã gửi lời kết nối · chờ người ấy đồng ý');   // vẫn y như trước
  await P(A).locator('[data-act="dt-withdraw"]').click();
  await slow(P(A)).toContainText('Chưa có bạn đồng tu');

  // ── 2. Kết nối bằng liên kết mời: mã + QR + chia sẻ; người kia mở …/#ban=MÃ
  await P(A).locator('[data-act="dt-tab"][data-v="moi"]').click();
  await slow(P(A).locator('[data-dt-code]')).toHaveText('K7M2-QX9A');
  await expect(P(A).locator('svg.qr')).toHaveAttribute('aria-label', 'Mã QR mời bạn tu cùng');
  await expect(P(A)).toContainText('Còn 5 lượt');
  await closeView(B);
  await B.evaluate(() => { location.hash = '#ban=K7M2-QX9A'; });
  await slow(B.locator('#toast')).toContainText('Đã kết nối đồng tu với Tuệ Thái · 5696');
  await slow.poll(() => B.evaluate(() => location.hash)).not.toContain('ban=');   // mã đã dùng thì rời khỏi địa chỉ
  await listUntil(A, 'Minh An ID 2210');   // danh sách ghi tên và ID (#151)
  await expect(P(A)).toContainText('Quen biết');

  // ── 3. B đang thiền: A thấy ghi chú, lời mời không hiện và không có âm ở B cho tới khi xuất thiền
  await B.evaluate(() => window.__app.player.play());
  await slow.poll(() => sv.presence[sv.U.b.id]?.state).toBe('thien');
  await listUntil(A, 'Đang tọa thiền');
  await expect(P(A)).toContainText('lời mời sẽ hiện khi bạn ấy xuất thiền');
  await P(A).locator('[data-act="dt-meet"]').click();
  await slow(P(A)).toContainText('Đã mời cùng ngồi thiền · chờ trả lời');
  await badge(B, '1');
  await B.waitForTimeout(1500);
  await expect(M(B)).toBeHidden();
  await B.evaluate(() => window.__app.player.pause());
  await slow(M(B)).toBeVisible();
  await expect(M(B)).toContainText('Tuệ Thái · 5696');
  await expect(M(B)).toContainText('Mời bạn cùng ngồi một thời thiền 15 phút.');
  await expect(M(B)).toContainText('Lời mời đến trong lúc bạn thiền.');
  // #139: trên điện thoại thẻ nằm trên mép trên đo được của bảng, không che nút Thu gọn
  const box = await B.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const pm = r('#panel .pm'), top = document.elementFromPoint((pm.left + pm.right) / 2, (pm.top + pm.bottom) / 2);
    return { card: r('#dtm').bottom, panel: r('#panel').top, pm: !!top && !!top.closest('.pm') }; });
  expect(box.card).toBeLessThanOrEqual(box.panel + 1);
  expect(box.pm).toBe(true);

  // ── 4. Nhận lời: đếm ngược chung theo giờ máy chủ ở cả hai máy, tới giờ cả hai cùng bắt đầu ở Đại Thiền Đường
  await M(B).locator('[data-act="dt-yes"]').click();
  await slow(M(B)).toContainText('bắt đầu sau');
  await slow(M(A)).toContainText('Cùng ngồi thiền với Minh An · 2210', { timeout: 20_000 });
  await expect(M(A)).toContainText('Tại Đại Thiền Đường');
  // cùng một mốc giờ máy chủ ở hai máy; số giây hiện ra lệch nhau không quá nhịp cập nhật 1 giây (cộng sai số đọc)
  const ends = await Promise.all([A, B].map((pg) => M(pg).locator('[data-dt-end]').getAttribute('data-dt-end')));
  expect(ends[0]).toBe(String(sv.invites.find((i) => i.status === 'dong_y').start_at));
  expect(ends[1]).toBe(ends[0]);
  const [ta, tb] = await Promise.all([A, B].map((pg) => M(pg).locator('[data-dt-end]').textContent()));
  expect(Math.abs(secs(ta) - secs(tb))).toBeLessThanOrEqual(2);
  await slow.poll(() => Promise.all([A, B].map((pg) => pg.evaluate(() => window.__app.player.playing))), { timeout: LEAD + 15_000 }).toEqual([true, true]);
  const st = await Promise.all([A, B].map((pg) => pg.evaluate(() => ({ t: window.__app.player.time, mode: document.body.classList.contains('hall') }))));
  for (const s of st) { expect(s.mode).toBe(true); expect(s.t).toBeLessThan(8); }
  await expect(M(A)).toBeHidden();   // đang thiền: không còn thẻ nào
  await expect(M(B)).toBeHidden();

  expect(A.errs).toEqual([]);
  expect(B.errs).toEqual([]);
});

test('quyền riêng tư và chế độ Cổng Vân Môn đồng bộ lên hồ sơ', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer(29);
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 29);
  await slow(A.locator('#dt')).toBeVisible();
  await openList(A);
  await P(A).locator('[data-act="dt-tab"][data-v="rieng"]').click();
  await slow(P(A).locator('[data-dt="hien_ngay"]')).toBeChecked();
  await expect(P(A).locator('[data-dt="hien_trang_thai"]')).toBeChecked();
  await expect(P(A)).toContainText('Chưa chặn ai.');
  await P(A).locator('[data-dt="hien_ngay"]').uncheck();
  // settings gộp ở mức trên cùng nên luôn gửi đủ đối tượng dong_tu (hợp đồng §2)
  await slow.poll(() => sv.settings[sv.U.a.id]?.dong_tu).toEqual({ hien_trang_thai: true, cho_tim: true, hien_ngay: false });
  await expect(P(A).locator('[data-dt="hien_ngay"]')).not.toBeChecked();
  // Cổng Vân Môn (mở nửa từ ngày 29): đổi sang Nghênh khách thì hồ sơ máy chủ có island.open, máy chủ dùng để kiểm quyền ghé thăm
  await P(A).locator('[data-act="dt-tab"][data-v="list"]').click();
  await P(A).locator('[data-act="dt-close"]').click();
  await A.evaluate(() => { location.hash = ''; });
  await A.locator('.zl', { hasText: 'Cổng Vân Môn' }).click();
  await slow(P(A).locator('[data-act="gate"]')).toBeVisible();
  await expect(P(A)).toContainText('Bạn đồng tu (0 đang ở Vân Đạo)');
  await P(A).locator('[data-act="gate"]').click();
  await slow.poll(() => sv.island[sv.U.a.id]?.open).toBe(true);
  expect(sv.settings[sv.U.a.id].dong_tu.hien_ngay).toBe(false);   // đổi cổng không ghi đè quyền riêng tư
  expect(A.errs).toEqual([]);
});

test('đổi tài khoản trên cùng trang: mã mời và dữ liệu của người trước không lọt sang người sau', async ({ browser }) => {
  test.setTimeout(240_000);
  const sv = fakeServer();
  // A đang đăng nhập; đăng xuất thì không còn phiên; «Giữ hành trình» lần sau tạo phiên của B
  let cur = sv.U.a.id;
  const session = (v) => { if (v === null) cur = null; else if (v === 'next') cur = sv.U.b.id; return cur; };
  const A = await device(browser, sv, 'a', { width: 1280, height: 800 }, 1, session);
  await slow(A.locator('#dt')).toBeVisible();
  await openList(A);
  await P(A).locator('[data-act="dt-tab"][data-v="moi"]').click();
  await slow(P(A).locator('[data-dt-code]')).toHaveText('K7M2-QX9A');
  await P(A).locator('[data-act="dt-tab"][data-v="list"]').click();
  await closeView(A);
  // Đăng xuất (bấm hai lần) rồi giữ hành trình thành tài khoản B, không tải lại trang
  await P(A).locator('[data-act="acct-open"]').first().click();
  await slow(P(A).locator('[data-act="acct-out"]')).toBeVisible();
  await P(A).locator('[data-act="acct-out"]').click();
  await P(A).locator('[data-act="acct-out"]').click();
  await slow(A.locator('#dt')).toBeHidden();
  await slow(P(A).locator('[data-act="acct-keep"]')).toBeVisible();
  await P(A).locator('[data-act="acct-keep"]').click();
  await slow(A.locator('#dt')).toBeVisible();
  expect(await A.evaluate(() => performance.getEntriesByType('navigation')[0].type)).not.toBe('reload');
  await openList(A);
  await P(A).locator('[data-act="dt-tab"][data-v="moi"]').click();
  await slow(P(A).locator('[data-dt-code]')).toHaveText('P3R8-TW6H');   // mã của B, không dùng lại mã của A
  expect(Object.values(sv.links).map((k) => k.owner).sort()).toEqual([sv.U.a.id, sv.U.b.id].sort());
  expect(A.errs).toEqual([]);
});

// Codex review #148: ở Đại Thiền Đường trên điện thoại, thẻ hẹn cùng thiền phải neo theo mép bảng đo được (--subb, #139),
// không chồng lên bảng (thu gọn hay mở), cả màn dọc lẫn ngang
for (const [name, vp] of [['dọc 390×760', { width: 390, height: 760 }], ['ngang 740×360', { width: 740, height: 360 }]]) {
  test(`Đại Thiền Đường, điện thoại ${name}: thẻ hẹn cùng thiền nằm trên mép bảng, không che bảng`, async ({ browser }) => {
    test.setTimeout(240_000);
    const sv = fakeServer(), now = Date.now(), { a, b } = sv.U;
    sv.pairs.push({ a: b.id, b: a.id, sa: { than: false, away: false }, sb: { than: false, away: false }, at: now - 86_400_000 });
    sv.invites.push({ id: 'mt-hall', from: b.id, to: a.id, kind: 'thien', place: 'dtd', status: 'dong_y', created_at: now - 20_000, responded_at: now - 5_000, start_at: now + 600_000 });
    const A = await device(browser, sv, 'a', vp);
    await slow(M(A)).toContainText('Cùng ngồi thiền với Minh An · 2210');
    await A.locator('#tabs [data-m="hall"]').click();
    await slow.poll(() => A.evaluate(() => document.body.classList.contains('hall'))).toBe(true);
    const box = () => A.evaluate(() => {
      const el = document.querySelector('#dtm'), c = el.getBoundingClientRect(), p = document.querySelector('#panel').getBoundingClientRect();
      const hit = document.elementFromPoint(p.left + p.width / 2, p.top + 6);
      return { shown: getComputedStyle(el).display !== 'none', cardTop: c.top, cardBottom: c.bottom, panelTop: p.top, panelHit: !!hit && !!hit.closest('#panel'), pmin: document.body.classList.contains('pmin') };
    });
    for (let i = 0; i < 2; i++) {   // bảng thu gọn và mở
      await A.waitForTimeout(400);
      const r = await box();
      // màn thấp, bảng đang mở: không còn chỗ trên mép bảng nên thẻ tạm ẩn; mọi trường hợp khác thẻ phải hiện trọn trên mép bảng
      if (vp.height > 500 || r.pmin) expect(r.shown).toBe(true); else expect(r.shown).toBe(false);
      if (r.shown) { expect(r.cardBottom, `thẻ không chồng bảng (pmin=${r.pmin})`).toBeLessThanOrEqual(r.panelTop + 1); expect(r.cardTop).toBeGreaterThanOrEqual(0); }
      expect(r.panelHit, 'chạm mép trên bảng vào bảng').toBe(true);
      await A.locator('#panel .pm').click();
    }
    expect(A.errs).toEqual([]);
  });
}

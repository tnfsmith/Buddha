// #125 (thiết kế Bạn đồng tu §5.7): tuần trà 10 phút — pha trà → rót chén → ngắm mây → hồi hướng; một mình, hoặc hai người theo giờ chung.
// Thời gian tua bằng window.__app.tdSkip; âm thanh kiểm qua amb.sfx (Web Audio, không tệp). Không gọi máy chủ.
import { test, expect } from '@playwright/test';
import { closeContextsAfterEach } from './hooks.js';

const BASE = (process.env.E2E_BASE_URL || 'http://127.0.0.1:4173/').replace(/#.*$/, '').replace(/\/?$/, '/');
closeContextsAfterEach();
test.use({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
test.skip(!!process.env.E2E_BASE_URL, 'chỉ chạy với bản dựng cục bộ');
const slow = expect.configure({ timeout: 60_000 });
const LOOK = { skin: 2, robe: 1, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' };

async function open(page) {
  await page.route('**/api/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'not_found' } }) }));
  await page.addInitScript((look) => { if (!localStorage.getItem('vandao.seeded')) { localStorage.setItem('vandao.seeded', '1'); localStorage.setItem('vandao.v1', JSON.stringify({ v: 1, day: 20, lastDate: null, done: {}, tu: {}, viec: {}, nguyen: {}, seed: 42, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: true, name: 'Tuệ Thái', look })); } }, LOOK);
  await page.goto(BASE + '#q=0&snap=1');
  await page.waitForFunction(() => window.__app?.world?.renderer && window.__app.tdSkip, null, { timeout: 150_000 });
  // ghi các hiệu ứng âm được gọi, bỏ qua âm thật (AudioContext cần cử chỉ người dùng)
  await page.evaluate(() => { const a = window.__app.amb; window.__sfx = []; a.sfx = (k, o) => window.__sfx.push(k + (o && o.dur ? ':' + Math.round(o.dur) : '')); });
}
const tea = (page) => page.evaluate(() => { const W = window.__app.world; return { tea: W.tea && { cups: W.tea.cups.map((x) => Math.round(x * 100) / 100), pour: W.tea.pour && W.tea.pour.cup, two: W.tea.two }, sfx: window.__sfx.slice(), guest: W.guest && W.guest.how }; });
// tua tới đúng giây thứ s của tuần trà (thời gian thật giữa các bước không làm lệch mốc)
const at = (page, s) => page.evaluate((x) => window.__app.tdSkip(x - window.__app.tdAt()), s);
/** Sổ tự ghi nhận trên máy (nhiem-vu-so-nhap §6): mục tra_dao của các ngày, và tổng Kusala để chắc không đổi */
const tuTra = (page) => page.evaluate(() => { const s = window.__app.state(); return { tra: Object.values(s.tu || {}).map((d) => d.tra_dao).filter(Boolean), totals: JSON.stringify(s.totals) }; });

test('một mình: pha trà, rót một chén (ấm nghiêng, dòng trà), ngắm mây, hồi hướng, trọn 10 phút; âm thanh đúng mốc', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  const P = page.locator('#panel');
  await page.locator('#labels .zl', { hasText: 'Trà Đạo' }).click();
  await slow(P.locator('[data-act="td-start"]')).toBeVisible();
  await P.locator('[data-act="td-start"]').click();
  await expect(P.locator('#td-step')).toHaveText('Pha trà');
  await at(page, 4.5);
  await at(page, 63);   // 63 s: đang rót chén của mình
  let t = await tea(page);
  expect(t.tea.pour).toBe(0);
  expect(t.tea.cups[0]).toBeGreaterThan(0);
  expect(t.tea.cups[1]).toBe(0);   // một mình: một chén
  await slow.poll(() => page.evaluate(() => window.__app.world.home.teaInfo().stream)).toBe(true);
  await expect(P.locator('#td-step')).toHaveText('Rót trà');
  await at(page, 103);   // 103 s: chén đầy, ấm đặt lại
  t = await tea(page);
  expect(t.tea).toMatchObject({ cups: [1, 0], pour: null });
  await slow.poll(() => page.evaluate(() => window.__app.world.home.teaInfo().tilt)).toBeLessThan(0.05);
  await at(page, 111);   // 111 s
  await expect(P.locator('#td-step')).toHaveText('Ngắm mây');
  await at(page, 541);   // 541 s
  await expect(P.locator('#td-step')).toHaveText('Hồi hướng');
  const k0 = (await tuTra(page)).totals;
  expect((await tuTra(page)).tra).toEqual([]);
  await at(page, 601);
  await expect(page.locator('#toast')).toContainText('Tuần trà đã trọn');
  // hết một tuần trà: tự ghi nhận tra_dao (10 phút có mặt), không cộng Kusala
  expect(await tuTra(page)).toEqual({ tra: [{ n: 1, min: 10, refs: ['tra-dao'] }], totals: k0 });
  t = await tea(page);
  expect(t.tea).toBeNull();
  expect(t.sfx).toEqual(['chime', 'pour:3', 'pour:9', 'chime', 'gift']);
  await expect(P.locator('[data-act="td-start"]')).toBeVisible();
});

test('hai người: lời mời Trà Đạo trên đảo mình — khách ngồi đối diện, rót hai chén; vào trễ thì bắt kịp, không phát lại âm đã qua; kết thúc giữa chừng', async ({ page }) => {
  test.setTimeout(240_000);
  await open(page);
  await page.evaluate(() => { const a = window.__app; a.acct.uid = 'me'; a.dongTu.list = { companions: [{ id: 'u1', tinh_danh: 'Minh An', tag: '2210', look: { robe: 4 }, closeness: 'than', presence: 'tra', day: 20, open: true }] }; });
  await page.evaluate(() => window.__app.together({ id: 'i1', kind: 'tra', place: 'dao', from: 'me', to: 'u1', start_at: Date.now() }, 30_000));
  const P = page.locator('#panel');
  await slow(P).toContainText('Tuần trà cùng Minh An');
  let t = await tea(page);
  expect(t.guest).toBe('tra');
  expect(t.tea.two).toBe(true);
  expect(t.sfx).toEqual([]);   // vào sau giờ hẹn 30 giây: bỏ tiếng chuông mở đầu và tiếng nước đã qua
  await at(page, 85);   // 85 s: rót chén của bạn
  t = await tea(page);
  expect(t.tea.pour).toBe(1);
  expect(t.tea.cups[0]).toBe(1);
  await at(page, 105);   // 105 s
  expect((await tea(page)).tea.cups).toEqual([1, 1]);
  await P.locator('[data-act="td-stop"]').click();
  expect((await tea(page)).tea).toBeNull();
  expect((await tuTra(page)).tra).toEqual([]);   // kết thúc giữa chừng: không ghi nhận

  // vào rất trễ (200 s): thẳng tới Ngắm mây, hai chén đã đầy
  await page.evaluate(() => window.__app.together({ id: 'i2', kind: 'tra', place: 'dao', from: 'me', to: 'u1', start_at: Date.now() }, 200_000));
  await slow(P.locator('#td-step')).toHaveText('Ngắm mây');
  expect((await tea(page)).tea).toMatchObject({ cups: [1, 1], pour: null, two: true });
  // uống cùng tới hết tuần trà: ghi số phút thật có mặt (vào ở giây 200 → 6,7 phút)
  await at(page, 601);
  await expect(page.locator('#toast')).toContainText('Tuần trà đã trọn');
  expect((await tuTra(page)).tra).toEqual([{ n: 1, min: 6.7, refs: ['tra-dao-hai'] }]);
});

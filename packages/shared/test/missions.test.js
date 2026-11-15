import { describe, expect, it } from 'vitest';
import { PASSIVE, WEEK_FOCUS, WEEK_PARAMI, calendar, catalogOk, heardEnough, heardIds, listenCode, logPassive, lotus, shiftDate, weakest, weekSitMinutes } from '../src/missions.js';
import { PARAMI } from '../src/parami.js';
import { actParami, catalog, dayPlan, fullGioi, hash32, isTraiDay, pickN, setAct, toMission } from '../src/missions.js';

describe('danh mục tự ghi nhận', () => {
  it('mọi mã Phước nghiệp sự / Ba-la-mật đều hợp lệ (Phụ lục H)', () => expect(catalogOk()).toBe(true));
  it('7 tuần phủ đủ 10 Ba-la-mật trọng tâm, mỗi tuần hai', () => {
    expect(WEEK_FOCUS).toHaveLength(7);
    expect(WEEK_FOCUS.every((f) => f.length === 2)).toBe(true);
    expect(new Set(WEEK_FOCUS.flat())).toEqual(new Set(Object.keys(PARAMI)));
  });
  it('WEEK_PARAMI có 7 tuần, ba trục', () => { expect(WEEK_PARAMI).toHaveLength(7); for (const w of WEEK_PARAMI) expect(Object.keys(w).sort()).toEqual(['duc', 'thien', 'tue']); });
  it('mã nghe theo loạt', () => { expect(listenCode('duong-xua')).toBe('nghe_duong_xua'); expect(listenCode('loi-phat-day')).toBe('nghe_loi_phat_day'); expect(listenCode(undefined)).toBe('nghe_loi_phat_day'); });
});

describe('ngưỡng nghe trọn', () => {
  it('70 % mặc định, 80 % cho hồi hướng', () => {
    expect(heardEnough(70, 100)).toBe(true); expect(heardEnough(69.9, 100)).toBe(false);
    expect(heardEnough(79, 100, 0.8)).toBe(false); expect(heardEnough(80, 100, 0.8)).toBe(true);
  });
  it('tổng 0, NaN hay âm thì chưa đủ', () => { for (const [a, b] of [[1, 0], [NaN, 10], [5, NaN], [5, -1]]) expect(heardEnough(a, b)).toBe(false); });
});

describe('sổ tự ghi nhận', () => {
  it('cộng lần, phút và mã bài không trùng; không sửa sổ cũ', () => {
    const a = logPassive({}, '2026-11-15', 'thoi_thien', { minutes: 15, ref: 'dai-thien' });
    const b = logPassive(a, '2026-11-15', 'thoi_thien', { minutes: 15, ref: 'dai-thien' });
    expect(a['2026-11-15'].thoi_thien).toEqual({ n: 1, min: 15, refs: ['dai-thien'] });
    expect(b['2026-11-15'].thoi_thien).toEqual({ n: 2, min: 30, refs: ['dai-thien'] });
  });
  it('mã lạ, ngày sai định dạng: giữ nguyên', () => {
    const a = logPassive({}, '2026-11-15', 'nghe_duong_xua', { ref: 'x' });
    expect(logPassive(a, '2026-11-15', 'mua_hang')).toBe(a);
    expect(logPassive(a, '15/11/2026', 'thoi_thien')).toBe(a);
  });
  it('phút bị chặn trong 0–240', () => { expect(logPassive({}, '2026-11-15', 'van_du', { minutes: 9999 })['2026-11-15'].van_du.min).toBe(240); expect(logPassive({}, '2026-11-15', 'van_du', { minutes: -5 })['2026-11-15'].van_du.min).toBe(0); });
});

describe('hoa sen 10 cánh', () => {
  it('mỗi mã chỉ tính một lần mỗi ngày (nghe nhiều bài không cày điểm)', () => {
    let L = {}; for (let i = 0; i < 10; i++) L = logPassive(L, '2026-11-15', 'nghe_duong_xua', { ref: 'b' + i });
    const s = lotus(L);
    expect(s.counts.panna).toBe(1); expect(s.counts.metta).toBe(1);
    expect(s.norm.panna).toBe(1); expect(s.norm.dana).toBe(0);
  });
  it('trục đã ghi nhận làm sáng cánh theo tuần (§8.2) và Sám hối thêm Chân thật', () => {
    const done = { 1: { duc: { E: 10 }, tue: { E: 10 } }, 8: { duc: { E: 10 } } };   // tuần 1: Đức + Tuệ; tuần 2: Đức
    const s = lotus({}, done, 2);
    expect(s.counts.sila).toBe(1); expect(s.counts.metta).toBe(1); expect(s.counts.panna).toBe(1); expect(s.counts.viriya).toBe(1);
    expect(s.counts.sacca).toBe(1 + 2); expect(s.counts.khanti).toBe(1);
    expect(s.total).toBe(8);   // 2 + 2 + 2 cánh từ ba lần ghi nhận, cộng 2 lần Sám hối
  });
  it('cánh yếu nhất để gợi ý; chưa có gì thì null', () => {
    expect(weakest(lotus())).toBe(null);
    const s = lotus(logPassive({}, '2026-11-15', 'thoi_thien', { minutes: 15 }));
    expect(weakest(s)).toBe('dana');
  });
});

describe('lịch tu, nhịp thiền, sổ nghe', () => {
  const log = ['2026-11-13', '2026-11-15'].reduce((L, d) => logPassive(L, d, 'thoi_thien', { minutes: 15 }), logPassive({}, '2026-11-14', 'nghe_loi_phat_day', { ref: 'kalama' }));
  it('lùi ngày đúng qua đầu tháng', () => { expect(shiftDate('2026-12-01', -1)).toBe('2026-11-30'); expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28'); });
  it('49 ô tới hôm nay; ngày trống để trống', () => {
    const c = calendar(log, { 3: { duc: { at: new Date(2026, 10, 12, 20).getTime() } } }, '2026-11-15');
    expect(c).toHaveLength(49); expect(c[48].date).toBe('2026-11-15'); expect(c[0].date).toBe('2026-09-28');
    const by = Object.fromEntries(c.map((x) => [x.date, x]));
    expect(by['2026-11-15']).toMatchObject({ sit: true, listen: false, any: true });
    expect(by['2026-11-14']).toMatchObject({ sit: false, listen: true, any: true });
    expect(by['2026-11-12']).toMatchObject({ confirm: true, any: true });
    expect(by['2026-11-11'].any).toBe(false);
  });
  it('phút thiền 7 ngày gần nhất', () => { expect(weekSitMinutes(log, '2026-11-15')).toBe(30); expect(weekSitMinutes(log, '2026-11-25')).toBe(0); });
  it('bài đã nghe theo loạt', () => { const h = heardIds(log); expect([...h['loi-phat-day']]).toEqual(['kalama']); expect(h['duong-xua'].size).toBe(0); });
  it('PASSIVE không cho sửa', () => { expect(Object.isFrozen(PASSIVE)).toBe(true); expect(Object.isFrozen(PASSIVE.thoi_thien.parami)).toBe(true); });
});


const item = (id, nhom, extra = {}, body = 'Một việc nhỏ.') => ({ id, version: 1, kind: 'nhiem_vu', tier: 0, title: 'Tên', body_inline: body,
  meta: JSON.stringify({ nhom, gioi: null, tuan: null, parami: ['sila'], punna: 'sila', minutes: 2, money: false, ...extra }) });
const ITEMS = [
  ...[1, 2, 3, 4, 5].flatMap((g) => [1, 2, 3].map((i) => item(`sn-gioi-${g}-0${i}`, 'gioi', { gioi: g, parami: ['sila', 'metta'], ...(g === 5 ? { safety_note: 'Giảm dần cùng nhân viên y tế.' } : {}) }))),
  ...['viriya', 'metta', 'sacca', 'khanti'].flatMap((p) => [1, 2, 3, 4].map((i) => item(`sn-hanh-${p}-0${i}`, 'hanh', { parami: [p], punna: 'bhavana' }))),
  ...[1, 2].map((t) => item(`sn-nguyen-tuan-${t}`, 'nguyen', { tuan: t, parami: t === 1 ? ['viriya', 'metta'] : ['sacca', 'khanti'] }, 'Khi … thì tôi …')),
  item('sn-trai-bat-quan', 'trai', { parami: ['sila', 'nekkhamma', 'adhitthana'], gioi_trai: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], safety_note: 'Theo hướng dẫn y tế.' }),
];

describe('danh mục nhiệm vụ (đợt B → C)', () => {
  it('đọc meta chuỗi JSON; bỏ mục sai hợp đồng', () => {
    expect(toMission(ITEMS[0])).toMatchObject({ id: 'sn-gioi-1-01', nhom: 'gioi', gioi: 1, parami: ['sila', 'metta'] });
    expect(toMission({ ...ITEMS[0], kind: 'bai_giang' })).toBe(null);
    expect(toMission({ ...ITEMS[0], meta: '{"nhom":"gioi","gioi":9,"parami":["sila"]}' })).toBe(null);
    expect(toMission({ ...ITEMS[0], meta: '{"nhom":"la","parami":["sila"]}' })).toBe(null);
    expect(toMission({ ...ITEMS[0], meta: '{"nhom":"hanh","parami":["xyz"]}' })).toBe(null);
    expect(toMission({ ...ITEMS[0], meta: 'không phải JSON' })).toBe(null);
  });
  it('gom theo nhóm; thẻ trai giữ 8 mô tả và ghi chú an toàn', () => {
    const c = catalog(ITEMS);
    expect(c.n).toBe(ITEMS.length); expect(c.gioi[3]).toHaveLength(3); expect(c.hanh.metta).toHaveLength(4);
    expect(c.nguyen[2].id).toBe('sn-nguyen-tuan-2'); expect(c.trai.trai).toHaveLength(8); expect(c.trai.safety).toContain('y tế');
    expect(c.gioi[5][0].safety).toContain('y tế');
  });
});

describe('việc của ngày', () => {
  const c = catalog(ITEMS);
  it('tất định: cùng ngày + hạt giống → cùng việc; khác ngày → có thể khác', () => {
    const a = dayPlan(c, { date: '2026-11-15', week: 1, seed: 7 }), b = dayPlan(c, { date: '2026-11-15', week: 1, seed: 7 });
    expect(a).toEqual(b);
    const many = new Set(Array.from({ length: 10 }, (_, i) => dayPlan(c, { date: `2026-11-${10 + i}`, week: 1, seed: 7 }).gioi[1].id));
    expect(many.size).toBeGreaterThan(1);
  });
  it('mỗi giới một việc; 3 hạnh khác nhau thuộc hai Ba-la-mật trọng tâm của tuần; nguyện của tuần', () => {
    const p = dayPlan(c, { date: '2026-11-15', week: 2, seed: 1 });
    expect(Object.values(p.gioi).map((x) => x.gioi)).toEqual([1, 2, 3, 4, 5]);
    expect(p.focus).toEqual(['sacca', 'khanti']);
    expect(p.hanh).toHaveLength(3); expect(new Set(p.hanh.map((x) => x.id)).size).toBe(3);
    expect(p.hanh.every((x) => ['sacca', 'khanti'].includes(x.parami[0]))).toBe(true);
    expect(new Set(p.hanh.map((x) => x.parami[0]))).toEqual(new Set(['sacca', 'khanti']));   // cả hai Ba-la-mật trọng tâm đều có mặt
    expect(p.nguyen.id).toBe('sn-nguyen-tuan-2');
    expect(dayPlan(c, { date: '2026-11-15', week: 5 }).nguyen).toBe(null);
  });
  it('một Ba-la-mật thiếu việc: bù từ Ba-la-mật kia cho đủ 3', () => {
    const few = catalog(ITEMS.filter((x) => !x.id.startsWith('sn-hanh-khanti-') || x.id === 'sn-hanh-khanti-01'));
    const p = dayPlan(few, { date: '2026-11-15', week: 2, seed: 3 });
    expect(p.hanh).toHaveLength(3); expect(p.hanh.filter((x) => x.parami[0] === 'khanti')).toHaveLength(1);
  });
  it('danh mục rỗng: không lỗi', () => { const p = dayPlan(catalog([]), { date: '2026-11-15', week: 1 }); expect(p.hanh).toEqual([]); expect(p.gioi[1]).toBe(null); });
  it('băm và chọn ổn định', () => { expect(hash32('abc')).toBe(hash32('abc')); expect(pickN([{ id: 'a' }, { id: 'b' }], 5, 'k')).toHaveLength(2); });
});

describe('sổ việc chủ động', () => {
  it('đặt và bỏ giới; giữ đủ năm giới', () => {
    let A = {}; for (const g of [1, 2, 3, 4, 5]) A = setAct(A, '2026-11-15', `gioi.${g}`, { id: `sn-gioi-${g}-01`, parami: ['sila', 'metta'] });
    expect(fullGioi(A['2026-11-15'])).toBe(true);
    A = setAct(A, '2026-11-15', 'gioi.3', null);
    expect(fullGioi(A['2026-11-15'])).toBe(false); expect(Object.keys(A['2026-11-15'].gioi)).toEqual(['1', '2', '4', '5']);
  });
  it('đường dẫn lạ, ngày sai: giữ nguyên; mã Ba-la-mật lạ bị bỏ', () => {
    const A = setAct({}, '2026-11-15', 'hanh', { id: 'x', parami: ['metta', 'zzz'], done: false });
    expect(A['2026-11-15'].hanh).toEqual({ id: 'x', parami: ['metta'], done: false });
    expect(setAct(A, '2026-11-15', 'tien', { id: 'y' })).toBe(A); expect(setAct(A, '15/11', 'hanh', { id: 'y' })).toBe(A); expect(setAct(A, '2026-11-15', 'gioi.6', { id: 'y' })).toBe(A);
  });
  it('Ba-la-mật trong ngày: hạnh chỉ tính khi đã làm xong; mỗi mã một lần', () => {
    let A = setAct({}, '2026-11-15', 'gioi.1', { id: 'a', parami: ['sila', 'metta'] });
    A = setAct(A, '2026-11-15', 'gioi.2', { id: 'b', parami: ['sila', 'dana'] });
    A = setAct(A, '2026-11-15', 'hanh', { id: 'h', parami: ['khanti'], done: false });
    expect([...actParami(A['2026-11-15'])].sort()).toEqual(['dana', 'metta', 'sila']);
    A = setAct(A, '2026-11-15', 'hanh', { id: 'h', parami: ['khanti'], done: true });
    expect(actParami(A['2026-11-15']).has('khanti')).toBe(true);
    const L = lotus({}, {}, 0, A); expect(L.counts.sila).toBe(1); expect(L.counts.khanti).toBe(1);
  });
  it('lịch tu tính cả việc chủ động và đánh dấu ngày giữ đủ giới', () => {
    let A = {}; for (const g of [1, 2, 3, 4, 5]) A = setAct(A, '2026-11-15', `gioi.${g}`, { id: `g${g}`, parami: ['sila'] });
    const c = calendar({}, {}, '2026-11-15', 49, A);
    expect(c[48]).toMatchObject({ any: true, gioi: true });
  });
});

describe('ngày trai theo âm lịch', () => {
  const L = (day, monthLength = 30) => ({ day, monthLength });
  it('tứ trai (mặc định): mùng 1, 14, rằm, ngày cuối tháng', () => {
    expect([1, 14, 15, 30].every((d) => isTraiDay(L(d)))).toBe(true);
    expect(isTraiDay(L(29, 29))).toBe(true); expect(isTraiDay(L(29, 30))).toBe(false); expect(isTraiDay(L(8))).toBe(false);
  });
  it('nhị trai, lục trai, thập trai; tháng thiếu tính lùi từ ngày cuối', () => {
    expect([1, 15].every((d) => isTraiDay(L(d), 'vn_2'))).toBe(true); expect(isTraiDay(L(14), 'vn_2')).toBe(false);
    expect([8, 14, 15, 23, 29, 30].every((d) => isTraiDay(L(d), 'vn_6'))).toBe(true); expect(isTraiDay(L(28, 29), 'vn_6')).toBe(true);
    expect([27, 28, 29].every((d) => isTraiDay(L(d, 29), 'vn_10'))).toBe(true); expect(isTraiDay(L(27, 30), 'vn_10')).toBe(false);
    expect(isTraiDay(L(15), 'khong')).toBe(false); expect(isTraiDay(null)).toBe(false);
  });
});

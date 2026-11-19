import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { checkVariantCoverage, readContentRows } from '../../../scripts/content-data.mjs';
import { hash32 } from '../src/missions.js';
import {
  PILLARS, fitsProfile, pickVariant, rankVariants, snapHash, swapVariant, toVariant, variantCatalog, variantCoverage, variantSeed, weekOfDay,
} from '../src/variant.js';

// Hàng giống API: meta là chuỗi JSON (staging 19/11).
const row = (id, meta = {}, extra = {}) => ({
  id, version: 1, kind: 'chuong_trinh', tier: 0, lang: 'vi', title: id, body_inline: 'Một việc nhỏ.', source_ref: 'Nguồn thử', body_r2_key: null,
  meta: JSON.stringify({
    program: 'so-nhap-49', schema: 1, week: 1, pillar: 'duc', level: 'nhe', minutes: 3, money: false,
    at_home: true, outdoors: false, needs_others: false, punna: 'sila', parami: ['sila'], scope: 'doi_thuc', ...meta,
  }),
  ...extra,
});
const PROFILE = { level: 'sau', minutes: 120, time_window: 'linh_hoat', familiarity: null, precepts: [1, 2, 3, 4, 5], uposatha: 'vn_4', no_money: false, at_home: false };
const IN = { userId: 'u_01', cycle: 1, day: 1, pillar: 'duc' };

describe('toVariant', () => {
  it('nhận hàng API hợp lệ, meta chuỗi hoặc đối tượng', () => {
    const v = toVariant(row('sn49-w1-duc-a'));
    expect(v).toMatchObject({ id: 'sn49-w1-duc-a', version: 1, week: 1, pillar: 'duc', level: 'nhe', minutes: 3, money: false, at_home: true, text: 'Một việc nhỏ.' });
    const r = row('sn49-w1-duc-b'); r.meta = JSON.parse(r.meta);
    expect(toVariant(r)).not.toBeNull();
  });
  it('từ chối sai hợp đồng mà không ném lỗi', () => {
    const bad = [
      null, 42, { ...row('sn49-x'), kind: 'nhiem_vu' }, row('khac-tien-to'), row('sn49-x', {}, { version: 0 }),
      row('sn49-x', {}, { meta: '{hỏng' }), row('sn49-x', {}, { meta: '[]' }), row('sn49-x', {}, { body_inline: '   ' }),
      row('sn49-x', {}, { body_inline: 'a'.repeat(91) }), row('sn49-x', { program: 'khac' }), row('sn49-x', { schema: 2 }),
      row('sn49-x', { week: 8 }), row('sn49-x', { pillar: 'toString' }), row('sn49-x', { level: 'constructor' }), row('sn49-x', { minutes: 0 }),
      row('sn49-x', { minutes: 2.5 }), row('sn49-x', { money: true }), row('sn49-x', { at_home: 'true' }), row('sn49-x', { punna: 'xx' }),
      row('sn49-x', { parami: [] }), row('sn49-x', { parami: ['sila', 'sila'] }), row('sn49-x', { scope: 'cong_dong' }),
    ];
    for (const b of bad) expect(toVariant(b)).toBeNull();
  });
  it('90 ký tự NFC là trần thân câu', () => expect(toVariant(row('sn49-x', {}, { body_inline: 'ạ'.normalize('NFD').repeat(90) }))).not.toBeNull());
});

describe('variantCatalog', () => {
  it('mỗi id lấy phiên bản cao nhất, đủ 21 ô, snap sắp theo id', () => {
    const cat = variantCatalog([row('sn49-b', { minutes: 4 }, { version: 2 }), row('sn49-a'), row('sn49-b', {}, { version: 1 }), row('sn49-c', { week: 7, pillar: 'tue' })]);
    expect(Object.keys(cat.cells)).toHaveLength(21);
    expect(cat.n).toBe(3);
    expect(cat.snap).toBe('sn49-a@1,sn49-b@2,sn49-c@1');
    expect(cat.cells['1-duc'].find((v) => v.id === 'sn49-b').minutes).toBe(4);
    expect(cat.cells['7-tue'].map((v) => v.id)).toEqual(['sn49-c']);
  });
  it('không phụ thuộc thứ tự hàng', () => {
    const rows = [row('sn49-a'), row('sn49-b'), row('sn49-c'), row('sn49-d')];
    const A = variantCatalog(rows), B = variantCatalog([...rows].reverse());
    expect(B.snap).toBe(A.snap);
    expect(rankVariants(B, PROFILE, IN).map((v) => v.id)).toEqual(rankVariants(A, PROFILE, IN).map((v) => v.id));
  });
  it('rỗng và đầu vào rác vẫn trả 21 ô rỗng', () => {
    for (const x of [undefined, null, {}, [null, 1, 'x']]) expect(variantCatalog(x).n).toBe(0);
  });
});

describe('weekOfDay', () => {
  it('biên 7/8 và 49', () => {
    expect([1, 7, 8, 14, 43, 49].map(weekOfDay)).toEqual([1, 1, 2, 2, 7, 7]);
    for (const d of [0, 50, 1.5, '3', null]) expect(weekOfDay(d)).toBeNull();
  });
  it('ngày 7 và 8 lấy hai ô khác nhau', () => {
    const cat = variantCatalog([row('sn49-w1'), row('sn49-w2', { week: 2 })]);
    expect(pickVariant(cat, PROFILE, { ...IN, day: 7 }).id).toBe('sn49-w1');
    expect(pickVariant(cat, PROFILE, { ...IN, day: 8 }).id).toBe('sn49-w2');
    expect(pickVariant(cat, PROFILE, { ...IN, day: 49, pillar: 'tue' })).toBeNull();
  });
});

describe('fitsProfile', () => {
  const v = toVariant(row('sn49-x', { level: 'vua', minutes: 10, money: 'optional', at_home: false, outdoors: true }));
  it('phút và mức nhe < vua < sau', () => {
    expect(fitsProfile(v, PROFILE)).toBe(true);
    expect(fitsProfile(v, { ...PROFILE, minutes: 9 })).toBe(false);
    expect(fitsProfile(v, { ...PROFILE, level: 'nhe' })).toBe(false);
    expect(fitsProfile(v, { ...PROFILE, level: 'vua', minutes: 10 })).toBe(true);
  });
  it('miễn phí và tại nhà', () => {
    expect(fitsProfile(v, { ...PROFILE, no_money: true })).toBe(false);
    expect(fitsProfile(v, { ...PROFILE, at_home: true })).toBe(false);
    const free = toVariant(row('sn49-y'));
    expect(fitsProfile(free, { ...PROFILE, no_money: true, at_home: true })).toBe(true);
  });
  it('không có hồ sơ hay hồ sơ hỏng → không hợp', () => {
    for (const p of [null, undefined, {}, { ...PROFILE, level: 'x' }, { ...PROFILE, minutes: '15' }]) expect(fitsProfile(v, p)).toBe(false);
  });
});

describe('rankVariants / pickVariant', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'].map((s) => row(`sn49-w1-duc-${s}`));
  const cat = variantCatalog(rows);
  it('xếp theo hash32(seed|id) tăng dần, seed theo hợp đồng', () => {
    const seed = variantSeed(IN);
    expect(seed).toBe('["u_01",1,1,"duc"]');
    const want = rows.map((r) => r.id).sort((a, b) => hash32(`${seed}|${a}`) - hash32(`${seed}|${b}`) || (a < b ? -1 : 1));
    expect(rankVariants(cat, PROFILE, IN).map((v) => v.id)).toEqual(want);
    expect(pickVariant(cat, PROFILE, IN).id).toBe(want[0]);
  });
  it('tất định: cùng đầu vào cùng kết quả; đổi người/chu kỳ/ngày/trục thì seed đổi', () => {
    const ids = (x) => rankVariants(cat, PROFILE, x).map((v) => v.id).join();
    expect(ids(IN)).toBe(ids({ ...IN }));
    const seeds = new Set([IN, { ...IN, userId: 'u_02' }, { ...IN, cycle: 2 }, { ...IN, day: 2 }].map(variantSeed));
    expect(seeds.size).toBe(4);
  });
  it('một ô chỉ một lựa chọn hợp lệ', () => {
    const c = variantCatalog([row('sn49-nhe'), row('sn49-sau', { level: 'sau', minutes: 30 })]);
    expect(rankVariants(c, { ...PROFILE, level: 'nhe', minutes: 5 }, IN).map((v) => v.id)).toEqual(['sn49-nhe']);
  });
  it('không hồ sơ, đầu vào sai hoặc không mục nào hợp → rỗng/null', () => {
    expect(rankVariants(cat, null, IN)).toEqual([]);
    expect(pickVariant(cat, { ...PROFILE, minutes: 2 }, IN)).toBeNull();
    for (const bad of [{ ...IN, userId: '' }, { ...IN, cycle: 0 }, { ...IN, day: 50 }, { ...IN, pillar: 'constructor' }, null]) expect(rankVariants(cat, PROFILE, bad)).toEqual([]);
    expect(rankVariants(null, PROFILE, IN)).toEqual([]);
  });
  it('khác phiên bản danh mục → snap khác', () => {
    const c2 = variantCatalog([...rows, row('sn49-w1-duc-a', {}, { version: 2 })]);
    expect(c2.snap).not.toBe(cat.snap);
    expect(snapHash(c2)).not.toBe(snapHash(cat));
  });
});

describe('swapVariant', () => {
  const cat = variantCatalog(['a', 'b', 'c'].map((s) => row(`sn49-${s}`)));
  const list = rankVariants(cat, PROFILE, IN).map((v) => v.id);
  it('chọn mục kế tiếp khác mục hiện tại, vòng lại đầu', () => {
    expect(swapVariant(cat, PROFILE, IN, list[0])).toMatchObject({ same: false, variant: { id: list[1] } });
    expect(swapVariant(cat, PROFILE, IN, list[2]).variant.id).toBe(list[0]);
  });
  it('hết lựa chọn thì giữ mục hiện tại', () => {
    const one = variantCatalog([row('sn49-mot')]);
    expect(swapVariant(one, PROFILE, IN, 'sn49-mot')).toMatchObject({ same: true, variant: { id: 'sn49-mot' } });
    expect(swapVariant(cat, null, IN, list[0])).toEqual({ variant: null, same: true });
  });
  it('mục hiện tại không còn trong danh sách → mục đầu', () => {
    expect(swapVariant(cat, PROFILE, IN, 'sn49-da-rut')).toMatchObject({ same: false, variant: { id: list[0] } });
  });
});

describe('danh mục đã phát hành trong content/', () => {
  // Đúng các hàng bộ nạp #118 ghi vào D1 (meta là chuỗi JSON như API trả), nên Worker và client cùng dữ liệu.
  const rows = readContentRows(join(import.meta.dirname, '../../../content/program/so-nhap-49')).filter((r) => r.status === 'da_duyet');
  const cat = variantCatalog(rows);
  it('63 mục hợp lệ, phủ đủ 21 ô với phương án nhẹ, khớp kiểm độ phủ của bộ nạp', () => {
    expect(rows).toHaveLength(63);
    expect(cat.n).toBe(63);
    expect(() => checkVariantCoverage(rows)).not.toThrow();
    const cov = variantCoverage(cat);
    expect(cov.missing).toEqual([]);
    expect(cov.ready).toBe(true);
  });
  it('hồ sơ chặt nhất (nhẹ, 5 phút, miễn phí, tại nhà) vẫn có gợi ý mọi ngày mọi trục', () => {
    const tight = { ...PROFILE, level: 'nhe', minutes: 5, no_money: true, at_home: true };
    for (let day = 1; day <= 49; day++) for (const pillar of PILLARS) expect(pickVariant(cat, tight, { userId: 'u_01', cycle: 1, day, pillar })).not.toBeNull();
  });
});

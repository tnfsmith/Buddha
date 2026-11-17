import { describe, it, expect } from 'vitest';
import { checkPracticeEvent, foldPractice, importEvents, mergePractice, byTime, MAX_EVENTS_PER_DAY } from '../src/practice.js';
import { setAct, logPassive } from '../src/missions.js';

const ev = (id, at, date, kind, slot, value) => ({ id, at, date, kind, slot, value });

describe('checkPracticeEvent: chỉ nhận mã, không chữ tự do', () => {
  it('nhận đủ ba loại hợp lệ và chuẩn hóa', () => {
    expect(checkPracticeEvent({ date: '2026-11-16', kind: 'viec', slot: 'gioi.1', value: { id: 'sn-gioi-1-01', parami: ['sila', 'metta', 'sila'] } }))
      .toEqual({ ok: true, ev: { date: '2026-11-16', kind: 'viec', slot: 'gioi.1', value: { id: 'sn-gioi-1-01', parami: ['sila', 'metta'] } } });
    expect(checkPracticeEvent({ date: '2026-11-16', kind: 'viec', slot: 'hanh', value: { id: 'sn-hanh-metta-02', parami: ['metta'], done: true } }).ok).toBe(true);
    expect(checkPracticeEvent({ date: '2026-11-16', kind: 'viec', slot: 'nguyen', value: { tuan: 3, parami: ['adhitthana'] } }).ok).toBe(true);
    expect(checkPracticeEvent({ date: '2026-11-16', kind: 'viec', slot: 'trai', value: null }).ok).toBe(true);
    expect(checkPracticeEvent({ date: '2026-11-16', kind: 'vow', slot: '3', value: { id: 'sn-nguyen-tuan-3' } }).ok).toBe(true);
    expect(checkPracticeEvent({ date: '2026-11-16', kind: 'tu', slot: 'thoi_thien', value: { min: 15, refs: ['dai-thien'] } }).ev.value).toEqual({ n: 1, min: 15, refs: ['dai-thien'] });
    expect(checkPracticeEvent({ date: '2026-11-16', kind: 'tu', slot: 'hoi_huong', value: {}, at: 1763260000000.4 }).ev).toMatchObject({ at: 1763260000000, value: { n: 1, min: 0, refs: [] } });
  });
  it('từ chối ngày, loại, ô, giá trị sai và chữ tự do', () => {
    const bad = (p) => checkPracticeEvent(p).code;
    expect(bad(null)).toBe('invalid_event');
    expect(bad({ date: '16/11/2026', kind: 'viec', slot: 'hanh', value: null })).toBe('invalid_date');
    expect(bad({ date: '2026-13-40', kind: 'viec', slot: 'hanh', value: null })).toBe('invalid_date');
    expect(bad({ date: '2026-11-16', kind: 'diem', slot: 'x', value: null })).toBe('invalid_kind');
    expect(bad({ date: '2026-11-16', kind: 'viec', slot: 'gioi.6', value: null })).toBe('invalid_slot');
    expect(bad({ date: '2026-11-16', kind: 'vow', slot: '8', value: null })).toBe('invalid_slot');
    expect(bad({ date: '2026-11-16', kind: 'tu', slot: 'mua_hang', value: {} })).toBe('invalid_slot');
    expect(bad({ date: '2026-11-16', kind: 'viec', slot: 'hanh', value: { id: 'Hôm nay tôi giận', parami: [] } })).toBe('invalid_value');
    expect(bad({ date: '2026-11-16', kind: 'viec', slot: 'hanh', value: { id: 'sn-x', parami: ['tien'] } })).toBe('invalid_value');
    expect(bad({ date: '2026-11-16', kind: 'viec', slot: 'hanh', value: { id: 'sn-x', done: 'yes' } })).toBe('invalid_value');
    expect(bad({ date: '2026-11-16', kind: 'viec', slot: 'nguyen', value: { tuan: 9 } })).toBe('invalid_value');
    expect(bad({ date: '2026-11-16', kind: 'vow', slot: '1', value: {} })).toBe('invalid_value');
    expect(bad({ date: '2026-11-16', kind: 'tu', slot: 'thoi_thien', value: null })).toBe('invalid_value');
    expect(bad({ date: '2026-11-16', kind: 'tu', slot: 'thoi_thien', value: { n: 0 } })).toBe('invalid_value');
    expect(bad({ date: '2026-11-16', kind: 'tu', slot: 'thoi_thien', value: { min: 5000 } })).toBe('invalid_value');
    expect(bad({ date: '2026-11-16', kind: 'tu', slot: 'nghe_duong_xua', value: { refs: ['ghi chú riêng'] } })).toBe('invalid_value');
    expect(bad({ date: '2026-11-16', kind: 'tu', slot: 'thoi_thien', value: {}, at: 'hôm qua' })).toBe('invalid_at');
    expect(MAX_EVENTS_PER_DAY).toBeGreaterThanOrEqual(40);
  });
});

describe('foldPractice: hai máy cùng một hành trình', () => {
  const D = '2026-11-16';
  it('việc: sự kiện sau thắng, bỏ đánh dấu thì xóa, trùng giờ thì theo mã', () => {
    const f = foldPractice([
      ev('B', 2000, D, 'viec', 'gioi.1', null),                                   // máy PC bỏ sau
      ev('A', 1000, D, 'viec', 'gioi.1', { id: 'sn-gioi-1-01', parami: ['sila'] }),  // điện thoại giữ trước
      ev('C', 1500, D, 'viec', 'gioi.4', { id: 'sn-gioi-4-02', parami: ['sacca'] }),
      ev('E', 3000, D, 'viec', 'hanh', { id: 'sn-hanh-metta-01', parami: ['metta'], done: false }),
      ev('D', 3000, D, 'viec', 'hanh', { id: 'sn-hanh-viriya-01', parami: ['viriya'], done: false }),
      ev('F', 4000, D, 'viec', 'hanh', { id: 'sn-hanh-metta-01', parami: ['metta'], done: true }),
    ]);
    expect(f.viec[D].gioi).toEqual({ 4: { id: 'sn-gioi-4-02', parami: ['sacca'] } });
    expect(f.viec[D].hanh).toEqual({ id: 'sn-hanh-metta-01', parami: ['metta'], done: true });
  });
  it('trùng giờ: mã lớn hơn thắng (cùng kết quả trên mọi máy)', () => {
    const a = ev('a', 5, D, 'viec', 'hanh', { id: 'sn-a', parami: [] }), b = ev('b', 5, D, 'viec', 'hanh', { id: 'sn-b', parami: [] });
    expect(foldPractice([a, b]).viec[D].hanh.id).toBe('sn-b');
    expect(foldPractice([b, a]).viec[D].hanh.id).toBe('sn-b');
    expect([b, a].sort(byTime).map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('ngày bỏ hết việc thì không còn trong sổ', () => {
    const f = foldPractice([ev('1', 1, D, 'viec', 'trai', { id: 'sn-trai-bat-quan', parami: ['sila'] }), ev('2', 2, D, 'viec', 'trai', null)]);
    expect(f.viec).toEqual({});
  });
  it('nguyện tuần theo tuần, bỏ nguyện thì xóa', () => {
    const f = foldPractice([ev('1', 1, D, 'vow', '2', { id: 'sn-nguyen-tuan-2' }), ev('2', 2, D, 'vow', '3', { id: 'sn-nguyen-tuan-3' }), ev('3', 3, D, 'vow', '3', null)]);
    expect(f.nguyen).toEqual({ 2: { id: 'sn-nguyen-tuan-2', at: 1 } });
  });
  it('sổ tự ghi nhận cộng dồn giống logPassive trên một máy', () => {
    let L = {}; L = logPassive(L, D, 'nghe_duong_xua', { ref: 'dx-01' }); L = logPassive(L, D, 'nghe_duong_xua', { ref: 'dx-02' }); L = logPassive(L, D, 'thoi_thien', { minutes: 15, ref: 'dai-thien' });
    const f = foldPractice([
      ev('1', 1, D, 'tu', 'nghe_duong_xua', { refs: ['dx-01'] }), ev('2', 2, D, 'tu', 'nghe_duong_xua', { refs: ['dx-02'] }),
      ev('3', 3, D, 'tu', 'thoi_thien', { min: 15, refs: ['dai-thien'] }),
    ]);
    expect(f.tu).toEqual(L);
  });
  it('bỏ qua sự kiện hỏng, không ném lỗi', () => {
    expect(foldPractice([ev('x', 1, 'sai', 'viec', 'hanh', null), { id: 'y' }, null, ev('z', 2, D, 'tu', 'van_du', { min: 5 })]).tu[D].van_du).toEqual({ n: 1, min: 5, refs: [] });
    expect(foldPractice(undefined)).toEqual({ viec: {}, nguyen: {}, tu: {} });
  });
});

describe('importEvents + mergePractice: đưa dữ liệu cũ lên một lần, không mất, không cộng đôi', () => {
  it.each(['00:00:00', '06:20:00', '06:59:59', '07:00:00', '12:00:00'])('giữ nguyện ngày đầu lúc %s +07 dù ngày UTC có thể còn là hôm trước', (time) => {
    const from = '2026-11-17', S = { nguyen: { 1: { id: 'sn-nguyen-tuan-1', at: Date.parse(`${from}T${time}+07:00`) } } };
    const events = importEvents(S, from, 'stable1');
    expect(events).toEqual([{ id: 'imp.stable1.20261117.vow.1', date: from, kind: 'vow', slot: '1',
      value: { id: 'sn-nguyen-tuan-1' }, at: Date.parse(from) - 86400000 }]);
    expect(importEvents(S, from, 'stable1')).toEqual(events);
    expect(foldPractice(events).nguyen[1].id).toBe('sn-nguyen-tuan-1');
  });
  it('chỉ bù chênh một ngày ở biên chu kỳ, giữ mã cũ ngoài biên và lọc nguyện quá cũ', () => {
    const S = { nguyen: { 1: { id: 'sn-nguyen-tuan-1', at: Date.parse('2026-11-14T12:00:00Z') },
      2: { id: 'sn-nguyen-tuan-2', at: Date.parse('2026-11-18T12:00:00Z') } } };
    expect(importEvents(S, '2026-11-17', 'stable1').map((e) => e.id)).toEqual(['imp.stable1.20261118.vow.2']);
    expect(importEvents(S, undefined, 'stable1').map((e) => e.id)).toEqual(['imp.stable1.20261114.vow.1', 'imp.stable1.20261118.vow.2']);
  });
  const S = {
    viec: setAct(setAct(setAct({}, '2026-11-16', 'gioi.2', { id: 'sn-gioi-2-03', parami: ['sila', 'dana'] }), '2026-11-16', 'hanh', { id: 'sn-hanh-metta-01', parami: ['metta'], done: true }), '2026-11-10', 'gioi.1', { id: 'sn-gioi-1-01', parami: ['sila'] }),
    nguyen: { 1: { id: 'sn-nguyen-tuan-1', at: Date.parse('2026-11-14T02:00:00Z') } },
    tu: { '2026-11-15': { thoi_thien: { n: 3, min: 45, refs: ['dai-thien'] } }, '2026-11-01': { van_du: { n: 1, min: 6, refs: [] } } },
  };
  const evs = importEvents(S, '2026-11-14', '01KXYZ7CJ9JBQW');
  it('chỉ lấy các ngày của chu kỳ hiện tại, mã cố định theo máy, giờ là đầu ngày', () => {
    expect(evs.map((e) => e.id).sort()).toEqual(['imp.01KXYZ7CJ9JBQW.20261114.vow.1', 'imp.01KXYZ7CJ9JBQW.20261115.tu.thoi_thien', 'imp.01KXYZ7CJ9JBQW.20261116.viec.gioi.2', 'imp.01KXYZ7CJ9JBQW.20261116.viec.hanh']);
    expect(evs.every((e) => e.id.length <= 64 && e.at < Date.parse(e.date + 'T00:00:00Z'))).toBe(true);
    expect(importEvents(S, '2026-11-14', '01KXYZ7CJ9JBQW')).toEqual(evs);
  });
  it('gộp lại cho đúng sổ trên máy (các ngày trong chu kỳ)', () => {
    const f = foldPractice(evs);
    expect(f.viec['2026-11-16']).toEqual(S.viec['2026-11-16']);
    expect(f.tu['2026-11-15']).toEqual(S.tu['2026-11-15']);
    expect(f.nguyen[1].id).toBe('sn-nguyen-tuan-1');
  });
  it('thao tác thật sau đó luôn thắng bản đưa lên', () => {
    const f = foldPractice([...evs, ev('01REAL', Date.parse('2026-11-16T01:00:00Z'), '2026-11-16', 'viec', 'gioi.2', null)]);
    expect(f.viec['2026-11-16'].gioi).toEqual({});
  });
  it('mergePractice: ngày trước chu kỳ chỉ có trên máy thì giữ, còn lại theo bản gộp', () => {
    const m = mergePractice(S, foldPractice(evs), '2026-11-14');
    expect(m.viec['2026-11-10']).toEqual(S.viec['2026-11-10']);
    expect(m.tu['2026-11-01']).toEqual(S.tu['2026-11-01']);
    expect(m.viec['2026-11-16']).toEqual(S.viec['2026-11-16']);
    expect(Object.keys(m.nguyen)).toEqual(['1']);
  });
});

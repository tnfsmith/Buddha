import { describe, expect, it } from 'vitest';
import { DUR, MILESTONES, ZONE_UNLOCK, GATE_FULL_DAY, gateLevel, advance, allDone } from '../src/schedule.js';
import { STAGES, ZONES } from '../../../apps/web/src/data.js';

const full = { duc: {}, thien: {}, tue: {} };

describe('Thời thiền 15 phút, 7 mốc chuẩn', () => {
  it('900 giây', () => expect(DUR).toBe(900));
  it('7 mốc 00:00 · 02:00 · 05:00 · 07:00 · 09:30 · 11:00 · 13:30', () => expect(MILESTONES.map((m) => m.t)).toEqual([0, 120, 300, 420, 570, 660, 810]));
  it('kịch bản âm thanh trong apps/web khớp 7 mốc', () => {
    expect(STAGES.map((s) => s.t0)).toEqual(MILESTONES.map((m) => m.t));
    expect(STAGES.at(-1).t1).toBe(DUR);
  });
});

describe('Phân khu Vân Đảo', () => {
  it('ngày mở trong apps/web khớp luật chung', () => {
    for (const z of ZONES) expect(z.unlock, z.id).toBe(ZONE_UNLOCK[z.id]);
  });
  it('Cổng Vân Môn nửa mở ngày 29, mở hẳn ngày 43', () => {
    expect([gateLevel(28), gateLevel(29), gateLevel(42), gateLevel(GATE_FULL_DAY)]).toEqual([0, 0.5, 0.5, 1]);
  });
});

describe('Khóa 1 nấc mỗi ngày', () => {
  it('đủ 3 trục và đã qua ngày mới thì tiến 1 ngày', () => {
    expect(advance({ day: 5, lastDate: '2026-11-12', done: { 5: full }, completed: false }, '2026-11-13')).toEqual({ day: 6, completed: false });
  });
  it('cùng ngày thì không tiến (chống nhảy ngày)', () => {
    expect(advance({ day: 5, lastDate: '2026-11-13', done: { 5: full }, completed: false }, '2026-11-13').day).toBe(5);
  });
  it('thiếu trục thì không tiến', () => {
    expect(advance({ day: 5, lastDate: '2026-11-12', done: { 5: { duc: {}, tue: {} } }, completed: false }, '2026-11-13').day).toBe(5);
  });
  it('vắng nhiều ngày vẫn chỉ tiến 1 nấc', () => {
    expect(advance({ day: 5, lastDate: '2026-10-01', done: { 5: full }, completed: false }, '2026-11-13').day).toBe(6);
  });
  it('ngày 49 đủ 3 trục thì hoàn tất, không vượt 49', () => {
    expect(advance({ day: 49, lastDate: '2026-11-12', done: { 49: full }, completed: false }, '2026-11-13')).toEqual({ day: 49, completed: true });
  });
  it('allDone', () => { expect(allDone({ 1: full }, 1)).toBe(true); expect(allDone({}, 1)).toBe(false); });
});

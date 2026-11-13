// legacy.import: đưa hành trình đang có trên máy lên lần đầu (T2.3, PROJECT_ROADMAP.md Phụ lục A); /me?entries=1 để máy mới dựng lại
import { describe, it, expect } from 'vitest';
import { getLocalDate } from '../src/utils/time.js';
import { call, guest, sync, confirm, DAY, TZ } from './helpers.js';
import { toImport, fromServer, hasProgress } from '../../../apps/web/src/net/account.js';

const full = (extra = {}) => ({ duc: { pre: 1, during: 1, post: 1, ...extra }, thien: { pre: 1, during: 1, post: 1 }, tue: { pre: 1, during: 1, post: 1 } });
const imp = (id, payload) => ({ id, type: 'legacy.import', at: Date.now(), payload });

describe('legacy.import', () => {
  it('nhận ngày hiện tại, lùi started_on, tính lại E, trả đủ chi tiết qua /me?entries=1', async () => {
    const { token } = await guest('Tâm An'), now = Date.now();
    const done = { 1: full({ wise: true, self: true, E: 9999 }), 2: full(), 3: { duc: { pre: 1.2, during: 1.2, post: 1.2, at: now - 60_000 } } };
    const r = await sync(token, [imp('IMP1', { day: 3, lastDate: getLocalDate(now, TZ), done, sacca: 2, sessions: 5 })]);
    expect(r.applied).toEqual(['IMP1']);
    expect(r.state.journey).toMatchObject({ day: 3, started_on: getLocalDate(now - 2 * DAY, TZ), last_done_on: getLocalDate(now, TZ), sacca_count: 2, sessions_done: 5 });
    expect(r.state.totals.duc).toBe(18.75 + 10 + 12);   // E do máy chủ tính, bỏ qua E client gửi
    const me = await (await call('/api/v1/me?entries=1', {}, token)).json();
    expect(me.entries).toHaveLength(7);
    expect(me.entries[0]).toMatchObject({ day: 1, pillar: 'duc', wise: 1, self: 1, e_score: 18.75 });
    // hôm nay đã xác nhận nên chưa sang ngày 4; ngày 3 vẫn xác nhận tiếp được
    const next = await sync(token, [confirm('N1', Date.now(), 3, 'thien')]);
    expect(next.applied).toEqual(['N1']);
    expect(next.state.journey.day).toBe(3);
  });

  it('từ chối khi hành trình máy chủ đã có dữ liệu, khi ngày đã qua thiếu trục, khi hệ số sai', async () => {
    const a = await guest();
    await sync(a.token, [confirm('A1', Date.now(), 1, 'duc')]);
    expect((await sync(a.token, [imp('IMP2', { day: 2, done: { 1: full() } })])).rejected).toEqual([{ id: 'IMP2', code: 'not_empty', retry: false }]);
    const b = await guest();
    expect((await sync(b.token, [imp('IMP3', { day: 3, done: { 1: full(), 2: { duc: { pre: 1, during: 1, post: 1 } } } })])).rejected[0].code).toBe('invalid_import');
    expect((await sync(b.token, [imp('IMP4', { day: 1, done: { 1: { duc: { pre: 50, during: 1, post: 1 } } } })])).rejected[0].code).toBe('invalid_import');
    expect((await sync(b.token, [imp('IMP5', { day: 99, done: {} })])).rejected[0].code).toBe('invalid_import');
  });

  it('"Dùng hành trình trên máy này": mở chu kỳ mới rồi nhập; chu kỳ cũ còn nguyên', async () => {
    const { token } = await guest();
    await sync(token, [confirm('C1', Date.now(), 1, 'duc')]);
    const r = await sync(token, [{ id: 'RST', type: 'journey.reset_cycle', at: Date.now() - 1 }, imp('IMP6', { day: 2, done: { 1: full() } })]);
    expect(r.applied).toEqual(['RST', 'IMP6']);
    expect(r.state.journey).toMatchObject({ cycle: 2, day: 2 });
    expect(r.state.totals.all).toBe(30);
  });

  it('sacca.add tăng hạt Chân thật; quá 8 thao tác một lần → 413', async () => {
    const { token } = await guest();
    const r = await sync(token, [{ id: 'SC1', type: 'sacca.add', at: Date.now() }]);
    expect(r.state.journey.sacca_count).toBe(1);
    const many = Array.from({ length: 9 }, (_, i) => ({ id: 'M' + i, type: 'sacca.add', at: Date.now() }));
    expect((await call('/api/v1/sync', { method: 'POST', body: JSON.stringify({ ops: many }) }, token)).status).toBe(413);
  });

  it('khứ hồi client: S trên máy → toImport → máy chủ → /me?entries=1 → fromServer cho lại đúng hành trình', async () => {
    const { token } = await guest('Tịnh Lạc'), now = Date.now(), today = getLocalDate(now, TZ);
    const e = (E, x = {}) => ({ E, pre: 1, during: 1, post: 1, wise: false, self: false, note: 'riêng tư, không gửi', at: now - DAY, ...x });
    const S = { day: 2, lastDate: today, completed: false, sacca: 1, sessions: 3, totals: { duc: 28.75, thien: 10, tue: 10 },
      done: { 1: { duc: e(18.75, { wise: true, self: true }), thien: e(10), tue: e(10) }, 2: { duc: e(10, { at: now - 1000 }) } } };
    expect(hasProgress(S)).toBe(true);
    const payload = toImport(S);
    expect(JSON.stringify(payload)).not.toContain('riêng tư');
    await call('/api/v1/profile', { method: 'PATCH', body: JSON.stringify({ look: { hair: 'ngan', robe: 2 }, settings: { birds: { n: 3, freq: 1, vol: 0.5 }, music: { on: true, source: 'time' } } }) }, token);
    expect((await sync(token, [imp('RT1', payload)])).applied).toEqual(['RT1']);
    const back = fromServer(await (await call('/api/v1/me?entries=1', {}, token)).json());
    expect(back).toMatchObject({ day: 2, lastDate: today, completed: false, sacca: 1, sessions: 3, totals: S.totals, name: 'Tịnh Lạc', look: { hair: 'ngan', robe: 2 }, birds: { n: 3 }, music: { on: true } });
    expect(back.done[1].duc).toMatchObject({ E: 18.75, wise: true, self: true, note: '' });
    expect(Object.keys(back.done[2])).toEqual(['duc']);
    // tài khoản mới chưa gửi diện mạo: không ghi đè diện mạo trên máy
    const fresh = await guest();
    expect(fromServer(await (await call('/api/v1/me?entries=1', {}, fresh.token)).json()).look).toBeUndefined();
  });
});

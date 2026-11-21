import { expect, it } from 'vitest';
import mission from '../../../content/nhiem-vu/so-nhap/sn-hanh-dana-01.md?raw';
import { contentRow, contentSql, parseContent } from '../../../scripts/content-data.mjs';
import { practiceSummary } from '../src/practice-summary.js';
import { call, env, guest, json } from './helpers.js';

const base = '/api/v1/practice/summary';
const when = (date) => Date.parse(date + 'T08:00:00Z');
const event = (uid, id, date, slot, value, cycle = 1) => env.DB.prepare(`INSERT INTO practice_event
  (user_id, id, program, cycle, local_date, kind, slot, value_json, at, server_at)
  VALUES (?, ?, 'so-nhap-49', ?, ?, 'tu', ?, ?, ?, ?)`)
  .bind(uid, id, cycle, date, slot, JSON.stringify(value), when(date), when(date)).run();
const entry = (uid, id, date, day, pillar, score, punna = null) => env.DB.prepare(`INSERT INTO kusala_entry
  (user_id, id, program, cycle, day, pillar, local_date, pre, during, post, wise, self, e_score, punna, note, at, server_at)
  VALUES (?, ?, 'so-nhap-49', 1, ?, ?, ?, 1, 1, 1, 0, 1, ?, ?, 'ghi chú riêng', ?, ?)`)
  .bind(uid, id, day, pillar, date, score, punna, when(date), when(date)).run();

it('tổng kết yêu cầu phiên, kiểm range và trả kết quả rỗng cho đúng chu kỳ', async () => {
  const anonymous = await json(await call(base + '?range=week'));
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get('cache-control')).toBe('no-store');
  const { token } = await guest();
  for (const invalid of ['', '?range=month']) {
    const result = await json(await call(base + invalid, {}, token));
    expect(result).toMatchObject({ status: 400, data: { error: { code: 'invalid_range' } } });
  }
  const result = await json(await call(base + '?range=week', {}, token));
  expect(result.status).toBe(200);
  expect(result.data).toMatchObject({
    program: 'so-nhap-49', cycle: 1, range: 'week',
    pillars: { duc: 0, thien: 0, tue: 0, all: 0 }, punna: {}, meditation_minutes: 0,
  });
  expect(result.data.from).toBe(result.data.to);
  expect(Object.values(result.data.lotus.counts)).toEqual(Array(10).fill(0));
});

it('giới hạn tuần theo lịch hồ sơ và sổ đã ghi; không cộng đôi thời thiền', async () => {
  const { user } = await guest();
  const other = await guest();
  const id = user.id;
  await env.DB.prepare("UPDATE journey SET started_on = '2026-10-01', day = 15, sacca_count = 2 WHERE user_id = ?").bind(id).run();
  await entry(id, 'old-confirmed', '2026-10-08', 6, 'duc', 11, 'sila');
  await entry(id, 'recent-confirmed', '2026-10-09', 8, 'duc', 12, 'sila');
  await entry(id, 'no-source', '2026-10-15', 15, 'thien', 8, 'unrecognized');
  await event(id, 'old-sit', '2026-10-08', 'thoi_thien', { n: 1, min: 20 });
  await event(id, 'sit-a', '2026-10-09', 'thoi_thien', { n: 1, min: 12.1 });
  await event(id, 'sit-b', '2026-10-09', 'thoi_thien', { n: 1, min: 13.2 });
  await event(id, 'listen', '2026-10-15', 'nghe_duong_xua', { n: 1, min: 5 });
  await event(id, 'old-cycle', '2026-10-15', 'thoi_thien', { n: 1, min: 80 }, 2);
  await event(other.user.id, 'other-person', '2026-10-15', 'thoi_thien', { n: 1, min: 80 });
  await env.DB.prepare(`INSERT INTO practice_session
    (id, user_id, kind, started_at, duration_s, completed, server_at) VALUES ('same-sit', ?, 'thien15', ?, 900, 1, ?)`)
    .bind(id, when('2026-10-09'), when('2026-10-09')).run();
  const week = await practiceSummary(env.DB, id, 'week', when('2026-10-15'));
  expect(week).toMatchObject({
    from: '2026-10-09', to: '2026-10-15',
    pillars: { duc: 12, thien: 8, tue: 0, all: 20 },
    punna: { sila: 1, bhavana: 2, dhammassavana: 1 }, meditation_minutes: 25.3,
  });
  expect(week.lotus.counts.adhitthana).toBe(1);
  expect(week.lotus.counts.sacca).toBe(1);
  expect(JSON.stringify(week)).not.toContain('ghi chú riêng');
  const cycle = await practiceSummary(env.DB, id, 'cycle', when('2026-10-15'));
  expect(cycle).toMatchObject({ from: '2026-10-01', to: '2026-10-15', meditation_minutes: 45.3 });
  expect(cycle.lotus.counts.sacca).toBe(3);
});

it('chỉ đếm hạnh có ghi đã làm và có nguồn công khai', async () => {
  const { user } = await guest();
  const row = contentRow(parseContent(mission));
  await env.DB.exec(contentSql([row]));
  const write = (id, value, at) => env.DB.prepare(`INSERT INTO practice_event
    (user_id, id, program, cycle, local_date, kind, slot, value_json, at, server_at)
    VALUES (?, ?, 'so-nhap-49', 1, (SELECT started_on FROM journey WHERE user_id = ?), 'viec', 'hanh', ?, ?, ?)`)
    .bind(user.id, id, user.id, JSON.stringify(value), at, at).run();
  const now = Date.now();
  await write('unfinished', { id: row.id, parami: ['dana'], done: false }, now - 3);
  expect((await practiceSummary(env.DB, user.id, 'week', now)).punna).toEqual({});
  await write('finished', { id: row.id, parami: ['dana'], done: true }, now - 2);
  expect((await practiceSummary(env.DB, user.id, 'week', now)).punna).toEqual({ veyyavacca: 1 });
  await env.DB.exec(contentSql([{ ...row, version: 2, status: 'ngung' }]));
  expect((await practiceSummary(env.DB, user.id, 'week', now)).punna).toEqual({});
});

it('chu kỳ hoàn thành chốt ngày kết thúc theo múi giờ hồ sơ', async () => {
  const { user } = await guest();
  await env.DB.prepare("UPDATE profile SET tz = 'America/Los_Angeles' WHERE user_id = ?").bind(user.id).run();
  await env.DB.prepare("UPDATE journey SET started_on = '2026-09-01', day = 49, completed_at = ? WHERE user_id = ?")
    .bind(Date.parse('2026-10-21T02:00:00Z'), user.id).run();
  await event(user.id, 'before-cutoff', '2026-10-20', 'thoi_thien', { n: 1, min: 15 });
  await event(user.id, 'after-cutoff', '2026-10-21', 'thoi_thien', { n: 1, min: 15 });
  const result = await practiceSummary(env.DB, user.id, 'week', when('2026-10-23'));
  expect(result).toMatchObject({ from: '2026-10-14', to: '2026-10-20', meditation_minutes: 15 });
});

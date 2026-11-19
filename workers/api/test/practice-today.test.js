import { beforeEach, describe, expect, it } from 'vitest';
import { PILLARS, rankVariants, snapHash, variantCatalog } from '@vandao/shared/variant.js';
import { contentRow, contentSql, parseContent } from '../../../scripts/content-data.mjs';
import { linkGuest } from '../src/auth/link.js';
import { changePracticeChoice } from '../src/practice-swap.js';
import { call, confirm, env, guest, json, sync } from './helpers.js';

const base = '/api/v1/practice';
const profile = {
  level: 'sau', minutes: 30, time_window: 'toi', familiarity: null, precepts: [1, 2, 5],
  uposatha: 'vn_4', no_money: false, at_home: false,
};
const fixture = import.meta.glob('../../../content/program/so-nhap-49/*.md', {
  eager: true, query: '?raw', import: 'default',
});
const rows = Object.values(fixture).map((raw) => contentRow(parseContent(raw)));
const catalog = variantCatalog(rows);
const get = (token) => call(base + '/today', {}, token).then(json);
const put = (token, p, rev = 0) => call(base + '/profile', { method: 'PUT', body: JSON.stringify({ profile: p, rev }) }, token).then(json);
const exported = (token) => call('/api/v1/export', {}, token).then(json).then((r) => r.data.practice_choices);
const count = async (userId) => (await env.DB.prepare('SELECT COUNT(*) AS n FROM practice_choice WHERE user_id = ?').bind(userId).first()).n;
const swap = (token, input) => call(base + '/swap', { method: 'POST', body: JSON.stringify(input) }, token).then(json);
const inputOf = ({ cycle, day, date, suggestions }, op_id, pillar = 'duc') => {
  const { id, version } = suggestions[pillar].variant;
  return { op_id, cycle, day, date, pillar, current: { id, version } };
};
const syncSwap = (token, { op_id, ...payload }, at = Date.now()) => sync(token, [{ id: op_id, payload, type: 'practice.swap', at }]);

beforeEach(async () => {
  expect(rows).toHaveLength(63);
  await env.DB.prepare("DELETE FROM content_item WHERE kind = 'chuong_trinh'").run();
  await env.DB.exec(contentSql(rows));
});

describe('đổi gợi ý trực tiếp và qua outbox', () => {
  it('hai thiết bị chỉ đổi một lần; gửi lại bằng cả hai đường và phát hiện ID dùng lại', async () => {
    const { token, user } = await guest();
    await put(token, profile);
    const today = (await get(token)).data;
    const a = inputOf(today, 'swap-direct'), b = inputOf(today, 'swap-outbox');
    const [direct, offline] = await Promise.all([swap(token, a), syncSwap(token, b)]);
    const directWon = direct.status === 200;
    expect(offline.applied).toEqual(directWon ? [] : [b.op_id]);
    if (directWon) expect(offline.rejected[0]).toMatchObject({ code: 'practice_swap_used', retry: false });
    else expect(direct.data.error.code).toBe('practice_swap_used');

    const winner = directWon ? a : b;
    const after = (await get(token)).data;
    expect(after.suggestions.duc).toMatchObject({ swapped: true, confirmed: false });
    expect(after.suggestions.duc.variant.text).not.toBe(today.suggestions.duc.variant.text);
    expect(await count(user.id)).toBe(3);
    expect((await swap(token, winner)).data).toEqual(after);
    expect((await syncSwap(token, winner)).applied).toEqual([winner.op_id]);
    const reuse = await syncSwap(token, { ...inputOf(today, winner.op_id, 'thien') });
    expect(reuse.rejected[0]).toMatchObject({ code: 'practice_swap_id_conflict', retry: false });
    const wrongType = await sync(token, [{ id: winner.op_id, type: 'sacca.add', at: Date.now() }]);
    expect(wrongType.rejected[0].code).toBe('practice_swap_id_conflict');
    expect(wrongType.state.totals.all).toBe(0);
    expect(wrongType.state.journey.sacca_count).toBe(0);
  });

  it('ca xác nhận và lựa chọn đã đổi từ chối mà không tiêu thêm lượt', async () => {
    const { token } = await guest();
    await put(token, profile);
    const today = (await get(token)).data;
    const a = inputOf(today, 'after-confirm');
    await sync(token, [confirm('confirmed-before-swap', Date.now(), today.day, 'duc')]);
    expect((await swap(token, a)).data.error.code).toBe('practice_pillar_confirmed');
    const b = inputOf(today, 'wrong-choice', 'tue');
    expect((await swap(token, { ...b, current: { ...b.current, version: 99 } })).data.error.code).toBe('practice_choice_changed');
    expect((await swap(token, b)).status).toBe(200);
  });

  it('qua ngày hoặc reset chỉ xác nhận thao tác cũ đã thắng, không áp thao tác khác lên ngày mới', async () => {
    const { token, user } = await guest();
    await put(token, profile);
    const today = (await get(token)).data;
    const a = inputOf(today, 'won-before-midnight'), b = inputOf(today, 'unsent-before-midnight', 'thien');
    expect((await swap(token, a)).status).toBe(200);
    const tomorrow = Date.now() + 86_400_000;
    expect(await changePracticeChoice(env.DB, user.id, a, tomorrow)).toEqual({ ok: true });
    expect(await changePracticeChoice(env.DB, user.id, b, tomorrow)).toMatchObject({ code: 'stale_day' });
    await sync(token, [{ id: 'swap-reset', type: 'journey.reset_cycle', at: Date.now() }]);
    expect((await syncSwap(token, a)).applied).toEqual([a.op_id]);
    expect((await syncSwap(token, b)).rejected[0]).toMatchObject({ code: 'stale_cycle', retry: false });
    expect((await get(token)).data.suggestions.duc.swapped).toBe(false);
  });

  it('danh mục thiếu độ phủ chặn đổi và giữ nguyên lựa chọn đã chốt', async () => {
    const { token } = await guest();
    await put(token, profile);
    const today = (await get(token)).data;
    const a = inputOf(today, 'no-alternative');
    await env.DB.prepare('DELETE FROM content_item WHERE id = ?').bind(rows.at(-1).id).run();
    expect((await swap(token, a)).data.error.code).toBe('practice_no_alternative');
    expect((await get(token)).data.suggestions.duc.swapped).toBe(false);
    await env.DB.exec(contentSql([rows.at(-1)]));
    expect((await swap(token, a)).status).toBe(200);
  });

  it('gộp khách không mất lựa chọn khi hai tài khoản dùng trùng một ID', async () => {
    const from = await guest(), to = await guest();
    await put(from.token, profile);
    await put(to.token, profile);
    const first = inputOf((await get(from.token)).data, 'same-id-in-two-accounts');
    const second = inputOf((await get(to.token)).data, first.op_id);
    expect((await swap(from.token, first)).status).toBe(200);
    expect((await swap(to.token, second)).status).toBe(200);
    const kept = (await get(from.token)).data.suggestions.duc;
    await linkGuest(env.DB, from.user, to.user);
    expect((await get(to.token)).data.suggestions.duc).toEqual(kept);
    expect((await syncSwap(to.token, first)).applied).toEqual([first.op_id]);
  });
});

describe('gợi ý hôm nay', () => {
  it('yêu cầu phiên, trả gợi ý tuần khi chưa có hồ sơ và không lưu dòng rỗng', async () => {
    const denied = await get();
    expect(denied.status).toBe(401);
    expect(denied.headers.get('cache-control')).toBe('no-store');
    const { token, user } = await guest();
    const result = await get(token);
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.data).toMatchObject({ cycle: 1, day: 1, profile_rev: 0, meditation: null });
    for (const pillar of PILLARS) expect(result.data.suggestions[pillar]).toEqual({ variant: null, swapped: false, confirmed: false });
    expect(await count(user.id)).toBe(0);
  });

  it.each([1, 8, 49])('ngày %i: cùng bộ chọn, hồ sơ 5 phút miễn phí tại nhà và đọc đồng thời', async (day) => {
    const { token, user } = await guest();
    const options = { ...profile, level: 'nhe', minutes: 5, no_money: true, at_home: true };
    const saved = await put(token, options);
    expect(saved.status).toBe(200);
    await env.DB.prepare('UPDATE journey SET day = ? WHERE user_id = ?').bind(day, user.id).run();
    const [a, b] = await Promise.all([get(token), get(token)]);
    expect(a.data).toEqual(b.data);
    expect(a.data).toMatchObject({
      day, cycle: 1, profile_rev: saved.data.rev, snap: snapHash(catalog),
      meditation: { time_window: 'toi', standard_minutes: 15, suggested_minutes: 5 },
    });
    for (const pillar of PILLARS) {
      const [want] = rankVariants(catalog, options, { userId: user.id, cycle: 1, day, pillar });
      expect(a.data.suggestions[pillar]).toMatchObject({ variant: { id: want.id, version: want.version }, confirmed: false, swapped: false });
    }
    expect(await count(user.id)).toBe(3);
  });

  it('giữ đúng phiên bản đã chốt khi có bản mới, chuyển về gợi ý tuần khi bị ngừng', async () => {
    const { token, user } = await guest();
    await put(token, profile);
    const original = (await get(token)).data.suggestions.duc.variant;
    const old = rows.find((row) => row.id === original.id);
    await env.DB.exec(contentSql([{ ...old, version: 2, body_inline: 'Đọc lại một câu cho rõ.' }]));
    expect((await get(token)).data.suggestions.duc.variant).toEqual(original);
    await env.DB.exec(contentSql([{ ...old, version: 3, status: 'ngung' }]));
    const broken = (await get(token)).data.suggestions.duc;
    expect(broken.variant).toBeNull();
    expect(await count(user.id)).toBe(3);
    const log = await sync(token, [confirm('practice-today-confirm', Date.now(), 1, 'duc')]);
    expect(log.applied).toEqual(['practice-today-confirm']);
    expect((await get(token)).data.suggestions.duc).toMatchObject({ confirmed: true, variant: null });
    expect(await exported(token)).toContainEqual(expect.objectContaining({ variant_id: original.id, version: original.version }));
  });

  it('thiếu độ phủ hoặc đã hoàn thành thì không tạo gợi ý mới', async () => {
    const { token, user } = await guest();
    await put(token, profile);
    await env.DB.prepare('DELETE FROM content_item WHERE id = ?').bind(rows[0].id).run();
    expect((await get(token)).data.suggestions.duc.variant).toBeNull();
    await env.DB.exec(contentSql([rows[0]]));
    await env.DB.prepare('UPDATE journey SET day = 49, completed_at = ? WHERE user_id = ?').bind(Date.now(), user.id).run();
    const r = await get(token);
    for (const pillar of PILLARS) expect(r.data.suggestions[pillar].variant).toBeNull();
    expect(await count(user.id)).toBe(0);
  });

  it('đổi chu kỳ giữ lịch sử và xóa tài khoản dọn mọi lựa chọn', async () => {
    const { token, user } = await guest();
    await put(token, profile);
    expect((await get(token)).data.cycle).toBe(1);
    await sync(token, [{ id: 'practice-today-reset', type: 'journey.reset_cycle', at: Date.now() }]);
    expect((await get(token)).data.cycle).toBe(2);
    const choices = await exported(token);
    expect(choices.map((row) => row.cycle)).toEqual([1, 1, 1, 2, 2, 2]);
    expect(choices.every((row) => !('swap_op_id' in row))).toBe(true);
    await env.DB.prepare('DELETE FROM user WHERE id = ?').bind(user.id).run();
    expect(await count(user.id)).toBe(0);
  });

  it.each([false, true])('gộp khách khi đã có tiến trình đích = %s', async (hasProgress) => {
    const from = await guest(), to = await guest(hasProgress ? 'Tịnh Lạc' : undefined);
    await put(from.token, profile);
    await put(to.token, profile);
    const fromChoices = (await get(from.token)).data.suggestions;
    const toChoices = (await get(to.token)).data.suggestions;
    await linkGuest(env.DB, from.user, to.user);
    expect((await get(to.token)).data.suggestions).toEqual(hasProgress ? toChoices : fromChoices);
    expect(await count(from.user.id)).toBe(0);
    expect(await count(to.user.id)).toBe(3);
  });
});

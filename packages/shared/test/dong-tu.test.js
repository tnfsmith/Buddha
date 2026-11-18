import { describe, it, expect } from 'vitest';
import {
  makeInviteCode, normInviteCode, showInviteCode, inviteUrl, inviteFromHash, parseFriendQuery, closenessOf, presenceOf, seenBucket,
  canTravel, canMeet, canVisitAway, checkMeetPayload, meetPhase, meetStartAt, nearIsles,
  MEET_KINDS, LINES, REASON_TEXT, ONLINE_MS, INVITE_TTL_MS, MEET_LEAD_MS, NEAR_ISLES,
} from '../src/dong-tu.js';

describe('mã mời và liên kết', () => {
  it('8 ký tự Crockford, không I L O U, chuẩn hóa lỗi gõ thường gặp', () => {
    const c = makeInviteCode(new Uint8Array([0, 1, 31, 32, 200, 18, 22, 27]));
    expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(normInviteCode(showInviteCode(c).toLowerCase())).toBe(c);
    expect(normInviteCode('ab0o-1il1')).toBe('AB001111');
    expect(normInviteCode('ABCD-EFGU')).toBeNull();
    expect(normInviteCode('ABC')).toBeNull();
    expect(() => makeInviteCode(new Uint8Array(4))).toThrow();
  });
  it('liên kết …/#ban=MÃ đọc lại được, kể cả có tham số khác', () => {
    const u = inviteUrl('https://vandao.ainextbrain.com/', 'K7M2QX9A');
    expect(u).toBe('https://vandao.ainextbrain.com/#ban=K7M2QX9A');
    expect(inviteFromHash('#ban=K7M2-QX9A')).toBe('K7M2QX9A');
    expect(inviteFromHash('#q=0&ban=k7m2qx9a')).toBe('K7M2QX9A');
    expect(inviteFromHash('#view=board')).toBeNull();
  });
});

describe('tìm đúng Tịnh danh · mã (không tìm gần đúng)', () => {
  it('nhận các cách viết thường gặp, chuẩn hóa NFC và hoa đầu chữ', () => {
    expect(parseFriendQuery('Tuệ Thái · 5696')).toEqual({ tinh_danh: 'Tuệ Thái', tag: '5696' });
    expect(parseFriendQuery('  tuệ   thái #5696 ')).toEqual({ tinh_danh: 'Tuệ Thái', tag: '5696' });
    expect(parseFriendQuery('Tuệ Thái 5696')).toEqual({ tinh_danh: 'Tuệ Thái', tag: '5696' });
    expect(parseFriendQuery('Tuệ Thái - 5696')).toEqual({ tinh_danh: 'Tuệ Thái', tag: '5696' });
  });
  it('thiếu mã, mã sai độ dài, ký tự lạ thì không tìm', () => {
    expect(parseFriendQuery('Tuệ Thái')).toBeNull();
    expect(parseFriendQuery('Tuệ Thái · 56')).toBeNull();
    expect(parseFriendQuery('Tuệ_Thái · 5696')).toBeNull();
    expect(parseFriendQuery('')).toBeNull();
  });
});

describe('thân thiết và hiện diện', () => {
  it('thân thiết chỉ khi cả hai cùng chọn', () => {
    expect(closenessOf(true, true)).toBe('than');
    expect(closenessOf(true, false)).toBe('quen');
    expect(closenessOf(false, false)).toBe('quen');
  });
  it('quá 3 phút không có nhịp thì là vắng; trạng thái lạ cũng là vắng', () => {
    const now = 1_000_000_000;
    expect(presenceOf({ state: 'thien', updated_at: now - ONLINE_MS + 1 }, now)).toBe('thien');
    expect(presenceOf({ state: 'online', updated_at: now - ONLINE_MS - 1 }, now)).toBe('vang');
    expect(presenceOf({ state: 'dang_xem_phim', updated_at: now }, now)).toBe('vang');
    expect(presenceOf(null, now)).toBe('vang');
  });
  it('lần cuối thấy chỉ ở mức thô', () => {
    const now = 10 * 86_400_000;
    expect(seenBucket(now - 60_000, now)).toBe('vua_xong');
    expect(seenBucket(now - 3_600_000, now)).toBe('hom_nay');
    expect(seenBucket(now - 3 * 86_400_000, now)).toBe('tuan_nay');
    expect(seenBucket(now - 9 * 86_400_000, now)).toBe('lau_roi');
    expect(seenBucket(undefined, now)).toBeNull();
  });
});

describe('canMeet: mời gặp theo phân khu đã mở và cổng Vân Môn', () => {
  const rel = { accepted: true, blocked: false };
  const P = (day, o = {}) => ({ day, completed: false, open: true, presence: 'online', ...o });
  it('cùng ngồi thiền: người được mời chưa đi được thì ngồi chung ở Đại Thiền Đường', () => {
    expect(canMeet('thien', P(30), P(3), rel)).toMatchObject({ ok: true, place: 'dtd', host: 'from', guest: 'to' });
    expect(canMeet('thien', P(30), P(31), rel)).toMatchObject({ ok: true, place: 'dao' });
  });
  it('ghé thăm cần người đi thăm đã mở nửa cổng (ngày 29) và chủ đảo đang Nghênh khách', () => {
    expect(canMeet('tham', P(30), P(10), rel)).toMatchObject({ ok: false, code: 'guest_gate_closed' });
    expect(canMeet('tham', P(30, { open: false }), P(30), rel)).toMatchObject({ ok: false, code: 'host_doc_cu' });
    expect(canMeet('xin_tham', P(30), P(40, { open: false }), rel)).toMatchObject({ ok: false, code: 'host_doc_cu' });
    expect(canMeet('xin_tham', P(30), P(2), rel)).toMatchObject({ ok: true, host: 'to', guest: 'from', place: 'dao' });
    expect(canMeet('tham', P(5), P(1, { completed: true }), rel).ok).toBe(true);
  });
  it('Trà Đạo cần Trà Đạo Tỉnh Thức của chủ đảo đã mở (ngày 15)', () => {
    expect(canMeet('tra', P(12), P(35), rel)).toMatchObject({ ok: false, code: 'tea_closed' });
    expect(canMeet('tra', P(15), P(35), rel).ok).toBe(true);
    expect(canMeet('tra', P(15), P(35), rel, 'dtd')).toMatchObject({ ok: false, code: 'invalid_place' });
  });
  it('chưa kết nối, đã chặn, bạn vắng thì không mời; bạn đang thiền thì lời mời chờ (quiet)', () => {
    expect(canMeet('thien', P(30), P(30), { accepted: false })).toMatchObject({ ok: false, code: 'not_companion' });
    expect(canMeet('thien', P(30), P(30), { accepted: true, blocked: true })).toMatchObject({ ok: false, code: 'blocked' });
    expect(canMeet('thien', P(30), P(30, { presence: 'vang' }), rel)).toMatchObject({ ok: false, code: 'friend_away' });
    expect(canMeet('thien', P(30), P(30, { presence: 'thien' }), rel)).toMatchObject({ ok: true, quiet: true });
    expect(canMeet('nhay_mua', P(30), P(30), rel)).toMatchObject({ ok: false, code: 'invalid_kind' });
  });
  it('ghé khi bạn vắng: chỉ thân thiết, bạn cho phép, mình đi được', () => {
    const r = { accepted: true, blocked: false, closeness: 'than', allowAway: true };
    expect(canVisitAway(P(30), r)).toBe(true);
    expect(canVisitAway(P(20), r)).toBe(false);
    expect(canVisitAway(P(30), { ...r, closeness: 'quen' })).toBe(false);
    expect(canVisitAway(P(30), { ...r, allowAway: false })).toBe(false);
    expect(canTravel({ day: 1, completed: true })).toBe(true);
  });
  it('mọi mã lý do đều có câu hiện cho người dùng; mọi kiểu gặp có lời mẫu', () => {
    for (const code of ['blocked', 'not_companion', 'friend_away', 'guest_gate_closed', 'host_doc_cu', 'tea_closed', 'invalid_place']) expect(REASON_TEXT[code]).toBeTruthy();
    for (const k of Object.keys(MEET_KINDS)) expect(LINES[k]).toBeTruthy();
  });
});

describe('lời mời gặp: thân yêu cầu và pha theo giờ máy chủ', () => {
  it('kiểm thân yêu cầu', () => {
    expect(checkMeetPayload({ to: '01M7BTQZ8K', kind: 'thien' })).toEqual({ ok: true, v: { to: '01M7BTQZ8K', kind: 'thien', place: null } });
    expect(checkMeetPayload({ to: '01M7BTQZ8K', kind: 'thien', place: 'dtd' }).ok).toBe(true);
    expect(checkMeetPayload({ to: 'x', kind: 'thien' }).code).toBe('invalid_to');
    expect(checkMeetPayload({ to: '01M7BTQZ8K', kind: 'karaoke' }).code).toBe('invalid_kind');
    expect(checkMeetPayload({ to: '01M7BTQZ8K', kind: 'tra', place: 'bien' }).code).toBe('invalid_place');
    expect(checkMeetPayload(null).code).toBe('invalid_payload');
  });
  it('chờ → hết hạn sau 10 phút; nhận → sắp (60 giây) → đang → xong sau 15 phút thiền', () => {
    const t0 = 5_000_000;
    expect(meetPhase({ kind: 'thien', status: 'cho', created_at: t0 }, t0 + 1000)).toMatchObject({ phase: 'cho' });
    expect(meetPhase({ kind: 'thien', status: 'cho', created_at: t0 }, t0 + INVITE_TTL_MS + 1).phase).toBe('het_han');
    const acc = t0 + 30_000, start = meetStartAt('thien', acc);
    expect(start).toBe(acc + MEET_LEAD_MS);
    const inv = { kind: 'thien', status: 'dong_y', created_at: t0, responded_at: acc, start_at: start };
    expect(meetPhase(inv, acc + 10_000)).toMatchObject({ phase: 'sap', startIn: MEET_LEAD_MS - 10_000 });
    expect(meetPhase(inv, start + 60_000).phase).toBe('dang');
    expect(meetPhase(inv, start + 15 * 60_000).phase).toBe('xong');
    expect(meetStartAt('tham', acc)).toBe(acc);
    expect(meetPhase({ kind: 'tham', status: 'dong_y', created_at: t0, responded_at: acc, start_at: acc }, acc + 3 * 3_600_000).phase).toBe('dang');
    expect(meetPhase({ kind: 'tra', status: 'tu_choi', created_at: t0 }, t0).phase).toBe('tu_choi');
  });
});

describe('nearIsles: dựng Vân Đảo bạn đồng tu gần đảo mình', () => {
  it('thân thiết ở vòng gần nhất, rồi quen biết; mỗi nhóm theo lúc kết nối; có giới hạn', () => {
    const L = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: 'q' + i, closeness: 'quen', accepted_at: 100 - i })),
      { id: 't2', closeness: 'than', accepted_at: 50 }, { id: 't1', closeness: 'than', accepted_at: 10 },
    ];
    const r = nearIsles(L);
    expect(r.slice(0, 2)).toEqual([{ id: 't1', closeness: 'than', ring: 0 }, { id: 't2', closeness: 'than', ring: 0 }]);
    expect(r.filter((x) => x.ring === 1).map((x) => x.id)).toEqual(['q5', 'q4', 'q3', 'q2']);
    expect(r.length).toBe(2 + NEAR_ISLES.quen);
    expect(nearIsles(null)).toEqual([]);
  });
});

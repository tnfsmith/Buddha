import { describe, expect, it } from 'vitest';
import { INVITE_TTL_MS, LINK_USES, MEET_LEAD_MS } from '@vandao/shared/dong-tu.js';
import { call, env, guest, json } from './helpers.js';

const base = '/api/v1';
const db = env.DB;
async function callAsync(person, path, method, body, headers) {
  return call(base + path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }), headers }, person?.token);
}
// Giữ lỗi và payload trong cùng helper để ca kiểm so sánh đúng giao thức JSON.
async function api(person, path, method = 'GET', body, headers) {
  return json(await callAsync(person, path, method, body, headers));
}

async function link(from, to) {
  const created = await api(from, '/companions/link', 'POST', {});
  expect(created.status).toBe(200);
  const result = await api(to, '/companions/link/' + created.data.code + '/accept', 'POST');
  expect(result.status).toBe(201);
  return created.data.code;
}
async function named(name, tag) {
  const actor = await guest(name);
  if (tag) await db.prepare('UPDATE profile SET tag = ? WHERE user_id = ?').bind(tag, actor.user.id).run();
  return actor;
}
const id = (p) => p.user.id;
const list = async (p) => (await api(p, '/companions')).data;
const prefs = (p, changes, open) => api(p, '/profile', 'PATCH', {
  settings: { dong_tu: { hien_trang_thai: true, cho_tim: true, hien_ngay: true, ...changes } },
  ...(open === undefined ? {} : { island: { open } }),
});
const day = (p, value) => db.prepare('UPDATE journey SET day = ? WHERE user_id = ? AND is_current = 1').bind(value, id(p)).run();
const setPresence = (p, state) => api(p, '/presence', 'POST', { state });
const setCompanion = (p, other, body) => api(p, '/companions/' + id(other), 'PATCH', body);
const ask = (p, query) => api(p, '/companions/request', 'POST', { query });
const code = (r) => r.data?.error?.code;

describe('Bạn đồng tu trên Worker/D1 #122', () => {
  it('mã mời công khai, một mã còn hạn, nhận bởi khách, giới thiệu, hết lượt, hết hạn và đổi mã', async () => {
    const owner = await named('Tuệ Thái', '5696'), receiver = await guest();
    const created = await api(owner, '/companions/link', 'POST', {});
    expect(created.data.uses_left).toBe(LINK_USES);
    const key = created.data.code;
    expect((await api(owner, '/companions/link', 'POST', {})).data.code).toBe(key);
    expect(await api(null, '/companions/link/' + key)).toMatchObject({
      status: 200, data: { owner: { tinh_danh: 'Tuệ Thái', tag: '5696' }, valid: true },
    });
    expect(code(await api(owner, '/companions/link/' + key + '/accept', 'POST'))).toBe('self');
    expect((await api(receiver, '/companions/link/' + key + '/accept', 'POST')).status).toBe(201);
    expect(code(await api(receiver, '/companions/link/' + key + '/accept', 'POST'))).toBe('already_companion');
    expect((await api(owner, '/companions/link', 'POST', {})).data.uses_left).toBe(LINK_USES - 1);
    expect((await list(receiver)).companions[0].id).toBe(id(owner));
    expect((await list(owner)).companions[0].id).toBe(id(receiver));
    const guide = await db.prepare('SELECT guide_id FROM guidance WHERE newcomer_id = ?').bind(id(receiver)).first();
    expect(guide).toEqual({ guide_id: id(owner) });
    await db.prepare('UPDATE invite SET uses_left=0 WHERE code=?').bind(key).run();
    expect(code(await api(receiver, '/companions/link/' + key + '/accept', 'POST'))).toBe('link_used_up');
    await db.prepare('UPDATE invite SET uses_left=1, expires_at=0 WHERE code=?').bind(key).run();
    expect(code(await api(receiver, '/companions/link/' + key + '/accept', 'POST'))).toBe('link_expired');
    const renewed = await api(owner, '/companions/link', 'POST', { renew: true });
    expect(renewed.data.code).not.toBe(key);
    expect(code(await api(null, '/companions/link/' + key))).toBe('link_invalid');
  });

  it('hai phiên nhận lượt cuối cùng đồng thời chỉ một lần thành bạn', async () => {
    const owner = await guest(), one = await guest(), two = await guest();
    const key = (await api(owner, '/companions/link', 'POST', {})).data.code;
    await db.prepare('UPDATE invite SET uses_left=1 WHERE code=?').bind(key).run();
    const both = await Promise.all([one, two].map((p) => api(p, '/companions/link/' + key + '/accept', 'POST')));
    expect(both.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(both.find((r) => r.status === 409).data.error.code).toBe('link_used_up');
    expect((await list(owner)).companions).toHaveLength(1);
  });

  it('tìm tên qua năm trường hợp có cùng phản hồi, từ chối kín và đủ 5 lượt cả khi không tìm thấy', async () => {
    const sender = await named('Tuệ Minh'), real = await named('Tâm An','1101');
    const disabled = await named('Tâm Hòa','1103'), hidden = await named('Tâm Minh','1104'), denied = await named('Tâm Hiền','1105');
    await prefs(disabled, { cho_tim: false });
    await api(hidden, '/profile', 'PATCH', { visibility: 'an' });
    await api(denied, '/blocks', 'POST', { user: id(sender) });
    const outgoing = [];
    for (const query of ['Tâm An · 1101','Tuệ An · 1102','Tâm Hòa · 1103','Tâm Minh · 1104','Tâm Hiền · 1105']) {
      const result = await ask(sender, query);
      expect(result.status).toBe(202);
      expect(Object.keys(result.data.request).sort()).toEqual(['at','expires_at','id','tag','tinh_danh']);
      outgoing.push(result.data.request);
    }
    expect((await list(sender)).outgoing).toEqual(expect.arrayContaining(outgoing));
    for (const rejected of [disabled, hidden, denied]) expect((await list(rejected)).incoming).toEqual([]);
    const me = await api(real, '/me');
    expect(me.data).toMatchObject({ dong_tu: 1, social: { requests: 1, invites: 0 } });
    const incoming = (await list(real)).incoming;
    expect(incoming.map((r) => r.id)).toEqual([outgoing[0].id]);
    expect((await api(real, '/companions/requests/' + incoming[0].id + '/respond', 'POST', { accept: false })).status).toBe(204);
    expect((await list(real)).incoming).toEqual([]);
    expect((await list(sender)).outgoing).toEqual(expect.arrayContaining(outgoing));
    expect(code(await ask(sender, 'Tuệ An · 1106'))).toBe('rate_limited');
  });

  it('đồng ý đúng người, từ chối riêng, gửi lại trong hạn trả dòng cũ và cho phép rút', async () => {
    const a = await guest(), b = await named('Tâm Hòa','2223'), c = await guest();
    const first = (await ask(a, 'Tâm Hòa · 2223')).data.request;
    expect((await ask(a, 'Tâm Hòa 2223')).data.request).toEqual(first);
    const path = '/companions/requests/' + first.id;
    expect((await api(c, path + '/respond', 'POST', { accept: true })).status).toBe(404);
    expect((await api(b, path + '/respond', 'POST', { accept: true })).status).toBe(201);
    expect((await list(a)).outgoing).toEqual([]);
    expect((await list(b)).companions[0].id).toBe(id(a));
    const other = (await ask(a, 'Tuệ Tâm · 9999')).data.request;
    expect((await api(a, '/companions/requests/' + other.id, 'DELETE')).status).toBe(204);
    expect((await list(a)).outgoing).toEqual([]);
  });

  it('thân thiết hai chiều và chỉ ghé khi cổng vẫn mở ở thời điểm ghé', async () => {
    const host = await guest(), visitor = await guest();
    await link(host, visitor);
    await day(visitor, 29);
    await prefs(host, {}, true);
    await setCompanion(host, visitor, { than: true, away: true });
    expect((await list(visitor)).companions[0].closeness).toBe('quen');
    const visit = () => api(visitor, '/visits/away', 'POST', { host: id(host) });
    expect(code(await visit())).toBe('not_than');
    await setCompanion(visitor, host, { than: true });
    expect((await list(visitor)).companions[0].closeness).toBe('than');
    expect((await visit()).data).toEqual({ ok: true });
    expect((await visit()).status).toBe(200);
    expect((await list(host)).visits).toHaveLength(1);
    await prefs(host, {}, false);
    expect(code(await visit())).toBe('host_doc_cu');
    expect((await list(host)).visits).toHaveLength(1);
  });

  it('mời gặp dùng ngày, cổng và hiện diện ở máy chủ; nhận lời sau một phút hoặc ngay khi ghé', async () => {
    const host = await guest(), visitor = await guest();
    await link(host, visitor);
    await day(host, 12);
    await day(visitor, 10);
    await prefs(host, {}, true);
    const meet = (kind, place) => api(host, '/meet', 'POST', { to: id(visitor), kind, place });
    expect(code(await meet('thien'))).toBe('friend_away');
    await setPresence(visitor, 'online');
    expect(code(await meet('tham'))).toBe('guest_gate_closed');
    const meditation = await meet('thien');
    expect(meditation.data.invite.place).toBe('dtd');
    const accept = (inv) => api(visitor, '/meet/' + inv.id + '/respond', 'POST', { accept: true });
    const held = (await accept(meditation.data.invite)).data.invite;
    expect(held.start_at - held.responded_at).toBe(MEET_LEAD_MS);
    await day(visitor, 29);
    expect(code(await meet('tra'))).toBe('tea_closed');
    await prefs(host, {}, false);
    expect(code(await meet('tham'))).toBe('host_doc_cu');
    await prefs(host, {}, true);
    const visit = (await meet('tham')).data.invite;
    const started = (await accept(visit)).data.invite;
    expect(started.start_at).toBe(started.responded_at);
    const older = (await meet('tham')).data.invite, newer = (await meet('tham')).data.invite;
    expect(code(await accept(older))).toBe('invite_not_pending');
    await db.prepare('UPDATE meet_invite SET created_at=? WHERE id=?').bind(Date.now() - INVITE_TTL_MS - 10_000, newer.id).run();
    expect(code(await accept(newer))).toBe('invite_expired');
    await db.prepare('DELETE FROM presence WHERE user_id=?').bind(id(visitor)).run();
    await prefs(visitor, { hien_trang_thai: false });
    expect((await meet('thien', 'dtd')).status).toBe(201);
    expect((await list(host)).companions[0].presence).toBeNull();
  });

  it('hiện diện cùng trạng thái không ghi thêm trước một phút và quá ba phút thì vắng', async () => {
    const viewer = await guest(), actor = await guest();
    await link(viewer, actor);
    expect((await setPresence(actor, 'thien')).status).toBe(204);
    const first = await db.prepare('SELECT updated_at FROM presence WHERE user_id=?').bind(id(actor)).first();
    await setPresence(actor, 'thien');
    expect(await db.prepare('SELECT updated_at FROM presence WHERE user_id=?').bind(id(actor)).first()).toEqual(first);
    await db.prepare('UPDATE presence SET updated_at=? WHERE user_id=?').bind(Date.now() - 181_000, id(actor)).run();
    expect((await list(viewer)).companions[0].presence).toBe('vang');
    await setPresence(actor, 'thien');
    expect((await list(viewer)).companions[0].presence).toBe('thien');
  });

  it.each([true,false])('chặn khi đang có lời kết nối chỉ vô hiệu phía nhận (%s)', async (senderBlocks) => {
    const tag = senderBlocks ? '4100' : '4101';
    const sender = await guest(), target = await named('Tuệ Thái', tag);
    const req = (await ask(sender, 'Tuệ Thái · ' + tag)).data.request;
    expect((await list(target)).incoming).toHaveLength(1);
    const [blocker, blocked] = senderBlocks ? [sender, target] : [target, sender];
    const linkCode = (await api(blocker, '/companions/link','POST',{})).data.code;
    await api(blocker, '/blocks', 'POST', { user: id(blocked) });
    expect((await list(sender)).outgoing).toEqual([req]);
    expect((await list(target)).incoming).toEqual([]);
    expect((await api(target, '/companions/requests/' + req.id + '/respond', 'POST', { accept: true })).status).toBe(404);
    expect(code(await api(blocked, '/companions/link/' + linkCode))).toBe('link_invalid');
    expect(code(await api(blocked, '/companions/link/' + linkCode + '/accept', 'POST'))).toBe('link_invalid');
    expect(code(await api(blocked, '/meet', 'POST', { to: id(blocker), kind: 'thien' }))).toBe('not_companion');
    expect(code(await api(blocked, '/visits/away', 'POST', { host: id(blocker) }))).toBe('not_companion');
    await api(blocker, '/blocks/' + id(blocked), 'DELETE');
    expect((await list(target)).incoming).toEqual([]);
  });

  it('chặn bỏ cặp đã kết nối và hủy lời mời, báo cáo riêng, kiểm phiên và dữ liệu hỏng', async () => {
    const a = await guest(), b = await guest();
    await link(a, b);
    await setPresence(b, 'online');
    const invite = (await api(a, '/meet', 'POST', { to: id(b), kind: 'thien' })).data.invite;
    expect((await api(b, '/me')).data.social.invites).toBe(1);
    await api(a, '/blocks', 'POST', { user: id(b) });
    expect((await list(b)).companions).toEqual([]);
    expect((await list(b)).invites).toEqual([]);
    expect((await db.prepare('SELECT status FROM meet_invite WHERE id=?').bind(invite.id).first()).status).toBe('huy');
    expect((await api(b, '/reports', 'POST', { target: id(a), context: 'island', reason: 'Kiểm chính sách' })).status).toBe(201);
    for (const [path, method] of [['/companions','GET'], ['/companions/link','POST'], ['/presence','POST'], ['/meet','POST'],
      ['/visits/away','POST'], ['/blocks','GET'], ['/reports','POST']]) expect((await api(null, path, method)).status).toBe(401);
    expect((await api(null, '/companions/link/%E0%A4%A')).status).toBe(400);
    expect(code(await api(a, '/meet', 'POST', { to: id(b), kind: 'toString' }))).toBe('invalid_kind');
    const badJson = await call(base + '/companions/request', { method: 'POST', body: '{' }, a.token);
    expect(badJson.status).toBe(400);
    expect(badJson.headers.get('Cache-Control')).toBe('no-store');
  });
});

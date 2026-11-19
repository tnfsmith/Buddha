import { describe, expect, it } from 'vitest';
import { LINK_USES } from '@vandao/shared/dong-tu.js';
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
});

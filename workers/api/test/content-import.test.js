import { it, expect } from 'vitest';
import { env, call } from './helpers.js';
import { publishedRow, contentSql } from '../../../scripts/content-data.mjs';

it('SQL công cụ nạp chạy thật trên D1: upsert idempotent, giữ bản khác và đọc lại API', async () => {
  const meta = { loat: 'duong-xua', phan: 1, thu_tu: 20, chuong: [4], dot: 'B' };
  const row = publishedRow({ id: 'kiem-nap', version: 2, kind: 'bai_giang', title: "Tên 'thử'", source_ref: 'Nguồn thử', status: 'da_duyet', meta, body: 'Ý đầu.\n> Pāli.\nÝ sau.' });
  await env.DB.exec(contentSql([row]));
  await env.DB.exec(contentSql([{ ...row, title: 'Đã cập nhật' }]));
  const stored = await env.DB.prepare('SELECT * FROM content_item WHERE id = ?').bind(row.id).all();
  expect(stored.results).toHaveLength(1);
  expect(stored.results[0]).toMatchObject({ title: 'Đã cập nhật', body_inline: row.body_inline, reviewed_at: null });
  await env.DB.exec(contentSql([{ ...row, version: 3 }]));
  const res = await call('/api/v1/content?kind=bai_giang');
  const { items } = await res.json();
  expect(items.filter(x => x.id === row.id).map(x => x.version)).toEqual([3, 2]);
  expect(items.filter(x => x.id === row.id).every(x => JSON.stringify(JSON.parse(x.meta)) === JSON.stringify(meta))).toBe(true);
  await env.DB.prepare('UPDATE content_item SET status = ? WHERE id = ?').bind('cho_duyet', row.id).run();
  expect((await (await call('/api/v1/content?kind=bai_giang')).json()).items.some(x => x.id === row.id)).toBe(false);
});

it('nhiem_vu: nạp cùng SQL, đọc đúng kind/meta và không lộ nháp trong API', async () => {
  const meta = { nhom: 'gioi', gioi: 1, parami: ['sila', 'metta'], punna: 'sila', tuan: null, minutes: 2, money: false, at_home: true, outdoors: false, needs_others: false, scope: 'doi_thuc' };
  const row = publishedRow({ id: 'kiem-nhiem-vu-87', version: 1, kind: 'nhiem_vu', tier: 0, lang: 'vi', title: 'Bảo vệ sự sống', source_ref: 'Tham khảo AN 8.39', status: 'da_duyet', meta, body: 'Dọn một vật sắc khỏi lối đi trong nhà.' });
  await env.DB.exec(contentSql([row]));
  await env.DB.exec(contentSql([row, { ...row, id: 'kiem-nhiem-vu-87-nhap', status: 'cho_duyet' }]));
  const res = await call('/api/v1/content?kind=nhiem_vu&tier=0'); expect(res.status).toBe(200);
  const { items } = await res.json();
  expect(items.every(x => x.kind === 'nhiem_vu')).toBe(true);
  expect(items.filter(x => x.id === row.id)).toHaveLength(1);
  const found = items.find(x => x.id === row.id);
  expect(found).toMatchObject({ body_inline: row.body_inline, body_r2_key: null, reviewed_at: null });
  expect(JSON.parse(found.meta)).toEqual(meta);
  expect(items.some(x => x.id === 'kiem-nhiem-vu-87-nhap')).toBe(false);
  expect((await (await call('/api/v1/content?kind=bai_giang')).json()).items.some(x => x.id === row.id)).toBe(false);
});

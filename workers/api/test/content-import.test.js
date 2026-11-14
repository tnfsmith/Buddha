import { it, expect } from 'vitest';
import { env, call } from './helpers.js';
import { publishedRow, contentSql } from '../../../scripts/content-data.mjs';

it('SQL công cụ nạp chạy thật trên D1: upsert idempotent, giữ bản khác và đọc lại API', async () => {
  const row = publishedRow({ id: 'kiem-nap', version: 2, kind: 'bai_giang', title: "Tên 'thử'", source_ref: 'Nguồn thử', status: 'da_duyet', body: 'Ý đầu.\n> Pāli.\nÝ sau.' });
  await env.DB.exec(contentSql([row]));
  await env.DB.exec(contentSql([{ ...row, title: 'Đã cập nhật' }]));
  const stored = await env.DB.prepare('SELECT * FROM content_item WHERE id = ?').bind(row.id).all();
  expect(stored.results).toHaveLength(1);
  expect(stored.results[0]).toMatchObject({ title: 'Đã cập nhật', body_inline: row.body_inline, reviewed_at: null });
  await env.DB.exec(contentSql([{ ...row, version: 3 }]));
  const res = await call('/api/v1/content?kind=bai_giang');
  const { items } = await res.json();
  expect(items.filter(x => x.id === row.id).map(x => x.version)).toEqual([3, 2]);
});

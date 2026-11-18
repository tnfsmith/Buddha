import { it, expect } from 'vitest';
import { env, call } from './helpers.js';
import { contentRow, contentSql } from '../../../scripts/content-data.mjs';

it('SQL công cụ nạp chạy thật trên D1: upsert idempotent, giữ bản khác và đọc lại API', async () => {
  const meta = { loat: 'duong-xua', phan: 1, thu_tu: 20, chuong: [4], dot: 'B' };
  const row = contentRow({ id: 'kiem-nap', version: 2, kind: 'bai_giang', title: "Tên 'thử'", source_ref: 'Nguồn thử', status: 'da_duyet', meta, body: 'Ý đầu.\n> Pāli.\nÝ sau.' });
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
  const row = contentRow({ id: 'kiem-nhiem-vu-87', version: 1, kind: 'nhiem_vu', tier: 0, lang: 'vi', title: 'Bảo vệ sự sống', source_ref: 'Tham khảo AN 8.39', status: 'da_duyet', meta, body: 'Dọn một vật sắc khỏi lối đi trong nhà.' });
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

it('rút phiên bản mới chặn bài, MP3 và cues cũ, giữ lịch sử để phát hành lại', async () => {
  const key = 'bai-giang/kiem-ngung/cu.mp3';
  const cues = 'bai-giang/kiem-ngung/cu.cues.json';
  const article = { id: 'kiem-ngung', version: 1, title: 'Bài thử rút', kind: 'bai_giang',
    source_ref: 'Nguồn thử', body: 'Ý thử.', status: 'da_duyet', body_r2_key: key };
  const first = contentRow(article);
  const listed = async () => {
    const { items } = await (await call('/api/v1/content?kind=bai_giang&tier=0')).json();
    return items.filter(x => x.id === article.id).map(x => x.version);
  };
  await env.DB.exec(contentSql([first, { ...first, version: 3, status: 'cho_duyet' }]));
  await env.MEDIA.put(key, '0123456789');
  await env.MEDIA.put(cues, '{}');
  expect(await listed()).toEqual([1]);
  const audio = await call('/media/' + key, { method: 'HEAD' });
  expect(audio.status).toBe(200);
  const etag = audio.headers.get('etag');
  // Phiên bản ngừng ở tier khác vẫn chặn bản cũ, kể cả lần nạp lại bản cũ.
  const stop = contentRow({ ...article, version: 2, tier: 1, status: 'ngung', body: '' });
  await env.DB.exec(contentSql([stop]));
  await env.DB.exec(contentSql([first]));
  expect(await listed()).toEqual([]);
  for (const path of [key, cues]) {
    for (const init of [{}, { method: 'HEAD' }, { headers: { Range: 'bytes=0-1', 'If-None-Match': etag } }]) {
      const response = await call('/media/' + path, init);
      expect(response.status).toBe(404);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  }
  expect(await env.MEDIA.head(key)).not.toBeNull();
  const stored = await env.DB.prepare('SELECT version, status FROM content_item WHERE id = ? ORDER BY version').bind(article.id).all();
  expect(stored.results).toEqual([
    { version: 1, status: 'da_duyet' }, { version: 2, status: 'ngung' }, { version: 3, status: 'cho_duyet' },
  ]);
  const newKey = 'bai-giang/kiem-ngung/moi.mp3';
  await env.MEDIA.put(newKey, '9876543210');
  await env.DB.exec(contentSql([contentRow({ ...article, version: 4, body_r2_key: newKey })]));
  expect(await listed()).toEqual([4]);
  expect((await call('/media/' + newKey, { method: 'HEAD' })).status).toBe(200);
  expect((await call('/media/' + key, { method: 'HEAD' })).status).toBe(404);
});

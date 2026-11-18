import { expect, it } from 'vitest';
import { contentRow, contentSql } from '../../../scripts/content-data.mjs';
import { call, env } from './helpers.js';

it('nạp biến thể vào D1 thật, đọc riêng theo kind và rút được phiên bản cũ', async () => {
  const article = {
    id: 'sn49-w1-tue-d1-test', version: 1, kind: 'chuong_trinh', tier: 0, lang: 'vi',
    title: 'Việc thử', source_ref: 'Nguồn thử', status: 'da_duyet', body: 'Dừng lại và theo dõi ba hơi thở.',
    meta: { program: 'so-nhap-49', schema: 1, week: 1, pillar: 'tue', level: 'nhe', minutes: 3,
      money: false, at_home: true, outdoors: false, needs_others: false,
      punna: 'bhavana', parami: ['viriya'], scope: 'doi_thuc' },
  };
  const list = async (kind) => {
    const r = await call(`/api/v1/content?kind=${kind}&tier=0`);
    expect(r.status).toBe(200);
    return (await r.json()).items;
  };
  const draft = contentRow({ ...article, version: 2, status: 'cho_duyet' });
  expect(draft).toBeNull();
  await env.DB.exec(contentSql([contentRow(article)]));
  const found = (await list('chuong_trinh')).find((x) => x.id === article.id);
  expect(found).toMatchObject({ version: 1, kind: 'chuong_trinh', body_inline: article.body, body_r2_key: null });
  expect(JSON.parse(found.meta)).toEqual(article.meta);
  expect((await list('nhiem_vu')).some((x) => x.id === article.id)).toBe(false);

  await env.DB.exec(contentSql([contentRow({ ...article, version: 2, status: 'ngung' })]));
  expect((await list('chuong_trinh')).some((x) => x.id === article.id)).toBe(false);
  expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM content_item WHERE id = ?').bind(article.id).first()).toEqual({ n: 2 });
});

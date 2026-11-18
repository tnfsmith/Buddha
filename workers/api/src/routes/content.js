// workers/api/src/routes/content.js
// Nội dung đã chọn phát hành; không yêu cầu Hội đồng (ADR 0003).
import { Hono } from 'hono';
import { publicContent } from '../content-public.js';

const contentApp = new Hono();

contentApp.get('/', async (c) => {
  const db = c.env.DB;
  const tier = c.req.query('tier');
  const kind = c.req.query('kind');

  let sql = `SELECT id, version, kind, tier, lang, title, body_inline, body_r2_key, source_ref, reviewed_at, meta
             FROM content_item AS item
             WHERE ${publicContent}`;
  const params = [];

  if (tier !== undefined && tier !== '') {
    sql += ` AND tier = ?`;
    params.push(Number(tier));
  }
  if (kind) {
    sql += ` AND kind = ?`;
    params.push(kind);
  }

  sql += ` ORDER BY tier ASC, id ASC, version DESC`;

  const results = await db.prepare(sql).bind(...params).all();

  return c.json({
    items: results?.results || []
  });
});

export default contentApp;

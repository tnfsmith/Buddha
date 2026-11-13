// workers/api/src/routes/content.js
// Truy vấn nội dung giáo lý và bài giảng đã duyệt (PROJECT_ROADMAP.md §4.3, §16)
import { Hono } from 'hono';

const contentApp = new Hono();

contentApp.get('/', async (c) => {
  const db = c.env.DB;
  const tier = c.req.query('tier');
  const kind = c.req.query('kind');

  let sql = `SELECT id, version, kind, tier, lang, title, body_inline, source_ref, reviewed_at
             FROM content_item
             WHERE status = 'da_duyet'`;
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

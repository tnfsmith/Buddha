// #50: R2 chỉ công khai khi D1 của CHÍNH môi trường có bài đang phát hành.
import { Hono } from 'hono';
import { publicContent } from '../content-public.js';

const mediaApp = new Hono();
const matches = (header, etag) => header?.split(',').some(x => x.trim() === '*' || x.trim().replace(/^W\//, '') === etag);

function byteRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || !size) return null;
  const a = match[1] ? Number(match[1]) : null, b = match[2] ? Number(match[2]) : null;
  if ((a !== null && !Number.isSafeInteger(a)) || (b !== null && !Number.isSafeInteger(b))) return null;
  const start = a === null ? Math.max(0, size - b) : a;
  const end = a === null || b === null ? size - 1 : Math.min(b, size - 1);
  return start <= end && start < size ? { offset: start, length: end - start + 1 } : null;
}

mediaApp.on(['GET', 'HEAD'], '/*', async c => {
  let key;
  try { key = decodeURIComponent(new URL(c.req.url).pathname.slice('/media/'.length)); }
  catch { return c.notFound(); }
  if (!/^bai-giang\/[a-z0-9_./-]+\.(?:mp3|cues\.json)$/.test(key) || key.includes('..') || key.includes('//') || key.startsWith('bai-giang/_')) return c.notFound();
  if (!c.env.DB || !c.env.MEDIA) return c.notFound();
  const audioKey = key.replace(/\.cues\.json$/, '.mp3');
  const published = await c.env.DB.prepare(`SELECT 1 FROM content_item AS item
    WHERE item.kind = 'bai_giang' AND item.body_r2_key = ? AND ${publicContent} LIMIT 1`).bind(audioKey).first();
  if (!published) return c.body(null, 404, { 'Cache-Control': 'no-store' });
  const head = await c.env.MEDIA.head(key);
  if (!head) return c.notFound();
  const headers = new Headers({
    'Content-Type': key.endsWith('.mp3') ? 'audio/mpeg' : 'application/json; charset=utf-8',
    'Cache-Control': 'public, no-cache',
    'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', 'ETag': head.httpEtag,
    'Last-Modified': head.uploaded.toUTCString(),
  });
  if (matches(c.req.header('If-None-Match'), head.httpEtag)) return new Response(null, { status: 304, headers });
  let range;
  const requested = c.req.header('Range'), ifRange = c.req.header('If-Range');
  if (c.req.method === 'GET' && requested && (!ifRange || ifRange === head.httpEtag)) {
    range = byteRange(requested, head.size);
    if (!range) { headers.set('Content-Range', `bytes */${head.size}`); return new Response(null, { status: 416, headers }); }
    headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`);
  }
  headers.set('Content-Length', String(range ? range.length : head.size));
  if (c.req.method === 'HEAD') return new Response(null, { headers });
  const object = await c.env.MEDIA.get(key, range ? { range } : undefined);
  return object ? new Response(object.body, { status: range ? 206 : 200, headers }) : c.notFound();
});
mediaApp.all('*', c => c.body(null, 405, { Allow: 'GET, HEAD' }));
export default mediaApp;

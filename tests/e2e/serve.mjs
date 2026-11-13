// Máy chủ tĩnh tối giản cho kiểm thử PWA cục bộ: phục vụ apps/web/public, đường lạ trả index.html (giống Workers Static Assets).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('../../apps/web/public/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };
const port = +(process.env.PORT || 4173);

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = join(ROOT, path.endsWith('/') ? 'index.html' : path);
  let body = await readFile(file).catch(() => null);
  if (!body) { file = join(ROOT, 'index.html'); body = await readFile(file); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(body);
}).listen(port, '127.0.0.1', () => console.log(`serve: http://127.0.0.1:${port}/`));

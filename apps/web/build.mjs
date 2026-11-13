import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// npm workspaces đưa gói lên node_modules gốc, nên tìm thư mục phông theo cơ chế resolve của Node
const pkgDir = (pkg) => dirname(require.resolve(`@fontsource/${pkg}/package.json`));

const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// Phông nhúng sẵn (đủ dấu tiếng Việt, chạy không cần mạng)
const F = (pkg, file) => readFileSync(join(pkgDir(pkg), 'files', file)).toString('base64');
const RANGE = { vietnamese: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB', latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', 'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' };
const face = (family, pkg, sub, w) => `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${F(pkg, `${pkg}-${sub}-${w}-normal.woff2`)}) format("woff2");unicode-range:${RANGE[sub]}}`;
const fonts = [['Be Vietnam Pro', 'be-vietnam-pro', 'vietnamese', 400], ['Be Vietnam Pro', 'be-vietnam-pro', 'vietnamese', 600], ['Be Vietnam Pro', 'be-vietnam-pro', 'latin', 400], ['Be Vietnam Pro', 'be-vietnam-pro', 'latin', 600], ['Be Vietnam Pro', 'be-vietnam-pro', 'latin-ext', 400], ['Noto Serif', 'noto-serif', 'vietnamese', 600], ['Noto Serif', 'noto-serif', 'latin', 600]].map((a) => face(...a)).join('\n');
// Chuẩn hóa NFC: chữ có dấu luôn là một ký tự dựng sẵn, không bị rời dấu khi phông thiếu dấu tổ hợp
const html = readFileSync('src/index.template.html', 'utf8').replace('/*__FONTS__*/', () => fonts).replace('/*__BUNDLE__*/', () => js).normalize('NFC');

// 1. Ghi vào dist/van-dao.html
mkdirSync('dist', { recursive: true });
writeFileSync('dist/van-dao.html', html);

// 2. Bản web (public/) cho Cloudflare Workers Static Assets: thêm PWA (manifest, service worker, biểu tượng).
//    Bản HTML đơn ở dist/ giữ nguyên, mở bằng file:// vẫn chạy offline mà không cần service worker.
mkdirSync('public', { recursive: true });
const ICON = readFileSync('src/index.template.html', 'utf8').match(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]+)"/)[1];
const iconSvg = decodeURIComponent(ICON);
// Biểu tượng maskable: nền kín + thu nhỏ vào vùng an toàn 80 %
const maskable = iconSvg.replace(/<svg ([^>]*)viewBox='0 0 64 64'>/, "<svg $1viewBox='0 0 64 64'><rect width='64' height='64' fill='#f6efe2'/><g transform='translate(6.4 6.4) scale(.8)'>").replace(/<\/svg>$/, '</g></svg>');
writeFileSync('public/icon.svg', iconSvg);
writeFileSync('public/icon-maskable.svg', maskable);
writeFileSync('public/manifest.webmanifest', JSON.stringify({
  name: 'Vân Đạo — Tịnh Cảnh tu tập', short_name: 'Vân Đạo', lang: 'vi', dir: 'ltr',
  description: 'Không gian 3D tu tập, thiền tọa và học kinh',
  start_url: '/', scope: '/', display: 'standalone', orientation: 'any',
  background_color: '#f6efe2', theme_color: '#f6efe2',
  icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }, { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }],
}, null, 2));
const webHtml = html.replace('</head>', '<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#f6efe2"><link rel="apple-touch-icon" href="/icon-maskable.svg"></head>');
writeFileSync('public/index.html', webHtml);
const VERSION = createHash('sha256').update(webHtml).digest('hex').slice(0, 12);
writeFileSync('public/sw.js', `// Service worker Vân Đạo ${VERSION} — sinh bởi build.mjs, không sửa tay
const CACHE = 'vandao-${VERSION}';
const CORE = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('vandao-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/')) return;
  const cacheP = caches.open(CACHE);
  if (req.mode === 'navigate') {
    // Trang: ưu tiên mạng để luôn có bản mới; mất mạng hoặc chậm quá 3 giây thì dùng bản đã lưu
    const net = fetch(req).then(async (res) => { if (res.ok) await (await cacheP).put('/', res.clone()); return res; });
    e.waitUntil(net.catch(() => {}));
    e.respondWith(cacheP.then((c) => c.match('/')).then((cached) => (cached ? Promise.race([net.catch(() => cached), new Promise((r) => setTimeout(() => r(cached), 3000))]) : net)));
    return;
  }
  // Tài nguyên tĩnh: ưu tiên bản đã lưu
  e.respondWith(cacheP.then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
});
`);

console.log('Build hoàn tất: dist/van-dao.html & public/ (index.html, sw.js, manifest)', (html.length / 1024).toFixed(0) + ' KB');

import { build, transformSync } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// npm workspaces đưa gói lên node_modules gốc, nên tìm thư mục phông theo cơ chế resolve của Node
const pkgDir = (pkg) => dirname(require.resolve(`@fontsource/${pkg}/package.json`));

// Thu gọn mã GLSL có sẵn của three.js (#95, tiết kiệm ~12 KB): chỉ các dòng `var|const tên = "…";` mang mã shader trong three.module.js.
// Chuỗi được giải mã/mã lại bằng JSON (không lệch ký tự); mỗi dòng GLSL bỏ chú thích //, thụt lề, khoảng trắng thừa; bỏ dòng trống;
// dòng mã (không phải chỉ thị #) bỏ thêm khoảng trắng quanh , ; ( ) { } = < > ? : — không đụng + - * / để không sinh ra ++ -- // /*.
// Giữ xuống dòng (chỉ thị # cần dòng riêng, regex #include/unroll_loop của three cần) và nguyên dòng chỉ thị (vd. "#include <…>").
const shrink = (s) => s.split('\n').map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1').trim().replace(/[ \t]+/g, ' ')).filter(Boolean).map((l) => (l[0] === '#' ? l : l.replace(/ ?([,;(){}=<>?:]) ?/g, '$1'))).join('\n');
const glsl = { name: 'glsl', setup(b) { b.onLoad({ filter: /three[\\/]build[\\/]three\.module\.js$/ }, (a) => ({ loader: 'js', contents: readFileSync(a.path, 'utf8').replace(/^((?:var|const) [\w$]+ = )("(?:[^"\\\n]|\\.)*");$/gm, (m, h, q) => {
  try { const s = JSON.parse(q); return s.includes('\n') && /gl_|vec[234]|uniform |#ifdef|#include|void main/.test(s) ? h + JSON.stringify(shrink(s)) + ';' : m; } catch { return m; } }) })); } };
// charset utf8: chữ tiếng Việt trong mã giữ nguyên UTF-8 (2–3 byte) thay vì \uXXXX (6 byte) — bản HTML đơn nhỏ hơn đáng kể (#93)
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none', charset: 'utf8', plugins: [glsl] });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// Phông nhúng sẵn (đủ dấu tiếng Việt, chạy không cần mạng)
const F = (pkg, file) => readFileSync(join(pkgDir(pkg), 'files', file)).toString('base64');
const RANGE = { vietnamese: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB', latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', 'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' };
// src(pkg, file): nguồn của tệp phông — bản HTML đơn nhúng data: base64, bản web trỏ tới tệp /assets/… (#161)
const face = (src) => (family, pkg, sub, w) => `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(${src(pkg, `${pkg}-${sub}-${w}-normal.woff2`)}) format("woff2");unicode-range:${RANGE[sub]}}`;
const FONTS = [['Be Vietnam Pro', 'be-vietnam-pro', 'vietnamese', 400], ['Be Vietnam Pro', 'be-vietnam-pro', 'vietnamese', 600], ['Be Vietnam Pro', 'be-vietnam-pro', 'latin', 400], ['Be Vietnam Pro', 'be-vietnam-pro', 'latin', 600], ['Be Vietnam Pro', 'be-vietnam-pro', 'latin-ext', 400], ['Noto Serif', 'noto-serif', 'vietnamese', 600], ['Noto Serif', 'noto-serif', 'latin', 600]];
const fonts = FONTS.map((a) => face((pkg, file) => `data:font/woff2;base64,${F(pkg, file)}`)(...a)).join('\n');
// Chuẩn hóa NFC: chữ có dấu luôn là một ký tự dựng sẵn, không bị rời dấu khi phông thiếu dấu tổ hợp
// Mã JS chèn SAU khi chuẩn hóa: chuỗi trong mã giữ đúng như nguồn (trước đây chúng là \uXXXX nên NFC cũng không đụng tới)
// CSS trong <style> thu gọn bằng esbuild (#104: bớt ~1,8 KB để giữ trần kích thước); chạy sau khi chèn phông, trước khi chèn mã JS
const minCss = (h) => h.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/g, (m, a, css, b) => a + transformSync(css, { loader: 'css', minify: true, charset: 'utf8' }).code.trim() + b);
const TEMPLATE = readFileSync('src/index.template.html', 'utf8');
const page = (fontCss) => minCss(TEMPLATE.replace('/*__FONTS__*/', () => fontCss).normalize('NFC'));
const html = page(fonts).replace('/*__BUNDLE__*/', () => js);

// 1. Ghi vào dist/van-dao.html
mkdirSync('dist', { recursive: true });
writeFileSync('dist/van-dao.html', html);

// 2. Bản web (public/) cho Cloudflare Workers Static Assets: thêm PWA (manifest, service worker, biểu tượng).
//    Bản HTML đơn ở dist/ giữ nguyên, mở bằng file:// vẫn chạy offline mà không cần service worker.
//    #161: bản web tách tệp theo độ ổn định cache. three.js (~0,6 MB, chỉ đổi khi nâng phiên bản), mã ứng dụng và phông
//    là các tệp /assets/tên-hash.* lưu cache lâu dài (_headers: immutable); lần deploy sau người dùng chỉ tải lại phần đã đổi.
mkdirSync('public', { recursive: true });
rmSync('public/assets', { recursive: true, force: true });
mkdirSync('public/assets', { recursive: true });
const hashOf = (b) => createHash('sha256').update(b).digest('hex').slice(0, 10);
const asset = (name, ext, body) => { const f = `${name}-${hashOf(body)}.${ext}`; writeFileSync(`public/assets/${f}`, body); return `/assets/${f}`; };

// 2a. three.js riêng: chỉ xuất các tên mã ứng dụng dùng (THREE.Tên và import { … } from 'three/…'), nên vẫn rút gọn như bản HTML đơn.
//     Mã ứng dụng phải dùng three qua dạng THREE.Tên; dạng khác (THREE[x], gán THREE cho biến) dừng build để không thiếu tên lúc chạy.
const SRC = [];
const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.js')) SRC.push(f); } };
walk('src');
const threeNames = new Set(), threeNamed = new Map();
for (const f of SRC) {
  const s = readFileSync(f, 'utf8');
  if (!/from 'three/.test(s)) continue;
  if (/\bTHREE\b(?!\.[A-Za-z_$])/.test(s.replace(/import \* as THREE from 'three';/g, ''))) throw new Error(`${f}: chỉ dùng three qua THREE.Tên (#161)`);
  for (const m of s.matchAll(/\bTHREE\.([A-Za-z_$][\w$]*)/g)) threeNames.add(m[1]);
  for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(three[^']*)'/g)) for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) threeNamed.set(n, m[2]);
}
const threeSrc = `export { ${[...threeNames].sort().join(', ')} } from 'three';\n` + [...threeNamed].sort().map(([n, p]) => `export { ${n} } from '${p}';`).join('\n');
const tb = await build({ stdin: { contents: threeSrc, resolveDir: process.cwd(), sourcefile: 'three-vendor.js', loader: 'js' }, bundle: true, minify: true, format: 'esm', target: 'es2020', write: false, legalComments: 'none', charset: 'utf8', plugins: [glsl] });
const THREE_URL = asset('three', 'js', tb.outputFiles[0].contents);

// 2b. Mã ứng dụng (ESM, sẵn sàng tách tệp tải sau bằng import()); mọi import 'three…' trỏ tới tệp three ở trên
const threeExt = { name: 'three-asset', setup(b) { b.onResolve({ filter: /^three(\/|$)/ }, () => ({ path: THREE_URL, external: true })); } };
const wb = await build({ entryPoints: { app: 'src/main.js' }, bundle: true, minify: true, format: 'esm', splitting: true, target: 'es2020', outdir: 'public/assets', entryNames: '[name]-[hash]', chunkNames: 'c-[hash]', write: false, legalComments: 'none', charset: 'utf8', metafile: true, plugins: [threeExt] });
for (const f of wb.outputFiles) writeFileSync(f.path, f.contents);
const urlOf = (out) => '/assets/' + out.split('/').pop();
const APP_URL = urlOf(Object.entries(wb.metafile.outputs).find(([, o]) => o.entryPoint === 'src/main.js')[0]);
const APP_JS = Object.keys(wb.metafile.outputs).filter((o) => o.endsWith('.js')).map(urlOf);

// 2c. Phông thành tệp .woff2 (nhị phân, nhỏ hơn base64 ~25 %)
const FONT_URLS = [];
const webFonts = FONTS.map((a) => face((pkg, file) => { const u = asset(file.replace(/-normal\.woff2$/, ''), 'woff2', readFileSync(join(pkgDir(pkg), 'files', file))); FONT_URLS.push(u); return u; })(...a)).join('\n');
const ASSETS = [THREE_URL, ...APP_JS, ...FONT_URLS];
writeFileSync('public/_headers', `# Sinh bởi build.mjs (#161): tệp có hash trong tên không bao giờ đổi nội dung
/assets/*
  Cache-Control: public, max-age=31536000, immutable
/sw.js
  Cache-Control: no-cache
`);
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
// modulepreload: tải three song song với mã ứng dụng thay vì đợi đọc xong app mới thấy import
const webHtml = page(webFonts)
  .replace('</head>', `<link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#f6efe2"><link rel="apple-touch-icon" href="/icon-maskable.svg"><link rel="modulepreload" href="${THREE_URL}"><link rel="modulepreload" href="${APP_URL}"></head>`)
  .replace('<script>/*__BUNDLE__*/</script>', () => `<script type="module" src="${APP_URL}"></script>`);
if (webHtml.includes('__BUNDLE__') || !webHtml.includes(APP_URL)) throw new Error('index.template.html cần đúng <script>/*__BUNDLE__*/</script> (#161)');
writeFileSync('public/index.html', webHtml);
const VERSION = createHash('sha256').update(webHtml).digest('hex').slice(0, 12);
// Câu nhắc theo hợp đồng reminder-clock §6 (đổi câu chữ là đổi app, không đổi máy chủ)
const PUSH_TEXT = {
  thien: 'Đến giờ ngồi thiền đã hẹn. Mời bạn về Đài Thiền.',
  nhiem_vu: 'Việc nhỏ của hôm nay đã sẵn ở Bia Tích Lũy.',
  ghi_nhan: 'Cuối ngày rồi. Mời bạn ghi nhận ba trục.',
  uposatha: 'Hôm nay là ngày trai. Bạn có thể tự nguyện thọ trì.',
  tong_ket_tuan: 'Mời bạn phản tỉnh tuần qua.',
};
writeFileSync('public/sw.js', `// Service worker Vân Đạo ${VERSION} — sinh bởi build.mjs, không sửa tay
const CACHE = 'vandao-${VERSION}';
const CORE = ['/', '/manifest.webmanifest', '/icon.svg', '/icon-maskable.svg'];
// #161: tệp /assets/ có hash trong tên nằm ở cache riêng, giữ qua các phiên bản (three.js, phông không phải tải lại).
// Giữ thêm danh sách của bản trước để trang cũ còn mở vẫn nạp được tệp tải sau.
const AC = 'vandao-assets', LIST = '/__assets__';
const ASSETS = ${JSON.stringify(ASSETS)};
self.addEventListener('install', (e) => {
  e.waitUntil(Promise.all([
    caches.open(CACHE).then((c) => c.addAll(CORE)),
    caches.open(AC).then((c) => Promise.all(ASSETS.map((u) => c.match(u).then((hit) => hit || c.add(u))))),
  ]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter((k) => k.startsWith('vandao-') && k !== CACHE && k !== AC).map((k) => caches.delete(k)));
    const c = await caches.open(AC), prev = await c.match(LIST).then((r) => (r ? r.json() : [])).catch(() => []);
    const keep = new Set([...ASSETS, ...prev]);
    await Promise.all((await c.keys()).map((r) => { const p = new URL(r.url).pathname; return p === LIST || keep.has(p) ? null : c.delete(r); }));
    await c.put(LIST, new Response(JSON.stringify(ASSETS)));
    await self.clients.claim();
  })());
});
// #106 §6: nhắc Web Push chỉ mang \`kind\`; câu chữ do app biên tập, không có chữ riêng tư trong push
const PUSH = ${JSON.stringify(PUSH_TEXT)};
self.addEventListener('push', (e) => {
  let d = null; try { d = e.data ? e.data.json() : null; } catch { d = null; }
  const kind = d && Object.prototype.hasOwnProperty.call(PUSH, d.kind) ? d.kind : null;
  if (!kind) return;
  e.waitUntil(self.registration.showNotification('Vân Đạo', { body: PUSH[kind], tag: kind, renotify: false, icon: '/icon.svg', badge: '/icon.svg', data: { kind } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const kind = e.notification.data && e.notification.data.kind, to = kind === 'thien' ? '/#zone=pad' : '/#view=board';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (cs) => {
    const c = cs.find((x) => new URL(x.url).origin === location.origin);
    if (!c) return self.clients.openWindow(to);
    await c.focus();
    return c.navigate ? c.navigate(new URL(to, location.origin).href).catch(() => {}) : null;
  }));
});
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/ws/') || url.pathname.startsWith('/media/')) return;
  if (url.pathname.startsWith('/assets/')) {
    // Tệp có hash: ưu tiên cache; chỉ lưu phản hồi đúng loại (đường dẫn thiếu có thể bị trả về index.html)
    e.respondWith(caches.open(AC).then((c) => c.match(url.pathname).then((hit) => hit || fetch(req).then((res) => { if (res.ok && !(res.headers.get('content-type') || '').includes('text/html')) c.put(url.pathname, res.clone()); return res; }))));
    return;
  }
  const cacheP = caches.open(CACHE);
  if (req.mode === 'navigate') {
    // Trang: ưu tiên mạng để luôn có bản mới; mất mạng hoặc chậm quá 3 giây thì dùng bản đã lưu.
    // Chỉ lưu trang gốc «/»: trang khác (vd. /moi/MÃ có thẻ xem trước riêng, #160) không ghi đè bản ngoại tuyến.
    const net = fetch(req).then(async (res) => { if (res.ok && url.pathname === '/') await (await cacheP).put('/', res.clone()); return res; });
    e.waitUntil(net.catch(() => {}));
    e.respondWith(cacheP.then((c) => c.match('/')).then((cached) => (cached ? Promise.race([net.catch(() => cached), new Promise((r) => setTimeout(() => r(cached), 3000))]) : net)));
    return;
  }
  // Tài nguyên tĩnh khác: ưu tiên bản đã lưu
  e.respondWith(cacheP.then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }))));
});
`);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
const sizeOf = (u) => readFileSync('public' + u).length;
console.log('Build hoàn tất: dist/van-dao.html', kb(Buffer.byteLength(html)), '· public/ index.html', kb(Buffer.byteLength(webHtml)), '+ three', kb(sizeOf(THREE_URL)), '+ app', kb(APP_JS.reduce((t, u) => t + sizeOf(u), 0)), '+ phông', kb(FONT_URLS.reduce((t, u) => t + sizeOf(u), 0)));

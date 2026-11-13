import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', write: false, legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
// Phông nhúng sẵn (đủ dấu tiếng Việt, chạy không cần mạng)
const F = (pkg, file) => readFileSync(`node_modules/@fontsource/${pkg}/files/${file}`).toString('base64');
const RANGE = { vietnamese: 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB', latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', 'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' };
const face = (family, pkg, sub, w) => `@font-face{font-family:"${family}";font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${F(pkg, `${pkg}-${sub}-${w}-normal.woff2`)}) format("woff2");unicode-range:${RANGE[sub]}}`;
const fonts = [['Be Vietnam Pro', 'be-vietnam-pro', 'vietnamese', 400], ['Be Vietnam Pro', 'be-vietnam-pro', 'vietnamese', 600], ['Be Vietnam Pro', 'be-vietnam-pro', 'latin', 400], ['Be Vietnam Pro', 'be-vietnam-pro', 'latin', 600], ['Be Vietnam Pro', 'be-vietnam-pro', 'latin-ext', 400], ['Noto Serif', 'noto-serif', 'vietnamese', 600], ['Noto Serif', 'noto-serif', 'latin', 600]].map((a) => face(...a)).join('\n');
// Chuẩn hóa NFC: chữ có dấu luôn là một ký tự dựng sẵn, không bị rời dấu khi phông thiếu dấu tổ hợp
const html = readFileSync('src/index.template.html', 'utf8').replace('/*__FONTS__*/', () => fonts).replace('/*__BUNDLE__*/', () => js).normalize('NFC');

// 1. Ghi vào dist/van-dao.html
mkdirSync('dist', { recursive: true });
writeFileSync('dist/van-dao.html', html);

// 2. Ghi vào public/index.html cho Cloudflare Workers Static Assets
mkdirSync('public', { recursive: true });
writeFileSync('public/index.html', html);

// 3. Cập nhật bản chạy offline ở root workspace nếu có
try {
  if (existsSync('../van-dao-src')) {
    writeFileSync('../van-dao.html', html);
  }
} catch (e) {
  // Bỏ qua nếu chạy ở môi trường độc lập
}

console.log('Build hoàn tất: dist/van-dao.html & public/index.html', (html.length / 1024).toFixed(0) + ' KB');

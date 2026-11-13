// Tóm tắt kết quả Lighthouse CI (.lighthouseci/lhr-*.json) thành bảng Markdown cho bình luận PR (T1.3, #8).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || '.lighthouseci';
const files = existsSync(dir) ? readdirSync(dir).filter((f) => /^lhr-.*\.json$/.test(f)) : [];
if (!files.length) { console.log('Lighthouse: không có kết quả.'); process.exit(0); }
const ms = (a) => (a && typeof a.numericValue === 'number' ? (a.numericValue / 1000).toFixed(1) + ' s' : '—');
const rows = files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))).map((r) => {
  const c = r.categories || {}, a = r.audits || {}, sc = (k) => (c[k] && c[k].score !== null ? Math.round(c[k].score * 100) : '—');
  return `| ${r.configSettings?.formFactor === 'desktop' ? 'Máy tính' : 'Điện thoại'} | ${sc('performance')} | ${sc('accessibility')} | ${sc('best-practices')} | ${sc('seo')} | ${ms(a['first-contentful-paint'])} | ${ms(a['largest-contentful-paint'])} | ${a['total-blocking-time'] ? Math.round(a['total-blocking-time'].numericValue) + ' ms' : '—'} | ${a['cumulative-layout-shift']?.displayValue ?? '—'} |`;
});
console.log(['**Lighthouse** — lớp giao diện 2D (WebGL tắt trên runner CI; hiệu năng 3D xem bảng perf.spec.js trong log kiểm khói). Điện thoại: mô phỏng 4G + CPU chậm 4 lần.', '',
  '| Thiết bị | Hiệu năng | Tiếp cận | Thực hành tốt | SEO | FCP | LCP | TBT | CLS |', '|---|---|---|---|---|---|---|---|---|', ...rows].join('\n'));

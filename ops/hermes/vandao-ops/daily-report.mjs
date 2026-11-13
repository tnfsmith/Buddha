#!/usr/bin/env node
// Báo cáo vận hành hằng ngày của Vân Đạo cho Hermes (PROJECT_ROADMAP.md §14.6, §20). Không phụ thuộc gói ngoài (Node ≥ 22).
// Biến môi trường (thiếu biến nào thì bỏ qua phần đó và ghi rõ trong báo cáo):
//   CF_ANALYTICS_TOKEN_PROD, CF_ACCOUNT_ID_PROD        token chỉ đọc "Account Analytics: Read" của tài khoản production
//   CF_ANALYTICS_TOKEN_STAGING, CF_ACCOUNT_ID_STAGING  tương tự cho tài khoản staging
//   GITHUB_TOKEN                                       fine-grained token chỉ đọc repo tnfsmith/Buddha (Actions, Pull requests, Contents)
//   VANDAO_REPO (mặc định tnfsmith/Buddha)
const FREE_REQ_PER_DAY = 100_000;
const TOKEN_EXPIRES = '2027-02-11';
const REPO = process.env.VANDAO_REPO || 'tnfsmith/Buddha';
const SITES = { production: 'https://vandao.ainextbrain.com/', staging: 'https://vandao-staging.vandao-staging.workers.dev/' };
const lines = [];
const warns = [];
const fmt = (n) => n.toLocaleString('vi-VN');

async function cfRequests(label, token, account) {
  if (!token || !account) { lines.push(`- ${label}: chưa cấu hình token Analytics`); return; }
  const end = new Date(); const start = new Date(end.getTime() - 24 * 3600e3);
  const query = `query($acc:String!,$start:Time!,$end:Time!){ viewer { accounts(filter:{accountTag:$acc}) {
    workersInvocationsAdaptive(limit:200, filter:{datetime_geq:$start, datetime_lt:$end}) { sum { requests errors } dimensions { scriptName } } } } }`;
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { acc: account, start: start.toISOString(), end: end.toISOString() } }),
  }).then((x) => x.json()).catch((e) => ({ errors: [{ message: String(e) }] }));
  if (r.errors?.length) { lines.push(`- ${label}: lỗi truy vấn — ${r.errors[0].message}`); warns.push(`${label}: không đọc được số liệu`); return; }
  const rows = r.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
  const total = rows.reduce((a, x) => a + x.sum.requests, 0);
  const pct = (total / FREE_REQ_PER_DAY) * 100;
  const vd = rows.filter((x) => /^vandao/.test(x.dimensions.scriptName));
  lines.push(`- ${label}: ${fmt(total)} yêu cầu/24 giờ cả tài khoản = ${pct.toFixed(1)} % hạn mức Free`);
  for (const x of vd) {
    const er = x.sum.requests ? (x.sum.errors / x.sum.requests) * 100 : 0;
    lines.push(`  - \`${x.dimensions.scriptName}\`: ${fmt(x.sum.requests)} yêu cầu, ${fmt(x.sum.errors)} lỗi (${er.toFixed(2)} %)`);
    if (er > 1) warns.push(`${x.dimensions.scriptName}: tỉ lệ lỗi ${er.toFixed(2)} %`);
  }
  if (pct >= 70) warns.push(`${label}: dùng ${pct.toFixed(0)} % hạn mức yêu cầu Workers Free`);
}

async function health() {
  for (const [name, url] of Object.entries(SITES)) {
    const t0 = Date.now();
    const r = await fetch(url, { redirect: 'follow' }).catch((e) => ({ status: 0, err: String(e) }));
    const ms = Date.now() - t0;
    lines.push(`- ${name}: HTTP ${r.status || 'lỗi'} trong ${ms} ms`);
    if (r.status !== 200) warns.push(`${name} không trả 200 (${r.status || r.err})`);
  }
}

async function github() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) { lines.push('- GitHub: chưa cấu hình GITHUB_TOKEN'); return; }
  const gh = (p) => fetch(`https://api.github.com/repos/${REPO}/${p}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }).then((x) => x.json());
  const [prs, runs] = await Promise.all([gh('pulls?state=open&per_page=50'), gh('actions/runs?branch=main&per_page=20')]);
  if (!Array.isArray(prs)) { lines.push(`- GitHub: lỗi đọc API — ${prs?.message ?? 'không rõ'}`); warns.push('GitHub: token không đọc được repo'); return; }
  lines.push(`- PR đang mở: ${prs.length}${prs.length ? ' — ' + prs.map((p) => `#${p.number} ${p.title}`).join('; ') : ''}`);
  for (const wf of ['ci', 'deploy']) {
    const last = runs.workflow_runs?.find((r) => r.name === wf);
    if (!last) continue;
    lines.push(`- \`${wf}\` gần nhất trên main: ${last.conclusion ?? last.status} (${last.head_sha.slice(0, 7)}, ${last.created_at.slice(0, 16).replace('T', ' ')} UTC)`);
    if (last.conclusion && last.conclusion !== 'success') warns.push(`workflow ${wf} trên main: ${last.conclusion}`);
  }
}

function tokenExpiry() {
  const days = Math.ceil((Date.parse(TOKEN_EXPIRES) - Date.now()) / 86400e3);
  lines.push(`- Token production hết hạn sau ${days} ngày (${TOKEN_EXPIRES})`);
  if (days <= 14) warns.push(`Token CF_PROD_API_TOKEN hết hạn sau ${days} ngày: tạo token mới, cập nhật secret`);
}

const today = new Date().toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
lines.push(`# Vân Đạo — báo cáo vận hành ${today}`, '', '## Sức khỏe');
await health();
lines.push('', '## Hạn mức Cloudflare (24 giờ qua)');
await cfRequests('Production', process.env.CF_ANALYTICS_TOKEN_PROD, process.env.CF_ACCOUNT_ID_PROD);
await cfRequests('Staging', process.env.CF_ANALYTICS_TOKEN_STAGING, process.env.CF_ACCOUNT_ID_STAGING);
lines.push('', '## GitHub');
await github();
lines.push('', '## Token');
tokenExpiry();
if (warns.length) lines.splice(1, 0, '', `**⚠ ${warns.length} cảnh báo:** ${warns.join(' · ')}`);
console.log(lines.join('\n'));
process.exit(warns.length ? 2 : 0);

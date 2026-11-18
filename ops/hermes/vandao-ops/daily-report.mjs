#!/usr/bin/env node
// T2.4: chỉ đọc Analytics/GitHub; không ghi tài nguyên, đặt lịch hay gửi tin nhắn.
import { pathToFileURL } from 'node:url';

const LIMIT = 1000;
const SITES = [
  ['Production', 'PROD', 'https://vandao.ainextbrain.com/', '9930849b-af4f-46b7-b7f1-c58cade859d5', '561aec70f7ee4098a30d054ad224cdbb', 'vd_metrics'],
  ['Staging', 'STAGING', 'https://vandao-staging.vandao-staging.workers.dev/', 'a9c4ecd2-2084-4aa8-9a63-a2e716d06044', '52f5a88f999344b5a04ec7aa1ae84325', 'vd_metrics_staging'],
];
const fmt = (n) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
const label = (s) => /^[\w.:-]{1,80}$/.test(s || '') ? s : '(nhãn không hợp lệ)';
const number = (n) => { if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw Error('số liệu không hợp lệ'); return n; };

function storageSnapshots(rows, dimension, field) {
  const sizes = new Map();
  for (const row of rows) {
    const id = row.dimensions?.[dimension];
    if (typeof id !== 'string' || !id || sizes.has(id)) throw Error('ID vùng lưu trữ thiếu hoặc trùng');
    sizes.set(id, number(row.max?.[field]));
  }
  return sizes;
}

function sqlCount(value) {
  const count = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(count) || count < 0) throw Error('số điểm Analytics Engine không hợp lệ');
  return count;
}

export function utcDay(now) {
  const end = new Date(now); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end.getTime() - 86400e3);
  return { day: start.toISOString().slice(0, 10), start: start.toISOString(), end: end.toISOString() };
}

export async function dailyReport({ env = process.env, now = new Date(), fetcher = globalThis.fetch, timeoutMs = 10_000 } = {}) {
  const period = utcDay(now), lines = ['# Vân Đạo — báo cáo vận hành', 'Workers/D1/KV và Analytics Engine Vân Đạo. T2.4 chưa nghiệm thu.', `Kỳ hạn mức: ${period.day}, 00:00–24:00 UTC (ngày đã đóng).`], warns = [];
  const unknown = (name, reason) => { lines.push(`- ${name}: không đo được — ${reason}`); warns.push(`${name}: không đo được`); };
  const quota = (name, value, cap, unit = '') => {
    const pct = number(value) / cap * 100;
    lines.push(`- ${name}: ${fmt(value)} / ${fmt(cap)} ${unit} (${pct.toFixed(1)} % Free)`);
    if (pct >= 70) warns.push(`${name} ≥ 70 %`);
  };
  const request = async (url, options = {}) => {
    try {
      const r = await fetcher(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
      if (r.status !== 200) throw Error(`HTTP ${r.status}`);
      return r;
    } catch (e) { throw Error(/^HTTP \d{3}$/.test(e.message) ? e.message : 'lỗi mạng hoặc quá thời gian chờ', { cause: e }); }
  };
  const json = async (url, options) => { const r = await request(url, options); try { return await r.json(); } catch { throw Error('phản hồi JSON không hợp lệ'); } };
  for (const [name, suffix, url, coreId, kvId, datasetName] of SITES) {
    lines.push('', `## ${name}`);
    try { const t = Date.now(), response = await request(url, { redirect: 'follow' }); if (response.status !== 200) throw Error(`HTTP ${response.status}`); lines.push(`- Web: HTTP 200 trong ${Date.now() - t} ms`); }
    catch (e) { unknown(`${name} Web`, e.message); }
    try {
      const health = await json(new URL('api/health', url).href, { redirect: 'error' });
      if (health.status !== 'ok' || health.service !== 'vandao-api') throw Error('phản hồi không phải vandao-api khỏe');
      lines.push('- API: HTTP 200, service vandao-api, status ok');
    } catch (e) { unknown(`${name} API`, e.message); }
    const token = env[`CF_ANALYTICS_TOKEN_${suffix}`], account = env[`CF_ACCOUNT_ID_${suffix}`];
    if (!token || !/^[a-f0-9]{32}$/i.test(account || '')) { unknown(`${name} Analytics`, 'thiếu token hoặc Account ID hợp lệ'); continue; }
    const read = async (dataset, fields, workers = false) => {
      const vars = workers ? '$start:string!,$end:string!' : '$day:Date!';
      const filter = workers ? 'datetime_geq:$start,datetime_lt:$end' : 'date_geq:$day,date_leq:$day';
      const query = `query($acc:string!,${vars}){viewer{accounts(filter:{accountTag:$acc}){${dataset}(limit:${LIMIT},filter:{${filter}}){${fields}}}}}`;
      const r = await json('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { acc: account, ...period } }) });
      if (r.errors && (!Array.isArray(r.errors) || r.errors.length)) throw Error('GraphQL từ chối truy vấn (kiểm quyền/schema)');
      const accounts = r.data?.viewer?.accounts;
      if (!Array.isArray(accounts) || accounts.length !== 1) throw Error('không có tài khoản trong phản hồi');
      const rows = accounts[0][dataset];
      if (!Array.isArray(rows) || !rows.length || rows.length >= LIMIT) throw Error('thiếu dữ liệu hoặc kết quả có thể bị cắt');
      return rows;
    };
    const tasks = [
      ['Workers', 'workersInvocationsAdaptive', 'sum{requests errors} dimensions{scriptName}', true],
      ['D1 dòng', 'd1AnalyticsAdaptiveGroups', 'sum{rowsRead rowsWritten}'],
      ['D1 dung lượng', 'd1StorageAdaptiveGroups', 'max{databaseSizeBytes} dimensions{databaseId}'],
      ['KV', 'kvOperationsAdaptiveGroups', 'sum{requests} dimensions{actionType}'],
      ['KV dung lượng', 'kvStorageAdaptiveGroups', 'max{byteCount} dimensions{namespaceId}'],
    ];
    const results = await Promise.allSettled(tasks.map(([, dataset, fields, workers]) => read(dataset, fields, workers)));
    for (let i = 0; i < results.length; i++) {
      const result = results[i], metric = `${name} ${tasks[i][0]}`;
      if (result.status === 'rejected') { unknown(metric, result.reason.message); continue; }
      try {
        const rows = result.value, sum = (field) => rows.reduce((n, row) => n + number(row.sum?.[field]), 0);
        if (i === 0) {
          const requests = sum('requests'); sum('errors');
          if (!rows.some((row) => /^vandao(?:-|$)/.test(row.dimensions?.scriptName || ''))) throw Error('không có số liệu Worker Vân Đạo');
          for (const row of rows) if (typeof row.dimensions?.scriptName !== 'string' || row.sum.errors > row.sum.requests) throw Error('tên Worker hoặc số lỗi không hợp lệ');
          quota(metric, requests, 100_000, 'yêu cầu/ngày cả tài khoản');
          for (const row of rows) {
            if (!/^vandao(?:-|$)/.test(row.dimensions.scriptName)) continue;
            const req = row.sum.requests, errors = row.sum.errors;
            const rate = req ? errors / req * 100 : 0;
            lines.push(`- ${label(row.dimensions.scriptName)}: ${fmt(errors)} lỗi/${fmt(req)} yêu cầu (${rate.toFixed(2)} %)`);
            if (rate > 1) warns.push(`${metric}: lỗi > 1 %`);
          }
        } else if (i === 1) {
          const reads = sum('rowsRead'), writes = sum('rowsWritten');
          quota(`${metric} đọc`, reads, 5_000_000, 'dòng/ngày cả tài khoản');
          quota(`${metric} ghi`, writes, 100_000, 'dòng/ngày cả tài khoản');
        } else if (i === 2) {
          const sizes = storageSnapshots(rows, 'databaseId', 'databaseSizeBytes');
          quota(`${metric} cả tài khoản`, [...sizes.values()].reduce((a, b) => a + b, 0), 5e9, 'byte');
          for (const [id, bytes] of sizes) quota(`${metric} DB ${label(id)}`, bytes, 500e6, 'byte/database');
          if (!sizes.has(coreId)) unknown(`${metric} DB Vân Đạo`, 'không có snapshot của database đã cấu hình');
        } else if (i === 3) {
          const counts = { read: 0, write: 0, delete: 0, list: 0 };
          for (const row of rows) {
            const action = row.dimensions?.actionType;
            if (!Object.hasOwn(counts, action)) throw Error('loại thao tác KV không hợp lệ');
            counts[action] += number(row.sum?.requests);
          }
          for (const [action, count] of Object.entries(counts)) quota(`${metric} ${action}`, count, action === 'read' ? 100_000 : 1000, 'thao tác/ngày cả tài khoản');
        } else {
          const sizes = storageSnapshots(rows, 'namespaceId', 'byteCount');
          if (!sizes.has(kvId)) throw Error('thiếu snapshot namespace CONFIG của Vân Đạo');
          quota(`${metric} cả tài khoản (tổng đỉnh từng namespace)`, [...sizes.values()].reduce((a, b) => a + b, 0), 1e9, 'byte');
        }
      } catch (e) { unknown(metric, e.message); }
    }
    try {
      // Bảng cố định theo môi trường. Kỳ UTC sinh từ ngày đã đóng.
      const query = `SELECT COUNT() AS samples, SUM(_sample_interval) AS points FROM ${datasetName}
        WHERE timestamp >= toDateTime(${Date.parse(period.start) / 1000})
          AND timestamp < toDateTime(${Date.parse(period.end) / 1000}) FORMAT JSON`;
      const r = await json(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
        method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${token}` }, body: query,
      });
      if (!Array.isArray(r.data) || r.data.length !== 1) throw Error('không có kết quả tổng hợp');
      const samples = sqlCount(r.data[0]?.samples), points = sqlCount(r.data[0]?.points);
      if (!samples || points < samples) throw Error('thiếu mẫu hợp lệ trong kỳ');
      lines.push(`- Analytics Engine Vân Đạo (${datasetName}): ước tính ${fmt(points)} điểm/ngày từ ${fmt(samples)} mẫu; chưa gồm dataset khác.`);
      if (points >= 70_000) warns.push(`${name} Analytics Engine: dataset Vân Đạo ước tính ≥ 70 % mốc Free ghi toàn tài khoản`);
    } catch (e) { unknown(`${name} Analytics Engine Vân Đạo`, e.message); }
  }
  lines.push('', '## GitHub');
  if (!env.GITHUB_TOKEN) unknown('GitHub', 'thiếu GITHUB_TOKEN chỉ đọc');
  else {
    const repo = env.VANDAO_REPO || 'tnfsmith/Buddha';
    try {
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw Error('tên repo không hợp lệ');
      const gh = (p) => json(`https://api.github.com/repos/${repo}/${p}`, { redirect: 'error', headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } });
      const [prs, branch] = await Promise.all([gh('pulls?state=open&per_page=100'), gh('branches/main')]);
      if (!Array.isArray(prs) || prs.length >= 100) throw Error('danh sách PR thiếu hoặc có thể bị cắt');
      lines.push(`- PR đang mở: ${prs.length}`);
      const head = branch.commit?.sha;
      if (!/^[a-f0-9]{40}$/i.test(head || '')) throw Error('không xác nhận được SHA main');
      for (const [wf, event] of [['ci', 'push'], ['deploy', 'workflow_run']]) {
        try {
          const result = await gh(`actions/workflows/${wf}.yml/runs?branch=main&event=${event}&head_sha=${head}&per_page=1`);
          const run = result.workflow_runs?.[0];
          if (run?.head_sha !== head || run.event !== event) throw Error('chưa có lần chạy đúng SHA và sự kiện của main');
          const state = run.conclusion || run.status;
          if (wf === 'deploy' && state === 'success') {
            if (!Number.isSafeInteger(run.id) || run.id < 1) throw Error('ID lượt triển khai không hợp lệ');
            const { jobs, total_count: total } = await gh(`actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
            if (!Array.isArray(jobs) || total !== jobs.length) throw Error('thiếu danh sách job triển khai');
            const staging = jobs.find((job) => job.name === 'staging');
            const passed = ['Deploy staging', 'Kiểm khói staging'].every((step) =>
              staging?.steps?.some((s) => s.name === step && s.conclusion === 'success'));
            if (staging?.conclusion !== 'success' || !passed) throw Error('workflow chưa chứng minh đã deploy và kiểm khói staging');
          }
          lines.push(`- ${wf} cho main ${head.slice(0, 7)}: ${label(state)}${wf === 'deploy' && state === 'success' ? ' (deploy và kiểm khói staging đạt; chưa đối chiếu SHA đang phục vụ)' : ''}`);
          if (state !== 'success') warns.push(`GitHub ${wf}: ${label(state)}`);
        } catch (e) { unknown(`GitHub ${wf}`, e.message); }
      }
    } catch (e) { unknown('GitHub', e.message); }
  }
  const days = Math.ceil((Date.parse('2027-02-11') - now.getTime()) / 86400e3);
  lines.push('', `- Token deploy production: hạn ghi trong hồ sơ 11/02/2027, còn ${days} ngày (chưa kiểm tra TTL thực tế).`);
  unknown('Phạm vi T2.4', 'chưa đo AE cả tài khoản, số lượt sync/auth và mã rejected, DO, chi phí; chưa đủ nghiệm thu');
  if (days <= 14) warns.push('Token deploy production sắp hết hạn theo hồ sơ');
  if (warns.length) lines.splice(1, 0, `**⚠ ${warns.length} cảnh báo:** ${warns.join(' · ')}`);
  let markdown = lines.join('\n');
  for (const [key, secret] of Object.entries(env)) if (/TOKEN|SECRET|PASSWORD/.test(key) && secret) markdown = markdown.split(String(secret)).join('[đã ẩn]');
  return { markdown, code: warns.length ? 2 : 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await dailyReport(); console.log(result.markdown); process.exitCode = result.code;
}

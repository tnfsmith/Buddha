import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyReport, utcDay } from './daily-report.mjs';

const now = new Date('2026-11-14T00:05:00Z');
const env = { CF_ANALYTICS_TOKEN_PROD: 'prod-secret', CF_ACCOUNT_ID_PROD: 'a'.repeat(32), CF_ANALYTICS_TOKEN_STAGING: 'staging-secret', CF_ACCOUNT_ID_STAGING: 'b'.repeat(32), GITHUB_TOKEN: 'github-secret' };
const core = ['9930849b-af4f-46b7-b7f1-c58cade859d5', 'a9c4ecd2-2084-4aa8-9a63-a2e716d06044'];
const config = ['561aec70f7ee4098a30d054ad224cdbb', '52f5a88f999344b5a04ec7aa1ae84325'];
const head = 'c'.repeat(40);
function fixture(change = () => {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/api/health')) return Response.json({ status: 'ok', service: 'vandao-api' });
    if (url.includes('/graphql')) {
      const { query, variables } = JSON.parse(options.body);
      assert.match(query, /\$acc:string!/); assert.doesNotMatch(query, /String|Time!/);
      assert.equal(variables.day, '2026-11-13');
      const site = variables.acc === env.CF_ACCOUNT_ID_PROD ? 0 : 1;
      const data = {
        workersInvocationsAdaptive: [{ sum: { requests: 20, errors: 0 }, dimensions: { scriptName: 'vandao' } }],
        d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 100, rowsWritten: 10 } }],
        d1StorageAdaptiveGroups: [{ max: { databaseSizeBytes: 1000 }, dimensions: { databaseId: core[site] } }],
        kvOperationsAdaptiveGroups: ['read', 'write', 'delete', 'list'].map((actionType) => ({ sum: { requests: 10 }, dimensions: { actionType } })),
        kvStorageAdaptiveGroups: [{ max: { byteCount: 1000 }, dimensions: { namespaceId: config[site] } }],
      };
      const payload = { data: { viewer: { accounts: [data] } } };
      change(data, payload, query);
      return Response.json(payload);
    }
    if (url.endsWith('/analytics_engine/sql')) {
      const prod = url.includes(env.CF_ACCOUNT_ID_PROD);
      assert.equal(options.headers.Authorization, `Bearer ${prod ? env.CF_ANALYTICS_TOKEN_PROD : env.CF_ANALYTICS_TOKEN_STAGING}`);
      assert.ok(options.body.includes(`FROM ${prod ? 'vd_metrics' : 'vd_metrics_staging'}\n`));
      assert.ok(options.body.includes(`timestamp >= toDateTime(${Date.parse('2026-11-13') / 1000})`));
      assert.ok(options.body.includes(`timestamp < toDateTime(${Date.parse('2026-11-14') / 1000})`));
      assert.match(options.body, /SUM\(_sample_interval\)/);
      return Response.json({ data: [{ samples: '10', points: '25' }] });
    }
    if (url.includes('/pulls?')) return Response.json([]);
    if (url.endsWith('/branches/main')) return Response.json({ commit: { sha: head } });
    if (url.includes('/actions/workflows/')) {
      const request = new URL(url);
      const event = request.pathname.includes('/ci.yml/') ? 'push' : 'workflow_run';
      assert.equal(request.searchParams.get('branch'), 'main');
      assert.equal(request.searchParams.get('head_sha'), head);
      assert.equal(request.searchParams.get('event'), event);
      return Response.json({ workflow_runs: [{ id: 123, conclusion: 'success', head_sha: head, event }] });
    }
    if (url.includes('/actions/runs/123/jobs?')) return Response.json({
      total_count: 1,
      jobs: [{ name: 'staging', conclusion: 'success', steps: ['Deploy staging', 'Kiểm khói staging'].map((name) => ({ name, conclusion: 'success' })) }],
    });
    return new Response('', { status: 200 });
  };
  return { fetcher, calls };
}
test('ngày UTC đã đóng đúng qua đầu năm', () => {
  assert.deepEqual(utcDay(new Date('2027-01-01T00:00:00Z')), { day: '2026-12-31', start: '2026-12-31T00:00:00.000Z', end: '2027-01-01T00:00:00.000Z' });
});
test('fixture tốt: tổng account, kỳ UTC và chỉ truy vấn đọc', async () => {
  const { fetcher, calls } = fixture();
  const result = await dailyReport({ env, now, fetcher });
  assert.equal(result.code, 2); assert.match(result.markdown, /2026-11-13/); assert.match(result.markdown, /5\.000\.000/);
  assert.match(result.markdown, /⚠ 1 cảnh báo:\*\* Phạm vi T2.4: không đo được/);
  assert.match(result.markdown, /T2.4 chưa nghiệm thu/); assert.match(result.markdown, /API: HTTP 200, service vandao-api/);
  assert.match(result.markdown, /ci cho main ccccccc: success/);
  assert.match(result.markdown, /deploy cho main ccccccc: success \(deploy và kiểm khói staging đạt; chưa đối chiếu SHA đang phục vụ\)/);
  assert.match(result.markdown, /KV dung lượng cả tài khoản/);
  assert.match(result.markdown, /Analytics Engine Vân Đạo \(vd_metrics\): ước tính 25 điểm\/ngày từ 10 mẫu; chưa gồm dataset khác/);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 12);
  for (const c of calls) {
    assert.ok(c.signal);
    if (c.method === 'POST') {
      assert.equal(c.redirect, 'error');
      if (c.url.endsWith('/graphql')) assert.match(JSON.parse(c.body).query, /^query/);
      else { assert.ok(c.url.endsWith('/analytics_engine/sql')); assert.match(c.body, /^SELECT/); }
    }
  }
});
test('ngưỡng 70% tính cả Worker ngoài Vân Đạo và DB 500 MB', async () => {
  const { fetcher } = fixture((d) => {
    d.workersInvocationsAdaptive.push({ sum: { requests: 69_980, errors: 0 }, dimensions: { scriptName: 'other' } });
    d.d1StorageAdaptiveGroups[0].max.databaseSizeBytes = 350_000_000;
    d.kvOperationsAdaptiveGroups[1].sum.requests = 700;
    d.d1AnalyticsAdaptiveGroups[0].sum.rowsWritten = 70_000;
    d.kvStorageAdaptiveGroups.push({ max: { byteCount: 699_999_000 }, dimensions: { namespaceId: 'other-config' } });
  });
  const r = await dailyReport({ env, now, fetcher });
  assert.equal(r.code, 2); assert.match(r.markdown, /Production Workers ≥ 70/); assert.match(r.markdown, /DB .* ≥ 70/); assert.match(r.markdown, /KV write ≥ 70/); assert.match(r.markdown, /D1 dòng ghi ≥ 70/);
  assert.match(r.markdown, /KV dung lượng cả tài khoản \(tổng đỉnh từng namespace\) ≥ 70/);
});
test('thiếu cấu hình phải cảnh báo và không gọi API có token', async () => {
  const { fetcher, calls } = fixture(); const r = await dailyReport({ env: {}, now, fetcher });
  assert.equal(r.code, 2); assert.match(r.markdown, /thiếu token/); assert.equal(calls.length, 4);
});
for (const [name, change] of [
  ['GraphQL partial error', (_d, p) => { p.errors = [{ message: `Bearer ${env.GITHUB_TOKEN}` }]; }],
  ['GraphQL error sai kiểu', (_d, p) => { p.errors = { message: 'denied' }; }],
  ['dataset trống', (d) => { d.d1AnalyticsAdaptiveGroups = []; }],
  ['không có account', (_d, p) => { p.data.viewer.accounts = []; }],
  ['field số thiếu', (d) => { delete d.d1AnalyticsAdaptiveGroups[0].sum.rowsRead; }],
  ['số âm', (d) => { d.kvOperationsAdaptiveGroups[0].sum.requests = -1; }],
  ['không có Worker Vân Đạo', (d) => { d.workersInvocationsAdaptive[0].dimensions.scriptName = 'other'; }],
  ['thiếu DB đã cấu hình', (d) => { d.d1StorageAdaptiveGroups[0].dimensions.databaseId = 'unknown-db'; }],
  ['thiếu namespace CONFIG', (d) => { d.kvStorageAdaptiveGroups[0].dimensions.namespaceId = 'other-config'; }],
  ['snapshot KV trùng namespace', (d) => { d.kvStorageAdaptiveGroups.push(d.kvStorageAdaptiveGroups[0]); }],
  ['giới hạn cắt kết quả', (d) => { d.workersInvocationsAdaptive = Array(1000).fill(d.workersInvocationsAdaptive[0]); }],
]) test(name, async () => {
  const { fetcher } = fixture(change); const r = await dailyReport({ env, now, fetcher });
  assert.equal(r.code, 2); assert.match(r.markdown, /không đo được/);
  assert.doesNotMatch(r.markdown, /⚠ 1 cảnh báo:/);
  for (const secret of [env.GITHUB_TOKEN, env.CF_ANALYTICS_TOKEN_PROD]) assert.ok(!r.markdown.includes(secret));
});
test('điểm AE có trọng số chạm ngưỡng, không coi là số đo toàn tài khoản', async () => {
  const good = fixture().fetcher;
  const fetcher = (url, options) => url.endsWith('/analytics_engine/sql')
    ? Response.json({ data: [{ samples: '1000', points: '70000' }] }) : good(url, options);
  const { markdown } = await dailyReport({ env, now, fetcher });
  assert.match(markdown, /Analytics Engine: dataset Vân Đạo ước tính ≥ 70 %/);
  assert.match(markdown, /70\.000 điểm\/ngày từ 1\.000 mẫu; chưa gồm dataset khác/);
});

test('AE trống hoặc số sai kiểu không trở thành 0 điểm', async () => {
  const good = fixture().fetcher;
  for (const data of [[], [{ samples: 0, points: null }], [{ samples: 8, points: '6' }], [{ samples: 8, points: '1e5' }]]) {
    const fetcher = (url, options) => url.endsWith('/analytics_engine/sql') ? Response.json({ data }) : good(url, options);
    const { markdown } = await dailyReport({ env, now, fetcher });
    assert.match(markdown, /Production Analytics Engine Vân Đạo: không đo được/);
    assert.doesNotMatch(markdown, /Analytics Engine Vân Đạo \(vd_metrics\): ước tính/);
  }
});

test('CI xanh ở SHA cũ không chứng minh main hiện tại xanh', async () => {
  const good = fixture().fetcher;
  const fetcher = (url, options) => url.includes('/ci.yml/runs?')
    ? Response.json({ workflow_runs: [{ event: 'push', head_sha: 'a'.repeat(40), conclusion: 'success' }] })
    : good(url, options);
  const { markdown } = await dailyReport({ env, now, fetcher });
  assert.match(markdown, /GitHub ci: không đo được — chưa có lần chạy đúng SHA/);
  assert.doesNotMatch(markdown, /ci cho main .*: success/);
  assert.match(markdown, /deploy cho main .*: success/);
});

test('workflow success nhưng bước deploy hoặc kiểm khói bị bỏ qua phải cảnh báo', async () => {
  const good = fixture().fetcher;
  const steps = [{ name: 'Deploy staging', conclusion: 'success' }, { name: 'Kiểm khói staging', conclusion: 'skipped' }];
  const fetcher = (url, options) => url.includes('/actions/runs/123/jobs?')
    ? Response.json({ total_count: 1, jobs: [{ name: 'staging', conclusion: 'success', steps }] }) : good(url, options);
  const { markdown } = await dailyReport({ env, now, fetcher });
  assert.match(markdown, /GitHub deploy: không đo được — workflow chưa chứng minh/);
  assert.doesNotMatch(markdown, /deploy cho main .*: success/);
});

for (const status of [403, 429, 500]) test(`HTTP ${status} không thành số 0`, async () => {
  const r = await dailyReport({ env, now, fetcher: async () => new Response(env.GITHUB_TOKEN, { status }) });
  assert.equal(r.code, 2); assert.match(r.markdown, new RegExp(`HTTP ${status}`)); assert.ok(!r.markdown.includes(env.GITHUB_TOKEN));
});
for (const status of [201, 202, 204]) test(`trang trả ${status} không được báo HTTP 200`, async () => {
  const good = fixture().fetcher;
  const r = await dailyReport({ env, now, fetcher: (url, options) => url.includes('api.') ? good(url, options) : Promise.resolve(new Response(null, { status })) });
  assert.equal(r.code, 2); assert.match(r.markdown, new RegExp(`HTTP ${status}`)); assert.doesNotMatch(r.markdown, /Web: HTTP 200/);
});
test('API health sai dịch vụ không được coi là khỏe', async () => {
  const good = fixture().fetcher;
  const r = await dailyReport({ env, now, fetcher: (url, options) => url.endsWith('/api/health') ? Promise.resolve(Response.json({ status: 'ok', service: 'other' })) : good(url, options) });
  assert.equal(r.code, 2); assert.match(r.markdown, /API: không đo được/); assert.doesNotMatch(r.markdown, /API: HTTP 200, service/);
});
test('JSON sai và timeout đều kết thúc bằng cảnh báo', async () => {
  const r = await dailyReport({ env, now, fetcher: async () => new Response('not-json') });
  assert.equal(r.code, 2); assert.match(r.markdown, /JSON không hợp lệ/);
  const fetcher = (_url, { signal }) => new Promise((_resolve, reject) => {
    const timer = setTimeout(() => reject(Error('fixture watchdog')), 1000);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
  const timed = await dailyReport({ env, now, fetcher, timeoutMs: 2 });
  assert.equal(timed.code, 2); assert.match(timed.markdown, /quá thời gian chờ/);
});

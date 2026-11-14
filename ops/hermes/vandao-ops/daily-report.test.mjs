import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyReport, utcDay } from './daily-report.mjs';

const now = new Date('2026-11-14T00:05:00Z');
const env = { CF_ANALYTICS_TOKEN_PROD: 'prod-secret', CF_ACCOUNT_ID_PROD: 'a'.repeat(32), CF_ANALYTICS_TOKEN_STAGING: 'staging-secret', CF_ACCOUNT_ID_STAGING: 'b'.repeat(32), GITHUB_TOKEN: 'github-secret' };
const core = ['9930849b-af4f-46b7-b7f1-c58cade859d5', 'a9c4ecd2-2084-4aa8-9a63-a2e716d06044'];
function fixture(change = () => {}) {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/api/health')) return Response.json({ status: 'ok', service: 'vandao-api' });
    if (url.includes('/graphql')) {
      const { query, variables } = JSON.parse(options.body);
      assert.match(query, /\$acc:string!/); assert.doesNotMatch(query, /String|Time!/);
      assert.equal(variables.day, '2026-11-13');
      const data = {
        workersInvocationsAdaptive: [{ sum: { requests: 20, errors: 0 }, dimensions: { scriptName: 'vandao' } }],
        d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 100, rowsWritten: 10 } }],
        d1StorageAdaptiveGroups: [{ max: { databaseSizeBytes: 1000 }, dimensions: { databaseId: core[variables.acc === env.CF_ACCOUNT_ID_PROD ? 0 : 1] } }],
        kvOperationsAdaptiveGroups: ['read', 'write', 'delete', 'list'].map((actionType) => ({ sum: { requests: 10 }, dimensions: { actionType } })),
      };
      const payload = { data: { viewer: { accounts: [data] } } };
      change(data, payload, query);
      return Response.json(payload);
    }
    if (url.includes('/pulls?')) return Response.json([]);
    if (url.includes('/actions/')) return Response.json({ workflow_runs: ['ci', 'deploy'].map((name) => ({ name, conclusion: 'success', head_sha: 'c'.repeat(40) })) });
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
  assert.match(result.markdown, /success \(ccccccc; chưa đối chiếu HEAD\/deploy\)/);
  assert.equal(calls.filter((c) => c.method === 'POST').length, 8);
  for (const c of calls) { assert.ok(c.signal); if (c.method === 'POST') { assert.ok(c.url.endsWith('/graphql')); assert.doesNotMatch(c.body, /mutation/); } }
});
test('ngưỡng 70% tính cả Worker ngoài Vân Đạo và DB 500 MB', async () => {
  const { fetcher } = fixture((d) => {
    d.workersInvocationsAdaptive.push({ sum: { requests: 69_980, errors: 0 }, dimensions: { scriptName: 'other' } });
    d.d1StorageAdaptiveGroups[0].max.databaseSizeBytes = 350_000_000;
    d.kvOperationsAdaptiveGroups[1].sum.requests = 700;
    d.d1AnalyticsAdaptiveGroups[0].sum.rowsWritten = 70_000;
  });
  const r = await dailyReport({ env, now, fetcher });
  assert.equal(r.code, 2); assert.match(r.markdown, /Production Workers ≥ 70/); assert.match(r.markdown, /DB .* ≥ 70/); assert.match(r.markdown, /KV write ≥ 70/); assert.match(r.markdown, /D1 dòng ghi ≥ 70/);
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
  ['giới hạn cắt kết quả', (d) => { d.workersInvocationsAdaptive = Array(1000).fill(d.workersInvocationsAdaptive[0]); }],
]) test(name, async () => {
  const { fetcher } = fixture(change); const r = await dailyReport({ env, now, fetcher });
  assert.equal(r.code, 2); assert.match(r.markdown, /không đo được/);
  assert.doesNotMatch(r.markdown, /⚠ 1 cảnh báo:/);
  for (const secret of [env.GITHUB_TOKEN, env.CF_ANALYTICS_TOKEN_PROD]) assert.ok(!r.markdown.includes(secret));
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

// T1.3 (#8): số liệu ẩn danh → Analytics Engine
import { describe, it, expect } from 'vitest';
import app from '../src/index.js';
import { scrub, summarize, deviceGroup, webAnalytics } from '../../../apps/web/src/net/metrics.js';

const post = (env, body, headers = {}) => app.request('/api/v1/metrics', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } }, env);

describe('POST /api/v1/metrics', () => {
  it('ghi một điểm hiệu năng và các điểm lỗi, không cần đăng nhập', async () => {
    const pts = [], env = { METRICS: { writeDataPoint: (p) => pts.push(p) }, ENV_NAME: 'staging' };
    const r = await post(env, { v: 1, device: { cls: 'phone', cores: '≤4', mem: '≤2' }, perf: { n: 6, fps_p50: 31, fps_p10: 24, calls_max: 104, tris_max: 359674, q_last: 0, q_min: 0, dpr: 1, mode: 'island' }, errors: [{ kind: 'error', msg: 'Uncaught ReferenceError: x is not defined', n: 2 }] });
    expect(r.status).toBe(204);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toMatchObject({ indexes: ['phone'], blobs: ['perf', 'staging', 'phone', '≤4', '≤2', 'island'] });
    expect(pts[0].doubles.slice(0, 4)).toEqual([31, 24, 104, 359674]);
    expect(pts[1]).toMatchObject({ indexes: ['err'], blobs: ['error', 'staging', 'phone', 'error', 'ReferenceError'], doubles: [2] });
  });
  it('kẹp số và giới hạn tối đa 10 điểm lỗi mỗi lần', async () => {
    const pts = [], env = { METRICS: { writeDataPoint: (p) => pts.push(p) } };
    await post(env, { v: 1, device: { cls: '<script>' }, perf: { fps_p50: 1e9, calls_max: -5 }, errors: Array.from({ length: 30 }, (_, i) => ({ kind: 'error', msg: 'e' + i, n: 1 })) });
    expect(pts).toHaveLength(11);
    expect(pts[0].blobs[2]).toBe('na');
    expect(pts[0].doubles[0]).toBe(240);
    expect(pts[0].doubles[2]).toBe(0);
  });
  it('chỉ lưu nhãn thuộc danh sách quy định và bỏ qua mục lỗi sai kiểu', async () => {
    const pts = [], env = { METRICS: { writeDataPoint: (p) => pts.push(p) }, ENV_NAME: 'staging' };
    const r = await post(env, {
      v: 1, device: { cls: 'ten-rieng', cores: 'ma-rieng', mem: '>8' },
      perf: { mode: 'du-lieu-rieng', fps_p50: { toString: null } },
      errors: [null, [], { kind: 'ten-rieng', msg: 'https://example.test/ ghi chú riêng', n: 2 },
        { kind: 'rejection', msg: 'Uncaught (in promise) TypeError: le@example.test', n: 3 }],
    });
    expect(r.status).toBe(204);
    expect(pts.map((pt) => pt.blobs)).toEqual([
      ['perf', 'staging', 'na', 'na', '>8', 'na'],
      ['error', 'staging', 'na', 'na', 'Other'],
      ['error', 'staging', 'na', 'rejection', 'TypeError'],
    ]);
    expect(pts[0].doubles[0]).toBe(0);
    expect(pts.slice(1).map((pt) => pt.doubles)).toEqual([[2], [3]]);
  });
  it('body sai hoặc quá 8 KB bị từ chối; chưa gắn Analytics Engine thì bỏ qua', async () => {
    expect((await post({}, '{x')).status).toBe(400);
    expect((await post({}, { v: 2, device: {} })).status).toBe(400);
    expect((await post({}, { v: 1, device: null })).status).toBe(400);
    expect((await post({}, { v: 1, device: [] })).status).toBe(400);
    expect((await post({}, 'x'.repeat(9000))).status).toBe(413);
    expect((await post({}, { v: 1, device: {}, extra: 'ệ'.repeat(3000) })).status).toBe(413);
    expect((await post({}, { v: 1, device: {} })).status).toBe(204);
  });
});

describe('net/metrics.js', () => {
  it('lược URL, email, chuỗi số khỏi thông điệp lỗi', () => {
    expect(scrub('Fetch https://vandao.ainextbrain.com/api/v1/me failed for le@example.com id 123456')).toBe('Fetch <url> failed for <email> id <n>');
  });
  it('tóm tắt mẫu vandao:perf của phiên', () => {
    const s = summarize([{ fps: 50, calls: 100, triangles: 3e5, quality: 2, dpr: 2, mode: 'island' }, { fps: 30, calls: 120, triangles: 4e5, quality: 1, dpr: 1.25, mode: 'hall' }, { fps: 40, calls: 90, triangles: 2e5, quality: 1, dpr: 1.25, mode: 'hall' }]);
    expect(s).toMatchObject({ n: 3, fps_p50: 40, fps_p10: 30, calls_max: 120, tris_max: 4e5, q_last: 1, q_min: 1, dpr: 1.25, mode: 'hall' });
    expect(summarize([])).toBeNull();
  });
  it('nhóm máy thô, không lộ cấu hình chi tiết', () => {
    const g = deviceGroup({ hardwareConcurrency: 6, deviceMemory: 4 }, { screen: { width: 390, height: 844 }, matchMedia: () => ({ matches: true }) });
    expect(g).toEqual({ cls: 'phone', cores: '≤8', mem: '≤4' });
  });
  it('Web Analytics chỉ chèn ở staging (production do zone tự chèn), không chèn trùng', () => {
    const added = [], doc = { querySelector: () => (added.length ? {} : null), createElement: () => ({ setAttribute(k, v) { this[k] = v; } }), head: { appendChild: (x) => added.push(x) } };
    expect(webAnalytics('vandao.ainextbrain.com', doc)).toBe(false);
    expect(webAnalytics('vandao-staging.vandao-staging.workers.dev', doc)).toBe(true);
    expect(JSON.parse(added[0]['data-cf-beacon']).token).toMatch(/^[0-9a-f]{32}$/);
    expect(webAnalytics('vandao-staging.vandao-staging.workers.dev', doc)).toBe(false);
  });
});

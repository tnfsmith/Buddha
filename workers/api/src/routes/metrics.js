// workers/api/src/routes/metrics.js
// T1.3 (#8): nhận số liệu ẩn danh từ net/metrics.js, ghi Workers Analytics Engine (binding METRICS).
// Không xác thực, không lưu IP hay User-Agent; mỗi lần gửi tối đa 1 điểm hiệu năng + 10 điểm lỗi (giới hạn 25/lần gọi).
import { Hono } from 'hono';

const metricsApp = new Hono();
const MAX_BYTES = 8192;
const DEVICES = ['phone', 'tablet', 'desktop'];
const BUCKETS = ['≤2', '≤4', '≤8', '>8'];
const MODES = ['island', 'zone', 'hall', 'tier', 'creator', 'overview', 'realm'];
const ERROR_KINDS = ['error', 'rejection'];
const ERROR_TYPES = /^(?:Uncaught (?:\(in promise\) )?)?(AggregateError|Error|EvalError|RangeError|ReferenceError|SyntaxError|TypeError|URIError):/;
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const num = (value, max) => Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0;
const tag = (value, allowed) => allowed.includes(value) ? value : 'na';

// Chỉ lưu loại lỗi thuộc danh sách cố định. Thông điệp từ request có thể chứa dữ liệu riêng tư.
const errorType = (message) => typeof message === 'string' ? ERROR_TYPES.exec(message)?.[1] ?? 'Other' : 'Other';

metricsApp.post('/', async (c) => {
  if (Number(c.req.header('Content-Length') || 0) > MAX_BYTES) return c.body(null, 413);
  const raw = await c.req.arrayBuffer();
  if (raw.byteLength > MAX_BYTES) return c.body(null, 413);
  let b; try { b = JSON.parse(new TextDecoder().decode(raw)); } catch { return c.body(null, 400); }
  if (b?.v !== 1 || !record(b.device)) return c.body(null, 400);
  const ae = c.env.METRICS;
  if (!ae) return c.body(null, 204);   // môi trường chưa gắn Analytics Engine (dev cục bộ, kiểm thử)
  const d = b.device, env = c.env.ENV_NAME || 'production', cls = tag(d.cls, DEVICES);
  const points = [];
  if (record(b.perf)) {
    const p = b.perf;
    points.push({
      indexes: [cls],
      blobs: ['perf', env, cls, tag(d.cores, BUCKETS), tag(d.mem, BUCKETS), tag(p.mode, MODES)],
      doubles: [num(p.fps_p50, 240), num(p.fps_p10, 240), num(p.calls_max, 1e5), num(p.tris_max, 1e8), num(p.q_last, 2), num(p.q_min, 2), num(p.dpr, 4), num(p.n, 1e4)],
    });
  }
  for (const e of (Array.isArray(b.errors) ? b.errors : []).slice(0, 10)) {
    if (!record(e)) continue;
    points.push({ indexes: ['err'], blobs: ['error', env, cls, tag(e.kind, ERROR_KINDS), errorType(e.msg)], doubles: [num(e.n, 1e4)] });
  }
  for (const pt of points) ae.writeDataPoint(pt);
  return c.body(null, 204);
});

export default metricsApp;

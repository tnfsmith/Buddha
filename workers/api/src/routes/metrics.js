// workers/api/src/routes/metrics.js
// T1.3 (#8): nhận số liệu ẩn danh từ net/metrics.js, ghi Workers Analytics Engine (binding METRICS).
// Không xác thực, không lưu IP hay User-Agent; mỗi lần gửi tối đa 1 điểm hiệu năng + 10 điểm lỗi (giới hạn 25/lần gọi).
import { Hono } from 'hono';

const metricsApp = new Hono();
const MAX_BYTES = 8192;
const num = (v, max) => { const x = Number(v); return Number.isFinite(x) ? Math.min(Math.max(x, 0), max) : 0; };
// nhãn ngắn: chữ/số/_.- hoặc bậc nhóm máy '≤4', '>8'; giá trị khác (kể cả cố chèn mã) thành 'na'
const tag = (v) => { const s = String(v ?? ''); return /^([\p{L}\p{N}_.-]{1,16}|[≤>]\d{1,2})$/u.test(s) ? s : 'na'; };
const text = (v, max = 120) => String(v ?? '').slice(0, max);

metricsApp.post('/', async (c) => {
  if (Number(c.req.header('Content-Length') || 0) > MAX_BYTES) return c.body(null, 413);
  const raw = await c.req.text();
  if (raw.length > MAX_BYTES) return c.body(null, 413);
  let b; try { b = JSON.parse(raw); } catch { return c.body(null, 400); }
  if (!b || b.v !== 1 || typeof b.device !== 'object') return c.body(null, 400);
  const ae = c.env.METRICS;
  if (!ae) return c.body(null, 204);   // môi trường chưa gắn Analytics Engine (dev cục bộ, kiểm thử)
  const d = b.device, env = c.env.ENV_NAME || 'production', cls = tag(d.cls);
  const points = [];
  if (b.perf && typeof b.perf === 'object') {
    const p = b.perf;
    points.push({
      indexes: [cls],
      blobs: ['perf', env, cls, tag(d.cores), tag(d.mem), tag(p.mode)],
      doubles: [num(p.fps_p50, 240), num(p.fps_p10, 240), num(p.calls_max, 1e5), num(p.tris_max, 1e8), num(p.q_last, 2), num(p.q_min, 2), num(p.dpr, 4), num(p.n, 1e4)],
    });
  }
  for (const e of (Array.isArray(b.errors) ? b.errors : []).slice(0, 10)) {
    points.push({ indexes: ['err'], blobs: ['error', env, cls, tag(e.kind), text(e.msg)], doubles: [num(e.n, 1e4)] });
  }
  for (const pt of points) ae.writeDataPoint(pt);
  return c.body(null, 204);
});

export default metricsApp;

// apps/web/src/net/metrics.js
// T1.3 (#8): số liệu hiệu năng và lỗi JS → POST /api/v1/metrics → Analytics Engine (dataset vd_metrics).
// Không cookie, không định danh: chỉ nhóm máy thô (điện thoại/máy tính, số lõi, bộ nhớ), tóm tắt FPS/lệnh vẽ của phiên,
// và lỗi JS đã lược URL, email, chuỗi số (AGENTS.md §5, Luật BVDLCN 91/2025). Tắt khi trình duyệt bật Do Not Track/GPC.
// Nguồn số đo: sự kiện `vandao:perf` do cảnh 3D phát mỗi 10 giây (world.js, làn Claude) — module này chỉ lắng nghe.

const ENDPOINT = '/api/v1/metrics', EVERY = 5 * 60 * 1000, MAX_SAMPLES = 60, MAX_ERRORS = 10;

const bucket = (v, steps) => { if (!v) return 'na'; for (const s of steps) if (v <= s) return '≤' + s; return '>' + steps[steps.length - 1]; };
export function deviceGroup(nav = navigator, win = window) {
  const minSide = Math.min(win.screen?.width || 0, win.screen?.height || 0);
  const coarse = Boolean(win.matchMedia && win.matchMedia('(pointer: coarse)').matches);
  return {
    cls: coarse ? (minSide && minSide <= 600 ? 'phone' : 'tablet') : 'desktop',
    cores: bucket(nav.hardwareConcurrency, [2, 4, 8]),
    mem: bucket(nav.deviceMemory, [2, 4, 8]),
  };
}

/** Lược thông điệp lỗi: bỏ URL, email, chuỗi số dài (có thể là mã định danh), cắt 120 ký tự */
export const scrub = (msg) => String(msg || '').replace(/https?:\/\/\S+/g, '<url>').replace(/\S+@\S+\.\S+/g, '<email>').replace(/\d{3,}/g, '<n>').replace(/\s+/g, ' ').trim().slice(0, 120);

const pct = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };

/** Tóm tắt các mẫu `vandao:perf` của phiên thành một bản ghi */
export function summarize(samples) {
  const fps = samples.map((s) => s.fps).filter((x) => typeof x === 'number' && x > 0);
  if (!fps.length) return null;
  const last = samples[samples.length - 1];
  return {
    n: fps.length, fps_p50: pct(fps, 0.5), fps_p10: pct(fps, 0.1),
    calls_max: Math.max(...samples.map((s) => s.calls || 0)), tris_max: Math.max(...samples.map((s) => s.triangles || 0)),
    q_last: last.quality ?? -1, q_min: Math.min(...samples.map((s) => s.quality ?? 2)), dpr: last.dpr || 1, mode: String(last.mode || '').slice(0, 16),
  };
}

// Cloudflare Web Analytics (không cookie). Production: zone ainextbrain.com tự chèn beacon ở biên, không thêm ở đây
// để khỏi đếm đôi. Staging (workers.dev không có zone) chèn bằng token công khai của site staging.
const CF_BEACON = { 'vandao-staging.vandao-staging.workers.dev': 'd7235e9269bf46f1b2ff94aee7a83d95' };
export function webAnalytics(host = location.hostname, doc = document) {
  const token = CF_BEACON[host];
  if (!token || doc.querySelector('script[data-cf-beacon]')) return false;
  const s = doc.createElement('script');
  s.defer = true; s.src = 'https://static.cloudflareinsights.com/beacon.min.js'; s.setAttribute('data-cf-beacon', JSON.stringify({ token, spa: true }));
  doc.head.appendChild(s);
  return true;
}

let started = false;
export function startMetrics({ endpoint = ENDPOINT, every = EVERY } = {}) {
  if (started || typeof window === 'undefined' || !/^https?:$/.test(location.protocol)) return false;   // bản HTML đơn (file://) không gửi
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return false;
  started = true;
  webAnalytics();
  const device = deviceGroup();
  let samples = [], errors = new Map();
  window.addEventListener('vandao:perf', (e) => { if (e.detail) { samples.push(e.detail); if (samples.length > MAX_SAMPLES) samples.shift(); } });
  const noteError = (kind, msg) => { const m = scrub(msg); if (!m) return; const k = kind + '|' + m; if (errors.has(k)) errors.get(k).n++; else if (errors.size < MAX_ERRORS) errors.set(k, { kind, msg: m, n: 1 }); };
  window.addEventListener('error', (e) => noteError('error', e.message));
  window.addEventListener('unhandledrejection', (e) => noteError('rejection', e.reason && (e.reason.message || e.reason)));
  const flush = () => {
    const perf = summarize(samples), errs = [...errors.values()];
    if (!perf && !errs.length) return;
    samples = []; errors = new Map();
    const body = JSON.stringify({ v: 1, device, perf, errors: errs });
    try { if (navigator.sendBeacon && navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }))) return; } catch { /* thử fetch */ }
    fetch(endpoint, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {});
  };
  setInterval(flush, every);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);
  return true;
}

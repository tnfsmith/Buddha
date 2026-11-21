// Nhiệm vụ của hành trình Sơ nhập: phần tự ghi nhận và thống kê "Tích lũy tu học"
// (docs/noi-dung/nhiem-vu-so-nhap.md, chủ dự án duyệt 15/11/2026, #85).
// Không cộng Kusala, không đổi khóa 1 nấc mỗi ngày: chỉ làm sáng hoa sen 10 cánh, lịch tu, nhịp thiền, sổ nghe Pháp.
// Hàm thuần, dữ liệu vào/ra là đối tượng thường: chạy được trên máy (offline) và máy chủ.
import { isParami, isPunna } from './parami.js';

/** Hoạt động trong Vân Đạo mà app tự ghi nhận (mục 6), kèm mã Phước nghiệp sự và Ba-la-mật (Phụ lục H) */
export const PASSIVE = Object.freeze({
  thoi_thien: Object.freeze({ name: 'Thời thiền', punna: 'bhavana', parami: Object.freeze(['viriya', 'adhitthana']) }),
  nghe_loi_phat_day: Object.freeze({ name: 'Nghe Lời Phật dạy', punna: 'dhammassavana', parami: Object.freeze(['panna']) }),
  nghe_duong_xua: Object.freeze({ name: 'Nghe Đường Xưa', punna: 'dhammassavana', parami: Object.freeze(['panna', 'metta']) }),
  hoi_huong: Object.freeze({ name: 'Hồi hướng', punna: 'pattidana', parami: Object.freeze(['dana', 'metta']) }),
  van_du: Object.freeze({ name: 'Vân Du', punna: 'bhavana', parami: Object.freeze(['upekkha']) }),
  tra_dao: Object.freeze({ name: 'Trà Đạo Tỉnh Thức', punna: 'sila', parami: Object.freeze(['nekkhamma']) }),   // hết một tuần trà (#125 §5.7)
});
export const isPassive = (c) => Object.hasOwn(PASSIVE, c);

/** Ngưỡng ghi nhận (quyết định 4 của chủ dự án): nghe trọn ≥ 70 % thời lượng, hồi hướng ≥ 80 %, thời thiền ≥ 12/15 phút, Vân Du ≥ 5 phút */
export const HEARD = 0.7;
export const HEARD_RITE = 0.8;
export const MIN_SIT = 12;
export const MIN_VANDU = 5;
/** Đã nghe đủ chưa: phần đã nghe thật (giây, hoặc số ý đọc trọn) so với tổng */
export const heardEnough = (part, total, k = HEARD) => Number.isFinite(part) && Number.isFinite(total) && total > 0 && part / total >= k;
/** Mã tự ghi nhận của một bài theo loạt */
export const listenCode = (loat) => (loat === 'duong-xua' ? 'nghe_duong_xua' : 'nghe_loi_phat_day');

/**
 * Thêm một lần tự ghi nhận vào sổ (không sửa đối tượng vào).
 * Sổ: { 'YYYY-MM-DD': { <mã>: { n, min, refs: [] } } }. Mã lạ, ngày sai định dạng → trả nguyên sổ.
 */
export function logPassive(log, date, code, { minutes = 0, ref = '' } = {}) {
  if (!isPassive(code) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return log || {};
  const L = { ...(log || {}) }, day = { ...(L[date] || {}) }, cur = day[code] || { n: 0, min: 0, refs: [] };
  const m = Math.max(0, Math.min(240, Number(minutes) || 0)), r = String(ref || '').slice(0, 80);
  day[code] = { n: cur.n + 1, min: Math.round((cur.min + m) * 10) / 10, refs: r && !cur.refs.includes(r) ? [...cur.refs, r].slice(-40) : cur.refs };
  L[date] = day;
  return L;
}

/**
 * Ba-la-mật của từng trục theo 7 tuần (PROJECT_ROADMAP.md §8.2). Chỉ số [tuần-1][trục].
 * Dùng để lần ghi nhận Đức–Thiện–Tuệ buổi tối cũng làm sáng hoa sen, cùng công thức Kusala như cũ.
 */
export const WEEK_PARAMI = Object.freeze([
  { duc: ['sila', 'metta'], thien: ['dana', 'metta'], tue: ['panna', 'viriya'] },
  { duc: ['sacca', 'khanti'], thien: ['metta'], tue: ['panna', 'upekkha'] },
  { duc: ['sila', 'nekkhamma'], thien: ['dana'], tue: ['panna', 'adhitthana'] },
  { duc: ['sacca'], thien: ['dana', 'nekkhamma'], tue: ['panna', 'viriya'] },
  { duc: ['khanti', 'upekkha'], thien: ['viriya', 'metta'], tue: ['metta'] },
  { duc: ['khanti'], thien: ['khanti', 'metta'], tue: ['panna', 'upekkha'] },
  { duc: ['sila', 'nekkhamma', 'adhitthana'], thien: ['dana', 'metta'], tue: ['panna', 'adhitthana'] },
].map((w) => Object.freeze(w)));
/** Hai Ba-la-mật trọng tâm của mỗi tuần (mục 5.1) */
export const WEEK_FOCUS = Object.freeze([
  ['viriya', 'metta'], ['sacca', 'khanti'], ['sila', 'nekkhamma'], ['dana', 'sacca'], ['metta', 'khanti'], ['khanti', 'upekkha'], ['adhitthana', 'panna'],
].map((x) => Object.freeze(x)));

const PARAMI_KEYS = ['dana', 'sila', 'nekkhamma', 'panna', 'viriya', 'khanti', 'sacca', 'adhitthana', 'metta', 'upekkha'];

/**
 * Hoa sen 10 cánh: số lần mỗi Ba-la-mật được rèn trong chu kỳ, chuẩn hóa theo cánh mạnh nhất (cân bằng, không phải điểm).
 * - log: sổ tự ghi nhận; mỗi mã chỉ tính 1 lần mỗi ngày, nghe mười bài không thành "cày điểm".
 * - done: S.done ({ [ngày hành trình]: { duc|thien|tue: {...} } }); mỗi trục đã ghi nhận tính theo WEEK_PARAMI.
 * - sacca: số lần Sám hối chân thật.
 * - act: sổ việc chủ động (đợt C); mỗi Ba-la-mật tính một lần mỗi ngày.
 */
export function lotus(log = {}, done = {}, sacca = 0, act = {}) {
  const counts = Object.fromEntries(PARAMI_KEYS.map((k) => [k, 0]));
  for (const day of Object.values(act || {})) for (const p of actParami(day)) counts[p]++;
  for (const day of Object.values(log || {})) for (const code of Object.keys(day || {})) if (isPassive(code)) for (const p of PASSIVE[code].parami) counts[p]++;
  for (const [d, rec] of Object.entries(done || {})) {
    const w = WEEK_PARAMI[Math.min(6, Math.max(0, Math.ceil(Number(d) / 7) - 1))];
    if (!w || !rec) continue;
    for (const pillar of ['duc', 'thien', 'tue']) if (rec[pillar]) for (const p of w[pillar]) counts[p]++;
  }
  counts.sacca += Math.max(0, Math.floor(Number(sacca) || 0));
  const top = Math.max(0, ...Object.values(counts));
  const norm = Object.fromEntries(PARAMI_KEYS.map((k) => [k, top ? counts[k] / top : 0]));
  return { counts, norm, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}
/** Cánh yếu nhất (để gợi ý hạnh tuần sau): trùng hạng thì theo thứ tự Buddhavaṃsa; chưa có gì thì null */
export function weakest(L) { if (!L || !L.total) return null; let best = null; for (const k of PARAMI_KEYS) if (best === null || L.counts[k] < L.counts[best]) best = k; return best; }

const pad = (n) => String(n).padStart(2, '0');
const ymd = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
/** Lùi ngày theo lịch địa phương (giữ đúng khi đổi giờ mùa hè) */
export function shiftDate(date, days) { const [y, m, d] = String(date).split('-').map(Number); return ymd(new Date(y, m - 1, d + days, 12).getTime()); }

/**
 * Lịch tu: các ngày từ `from` tới `to` (gồm cả hai), mỗi ngày cho biết có thực hành gì.
 * Ngày trống để trống (giao diện không tô đỏ).
 */
export function calendar(log = {}, done = {}, to, n = 49, act = {}) {
  const confirmed = new Set();
  for (const rec of Object.values(done || {})) for (const v of Object.values(rec || {})) if (v && v.at) confirmed.add(ymd(v.at));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = shiftDate(to, -i), day = (log || {})[date] || {};
    const a = (act || {})[date];
    out.push({ date, sit: !!day.thoi_thien, listen: !!(day.nghe_loi_phat_day || day.nghe_duong_xua), confirm: confirmed.has(date), gioi: fullGioi(a),
      any: confirmed.has(date) || Object.keys(day).some(isPassive) || actParami(a).size > 0 });
  }
  return out;
}
/** Số phút thời thiền trong 7 ngày kết thúc ở `to` */
export function weekSitMinutes(log = {}, to) { let s = 0; for (let i = 0; i < 7; i++) { const day = (log || {})[shiftDate(to, -i)]; if (day && day.thoi_thien) s += day.thoi_thien.min; } return Math.round(s); }
/** Các bài đã nghe trọn (mã bài), theo loạt */
export function heardIds(log = {}) {
  const out = { 'loi-phat-day': new Set(), 'duong-xua': new Set() };
  for (const day of Object.values(log || {})) {
    for (const r of (day.nghe_loi_phat_day && day.nghe_loi_phat_day.refs) || []) out['loi-phat-day'].add(r);
    for (const r of (day.nghe_duong_xua && day.nghe_duong_xua.refs) || []) out['duong-xua'].add(r);
  }
  return out;
}
/** Kiểm danh mục (dùng trong kiểm thử và khi máy chủ nhận sự kiện) */
export const catalogOk = () => Object.values(PASSIVE).every((x) => isPunna(x.punna) && x.parami.every(isParami))
  && WEEK_PARAMI.every((w) => ['duc', 'thien', 'tue'].every((k) => w[k].every(isParami))) && WEEK_FOCUS.every((f) => f.every(isParami));

// ───────── Đợt C (#85): việc chủ động — Giữ giới hôm nay, Hạnh của tuần, Nguyện tuần, ngày trai ─────────
// Danh mục là nội dung `kind: nhiem_vu` (đợt B, content/nhiem-vu/so-nhap/). Người dùng tự xác nhận; không cộng Kusala.

/** Ngày trai theo âm lịch (§8.3; tùy chọn `uposatha` ở §4.6). lunar = { day, monthLength } từ amlich.js. Tháng thiếu thì ngày cuối là 29. */
export function isTraiDay(lunar, mode = 'vn_4') {
  if (!lunar || !(lunar.day >= 1)) return false;
  const last = lunar.monthLength === 29 ? 29 : 30, d = lunar.day, fromEnd = last - d;   // fromEnd: 0 = ngày cuối tháng, 1 = áp chót, 2 = trước nữa
  const R = { vn_2: [[1, 15], []], vn_4: [[1, 14, 15], [0]], vn_6: [[8, 14, 15, 23], [0, 1]], vn_10: [[1, 8, 14, 15, 18, 23, 24], [0, 1, 2]] }[mode];
  return !!R && (R[0].includes(d) || R[1].includes(fromEnd));
}

/** Băm FNV-1a 32 bit: chọn việc tất định theo (ngày, hạt giống) để offline và máy chủ ra cùng kết quả */
export function hash32(s) { let h = 0x811c9dc5; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
/** Chọn tất định k mục khác nhau theo khóa */
export function pickN(items, k, key) {
  return (items || []).map((x) => [hash32(`${key}|${x.id}`), x]).sort((a, b) => a[0] - b[0] || (a[1].id < b[1].id ? -1 : 1)).slice(0, Math.max(0, k)).map((p) => p[1]);
}

const NHOM = ['gioi', 'hanh', 'nguyen', 'trai'];
/**
 * Một mục nội dung `nhiem_vu` (API trả meta là chuỗi JSON) → nhiệm vụ, hoặc null nếu sai hợp đồng (#87).
 * Giữ lại: id, title, text (câu hành động), nhom, gioi, tuan, parami[], punna, minutes, safety, trai (8 mô tả của thẻ trai).
 */
export function toMission(it) {
  if (!it || it.kind !== 'nhiem_vu' || typeof it.body_inline !== 'string' || !it.body_inline.trim()) return null;
  let m = it.meta; if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { return null; } }
  if (!m || typeof m !== 'object' || !NHOM.includes(m.nhom)) return null;
  const parami = Array.isArray(m.parami) ? m.parami.filter(isParami) : [];
  if (!parami.length) return null;
  const gioi = m.nhom === 'gioi' ? Number(m.gioi) : null, tuan = m.nhom === 'nguyen' ? Number(m.tuan) : null;
  if (m.nhom === 'gioi' && !(gioi >= 1 && gioi <= 5)) return null;
  if (m.nhom === 'nguyen' && !(tuan >= 1 && tuan <= 7)) return null;
  return { id: String(it.id), title: String(it.title || ''), text: it.body_inline.trim(), nhom: m.nhom, gioi, tuan, parami, punna: isPunna(m.punna) ? m.punna : null,
    minutes: Number(m.minutes) || 0, safety: typeof m.safety_note === 'string' ? m.safety_note : '', trai: Array.isArray(m.gioi_trai) ? m.gioi_trai.map(String).slice(0, 8) : [] };
}
/** Gom danh mục theo nhóm: gioi[1..5], hanh[mã Ba-la-mật], nguyen[1..7], trai */
export function catalog(items) {
  const c = { gioi: { 1: [], 2: [], 3: [], 4: [], 5: [] }, hanh: {}, nguyen: {}, trai: null, n: 0 }, seen = new Set();
  for (const x of (items || []).map(toMission)) {
    if (!x || seen.has(x.id)) continue; seen.add(x.id); c.n++;
    if (x.nhom === 'gioi') c.gioi[x.gioi].push(x);
    else if (x.nhom === 'hanh') { const p = x.parami[0]; (c.hanh[p] = c.hanh[p] || []).push(x); }
    else if (x.nhom === 'nguyen') { if (!c.nguyen[x.tuan]) c.nguyen[x.tuan] = x; }
    else if (x.nhom === 'trai' && !c.trai) c.trai = x;
  }
  for (const k of Object.keys(c.gioi)) c.gioi[k].sort((a, b) => (a.id < b.id ? -1 : 1));
  return c;
}
/**
 * Việc của một ngày (quyết định 2: 3 việc chính + thẻ giới + 1 hạnh): mỗi giới một việc gợi ý,
 * 3 việc nhỏ của hai Ba-la-mật trọng tâm của tuần để chọn 1, Nguyện tuần.
 */
export function dayPlan(cat, { date, week, seed = 0 }) {
  const w = Math.min(7, Math.max(1, Number(week) || 1)), key = `${date}|${seed}`;
  const gioi = {}; for (let g = 1; g <= 5; g++) gioi[g] = pickN(cat.gioi[g], 1, `${key}|g${g}`)[0] || null;
  // 3 việc hạnh: 2 của một Ba-la-mật trọng tâm, 1 của Ba-la-mật kia (đổi bên theo ngày), thiếu thì bù từ phần còn lại
  const focus = WEEK_FOCUS[w - 1], flip = hash32(`${key}|f`) & 1, A = focus[flip], B = focus[1 - flip];
  let hanh = [...pickN(cat.hanh[A] || [], 2, `${key}|${A}`), ...pickN(cat.hanh[B] || [], 1, `${key}|${B}`)];
  if (hanh.length < 3) hanh = [...hanh, ...pickN([...(cat.hanh[A] || []), ...(cat.hanh[B] || [])].filter((x) => !hanh.includes(x)), 3 - hanh.length, `${key}|r`)];
  return { week: w, focus, gioi, hanh, nguyen: cat.nguyen[w] || null };
}

/**
 * Sổ việc chủ động theo ngày (bất biến): { [ngày]: { gioi: { [1..5]: { id, parami } }, hanh: { id, parami, done }, nguyen: { tuan, parami }, trai: { id, parami } } }.
 * Không có chữ tự do. value = null để bỏ (người dùng sửa lại trong ngày).
 */
export function setAct(act, date, path, value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return act || {};
  const A = { ...(act || {}) }, day = { ...(A[date] || {}) };
  if (path.startsWith('gioi.')) { const g = path.slice(5); if (!['1', '2', '3', '4', '5'].includes(g)) return act || {}; const G = { ...(day.gioi || {}) }; if (value) G[g] = clean(value); else delete G[g]; day.gioi = G; }
  else if (['hanh', 'nguyen', 'trai'].includes(path)) { if (value) day[path] = clean(value); else delete day[path]; }
  else return act || {};
  A[date] = day;
  return A;
}
const clean = (v) => ({ ...(v.id ? { id: String(v.id).slice(0, 60) } : {}), ...(v.tuan ? { tuan: Number(v.tuan) } : {}), parami: (v.parami || []).filter(isParami), ...(v.done !== undefined ? { done: !!v.done } : {}) });
/** Ba-la-mật được rèn trong một ngày từ việc chủ động (mỗi mã tính một lần): giới đã giữ, hạnh đã làm xong, nguyện đã giữ, ngày trai */
export function actParami(day) {
  const s = new Set(); if (!day) return s;
  for (const v of Object.values(day.gioi || {})) for (const p of v.parami || []) s.add(p);
  if (day.hanh && day.hanh.done) for (const p of day.hanh.parami || []) s.add(p);
  for (const k of ['nguyen', 'trai']) if (day[k]) for (const p of day[k].parami || []) s.add(p);
  return s;
}
/** Hôm đó giữ đủ năm giới */
export const fullGioi = (day) => !!day && ['1', '2', '3', '4', '5'].every((g) => day.gioi && day.gioi[g]);

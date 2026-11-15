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
 */
export function lotus(log = {}, done = {}, sacca = 0) {
  const counts = Object.fromEntries(PARAMI_KEYS.map((k) => [k, 0]));
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
export function calendar(log = {}, done = {}, to, n = 49) {
  const confirmed = new Set();
  for (const rec of Object.values(done || {})) for (const v of Object.values(rec || {})) if (v && v.at) confirmed.add(ymd(v.at));
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = shiftDate(to, -i), day = (log || {})[date] || {};
    out.push({ date, sit: !!day.thoi_thien, listen: !!(day.nghe_loi_phat_day || day.nghe_duong_xua), confirm: confirmed.has(date), any: confirmed.has(date) || Object.keys(day).some(isPassive) });
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

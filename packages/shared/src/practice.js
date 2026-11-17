// Đồng bộ việc tu tập giữa các thiết bị (đợt D rút gọn, #93/#94): Giữ giới, Hạnh của tuần, Nguyện tuần, ngày trai, sổ tự ghi nhận.
// Hợp đồng chung cho máy khách (apps/web/src/net/account.js) và máy chủ (workers/api, thao tác `practice.event`).
// Mỗi thao tác là một sự kiện chỉ thêm, không sửa: { date, kind, slot, value, at? }. Không có chữ tự do, chỉ mã.
//   kind 'viec': slot 'gioi.1'…'gioi.5' | 'hanh' | 'nguyen' | 'trai'; value { id?, tuan?, parami[], done? } hoặc null (bỏ). Sự kiện sau thắng.
//   kind 'vow':  slot '1'…'7' (tuần hành trình); value { id } hoặc null. Sự kiện sau thắng.
//   kind 'tu':   slot là mã tự ghi nhận (PASSIVE); value { n, min, refs[] }, cộng dồn (mỗi lần nghe/thiền là n = 1).
// Thứ tự gộp: theo `at` (giờ của sự kiện), trùng thì theo `id`. Hàm thuần: chạy được trên máy và máy chủ.
import { isParami } from './parami.js';
import { isPassive, setAct } from './missions.js';

/** Phiên bản hợp đồng; máy chủ báo `practice: 1` trong /me và kết quả /sync khi đã nhận `practice.event` */
export const PRACTICE_V = 1;
export const VIEC_SLOTS = Object.freeze(['gioi.1', 'gioi.2', 'gioi.3', 'gioi.4', 'gioi.5', 'hanh', 'nguyen', 'trai']);
/** Giới hạn máy chủ nên áp: số sự kiện mỗi người mỗi ngày (kể cả lần đưa dữ liệu cũ lên) */
export const MAX_EVENTS_PER_DAY = 60;

const DATE = /^\d{4}-\d{2}-\d{2}$/, SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/**
 * Kiểm và chuẩn hóa một sự kiện. Trả { ok: true, ev } hoặc { ok: false, code } (máy chủ từ chối vĩnh viễn với `code`).
 * Không kiểm khoảng ngày so với hành trình: việc đó do máy chủ làm với started_on và múi giờ của người dùng.
 */
export function checkPracticeEvent(p) {
  if (!p || typeof p !== 'object') return { ok: false, code: 'invalid_event' };
  const { date, kind, slot } = p, v = p.value;
  if (typeof date !== 'string' || !DATE.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z'))) return { ok: false, code: 'invalid_date' };
  if (p.at !== undefined && !(Number.isFinite(p.at) && p.at > 0)) return { ok: false, code: 'invalid_at' };
  const at = p.at === undefined ? undefined : Math.round(p.at);
  const out = (value) => ({ ok: true, ev: { date, kind, slot, value, ...(at !== undefined ? { at } : {}) } });
  if (kind === 'viec') {
    if (!VIEC_SLOTS.includes(slot)) return { ok: false, code: 'invalid_slot' };
    if (v === null) return out(null);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, code: 'invalid_value' };
    if (v.id !== undefined && !(typeof v.id === 'string' && SLUG.test(v.id) && v.id.length <= 60)) return { ok: false, code: 'invalid_value' };
    if (v.tuan !== undefined && !int(v.tuan, 1, 7)) return { ok: false, code: 'invalid_value' };
    if (v.done !== undefined && typeof v.done !== 'boolean') return { ok: false, code: 'invalid_value' };
    if (!Array.isArray(v.parami ?? []) || (v.parami ?? []).length > 10 || !(v.parami ?? []).every(isParami)) return { ok: false, code: 'invalid_value' };
    return out({ ...(v.id ? { id: v.id } : {}), ...(v.tuan ? { tuan: v.tuan } : {}), parami: [...new Set(v.parami ?? [])], ...(v.done !== undefined ? { done: v.done } : {}) });
  }
  if (kind === 'vow') {
    if (!['1', '2', '3', '4', '5', '6', '7'].includes(slot)) return { ok: false, code: 'invalid_slot' };
    if (v === null) return out(null);
    if (!v || typeof v !== 'object' || !(typeof v.id === 'string' && SLUG.test(v.id) && v.id.length <= 60)) return { ok: false, code: 'invalid_value' };
    return out({ id: v.id });
  }
  if (kind === 'tu') {
    if (!isPassive(slot)) return { ok: false, code: 'invalid_slot' };
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ok: false, code: 'invalid_value' };
    const n = v.n ?? 1, min = v.min ?? 0, refs = v.refs ?? [];
    if (!int(n, 1, 500) || !(Number.isFinite(min) && min >= 0 && min <= 1440) || !Array.isArray(refs) || refs.length > 40 || !refs.every((r) => typeof r === 'string' && SLUG.test(r))) return { ok: false, code: 'invalid_value' };
    return out({ n, min: Math.round(min * 10) / 10, refs: [...new Set(refs)] });
  }
  return { ok: false, code: 'invalid_kind' };
}

/** Thứ tự gộp chung cho máy và máy chủ */
export const byTime = (a, b) => (a.at - b.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Gộp danh sách sự kiện [{ id, date, kind, slot, value, at }] thành ba sổ của S: { viec, nguyen, tu }.
 * Sự kiện hỏng bị bỏ qua (máy chủ đã kiểm, đây chỉ là lưới an toàn cho dữ liệu cũ).
 */
export function foldPractice(events) {
  let viec = {}; const nguyen = {}, tu = {};
  for (const e of [...(events || [])].filter((x) => x && Number.isFinite(x.at)).sort(byTime)) {
    const c = checkPracticeEvent(e); if (!c.ok) continue;
    const { date, kind, slot, value } = c.ev;
    if (kind === 'viec') viec = setAct(viec, date, slot, value);
    else if (kind === 'vow') { if (value) nguyen[slot] = { id: value.id, at: e.at }; else delete nguyen[slot]; }
    else {
      const day = (tu[date] = tu[date] || {}), cur = day[slot] || { n: 0, min: 0, refs: [] };
      day[slot] = { n: cur.n + value.n, min: Math.round((cur.min + value.min) * 10) / 10, refs: [...cur.refs, ...value.refs.filter((r) => !cur.refs.includes(r))].slice(-40) };
    }
  }
  // ngày không còn việc nào (đã bỏ hết) thì bỏ khỏi sổ, cho giống sổ trên máy
  for (const [d, x] of Object.entries(viec)) if (!Object.keys(x.gioi || {}).length && !x.hanh && !x.nguyen && !x.trai) delete viec[d];
  return { viec, nguyen, tu };
}

/**
 * Dữ liệu đang có trên máy → các sự kiện đưa lên một lần khi máy chủ vừa hỗ trợ (`from`: ngày bắt đầu chu kỳ hiện tại).
 * `at` của mỗi sự kiện là đầu ngày của nó (giờ UTC của ngày đó − 1 ngày cho chắc), nên mọi thao tác thật sau này luôn thắng.
 * `key` (mã thiết bị + chu kỳ) cho mã sự kiện cố định: đưa lên lại lần nữa thì máy chủ coi là trùng, không cộng đôi sổ tự ghi nhận.
 */
export function importEvents(S, from, key) {
  const evs = [], k = String(key || 'x').replace(/[^0-9A-Za-z]/g, '').slice(-16), ok = (d) => DATE.test(d) && (!from || d >= from);
  const at0 = (d) => Date.parse(d + 'T00:00:00Z') - 86400000;
  const add = (date, kind, slot, value) => evs.push({ id: `imp.${k}.${date.replace(/-/g, '')}.${kind}.${slot}`.slice(0, 64), date, kind, slot, value, at: at0(date) });
  for (const [d, day] of Object.entries(S.viec || {})) {
    if (!ok(d) || !day) continue;
    for (const [g, v] of Object.entries(day.gioi || {})) if (v) add(d, 'viec', 'gioi.' + g, v);
    for (const s of ['hanh', 'nguyen', 'trai']) if (day[s]) add(d, 'viec', s, day[s]);
  }
  for (const [w, v] of Object.entries(S.nguyen || {})) {
    if (!v || !v.id) continue;
    let d = Number.isFinite(v.at) ? new Date(v.at).toISOString().slice(0, 10) : from;
    // Nguyện thuộc chu kỳ; ngày UTC có thể lùi một ngày so với started_on (00–07h ở VN).
    // Chỉ bù biên này, giữ nguyên mã các ngày khác và tiếp tục lọc dữ liệu quá cũ.
    if (from && d && Date.parse(from) - Date.parse(d) === 86400000) d = from;
    if (d && ok(d)) add(d, 'vow', String(w), { id: v.id });
  }
  for (const [d, day] of Object.entries(S.tu || {})) {
    if (!ok(d) || !day) continue;
    for (const [code, x] of Object.entries(day)) if (x && x.n > 0) add(d, 'tu', code, { n: Math.min(500, x.n), min: Math.min(1440, x.min || 0), refs: (x.refs || []).slice(-40) });
  }
  return evs.filter((e) => checkPracticeEvent(e).ok).map((e) => ({ ...e, value: checkPracticeEvent(e).ev.value }));
}

/**
 * Sổ của máy chủ (đã gộp cả các thao tác còn chờ gửi) thay cho sổ trên máy với các ngày từ `from` trở đi;
 * ngày trước chu kỳ hiện tại chỉ có trên máy thì giữ nguyên. Nguyện tuần theo chu kỳ nên lấy hẳn bản gộp.
 */
export function mergePractice(local, folded, from) {
  const keep = (L) => Object.fromEntries(Object.entries(L || {}).filter(([d]) => from && d < from));
  return { viec: { ...keep(local.viec), ...folded.viec }, tu: { ...keep(local.tu), ...folded.tu }, nguyen: { ...folded.nguyen } };
}

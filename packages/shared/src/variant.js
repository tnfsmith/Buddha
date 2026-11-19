// Bộ chọn biến thể Sơ nhập 49 ngày (#104), theo hợp đồng docs/contracts/so-nhap-variants.md (#112).
// Dùng chung Worker (#105 today/swap) và client: cùng đầu vào, cùng ảnh chụp danh mục → cùng kết quả.
// Không đọc giờ, không đọc mạng, không ghi gì; hoàn cảnh riêng tư không là đầu vào.
import { hash32, pickN } from './missions.js';
import { isParami, isPunna } from './parami.js';

export const VARIANT_PROGRAM = 'so-nhap-49';
export const VARIANT_SCHEMA = 1;
export const PILLARS = Object.freeze(['duc', 'thien', 'tue']);
export const LEVELS = Object.freeze(['nhe', 'vua', 'sau']);
const RANK = Object.freeze({ nhe: 0, vua: 1, sau: 2 });
const SCOPES = Object.freeze(['doi_thuc', 'dong_tu']);
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export const isPillar = (p) => typeof p === 'string' && PILLARS.includes(p);
export const isLevel = (l) => typeof l === 'string' && own(RANK, l);
const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;

/** Ngày hành trình 1–49 → tuần 1–7; ngoài khoảng → null. */
export const weekOfDay = (day) => (isInt(day, 1, 49) ? Math.floor((day - 1) / 7) + 1 : null);

/**
 * Một hàng `GET /api/v1/content?kind=chuong_trinh&tier=0` (meta là chuỗi JSON hoặc đối tượng) → biến thể chuẩn hóa,
 * hoặc null nếu sai hợp đồng hay khác chương trình/lược đồ. Không ném lỗi.
 */
export function toVariant(it) {
  if (!it || typeof it !== 'object' || it.kind !== 'chuong_trinh') return null;
  if (typeof it.id !== 'string' || !/^sn49-[a-z0-9-]+$/.test(it.id) || !isInt(it.version, 1, Number.MAX_SAFE_INTEGER)) return null;
  const body = typeof it.body_inline === 'string' ? it.body_inline.normalize('NFC').trim() : '';
  if (!body || [...body].length > 90) return null;
  let m = it.meta;
  if (typeof m === 'string') { try { m = JSON.parse(m); } catch { return null; } }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
  if (m.program !== VARIANT_PROGRAM || m.schema !== VARIANT_SCHEMA) return null;
  if (!isInt(m.week, 1, 7) || !isPillar(m.pillar) || !isLevel(m.level) || !isInt(m.minutes, 1, 120)) return null;
  if (m.money !== false && m.money !== 'optional') return null;
  for (const k of ['at_home', 'outdoors', 'needs_others']) if (typeof m[k] !== 'boolean') return null;
  if (!isPunna(m.punna) || !Array.isArray(m.parami) || !m.parami.length || !m.parami.every(isParami) || new Set(m.parami).size !== m.parami.length) return null;
  if (!SCOPES.includes(m.scope)) return null;
  return {
    id: it.id, version: it.version, title: String(it.title || ''), text: body, source_ref: String(it.source_ref || ''),
    week: m.week, pillar: m.pillar, level: m.level, minutes: m.minutes, money: m.money,
    at_home: m.at_home, outdoors: m.outdoors, needs_others: m.needs_others, punna: m.punna, parami: [...m.parami], scope: m.scope,
  };
}

/**
 * Gom danh mục: mỗi id lấy phiên bản cao nhất trong các hàng hợp lệ (hàng công khai do API lọc).
 * → { cells: { '1-duc': [...], … } (sắp theo id), snap: 'id@version,…' sắp theo id, n }.
 * `snap` là dấu của ảnh chụp: hai thiết bị chỉ cùng kết quả khi cùng snap, cùng hồ sơ, cùng chu kỳ và ngày.
 */
export function variantCatalog(rows) {
  const best = new Map();
  for (const v of (Array.isArray(rows) ? rows : []).map(toVariant)) {
    if (!v) continue;
    const cur = best.get(v.id);
    if (!cur || v.version > cur.version) best.set(v.id, v);
  }
  const all = [...best.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const cells = {};
  for (let w = 1; w <= 7; w++) for (const p of PILLARS) cells[`${w}-${p}`] = [];
  for (const v of all) cells[`${v.week}-${v.pillar}`].push(v);
  return { cells, snap: all.map((v) => `${v.id}@${v.version}`).join(','), n: all.length };
}

/**
 * Độ phủ để quyết định bật bộ chọn, cùng điều kiện với checkVariantCoverage của bộ nạp (#112): đủ 21 ô; mỗi ô 3–6 mục
 * với 3–6 câu hành động khác nhau (mỗi mục một câu riêng); có ít nhất một phương án nhẹ ≤ 5 phút, miễn phí, làm một mình tại nhà.
 * → { ready, cells: { '1-duc': { n, distinct, light } }, missing: ['3-tue', …] }.
 */
export function variantCoverage(cat) {
  const out = { ready: true, cells: {}, missing: [] };
  for (let w = 1; w <= 7; w++) for (const p of PILLARS) {
    const key = `${w}-${p}`, list = (cat && cat.cells && cat.cells[key]) || [];
    const distinct = new Set(list.map((v) => v.text)).size;
    const light = list.some((v) => v.level === 'nhe' && v.minutes <= 5 && v.money === false && v.at_home && !v.needs_others);
    out.cells[key] = { n: list.length, distinct, light };
    if (list.length < 3 || list.length > 6 || distinct !== list.length || !light) { out.ready = false; out.missing.push(key); }
  }
  return out;
}

/** Biến thể có hợp với hồ sơ đã lưu (hợp đồng #111) không: phút, mức (nhe < vua < sau), miễn phí, tại nhà. */
export function fitsProfile(v, profile) {
  if (!v || !profile || typeof profile !== 'object') return false;
  if (!isInt(profile.minutes, 1, 120) || !isLevel(profile.level)) return false;
  if (v.minutes > profile.minutes || RANK[v.level] > RANK[profile.level]) return false;
  if (profile.no_money === true && v.money !== false) return false;
  if (profile.at_home === true && v.at_home !== true) return false;
  return true;
}

/** Seed của hợp đồng: JSON.stringify([userId, cycle, day, pillar]). */
export const variantSeed = ({ userId, cycle, day, pillar }) => JSON.stringify([userId, cycle, day, pillar]);

const okInput = (x) => !!x && typeof x.userId === 'string' && x.userId !== '' && isInt(x.cycle, 1, Number.MAX_SAFE_INTEGER) && weekOfDay(x.day) !== null && isPillar(x.pillar);

/**
 * Danh sách lựa chọn hợp lệ theo thứ tự tất định cho { userId, cycle, day, pillar }: mục đầu là gợi ý.
 * Xếp theo hash32(seed + "|" + id) tăng dần, trùng hash thì theo id (pickN của missions.js).
 * Rỗng khi chưa có hồ sơ, đầu vào sai, hoặc không còn mục hợp lệ — khi đó app giữ gợi ý tuần đang có và cho bỏ qua.
 */
export function rankVariants(cat, profile, input) {
  if (!okInput(input) || !profile) return [];
  const list = ((cat && cat.cells && cat.cells[`${weekOfDay(input.day)}-${input.pillar}`]) || []).filter((v) => fitsProfile(v, profile));
  return pickN(list, list.length, variantSeed(input));
}

/** Gợi ý của một trục trong ngày, hoặc null. */
export const pickVariant = (cat, profile, input) => rankVariants(cat, profile, input)[0] || null;

/**
 * Đổi gợi ý: mục hợp lệ kế tiếp có câu hành động khác mục hiện tại (vòng lại đầu danh sách), để người dùng không nhận
 * lại cùng một việc dưới id khác. Hết lựa chọn → giữ mục hiện tại (`same: true`).
 * Mục hiện tại không còn trong danh sách (danh mục/hồ sơ đổi) → mục đầu.
 * Chỉ tính toán: giới hạn một lần/trục/ngày, chống trùng và lưu thuộc #105 (today/swap). Đổi không hoàn tất trục, không cộng Kusala.
 * → { variant, same } với variant null khi không có lựa chọn nào.
 */
export function swapVariant(cat, profile, input, currentId) {
  const list = rankVariants(cat, profile, input);
  if (!list.length) return { variant: null, same: true };
  const i = list.findIndex((v) => v.id === currentId);
  if (i < 0) return { variant: list[0], same: false };
  for (let k = 1; k < list.length; k++) { const v = list[(i + k) % list.length]; if (v.text !== list[i].text) return { variant: v, same: false }; }
  return { variant: list[i], same: true };
}

/** Dấu ngắn của ảnh chụp danh mục (để lưu kèm lựa chọn và so khi offline). */
export const snapHash = (cat) => hash32((cat && cat.snap) || '').toString(36);

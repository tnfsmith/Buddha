// apps/web/src/net/account.js
// "Giữ hành trình" (T2.3, PROJECT_ROADMAP.md §6.1, §6.4): nối trạng thái trên máy (S, localStorage) với tài khoản máy chủ.
// Máy vẫn là nơi chạy chính (offline-first): mọi thao tác ghi S trước, rồi xếp vào outbox để đồng bộ.
// Không có gì ở đây tự chạy khi người dùng chưa chọn "Giữ hành trình" hoặc "Tôi đã có hành trình".
import * as A from './api.js';
import { enqueueOp, triggerSync, startAutoSync, setSyncEnabled, onSyncComplete, getDeviceId } from './sync.js';
import { idbGet, idbSet, idbGetAll } from './idb.js';
import { observeDongTuMe, setDongTuAccount } from './dong-tu.js';
import { foldPractice, importEvents, mergePractice } from '@vandao/shared/practice.js';

const FLAG = 'vandao.acct';
/** Trạng thái tài khoản trên máy này. `available`: có máy chủ (không phải bản HTML đơn mở bằng file://) */
// `practice`: máy chủ đã nhận sổ việc (giới, hạnh, nguyện, ngày trai, tự ghi nhận — #93/#94); `mark`: dấu bản máy chủ đã áp lần cuối;
// `syncedAt`: lần cuối máy này khớp với máy chủ (hiện trên Bia); `pulling`: đang kéo bản mới.
export const acct = { available: typeof location !== 'undefined' && /^https?:$/.test(location.protocol), on: false, uid: null, guest: true, cycle: null, rejected: [], practice: false, imported: null, mark: null, syncedAt: 0, pulling: false };
let hooks = { S: null, apply: () => {} };

const readFlag = () => { try { return JSON.parse(localStorage.getItem(FLAG) || 'null'); } catch { return null; } };
function writeFlag() {
  const v = acct.on ? { uid: acct.uid, guest: acct.guest, cycle: acct.cycle, practice: acct.practice, imported: acct.imported, mark: acct.mark, syncedAt: acct.syncedAt } : null;
  try { if (v) localStorage.setItem(FLAG, JSON.stringify(v)); else localStorage.removeItem(FLAG); } catch { /* chỉ giữ trong bộ nhớ */ }
  idbSet('meta', 'acct', v).catch(() => {});
}
function setOn(user, cycle, me) {
  acct.on = true; acct.uid = user.id; acct.guest = Boolean(user.isAnonymous); if (cycle !== undefined) acct.cycle = cycle;
  writeFlag(); setSyncEnabled(true); startAutoSync(); startLive();
  setDongTuAccount(user.id);
  observeDongTuMe(user.id, me);
}

const r2 = (x) => Math.round(x * 100) / 100;
const sum = (t) => (t.duc || 0) + (t.thien || 0) + (t.tue || 0);
export const hasProgress = (S) => S.day > 1 || S.completed || Object.keys(S.done || {}).length > 0;
const serverEmpty = (me) => me.journey.day === 1 && !me.journey.completed_at && me.totals.all === 0;

/** Hành trình trên máy → payload `legacy.import` (máy chủ tự tính lại E; ghi chú quán chiếu không gửi) */
export const toImport = (S) => ({
  day: S.day, lastDate: S.lastDate, sacca: S.sacca, sessions: S.sessions,
  done: Object.fromEntries(Object.entries(S.done || {}).map(([d, e]) => [d, Object.fromEntries(Object.entries(e).map(([k, x]) => [k, { pre: x.pre, during: x.during, post: x.post, wise: Boolean(x.wise), self: Boolean(x.self), at: x.at }]))])),
});

/** Trả lời của GET /me?entries=1 → các trường của S (trường nào máy chủ chưa có thì bỏ qua, giữ giá trị trên máy) */
export function fromServer(me) {
  const done = {}, totals = { duc: 0, thien: 0, tue: 0 }, J = me.journey, P = me.profile, st = P.settings || {};
  for (const e of me.entries || []) {
    (done[e.day] = done[e.day] || {})[e.pillar] = { E: e.e_score, pre: e.pre, during: e.during, post: e.post, wise: Boolean(e.wise), self: Boolean(e.self), note: '', at: e.at };
    totals[e.pillar] = r2(totals[e.pillar] + e.e_score);
  }
  const out = { day: J.day, lastDate: J.last_done_on, completed: Boolean(J.completed_at), done, totals, sacca: J.sacca_count || 0, sessions: J.sessions_done || 0 };
  if (P.tinh_danh) out.name = P.tinh_danh;
  if (P.look && typeof P.look.hair === 'string') out.look = P.look;          // chỉ nhận diện mạo do client đã gửi lên
  if (st.birds && typeof st.birds.n === 'number') out.birds = st.birds;
  if (st.music && 'source' in st.music) out.music = st.music;
  return out;
}

async function pushProfile(S, me) {
  const patch = { look: S.look, settings: { birds: S.birds, music: S.music } }, soft = (e) => { if (e.status === 0) throw e; };
  if (S.name && S.name !== me.profile.tinh_danh) patch.tinh_danh = S.name;
  try { await A.updateProfile(patch); } catch (e) {
    soft(e);
    // Tịnh danh chưa đổi được (giới hạn 30 ngày…): vẫn lưu diện mạo và cài đặt
    if (patch.tinh_danh) await A.updateProfile({ look: patch.look, settings: patch.settings }).catch(soft);
  }
  // Múi giờ gửi riêng: máy chủ từ chối (đổi quá 1 lần/7 ngày) cũng không làm rơi Tịnh danh và diện mạo ở trên
  let tz = null; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* giữ múi giờ mặc định */ }
  if (tz && tz !== me.profile.tz) await A.updateProfile({ tz }).catch(soft);
}
async function pushLocal(S, me) {
  await pushProfile(S, me);
  if (hasProgress(S) && serverEmpty(me)) await enqueueOp('legacy.import', toImport(S));
  const res = await triggerSync();
  if (res && res.state) { acct.cycle = res.state.journey.cycle; writeFlag(); }
}

/** Khởi động: máy đã bật "Giữ hành trình" thì bật đồng bộ nền. `apply(fields)`: giao diện ghi các trường vào S rồi vẽ lại. */
export async function initAccount(S, apply) {
  hooks = { S, apply };
  if (!acct.available) return acct;
  setDongTuAccount(null);
  let f = readFlag(); if (!f) { try { f = await idbGet('meta', 'acct'); } catch { f = null; } }
  onSyncComplete(async (state, res) => {
    acct.rejected = (res.rejected || []).filter((r) => r.code !== 'exists');
    const first = acct.cycle === null, changedCycle = !first && state.journey.cycle !== acct.cycle;
    acct.cycle = state.journey.cycle; acct.syncedAt = Date.now();
    if (state.practice && !acct.practice) acct.practice = true;   // máy chủ vừa nhận sổ việc (#94)
    writeFlag();
    // Lần đầu máy chủ nhận sổ việc: đưa sổ đang có trên máy lên một lần, lượt đồng bộ sau mới kéo về
    if (acct.practice && await importOnce(state.journey)) return;
    if (first) { acct.mark = markOf(state); writeFlag(); return; }
    // Thiết bị khác đã đi trước (việc mới, xác nhận thêm, sang ngày mới, mở chu kỳ mới): lấy bản máy chủ về
    if (changedCycle || markOf(state) !== acct.mark || state.journey.day > S.day || state.totals.all > sum(S.totals) + 0.05) await pull(changedCycle).catch(() => {});
  });
  if (f && f.uid) {
    setDongTuAccount(f.uid);
    acct.on = true; acct.uid = f.uid; acct.guest = f.guest !== false; acct.cycle = f.cycle ?? null;
    acct.practice = Boolean(f.practice); acct.imported = f.imported ?? null; acct.mark = f.mark ?? null; acct.syncedAt = f.syncedAt || 0;
    setSyncEnabled(true); startAutoSync(); startLive();
  }
  return acct;
}

const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
/** Dấu bản máy chủ: đổi khi có việc mới, Kusala, sang ngày, chu kỳ mới (journey.rev) hoặc hồ sơ (profile.rev) */
const markOf = (st) => (st && st.journey ? `${st.journey.cycle}:${st.journey.rev}:${st.profile ? st.profile.rev : ''}` : null);
const pendingOps = () => idbGetAll('outbox').catch(() => []);
/** Thao tác sổ việc còn chờ gửi → sự kiện, để gộp cùng bản máy chủ (việc vừa làm trên máy không bị bản cũ đè mất) */
const pendingEvents = (ops) => ops.filter((o) => o.type === 'practice.event' && o.payload).map((o) => ({ ...o.payload, id: o.id, at: o.payload.at ?? o.at }));

/**
 * Kéo bản máy chủ về và áp vào S. Hồ sơ/Kusala chỉ áp khi máy không còn thao tác Kusala chờ gửi (giữ luật cũ);
 * sổ việc luôn áp được vì gộp cả thao tác còn chờ. `full`: chu kỳ mới, lấy hẳn bản máy chủ.
 */
async function pull(full = false) {
  const S = hooks.S; if (!acct.on || !S) return false;
  acct.pulling = true;
  try {
    const uid = acct.uid, me = await A.getMe(true);
    observeDongTuMe(uid, me);
    // Máy chủ vừa nhận sổ việc: xếp hàng sổ trên máy TRƯỚC khi gộp, để bản máy chủ (còn trống) không đè mất việc đã làm
    if (me.practice && me.journey) { acct.practice = true; await importOnce(me.journey); }
    const ops = await pendingOps(), kusalaWaiting = ops.some((o) => o.type !== 'practice.event');
    const fields = kusalaWaiting && !full ? {} : full ? fromServer(me) : keepNotes(fromServer(me), S);
    if (me.practice && Array.isArray(me.events)) {
      acct.practice = true;
      Object.assign(fields, mergePractice(S, foldPractice([...me.events, ...pendingEvents(ops)]), me.journey && me.journey.started_on));
    }
    acct.cycle = me.journey ? me.journey.cycle : acct.cycle; acct.mark = markOf(me); acct.syncedAt = Date.now(); writeFlag();
    // chỉ áp các trường thật sự khác (so không phụ thuộc thứ tự khóa), để màn hình không vẽ lại/đổi diện mạo vô cớ
    for (const k of Object.keys(fields)) if (same(fields[k], S[k])) delete fields[k];
    const changed = Object.keys(fields).length > 0;
    if (changed) hooks.apply(fields, false);
    return changed;
  } finally { acct.pulling = false; }
}

/**
 * Đưa sổ việc đang có trên máy lên một lần cho mỗi (tài khoản, chu kỳ). Mã sự kiện cố định theo máy: lặp lại cũng không cộng đôi.
 * Trả true nếu vừa xếp hàng. `acct.imported` ghi lại để `recordPractice` biết từ lúc nào gửi từng việc riêng.
 */
async function importOnce(journey) {
  const S = hooks.S; if (!S || !journey || !journey.started_on || !acct.uid) return false;
  const k = `${acct.uid}:${journey.cycle}`, key = 'practiceImport:' + k;
  if (acct.imported === k) return false;
  if (await idbGet('meta', key).catch(() => null)) { acct.imported = k; writeFlag(); return false; }
  const dev = await getDeviceId(), now = Date.now(), evs = importEvents(S, journey.started_on, dev + journey.cycle);
  for (const e of evs) await enqueueOp('practice.event', { date: e.date, kind: e.kind, slot: e.slot, value: e.value, at: e.at }, now, e.id);
  await idbSet('meta', key, { at: now, n: evs.length }).catch(() => {});
  acct.imported = k; writeFlag();
  if (evs.length) { triggerSync(); return true; }
  return false;
}

/**
 * Ghi một việc của sổ việc để đồng bộ. Máy chủ chưa nhận (`practice` chưa bật) hoặc sổ trên máy chưa được đưa lên cho chu kỳ này
 * thì chỉ giữ trên máy: lần đưa lên sẽ gồm cả việc này (không gửi riêng nữa để sổ tự ghi nhận không bị cộng đôi).
 */
export function recordPractice(kind, slot, value, date) {
  if (!acct.on || !acct.practice || acct.imported !== `${acct.uid}:${acct.cycle}`) return;
  enqueueOp('practice.event', { date, kind, slot, value }).catch(() => {});
}

let lastKick = 0, liveOn = false;
/**
 * Hỏi máy chủ có gì mới: còn thao tác chờ thì gửi (kết quả tự kéo bản mới), không thì hỏi nhẹ `GET /me` và chỉ tải đủ khi dấu đổi.
 * `force`: mở Bia hoặc người dùng chủ động — luôn tải đủ.
 */
export async function syncNow(force = false) {
  if (!acct.on) return false;
  if (!force && Date.now() - lastKick < 4000) return false;
  lastKick = Date.now();
  if ((await pendingOps()).length) { await triggerSync(); if (!force) return true; }
  try {
    if (!force) {
      const uid = acct.uid, me = await A.getMe();
      observeDongTuMe(uid, me); acct.syncedAt = Date.now();
      if (me.practice && !acct.practice) { acct.practice = true; writeFlag(); await triggerSync(); return true; }   // máy chủ vừa cập nhật (#94)
      if (markOf(me) === acct.mark && me.journey.day === hooks.S.day) { writeFlag(); return false; }
    }
    return await pull();
  } catch { return false; }
}
/**
 * Đang mở trang: quay lại cửa sổ/tab hoặc có mạng lại thì hỏi máy chủ ngay; trang đang hiện và người dùng còn thao tác trong
 * 10 phút gần đây thì 30 giây hỏi một lần (tab bỏ quên không tốn lượt gọi của gói Free) (#93)
 */
function startLive() {
  if (liveOn || typeof window === 'undefined') return;
  liveOn = true;
  let lastInput = Date.now();
  const kick = () => { if (document.visibilityState === 'visible') syncNow().catch(() => {}); };
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true });
  window.addEventListener('focus', kick);
  window.addEventListener('online', kick);
  document.addEventListener('visibilitychange', kick);
  setInterval(() => { if (Date.now() - lastInput < 600000) kick(); }, 30000);
}

/** Ghi chú quán chiếu chỉ nằm trên máy (không gửi lên): khi lấy cùng hành trình từ máy chủ về thì giữ lại ghi chú đang có */
function keepNotes(fields, S) {
  for (const [d, e] of Object.entries(fields.done || {})) for (const k of Object.keys(e)) { const n = S.done && S.done[d] && S.done[d][k] && S.done[d][k].note; if (n) e[k].note = n; }
  return fields;
}
// Đã đăng nhập nhưng còn chờ người dùng chọn hành trình (xung đột): CHƯA bật đồng bộ, để bản máy chủ không tự ghi đè bản trên máy
let pending = null;

/**
 * "Giữ hành trình của tôi": tạo phiên khách rồi đưa hồ sơ + hành trình trên máy lên máy chủ.
 * Trình duyệt còn phiên của một tài khoản (ví dụ tải lại trang giữa lúc đang chọn hành trình) thì xử như vừa đăng nhập.
 */
export async function keepJourney(S) {
  const s = await A.getSession().catch((e) => { if (e.status === 0) throw e; return null; });
  if (s && s.user) return afterSignIn(S, s);
  const r = await A.signInAnonymous(), me = await A.getMe();
  setOn({ ...r.user, isAnonymous: true }, undefined, me);
  await pushLocal(S, me);
  return { mode: 'pushed' };
}

/**
 * Sau khi đăng nhập vào tài khoản đã có (passkey, mã khôi phục, liên kết thiết bị). Trả:
 *  { mode: 'restore', fields }  máy trống hoặc giống bản đã lưu → giao diện ghi `fields` vào S
 *  { mode: 'pushed' }           tài khoản chưa có gì → đã đưa hành trình trên máy lên
 *  { mode: 'conflict', me, fields }  hai bên đều có tiến trình → giao diện hỏi (§6.1 bước 5), rồi gọi useSaved hoặc useLocal
 */
export async function afterSignIn(S, s) {
  s = s || (await A.getSession()); const me = await A.getMe(true);
  const serverHas = !serverEmpty(me) || Boolean(me.profile.tinh_danh), localHas = hasProgress(S);
  if (!serverHas) { setOn(s.user, me.journey.cycle, me); await pushLocal(S, me); return { mode: 'pushed' }; }
  const fields = fromServer(me);
  if (localHas && (me.journey.day !== S.day || Math.abs(me.totals.all - sum(S.totals)) > 0.05)) { pending = { user: s.user, cycle: me.journey.cycle, me }; return { mode: 'conflict', me, fields }; }
  setOn(s.user, me.journey.cycle, me);
  return { mode: 'restore', fields: localHas ? keepNotes(fields, S) : fields };
}
/** Xung đột → "Giữ hành trình đã lưu": giao diện sao lưu bản trên máy, ghi bản đã lưu vào S, rồi mới bật đồng bộ */
export function useSaved() { if (pending) setOn(pending.user, pending.cycle, pending.me); pending = null; }
/** Xung đột → "Dùng hành trình trên máy này": bản đã lưu thành chu kỳ cũ, hành trình trên máy thành chu kỳ hiện tại */
export async function useLocal(S) {
  const now = Date.now(), me = await A.getMe();
  if (pending) setOn(pending.user, null, me); pending = null;
  acct.cycle = null; writeFlag();   // lượt đồng bộ kế tiếp chỉ ghi nhận chu kỳ mới, không kéo bản máy chủ về
  await pushProfile(S, me);
  await enqueueOp('journey.reset_cycle', {}, now - 1);
  await enqueueOp('legacy.import', toImport(S), now);
  await triggerSync();
}

/** Ghi một thao tác tu tập để đồng bộ (không làm gì khi chưa bật "Giữ hành trình") */
export function record(type, payload = {}) {
  if (!acct.on) return;
  enqueueOp(type, payload).catch(() => {});
}
/** Lưu Tịnh danh/diện mạo/cài đặt lên máy chủ (không chặn giao diện) */
export function recordProfile(S) {
  if (!acct.on) return;
  A.getMe().then((me) => pushProfile(S, me)).catch(() => {});
}

/** Gắn passkey hoặc tạo mã khôi phục xong: tài khoản thôi là "khách" */
export function markSecured() { if (acct.on) { acct.guest = false; writeFlag(); } }
/** Đăng xuất máy này: dữ liệu trên máy giữ nguyên, ngừng đồng bộ */
export async function signOutHere() {
  await A.signOut().catch(() => {});
  acct.on = false; acct.uid = null; acct.guest = true; acct.cycle = null; acct.rejected = []; acct.practice = false; acct.imported = null; acct.mark = null; acct.syncedAt = 0; writeFlag(); setSyncEnabled(false); setDongTuAccount(null);
}

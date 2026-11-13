// apps/web/src/net/account.js
// "Giữ hành trình" (T2.3, PROJECT_ROADMAP.md §6.1, §6.4): nối trạng thái trên máy (S, localStorage) với tài khoản máy chủ.
// Máy vẫn là nơi chạy chính (offline-first): mọi thao tác ghi S trước, rồi xếp vào outbox để đồng bộ.
// Không có gì ở đây tự chạy khi người dùng chưa chọn "Giữ hành trình" hoặc "Tôi đã có hành trình".
import * as A from './api.js';
import { enqueueOp, triggerSync, startAutoSync, setSyncEnabled, onSyncComplete } from './sync.js';
import { idbGet, idbSet, idbGetAll } from './idb.js';

const FLAG = 'vandao.acct';
/** Trạng thái tài khoản trên máy này. `available`: có máy chủ (không phải bản HTML đơn mở bằng file://) */
export const acct = { available: typeof location !== 'undefined' && /^https?:$/.test(location.protocol), on: false, uid: null, guest: true, cycle: null, rejected: [] };
let hooks = { S: null, apply: () => {} };

const readFlag = () => { try { return JSON.parse(localStorage.getItem(FLAG) || 'null'); } catch { return null; } };
function writeFlag() {
  const v = acct.on ? { uid: acct.uid, guest: acct.guest, cycle: acct.cycle } : null;
  try { if (v) localStorage.setItem(FLAG, JSON.stringify(v)); else localStorage.removeItem(FLAG); } catch { /* chỉ giữ trong bộ nhớ */ }
  idbSet('meta', 'acct', v).catch(() => {});
}
function setOn(user, cycle) {
  acct.on = true; acct.uid = user.id; acct.guest = Boolean(user.isAnonymous); if (cycle !== undefined) acct.cycle = cycle;
  writeFlag(); setSyncEnabled(true); startAutoSync();
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
  let f = readFlag(); if (!f) { try { f = await idbGet('meta', 'acct'); } catch { f = null; } }
  onSyncComplete(async (state, res) => {
    acct.rejected = (res.rejected || []).filter((r) => r.code !== 'exists');
    const first = acct.cycle === null, changedCycle = !first && state.journey.cycle !== acct.cycle;
    acct.cycle = state.journey.cycle; writeFlag();
    if (first || (await idbGetAll('outbox').catch(() => [])).length) return;
    // Thiết bị khác đã đi trước (xác nhận thêm, sang ngày mới, mở chu kỳ mới): lấy bản máy chủ về
    if (changedCycle || state.journey.day > S.day || state.totals.all > sum(S.totals) + 0.05) {
      try { const f = fromServer(await A.getMe(true)); hooks.apply(changedCycle ? f : keepNotes(f, S), false); } catch { /* lần đồng bộ sau thử lại */ }
    }
  });
  if (f && f.uid) { acct.on = true; acct.uid = f.uid; acct.guest = f.guest !== false; acct.cycle = f.cycle ?? null; setSyncEnabled(true); startAutoSync(); }
  return acct;
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
  setOn({ ...r.user, isAnonymous: true });
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
  if (!serverHas) { setOn(s.user, me.journey.cycle); await pushLocal(S, me); return { mode: 'pushed' }; }
  const fields = fromServer(me);
  if (localHas && (me.journey.day !== S.day || Math.abs(me.totals.all - sum(S.totals)) > 0.05)) { pending = { user: s.user, cycle: me.journey.cycle }; return { mode: 'conflict', me, fields }; }
  setOn(s.user, me.journey.cycle);
  return { mode: 'restore', fields: localHas ? keepNotes(fields, S) : fields };
}
/** Xung đột → "Giữ hành trình đã lưu": giao diện sao lưu bản trên máy, ghi bản đã lưu vào S, rồi mới bật đồng bộ */
export function useSaved() { if (pending) setOn(pending.user, pending.cycle); pending = null; }
/** Xung đột → "Dùng hành trình trên máy này": bản đã lưu thành chu kỳ cũ, hành trình trên máy thành chu kỳ hiện tại */
export async function useLocal(S) {
  const now = Date.now(), me = await A.getMe();
  if (pending) setOn(pending.user, null); pending = null;
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
  acct.on = false; acct.uid = null; acct.guest = true; acct.cycle = null; acct.rejected = []; writeFlag(); setSyncEnabled(false);
}

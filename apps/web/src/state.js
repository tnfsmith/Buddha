// Trạng thái hành trình trên máy (PROJECT_ROADMAP.md §4.5).
// localStorage 'vandao.v1' vẫn là nguồn đọc đồng bộ lúc khởi động; IndexedDB 'vandao' giữ bản sao song song
// (store state/outbox/meta) để khôi phục khi localStorage bị xóa, và là nơi outbox đồng bộ máy chủ ở GĐ2.
// Đối tượng S giữ nguyên danh tính suốt vòng đời trang: mọi nơi import { S } đều thấy cùng một bản.
import { advance, allDone as allDoneIn } from '@vandao/shared/schedule.js';
import { defaultLook } from './people.js';
import { idbGet, idbSet } from './net/idb.js';

export const KEY = 'vandao.v1';
export const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const fresh = () => ({ v: 1, day: 1, lastDate: null, done: {}, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: '', look: defaultLook(), birds: { n: 6, freq: 1, vol: 0.6 }, music: { on: false, source: 'time', song: 'van-thuy', mood: 'an', order: 'loop', len: 0, genre: 'all', vol: 0.6 }, vandu: false });
// Cài đặt nhạc bản cũ (và bản từ thiết bị chưa cập nhật): 'one' = phát liên tục một khúc → 'loop' không giới hạn; 'đổi khúc sau 3/5/10 phút' → thời lượng khúc
export function fixMusic(M) { if (M.order === 'one') M.order = 'loop'; if (!['loop', 'seq', 'shuf', 'once'].includes(M.order)) M.order = 'loop'; if (typeof M.len !== 'number') M.len = M.order === 'loop' ? 0 : M.span >= 10 ? 15 : 5; if (!M.genre) M.genre = 'all'; delete M.span; return M; }

export const S = fresh();
const hadLocal = (() => { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } })();
/** true khi trình duyệt chặn lưu trữ cục bộ: tiến trình chỉ giữ trong bộ nhớ */
export let mem = true;

const replace = (obj) => { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, obj); };

try { const raw = localStorage.getItem(KEY); if (raw) replace(Object.assign(fresh(), JSON.parse(raw))); S.look = { ...defaultLook(), ...S.look }; S.music = fixMusic({ ...fresh().music, len: undefined, ...S.music }); S.birds = { ...fresh().birds, ...S.birds }; localStorage.setItem(KEY, JSON.stringify(S)); mem = false; } catch (e) { mem = true; }

// ───────── IndexedDB: bản sao song song + outbox ─────────
// Lược đồ IndexedDB chỉ có một chủ: net/idb.js (`vandao` v2: state, outbox, meta, kusala, sessions). Máy đã chạy bản v1
// (T1.1) được nâng cấp tại chỗ: giữ nguyên ba store cũ cùng dữ liệu, thêm store mới.
export { idbGet } from './net/idb.js';
export const idbPut = (store, key, val) => idbSet(store, key, val);
let idbQueue = Promise.resolve();
// Chỉ chép sang IndexedDB sau khi stateReady đã đối chiếu, để trạng thái rỗng lúc khởi động không ghi đè bản cần khôi phục
let mirrorOn = false;
const mirror = (force) => { if (!mirrorOn && !force) return idbQueue; const snap = JSON.parse(JSON.stringify(S)); idbQueue = idbQueue.then(() => idbPut('state', KEY, snap)).catch(() => {}); return idbQueue; };

// Đang khôi phục từ IndexedDB (sắp tải lại trang): không ghi gì nữa, kẻo savePos lúc pagehide chép trạng thái rỗng đè lên bản vừa khôi phục
let restoring = false;
export const save = () => { if (restoring) return; try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* chỉ giữ trong bộ nhớ */ } mirror(); };
export const allDone = (d) => allDoneIn(S.done, d);

/** "Trở về ngày 1": giữ Tịnh danh và diện mạo, xóa phần còn lại */
export function resetState(keep) { replace(Object.assign(fresh(), keep)); }

// Khóa 1 nấc mỗi ngày (luật chung ở packages/shared/schedule.js)
Object.assign(S, advance(S, today()));
save();

/**
 * Hoàn tất khi IndexedDB đã đối chiếu xong:
 * - 'restored': localStorage trống nhưng IndexedDB còn hành trình → chép lại rồi tải lại trang (một lần)
 * - 'mirrored': IndexedDB đã có bản sao mới nhất · 'no-idb': trình duyệt không cho dùng IndexedDB
 */
export const stateReady = (async () => {
  try {
    const stored = await idbGet('state', KEY);
    if (!hadLocal && stored && (stored.name || stored.day > 1) && !sessionStorage.getItem('vandao.restored')) {
      restoring = true; localStorage.setItem(KEY, JSON.stringify(stored));
      if (localStorage.getItem(KEY)) { sessionStorage.setItem('vandao.restored', '1'); location.reload(); return 'restored'; }
      restoring = false;
    }
    mirrorOn = true;
    await mirror();
    if (!(await idbGet('meta', 'createdAt'))) await idbPut('meta', 'createdAt', Date.now());
    return 'mirrored';
  } catch (e) { return 'no-idb'; }
})();

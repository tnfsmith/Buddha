// Cổng mở Tầng 1 Nhập Lưu Tịnh Cảnh (#107, hợp đồng docs/contracts/tier-unlock.md, #169).
// Ba điều kiện do máy chủ xét: hoàn tất 49 ngày, ≥ 30 thời thiền trọn (≥ 12 phút), tự vấn tuần 7. Chứng thực tùy chọn.
// Máy chủ là nguồn trạng thái; máy khách giữ ảnh chụp theo tài khoản để Tầng 1 đã mở vẫn mở khi mất mạng.
// Câu trả lời tự vấn chỉ ở trên máy (ui/phan-tinh.js); máy chủ chỉ nhận một cờ. Không nói chứng đắc (AGENTS.md 1.6).
import { api } from '../net/api.js';
import { acct, syncNow } from '../net/account.js';

const KEY = 'vandao.tier1', URL1 = '/api/v1/tier-progress/1', FRESH_MS = 60_000;
// staleTry: chu kỳ (acct.cycle) đã được tự tải lại ngay một lần vì khác chu kỳ của ảnh chụp; lỗi thì chờ FRESH_MS như thường
const G = { uid: null, snap: null, at: 0, busy: '', err: '', loading: false, staleTry: null };
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
function follow() {
  const uid = acct.on ? acct.uid : null;
  if (G.uid === uid) return;
  G.uid = uid; G.snap = uid ? read()[uid] || null : null; G.at = 0; G.busy = ''; G.err = ''; G.staleTry = null;
}
function keep(s) {
  G.snap = s; G.at = Date.now();
  const all = read(); all[G.uid] = s;
  try { localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* chỉ giữ trong bộ nhớ */ }
}
/** Ảnh chụp thuộc chu kỳ cũ (đặt lại ở thiết bị khác, đồng bộ đã kéo chu kỳ mới về) */
const oldSnap = () => !!G.snap && acct.cycle !== null && G.snap.cycle !== acct.cycle;
/** Còn đúng tài khoản lúc bắt đầu (sau khi chờ đồng bộ, người dùng có thể đã đăng xuất hoặc đổi tài khoản) */
const same = (uid) => acct.on && acct.uid === uid && G.uid === uid;
const okSnap = (s) => !!s && typeof s === 'object' && s.tier === 1 && ['dang_tu', 'du_dieu_kien', 'da_mo'].includes(s.status) && !!s.criteria;

/**
 * Tầng 1 đã mở cho người đang dùng: máy chủ đã trả `da_mo` cho đúng tài khoản (ảnh chụp lưu trên máy), hoặc
 * máy này đã ở Tầng 1 trước khi có cổng máy chủ (mặc định ghi ở #169 điểm 3: không khóa lại quyền đã mở).
 */
export function tierOpened(S) { follow(); return !!S.tier1Legacy || (!!G.snap && G.snap.status === 'da_mo'); }

/** Ghi mốc một lần khi bản này chạy lần đầu trên máy: đã hoàn thành chương trình từ trước thì giữ Tầng 1 đã mở */
export function tierMigrate(S) {
  if (S.tier1v !== undefined) return false;
  S.tier1Legacy = !!S.completed; S.tier1v = 1;
  return true;
}

/** Tải trạng thái (đẩy hàng đợi thực hành lên trước để số thời thiền trọn tính cả thời vừa ngồi) */
export async function tierLoad(render, force = false) {
  follow();
  // Chu kỳ trên máy đã đổi (đặt lại ở thiết bị khác) thì ảnh chụp cũ hết giá trị: tải lại ngay, không chờ hết 60 giây,
  // nhưng chỉ một lần cho mỗi chu kỳ quan sát được. Lỗi thì giữ thời gian chờ, người dùng bấm «Thử lại» (review #174).
  const stale = oldSnap() && G.staleTry !== acct.cycle;
  if (!acct.on || G.loading || (!force && !stale && G.at && Date.now() - G.at < FRESH_MS)) return;
  const uid = G.uid; G.loading = true;
  if (stale) G.staleTry = acct.cycle;
  try {
    await syncNow().catch(() => {});
    if (!same(uid)) return;
    const s = await api(URL1);
    if (same(uid)) { if (okSnap(s)) { keep(s); G.err = ''; } else G.err = 'load'; }
  } catch { if (same(uid)) G.err = 'load'; }
  finally {
    G.loading = false;
    if (same(uid)) { G.at = Date.now(); render(); }   // mọi kết thúc (kể cả trả về sai dạng) đều đặt mốc chờ
  }
}

const row = (ok, text) => `<li class="${ok ? 'on' : ''}">${ok ? '✓' : '○'} ${text}</li>`;
const btn = (act, text, cls = 'btn', x = '') => `<button class="${cls}" data-act="${act}"${x}${G.busy ? ' disabled' : ''}>${text}</button>`;

/**
 * Khối cổng ở Bia Tích Lũy và Cổng Vân Môn. Hiện từ tuần 7 (ngày 43) hoặc khi đã có trạng thái.
 * reflected: tự vấn tuần 7 đã lưu trên máy này (chưa chắc đã gửi cờ).
 */
export function tierBlock(S, reflected) {
  follow();
  const day = Number(S.day) || 1, end = !!S.completed || day >= 49;
  if (tierOpened(S)) return '<div class="note tg" role="status"><p><b>Đã hoàn thành chương trình Sơ nhập.</b> Cổng Nhập Lưu Tịnh Cảnh (Tầng 1) đã mở.</p></div>';
  if (day < 43 && !end && !(G.snap && G.snap.status !== 'dang_tu')) return '';   // chỉ hiện từ tuần 7
  let h = '<div class="tg"><h3>Cổng Nhập Lưu Tịnh Cảnh</h3>';
  if (!acct.on) return h + '<p class="muted">Giữ hành trình để mở Tầng 1: máy chủ xét ba điều kiện của chương trình.</p><div class="row">' + btn('acct-open', 'Giữ hành trình của tôi') + '</div></div>';
  const s = G.snap, c = s && s.criteria, retry = '<div class="row">' + btn('tg-reload', 'Thử lại', 'ghost') + '</div>';
  // Chưa có ảnh chụp, hoặc ảnh chụp của chu kỳ cũ: không hiện điều kiện và nút của chu kỳ đã qua
  if (!c || oldSnap()) {
    const what = c ? 'Chu kỳ đã đổi trên thiết bị khác. ' : '';
    return h + (G.err ? `<p class="note" role="alert">${what}Chưa tải được tình trạng cổng.</p>` + retry : `<p class="muted" role="status">${what}Đang tải tình trạng cổng…</p>`) + '</div>';
  }
  const n = Number(c.full_sessions) || 0, need = Number(c.min_full_sessions) || 30;
  h += '<ul class="tgl">' + row(!!c.journey_completed, `Hoàn tất 49 ngày Sơ nhập${c.journey_completed ? '' : ` (ngày ${Math.min(day, 49)}/49)`}`) +
    row(n >= need, `Thời thiền trọn từ 12 phút: ${Math.min(n, need)}/${need}`) +
    row(!!c.week_7_reflected, 'Tự vấn tuần 7') + '</ul>';
  if (!c.week_7_reflected && end) {
    h += reflected ? '<p class="muted">Đã lưu tự vấn tuần 7 trên máy này. Xác nhận để máy chủ ghi nhận (chỉ gửi một cờ, không gửi câu trả lời).</p><div class="row">' + btn('tg-reflect', 'Xác nhận đã tự vấn') + '</div>'
      : '<div class="row">' + btn('pt-open', 'Tự vấn tuần 7', 'btn', ' data-w="7"') + '</div>';
  }
  if (s.status === 'du_dieu_kien') h += '<div class="row">' + btn('tg-open', 'Mở Nhập Lưu Tịnh Cảnh') + '</div>';
  h += (G.busy ? `<p class="muted" role="status">${G.busy}…</p>` : '') + (G.err && G.err !== 'load' ? `<p class="note" role="alert">${G.err}</p>` : '') +
    (G.err === 'load' && !G.busy ? '<p class="note" role="alert">Chưa tải được tình trạng mới nhất; đang hiện lần tải trước.</p>' + retry : '');
  return h + '<p class="muted">Thời thiền được đếm sau khi đồng bộ lên máy chủ. Chứng thực tuần là tùy chọn.</p></div>';
}

const ERR = {
  cycle_conflict: 'Chu kỳ đã đổi trên thiết bị khác. Đã tải lại tình trạng cổng.',
  reflection_too_early: 'Tự vấn tuần 7 được xác nhận từ ngày 49.',
  tier_not_ready: 'Còn điều kiện chưa đạt. Đã tải lại tình trạng cổng.',
  invalid_payload: 'Chưa gửi được: thiếu thông tin chu kỳ. Đã tải lại tình trạng cổng.',
};
/** Nút tg-*: tải lại, xác nhận tự vấn, mở cổng. Không đổi Kusala hay tiến trình ngày. */
export async function tierAct(act, render, toast) {
  follow();
  if (act === 'tg-reload') { G.err = ''; render(); return tierLoad(render, true); }
  if (!acct.on || G.busy || (act !== 'tg-reflect' && act !== 'tg-open')) return;
  // Gửi đúng chu kỳ của ảnh chụp người dùng đang xem: chu kỳ đã đổi thì máy chủ trả cycle_conflict, không ghi nhầm sang chu kỳ mới
  const uid = G.uid, cycle = G.snap ? G.snap.cycle : acct.cycle;
  G.busy = act === 'tg-open' ? 'Đang mở cổng' : 'Đang gửi xác nhận'; G.err = ''; render();
  try {
    if (act === 'tg-reflect') await api(URL1 + '/reflection', { method: 'POST', body: { cycle, done: true } });
    else {
      await syncNow().catch(() => {});
      if (!same(uid)) return;   // đã đổi tài khoản trong lúc chờ đồng bộ: không gửi thay người khác
      await api(URL1 + '/open', { method: 'POST', body: { cycle } });
    }
  } catch (e) {
    if (same(uid)) G.err = ERR[e && e.code] || 'Chưa gửi được. Hãy thử lại khi có mạng.';
  }
  if (!same(uid)) return;
  G.busy = '';
  await tierLoad(render, true);
  if (act === 'tg-open' && G.snap && G.snap.status === 'da_mo') toast('Đã hoàn thành chương trình Sơ nhập. Cổng Nhập Lưu Tịnh Cảnh đã mở.');
}

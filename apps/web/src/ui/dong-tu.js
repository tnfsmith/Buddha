// Bạn đồng tu (#124; hợp đồng docs/contracts/ban-dong-tu.md §5; thiết kế docs/thiet-ke/ban-dong-tu.md §6): danh sách bạn,
// mời bạn tu cùng (mã + QR), tìm đúng «Tịnh danh · mã», chi tiết bạn, quyền riêng tư, thẻ lời mời gặp và đếm ngược cùng giờ.
// Chỉ dùng mô-đun mạng net/dong-tu.js. Không chữ tự do (chỉ lời mẫu), không điểm, không xếp hạng, không hiện số bạn.
// Lời mời gặp không hiện và không có âm khi đang thiền; xuất thiền rồi mới hiện, kèm dòng «trong lúc bạn thiền».
import {
  CHEER_LINES, INVITE_TTL_MS, LINES, MAX_COMPANIONS, MEET_KINDS, PRESENCE_TEXT, REASON_TEXT, SEEN_TEXT,
  SESSION_AHEAD_MS, SESSION_MAX, SESSION_MIN_LEAD_MS, SESSION_OPEN_MAX, SESSION_REMIND_MS, SESSION_STEP_MS,
  canMeet, inviteFromHash, isMeetKind, meetPhase, parseFriendQuery, sessionPhase, showInviteCode,
} from '@vandao/shared/dong-tu.js';
import {
  block, cancelMeet, createLink, dongTu, linkInfo, listBlocks, loadCompanions, meet, observeDongTuMe, onDongTu, pushSocialPrefs,
  removeCompanion, report, respondMeet, respondRequest, requestByName, setCompanion, setPresence, unblock, withdrawRequest,
} from '../net/dong-tu.js';
import { acct } from '../net/account.js';
import { api, getMe, updateProfile } from '../net/api.js';
import { ZONE_UNLOCK, gateLevel } from '@vandao/shared/schedule.js';
import { esc } from './dom.js';
import { qr } from './account.js';
import { ceilStep, icsDownload, localInput, whenText } from './hen-ics.js';

/**
 * Trạng thái màn. `tab`: list · moi (mã mời) · tim (tìm bạn) · ban (một bạn) · bao (báo cáo) · rieng (quyền riêng tư) ·
 * loi (vừa mở liên kết mời khi chưa có phiên). `skew`: giờ máy chủ − giờ máy, để đếm ngược hai bên khớp nhau.
 */
const D = { uid: null, tab: 'list', pend: null };
/** Mọi trạng thái riêng của một tài khoản. Đổi người (đăng xuất, đăng nhập người khác) thì xóa sạch, kể cả mã mời đã tạo. */
function resetFor(uid) {
  Object.assign(D, {
    uid, tab: D.tab === 'loi' ? 'loi' : 'list', sel: null, busy: '', err: '', msg: '', arm: '', link: null, me: null, blocks: null, q: '', peek: null, prog: new Map(), progReq: new Map(), kem: false,
    skew: 0, at: 0, lastLoad: 0, msgInv: null, cardKey: null, viewKey: '', openSynced: false,
    quietSeen: new Set(), chimed: new Set(), watch: new Set(), joined: new Set(), hide: new Set(), answered: new Set(), hen: freshHen(),
    cheered: new Set(), cheerHold: false, cheerRetry: 0, cheerMark: 0, cheerSeenAt: 0,
  });
}
/** Ô hẹn giờ đồng tu: bạn được chọn, «gio» (hẹn giờ) hoặc «ngay», giờ địa phương trong ô datetime-local */
function freshHen() { return { pick: new Set(), when: 'gio', at: localInput(ceilStep(Date.now() + 30 * 60_000)) }; }
resetFor(null);
/** Gọi ở mọi lối vào: tài khoản đổi thì trạng thái cũ không được lọt sang người mới */
const follow = () => { if (acct.uid !== D.uid) resetFor(acct.uid); };
/** Kết quả bất đồng bộ chỉ được ghi khi vẫn đúng tài khoản lúc bắt đầu */
const still = (uid) => uid === acct.uid && uid === D.uid;
let ctx = null;

const L = (k) => { const v = dongTu.list && dongTu.list[k]; return Array.isArray(v) ? v : []; };
const now = () => Date.now() + D.skew;
// Bạn đồng tu có thể chưa tạo nhân vật (§11: kết nối không đòi Tịnh danh): không hiện «null», ghi rõ chưa đặt
const nm = (p) => (p && p.tinh_danh) || 'Chưa đặt Tịnh danh';
const label = (p) => (p && p.tinh_danh ? `${p.tinh_danh} · ${p.tag}` : `ID ${p.tag} (chưa đặt Tịnh danh)`);
const who = (p) => esc(label(p));
const friend = (id) => L('companions').find((c) => c.id === id) || null;
const nameOf = (id) => { const c = friend(id); return c ? who(c) : 'Bạn đồng tu'; };
const plainName = (id) => { const c = friend(id); return c ? label(c) : 'bạn đồng tu'; };
const other = (inv) => (inv.from === acct.uid ? inv.to : inv.from);
const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const mins = (ms) => `${Math.max(1, Math.ceil(ms / 60_000))} phút`;
const fmtLeft = (ms, f) => (f === 'c' ? clock(ms) : mins(ms));
const date = (ms) => new Date(ms).toLocaleDateString('vi-VN');
const PLACE = { dtd: 'Tại Đại Thiền Đường', dao: 'Trên Vân Đảo' };
const AT = { dtd: 'tại Đại Thiền Đường', dao: 'trên Vân Đảo' };
const WHAT = { thien: 'cùng ngồi thiền', tra: 'cùng thưởng trà' };
const REPORT = ['Quấy rầy, mời gặp liên tục', 'Mạo danh người khác', 'Tịnh danh hoặc hình ảnh không phù hợp', 'Lý do khác'];
const ERR = {
  offline: 'Không kết nối được máy chủ. Hãy thử lại khi có mạng.',
  rate_limited: 'Bạn đã thao tác nhiều lần trong thời gian ngắn. Hãy thử lại sau.',
  invite_expired: 'Lời mời đã hết hạn.', invite_not_pending: 'Lời mời này không còn chờ trả lời.',
  not_found: 'Không còn thấy mục này.', limit_companions: `Đã đủ ${MAX_COMPANIONS} bạn đồng tu.`,
  link_invalid: 'Mã mời không còn hiệu lực.', link_expired: 'Mã mời đã hết hạn.', link_used_up: 'Mã mời đã dùng hết lượt.',
  already_companion: 'Hai bạn đã kết nối đồng tu.', self: 'Đây là mã mời của chính bạn.',
  unauthorized: 'Phiên đã hết. Hãy mở Tài khoản để đăng nhập lại.',
  session_closed: 'Hẹn này đã kết thúc hoặc đã hủy.', cheer_today: 'Hôm nay bạn đã gửi lời khích lệ cho bạn ấy.', invalid_payload: 'Giờ hẹn hoặc danh sách bạn chưa hợp lệ.',
};
const human = (e) => ERR[e && e.code] || REASON_TEXT[e && e.code] || 'Chưa thực hiện được. Hãy thử lại.';

/** Lời mời gặp của mình, chia theo việc cần làm: đến (chờ mình trả lời), đi (chờ bạn trả lời), cùng giờ (đã nhận, sắp/đang làm) */
function invites() {
  const t = now(), out = { incoming: [], outgoing: [], together: [] };
  for (const inv of L('invites')) {
    if (!inv || !isMeetKind(inv.kind) || (inv.from !== acct.uid && inv.to !== acct.uid)) continue;
    const ph = meetPhase(inv, t);
    if (ph.phase === 'cho') { if (inv.to !== acct.uid) out.outgoing.push({ inv, ph }); else if (!D.answered.has(inv.id)) out.incoming.push({ inv, ph }); }
    else if ((ph.phase === 'sap' || ph.phase === 'dang') && MEET_KINDS[inv.kind].synced && Number.isFinite(inv.start_at)) out.together.push({ inv, ph });
  }
  return out;
}
/**
 * Hẹn đồng tu (#151, hợp đồng §9): phiên mình chủ trì hoặc có ghế, chưa hủy, chưa qua thời thiền. Ghế mình đã từ chối/rời thì không hiện.
 * `going`: mình sẽ ngồi (chủ phiên, hoặc ghế đã nhận lời). Khóa trong D.joined/hide/watch có tiền tố «s:» để không trùng id lời mời gặp.
 */
/**
 * Máy chủ có API phiên (§9.3) khi GET /companions trả mảng `sessions`. Chưa có (bản API cũ) thì ẩn nút hẹn giờ: UI có thể
 * lên trước API mà không gọi route chưa triển khai; API lên sau thì nút tự hiện ở lần tải danh sách kế tiếp.
 */
const hasSessions = () => !!dongTu.list && Array.isArray(dongTu.list.sessions);
const SEAT = { moi: 'chờ trả lời', nhan: 'đã nhận lời', tu_choi: 'không tham gia', roi: 'không tham gia' };
function sessions() {
  const t = now(), out = [];
  for (const s of L('sessions')) {
    if (!s || !s.host || !Array.isArray(s.seats) || !Number.isFinite(s.start_at)) continue;
    const host = s.host.id === acct.uid, seat = host ? null : s.seats.find((x) => x && x.id === acct.uid) || null;
    if (!host && (!seat || seat.status === 'tu_choi' || seat.status === 'roi')) continue;
    const ph = sessionPhase(s, t);
    if (ph === 'xong' || ph === 'huy' || D.hide.has('s:' + s.id)) continue;
    out.push({ s, host, seat, ph, going: host || seat.status === 'nhan' });
  }
  return out.sort((a, b) => a.s.start_at - b.s.start_at);
}
/**
 * Khích lệ (#151 §8, hợp đồng §10.3): chỉ lời mẫu, mỗi bạn mỗi ngày một lời, không push, không đếm hay xếp hạng.
 * Lời nhận trong 7 ngày, mới trước. «Mới»: số lời chưa xem theo `social.cheers` của GET /me (máy chủ giữ mốc đã xem).
 */
const ymdLocal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const sentKey = (id) => `${id}|${ymdLocal(now())}`;
function cheers() {
  const t = now();
  return L('cheers').filter((c) => c && c.from && Object.prototype.hasOwnProperty.call(CHEER_LINES, c.line) && Number.isFinite(c.at) && c.at > t - 7 * 86_400_000).sort((a, b) => b.at - a.at);
}
// Nguồn duy nhất: social.cheers mà net/dong-tu.js giữ từ GET /me (#185). Sau POST /cheers/seen, giữ 0 tới khi GET /me của chính
// màn trả về (máy chủ đã tính mốc đã xem); lời đến sau đó thì lần /me kế báo đúng, kể cả khi số đếm bằng số trước (review #184).
/** Máy chủ có API khích lệ (§10.3) khi GET /companions trả mảng `cheers`; chưa có thì ẩn khối, không gọi route chưa triển khai */
const hasCheers = () => !!dongTu.list && Array.isArray(dongTu.list.cheers);
const cheerUnseen = () => (D.cheerHold ? 0 : Number(dongTu.social.cheers) || 0);
const CHEER_RETRY_MS = 15_000;
const cheerText = (c) => (c.line !== 'tien_trinh' ? CHEER_LINES[c.line]
  : c.completed === true ? 'Mình đã hoàn thành chương trình 49 ngày.' : Number.isInteger(c.day) ? `Mình đang ở ngày ${c.day} của hành trình 49 ngày.` : 'Mình đang tiếp tục hành trình 49 ngày.');
function ago(at) {
  const a = new Date(now()), b = new Date(at), d = Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate())) / 86_400_000);
  return d <= 0 ? 'hôm nay' : d === 1 ? 'hôm qua' : `${d} ngày trước`;
}
/** Đánh dấu đã xem tới lời mới nhất (POST /cheers/seen, mốc chỉ tăng ở máy chủ); các lời «mới» vẫn ghi «mới» tới khi đóng màn */
async function cheerSeen(until) {
  const uid = D.uid; D.cheerSeenAt = until;
  try {
    await api('/api/v1/cheers/seen', { method: 'POST', body: { until } });
    if (!still(uid)) return;
    D.cheerMark = Math.max(D.cheerMark, cheerUnseen()); D.cheerHold = true; ctx.badge();
  } catch { if (still(uid)) D.cheerSeenAt = 0; return; }
  await loadMe();
}
function cheerList() {
  const CH = cheers();
  if (!hasCheers() || !CH.length) return '';
  const fresh = Math.max(D.cheerMark, cheerUnseen());
  if (cheerUnseen() > 0 && CH[0].at > D.cheerSeenAt) void cheerSeen(CH[0].at);
  return '<h3>Lời khích lệ</h3>' + CH.map((c, i) => `<div class="dtf"><div class="dtn"><b>${who(c.from)}</b><span>«${esc(cheerText(c))}» · ${ago(c.at)}${i < fresh ? ' · <b class="dtnew">mới</b>' : ''}</span></div></div>`).join('');
}
function cheerBlock(c) {
  if (D.cheered.has(sentKey(c.id))) return mu('Hôm nay bạn đã gửi lời khích lệ cho bạn ấy.');
  const own = (ctx.S.completed ? 'Mình đã hoàn thành chương trình 49 ngày' : `Mình đang ở ngày ${ctx.S.day || 1} của hành trình 49 ngày`) + '.';
  return '<div class="dtch">' + Object.keys(CHEER_LINES).map((k) => bt('dt-cheer', esc(k === 'tien_trinh' ? own : CHEER_LINES[k]), 'btn alt', di(c.id) + ` data-v="${k}"` + dis())).join('') + '</div>' +
    mu('Mỗi ngày một lời cho mỗi bạn. Lời tiến trình lấy theo hành trình đã lưu trên máy chủ.');
}
const prefs = () => { const s = (D.me && D.me.settings && D.me.settings.dong_tu) || {}; return { hien_trang_thai: s.hien_trang_thai !== false, cho_tim: s.cho_tim !== false, hien_ngay: s.hien_ngay !== false, chia_se_tien_trinh: s.chia_se_tien_trinh === true }; };

/** Số chấm trên nút: lời kết nối và lời mời gặp đang chờ mình. Không bao giờ là số bạn. */
export function dtBadge() {
  follow();
  if (!dongTu.on) return 0;
  if (!dongTu.list) return (dongTu.social.requests || 0) + (dongTu.social.invites || 0);
  return L('incoming').length + invites().incoming.length + sessions().filter((x) => x.seat && x.seat.status === 'moi').length + cheerUnseen();
}

// ───────── Các màn ─────────
const mu = (t) => `<p class="muted">${t}</p>`, ms = (t) => `<p class="muted" role="status">${t}</p>`;
const status = () => (D.busy ? ms(esc(D.busy) + '…') : '') + (D.err ? `<p class="note" role="alert">${esc(D.err)}</p>` : '') + (D.msg ? ms(esc(D.msg)) : '');
const dis = () => (D.busy ? ' disabled' : '');
const back = (to = 'list') => rw(to === 'list' ? bt('dt-tab', '← Danh sách', 'ghost', ' data-v="list"') : bt('dt-ban', '← Quay lại', 'ghost', di(D.sel)));
/** Nút và hàng nút (gọn mã: bản HTML đơn có trần kích thước) */
const di = (id) => ` data-id="${esc(id)}"`, bt = (act, text, cls = 'btn', x = '') => `<button class="${cls}" data-act="${act}"${x}>${text}</button>`, rw = (...b) => `<div class="row">${b.join('')}</div>`;
const left = (end, f) => `<span data-dt-end="${end}" data-dt-f="${f}">${fmtLeft(end - now(), f)}</span>`;
const guestNote = () => (acct.on && acct.guest ? '<p class="note">Hành trình đang giữ bằng phiên khách: gắn vân tay / Face ID hoặc lưu mã khôi phục để không mất bạn đồng tu.</p>' + rw(bt('acct-open', 'Tài khoản', 'ghost')) : '');

export function dtView() {
  follow();
  if (D.tab === 'loi') return linkNote();
  if (!dongTu.on) return `<h2>Bạn đồng tu</h2>${acct.on ? ms('Đang kết nối máy chủ…') : '<p>Giữ hành trình để kết nối với người bạn tu cùng ngoài đời.</p>' + rw(bt('acct-open', 'Giữ hành trình của tôi'))}${rw(bt('dt-close', '← Quay lại', 'ghost'))}`;
  if (D.tab === 'moi') return inviteView();
  if (D.tab === 'tim') return findView();
  if (D.tab === 'rieng') return privacyView();
  if (D.tab === 'hen') return henView();
  const f = friend(D.sel);
  if (D.tab === 'ban' && f) return friendView(f);
  if (D.tab === 'bao' && f) return reportView(f);
  return listView();
}

/**
 * Điều kiện mời (#151 §7): nhân vật đã tạo trên máy (Tịnh danh + hình dáng), đã giữ hành trình, và hồ sơ máy chủ đã nhận Tịnh danh.
 * Nhận lời mời của người khác không cần điều kiện này. Máy chủ chặn cùng điều kiện bằng 409 need_character (hợp đồng §11).
 */
const hasLook = (l) => !!l && typeof l === 'object' && Object.keys(l).length > 0;
function ready() {
  const S = ctx.S;
  if (!S.name || !hasLook(S.look)) return { ok: false, step: 'tao' };
  if (!acct.on) return { ok: false, step: 'giu' };
  // Chỉ mở khi đã nhận hồ sơ máy chủ của ĐÚNG tài khoản này (D xóa sạch khi đổi người) có cả Tịnh danh lẫn hình dáng (hợp đồng §11)
  if (!D.me) return { ok: false, step: 'kiem' };
  if (!D.me.tinh_danh || !hasLook(D.me.look)) return { ok: false, step: 'luu' };
  return { ok: true };
}
function gateNote(g) {
  if (g.ok) return '';
  if (g.step === 'kiem') return D.meFail ? '<p class="note" role="alert">Chưa kiểm tra được nhân vật đã lưu.</p>' + rw(bt('dt-me', 'Thử lại', 'btn', dis())) : ms('Đang kiểm tra nhân vật đã lưu…');
  const [t, a, l] = g.step === 'tao' ? ['Hãy tạo nhân vật trước khi mời bạn.', 'dt-creator', 'Tạo nhân vật'] : g.step === 'giu' ? ['Hãy giữ hành trình trước khi mời bạn.', 'acct-open', 'Giữ hành trình của tôi'] : ['Nhân vật chưa lưu lên máy chủ.', 'dt-save', 'Lưu nhân vật'];
  return `<p class="note" role="status">${t}</p>` + rw(bt(a, l, 'btn', dis()));
}
/** Các kiểu mời theo canMeet (#151 §4). Gặp trên Vân Đảo cần du vân sang đảo bạn (#125): đủ điều kiện thì ghi «sắp có», chưa đủ thì ghi lý do. */
const KINDS = [['thien', 'dtd', 'Cùng ngồi thiền ở Đại Thiền Đường'], ['thien', 'dao', 'Thiền tọa trên Vân Đảo của mình'], ['tra', 'dao', 'Cùng Trà Đạo'], ['tham', 'dao', 'Mời Vân Mây sang thăm'], ['xin_tham', 'dao', 'Xin sang thăm Vân Đảo bạn'], ['tham_quan', 'dao', 'Mời tham quan Vân Đảo']];
function kinds(c) {
  const S = ctx.S, me = { day: S.day, completed: !!S.completed, open: !!S.open }, fr = { day: c.day, completed: c.completed === true, open: c.open === true, presence: c.presence == null ? 'online' : c.presence }, g = ready().ok;
  return KINDS.map(([k, p, label]) => {
    const r = canMeet(k, me, fr, { accepted: true }, p), now = k === 'thien' && p === 'dtd';
    const why = !g ? 'Cần tạo và lưu nhân vật trước.' : !r.ok ? REASON_TEXT[r.code] || '' : now ? (r.quiet ? 'Bạn ấy đang tọa thiền: lời mời sẽ hiện khi bạn ấy xuất thiền.' : '') : 'Sắp có (#125).';
    const on = g && r.ok && now;
    return `<div class="dtk"><button class="btn alt"${on ? ` data-act="dt-meet" data-id="${esc(c.id)}" data-k="${k}" data-p="${p}"` : ' disabled'}${dis()}>${esc(label)}</button>${why ? `<span class="muted">${esc(why)}</span>` : ''}</div>`;
  }).join('');
}
function listView() {
  const g = ready();
  const x = g.ok ? '' : ' disabled';
  let h = '<h2>Bạn đồng tu</h2>' + gateNote(g) + rw(bt('dt-tab', 'Mời bạn tu cùng', 'btn', ' data-v="moi"' + x), bt('dt-tab', 'Tìm bạn', 'btn alt', ' data-v="tim"' + x),
    hasSessions() ? bt('dt-tab', 'Hẹn giờ đồng tu', 'btn alt', ' data-v="hen"' + (g.ok && L('companions').length ? '' : ' disabled')) : '') + status();
  if (!dongTu.list) return h + ms('Đang tải danh sách…') + foot();
  const I = invites(), cs = L('companions'), inc = L('incoming'), og = L('outgoing'), SS = sessions();
  if (I.incoming.length) h += `<h3>Lời mời đang chờ (${I.incoming.length})</h3>` + I.incoming.map(incomingRow).join('');
  h += cheerList();
  if (SS.length) h += '<h3>Hẹn đồng tu</h3>' + SS.map(sesRow).join('');
  if (inc.length) h += `<h3>Lời kết nối (${inc.length})</h3>` + inc.map(reqRow).join('');
  const than = cs.filter((c) => c.closeness === 'than'), quen = cs.filter((c) => c.closeness !== 'than');
  if (than.length) h += '<h3>Thân thiết</h3>' + than.map((c) => row(c, I)).join('');
  if (quen.length) h += '<h3>Quen biết</h3>' + quen.map((c) => row(c, I)).join('');
  if (og.length) h += '<h3>Đang chờ</h3>' + og.map(outRow).join('');
  if (!cs.length && !inc.length && !og.length) h += mu('Chưa có bạn đồng tu. Mời người quen bằng mã mời, hoặc tìm đúng «Tịnh danh · mã».');
  return h + guestNote() + foot();
}
const foot = () => rw(bt('dt-tab', 'Quyền riêng tư', 'ghost', ' data-v="rieng"'), bt('dt-close', '← Quay lại', 'ghost'));

function presenceLine(c) {
  const p = c.presence, bits = [p == null ? 'Không chia sẻ trạng thái' : PRESENCE_TEXT[p] || PRESENCE_TEXT.vang];
  if (p === 'vang' && c.seen && SEEN_TEXT[c.seen]) bits.push('lần cuối ' + SEEN_TEXT[c.seen]);
  if (c.completed === true) bits.push('đã hoàn thành chương trình'); else if (Number.isFinite(c.day)) bits.push('ngày ' + c.day);
  return bits.join(' · ');
}
const dot = (c) => `<i class="dtd ${c.presence == null ? 'an' : esc(c.presence)}" aria-hidden="true"></i>`;

/** Nút mời của một bạn. #124 mời cùng ngồi thiền ở Đại Thiền Đường; các kiểu gặp trên Vân Đảo cần du vân 3D (#125). */
function meetBlock(c, I) {
  const tog = I.together.find((x) => other(x.inv) === c.id);
  if (tog) return mu(togetherText(tog)) + (tog.ph.phase === 'dang' && !D.joined.has(tog.inv.id) ? rw(bt('dt-join', 'Vào ngồi cùng', 'btn', di(tog.inv.id))) : '');
  const out = I.outgoing.find((x) => x.inv.to === c.id);
  if (out) return `${mu(`Đã mời ${WHAT[out.inv.kind] || 'gặp'} · chờ trả lời, còn ${left(out.inv.created_at + INVITE_TTL_MS, 'm')}`)}${rw(bt('dt-cancel', 'Hủy lời mời', 'ghost', di(out.inv.id) + dis()))}`;
  if (I.incoming.some((x) => x.inv.from === c.id)) return '';
  if (!ready().ok) return rw(bt('', 'Mời cùng ngồi thiền', 'btn alt', ' disabled'));
  const S = ctx.S, chk = canMeet('thien', { day: S.day, completed: !!S.completed, open: !!S.open },
    // bạn tắt hiện trạng thái: máy chủ coi như đang ở Vân Đạo khi kiểm (hợp đồng §3.3), máy khách cũng để nút mở
    { day: c.day, completed: c.completed === true, open: c.open === true, presence: c.presence == null ? 'online' : c.presence }, { accepted: true }, 'dtd');
  if (!chk.ok) return rw(bt('', 'Mời cùng ngồi thiền', 'btn alt', ' disabled')) + mu(esc(REASON_TEXT[chk.code] || ''));
  return rw(bt('dt-meet', 'Mời cùng ngồi thiền', 'btn alt', di(c.id) + ' data-k="thien" data-p="dtd"' + dis())) +
    (chk.quiet ? mu('Bạn ấy đang tọa thiền: lời mời sẽ hiện khi bạn ấy xuất thiền.') : '');
}
/** Tên và ID: ID là mã 4 số công khai, cùng dạng người khác gõ khi tìm («Tịnh danh · mã») */
const nameId = (p) => `<b>${esc(nm(p))}</b> <span class="dtid">ID ${esc(p.tag)}</span>`;
function row(c, I) {
  const open = D.peek === c.id;
  return `<div class="dtf" data-id="${esc(c.id)}"><button class="dtn" data-act="dt-ban" data-id="${esc(c.id)}">${dot(c)}${nameId(c)}<span>${esc(presenceLine(c))}</span></button>${meetBlock(c, I)}` +
    `${rw(bt('dt-peek', open ? 'Thu lại' : 'Xem nhanh', 'ghost', di(c.id) + ` aria-expanded="${open}"`), bt('dt-ban', 'Mời khác · chi tiết', 'ghost', di(c.id)))}${open ? peek(c) : ''}</div>`;
}
/**
 * Xem nhanh (#151 §8) từ dữ liệu bạn đã cho hiện trong danh sách: ngày hành trình, phân khu Vân Đảo đã mở (suy từ ngày), chế độ cổng.
 * Không Kusala, không so sánh. Số thời thiền, bài giảng đã nghe và lần tu gần nhất chỉ có khi bạn bật «Chia sẻ tiến trình»
 * (hợp đồng §10.2: GET /companions/:id/progress; chưa bật hay không đủ điều kiện thì 404, cùng một dạng).
 */
const LAST = { hom_nay: 'hôm nay', hom_qua: 'hôm qua', trong_tuan: 'trong tuần này', lau_hon: 'hơn một tuần trước' };
async function loadProg(id) {
  // Mỗi lần tải có thẻ riêng theo bạn: chỉ phản hồi của lần tải MỚI NHẤT được ghi, để 200 cũ tới muộn không ghi đè 404 mới
  // (bạn vừa tắt chia sẻ thì số liệu không hiện lại)
  const uid = D.uid, had = D.prog.get(id), tok = {};
  D.progReq.set(id, tok);
  if (!had || had.st !== 'ok') D.prog.set(id, { st: 'loading' });   // mở lại thì tải mới, giữ số cũ trong lúc chờ
  let r;
  try { const v = await api(`/api/v1/companions/${encodeURIComponent(id)}/progress`); r = v && typeof v === 'object' ? { st: 'ok', v } : { st: 'err' }; }
  catch (e) { r = { st: e && e.status === 404 ? 'none' : 'err' }; }
  if (!still(uid) || D.progReq.get(id) !== tok) return;
  D.prog.set(id, r); if (ctx.viewOpen()) ctx.render();
}
function progLines(id) {
  const p = D.prog.get(id);
  if (!p || p.st === 'loading') return ms('Đang tải tiến trình…');
  if (p.st === 'none') return mu('Bạn ấy chưa bật chia sẻ tiến trình.');
  if (p.st === 'err') return mu('Chưa tải được tiến trình.') + rw(bt('dt-prog', 'Thử lại', 'ghost', di(id)));
  const v = p.v, n = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);
  return `<p>${esc(`Đã ngồi ${n(v.sessions_done)} thời thiền · đã nghe ${n(v.sermons_done)} bài giảng.`)}</p>` + (LAST[v.last_active] ? mu(esc(`Tu tập gần nhất: ${LAST[v.last_active]}.`)) : '');
}
function peek(c) {
  const p = D.prog.get(c.id), pv = p && p.st === 'ok' ? p.v : null;
  const day = pv && Number.isInteger(pv.day) ? pv.day : Number.isFinite(c.day) ? c.day : null, done = (pv ? pv.completed === true : false) || c.completed === true, bits = [];
  bits.push(done ? 'Đã hoàn thành chương trình 49 ngày.' : day ? `Ngày ${day} của hành trình 49 ngày.` : 'Bạn ấy không hiện ngày hành trình.');
  if (day || done) {
    const z = [['Tịnh Thất', 1], ['Đài Thiền', 1], ['Vườn Tâm Thức', 1], ['Bia Tích Lũy', 1], ['Trà Đạo Tỉnh Thức', ZONE_UNLOCK.tea]].filter(([, d]) => done || day >= d).map(([n]) => n);
    const gl = done ? 1 : gateLevel(day);
    if (gl) z.push(gl >= 1 ? 'Cổng Vân Môn (mở hẳn)' : 'Cổng Vân Môn (mở nửa)');
    bits.push(`Vân Đảo đã mở: ${z.join(', ')}.`);
  }
  bits.push(`Cổng Vân Môn: ${c.open ? 'Nghênh khách' : 'Độc cư'}.`);
  return `<div class="dtpk">${bits.map((b) => `<p>${esc(b)}</p>`).join('')}${progLines(c.id)}${mu(`Xem Vân Đảo bạn: sắp có (#125).`)}</div>`;
}
function togetherText({ inv, ph }) {
  const what = WHAT[inv.kind] || 'gặp nhau';
  return ph.phase === 'sap' ? `Hẹn ${what} ${AT[inv.place] || ''} · bắt đầu sau ${left(inv.start_at, 'c')}` : `Đang ${what} · đã bắt đầu`;
}
function incomingRow({ inv }) {
  const where = PLACE[inv.place];
  return `<div class="dtf"><div class="dtn"><b>${nameOf(inv.from)}</b><span>${esc(LINES[inv.kind])}</span></div>${mu(`${where ? where + ' · ' : ''}còn ${left(inv.created_at + INVITE_TTL_MS, 'm')} để trả lời`)}` +
    rw(bt('dt-yes', 'Đồng ý', 'btn', di(inv.id) + dis()), bt('dt-no', 'Để lúc khác', 'btn alt', di(inv.id) + dis())) + '</div>';
}
const reqRow = (r) => { const x = di(r.id) + dis(); return `<div class="dtf"><div class="dtn"><b>${who(r.from || {})}</b><span>muốn kết nối đồng tu với bạn</span></div>${rw(bt('dt-req-yes', 'Đồng ý', 'btn', x), bt('dt-req-no', 'Bỏ qua', 'btn alt', x))}</div>`; };
// Người gửi chỉ thấy «đã gửi» tới khi bên kia đồng ý hoặc hết hạn: không có tín hiệu từ chối hay «không tìm thấy» (hợp đồng §4)
const outRow = (r) => `<div class="dtf"><div class="dtn"><b>${who(r)}</b><span>Đã gửi lời kết nối · chờ người ấy đồng ý</span></div>${rw(bt('dt-withdraw', 'Rút lại', 'ghost', di(r.id) + dis()))}</div>`;

// ───────── Hẹn đồng tu nhóm (#151 §4–§5, hợp đồng §9) ─────────
function sesRow({ s, host, seat, ph, going }) {
  const x = di(s.id) + dis(), arm = D.arm === 'sc:' + s.id;
  const t = ph === 'hen' ? esc(whenText(s.start_at)) : ph === 'sap' ? `bắt đầu sau ${left(s.start_at, 'c')}` : 'đang diễn ra';
  let h = `<div class="dtf dts"><div class="dtn"><b>Cùng ngồi thiền ở Đại Thiền Đường</b><span>${t}</span></div>` +
    mu(host ? 'Bạn chủ trì.' : `Chủ hẹn: ${who(s.host)}`) + `<ul class="dtsl">${s.seats.map((p) => `<li>${who(p)} · ${SEAT[p.status] || ''}</li>`).join('')}</ul>`;
  if (seat && seat.status === 'moi') h += rw(bt('dt-s-yes', 'Nhận lời', 'btn', x), bt('dt-s-no', 'Để lúc khác', 'btn alt', x));
  else if (ph === 'dang' && !D.joined.has('s:' + s.id)) h += rw(bt('dt-s-join', 'Vào ngồi cùng', 'btn', di(s.id)));
  else if (going) {
    h += rw(ph === 'hen' ? bt('dt-ics', 'Thêm vào lịch', 'ghost', di(s.id)) : '',
      host ? bt('dt-s-cancel', arm ? 'Bấm lần nữa để hủy hẹn' : 'Hủy hẹn', 'ghost', x) : bt('dt-s-leave', 'Không tham gia nữa', 'ghost', x));
    if (arm) h += mu('Mọi người được mời sẽ thấy hẹn đã hủy.');
  }
  return h + '</div>';
}
function henView() {
  const g = ready(), H = D.hen;
  let h = '<h2>Hẹn giờ đồng tu</h2>';
  if (!hasSessions()) return h + mu('Tính năng hẹn giờ đang được cập nhật.') + back();
  if (!g.ok) return h + gateNote(g) + back();
  h += mu(`Cùng ngồi một thời thiền 15 phút trên Đài Đồng Tu ở Đại Thiền Đường. Mời từ 1 đến ${SESSION_MAX - 1} bạn, hẹn trước tối đa 7 ngày.`) + status();
  if (sessions().filter((y) => y.host).length >= SESSION_OPEN_MAX) return h + `<p class="note">Bạn đang có ${SESSION_OPEN_MAX} hẹn sắp tới. Hãy chờ một hẹn qua, hoặc hủy bớt.</p>` + back();
  const cs = L('companions'), n = H.pick.size, full = n >= SESSION_MAX - 1;
  if (!cs.length) return h + mu('Chưa có bạn đồng tu để hẹn.') + back();
  h += '<h3>Mời ai</h3>' + cs.map((c) => {
    const on = H.pick.has(c.id), off = (!on && full) || !!D.busy;
    return `<label class="chk"><input type="checkbox" data-dt="hen-ban" data-id="${esc(c.id)}"${on ? ' checked' : ''}${off ? ' disabled' : ''}> ${who(c)}` +
      (H.when === 'ngay' && c.presence === 'vang' ? ' <span class="muted">· đang vắng, sẽ không được mời</span>' : '') + '</label>';
  }).join('') + (full ? mu(`Đã chọn đủ ${SESSION_MAX - 1} bạn.`) : '');
  const t = now(), radio = (v, text) => `<label class="chk"><input type="radio" name="dthw" data-dt="hen-when" value="${v}"${H.when === v ? ' checked' : ''}${dis()}> ${text}</label>`;
  h += '<h3>Khi nào</h3>' + radio('gio', 'Hẹn giờ') +
    `<input type="datetime-local" data-dt="hen-at" aria-label="Giờ hẹn" step="${SESSION_STEP_MS / 1000}" min="${localInput(ceilStep(t + SESSION_MIN_LEAD_MS))}" max="${localInput(t + SESSION_AHEAD_MS)}" value="${esc(H.at)}"${H.when === 'gio' && !D.busy ? '' : ' disabled'}>` +
    radio('ngay', 'Ngay, bắt đầu sau 1 phút (chỉ mời bạn đang ở Vân Đạo)');
  h += rw(bt('dt-hen', n ? `Gửi lời hẹn tới ${n} bạn` : 'Hãy chọn ít nhất một bạn', 'btn', n && !D.busy ? '' : ' disabled'));
  return h + mu('Khi ứng dụng đang mở, bạn được nhắc lúc còn 10 phút và 1 phút. «Thêm vào lịch» để lịch của máy nhắc trước 10 phút.') + back();
}
/** Tạo phiên: giờ địa phương trong ô → UTC ms; máy chủ kiểm lại mọi điều kiện (§9.3) */
function henSend() {
  const H = D.hen, ids = [...H.pick].filter((id) => friend(id));
  let start = 'ngay';
  if (H.when === 'gio') {
    const t = H.at ? new Date(H.at).getTime() : NaN, n = now();
    if (!Number.isFinite(t) || t % SESSION_STEP_MS) { D.err = 'Hãy chọn giờ theo bước 5 phút.'; return ctx.render(); }
    if (t < n + SESSION_MIN_LEAD_MS || t > n + SESSION_AHEAD_MS) { D.err = 'Giờ hẹn phải từ 1 phút tới 7 ngày nữa.'; return ctx.render(); }
    start = t;
  }
  return run('Đang gửi lời hẹn', async (ok) => {
    const r = await api('/api/v1/sessions', { method: 'POST', body: { start_at: start, invitees: ids } });
    if (!ok()) return;
    const sk = (r && Array.isArray(r.skipped) ? r.skipped : []).map((x) => plainName(typeof x === 'string' ? x : x && x.id));
    D.hen = freshHen(); D.tab = 'list'; reload();
    D.msg = `Đã gửi lời hẹn${start === 'ngay' ? ' cùng ngồi ngay' : ' ' + whenText(start)}.` + (sk.length ? ` Chưa mời ${sk.join(', ')} vì đang vắng.` : '');
  });
}
const reload = () => { D.lastLoad = Date.now(); void loadCompanions().catch(() => {}); };
const sesById = (id) => sessions().find((x) => x.s.id === id) || null;

function friendView(c) {
  const me = c.me || {}, than = c.closeness === 'than';
  return `<h2>${esc(nm(c))}</h2><p class="pali">ID ${esc(c.tag)} · bạn đồng tu ${than ? 'thân thiết' : 'quen biết'}</p><p>${dot(c)} ${esc(presenceLine(c))}</p>${meetBlock(c, invites())}${status()}
    <h3>Các kiểu mời</h3>${kinds(c)}${hasCheers() ? `<h3>Khích lệ</h3>${cheerBlock(c)}` : ''}<h3>Xem nhanh</h3>${peek(c)}
    <h3>Mức gần gũi</h3><label class="chk"><input type="checkbox" data-dt="than"${me.than ? ' checked' : ''}${dis()}> Thân thiết</label>
    ${mu(`Hai người cùng chọn thì thành thân thiết. Không có nấc nào tự lên theo số lần gặp.`)}` +
    (than ? `<label class="chk"><input type="checkbox" data-dt="away"${me.away ? ' checked' : ''}${dis()}> Cho bạn ấy ghé Vân Đảo của mình khi mình vắng</label>${mu(`Chỉ có tác dụng khi Cổng Vân Môn của bạn ở chế độ Nghênh khách.`)}` : '') +
    '<h3>Khác</h3>' + rw(bt('dt-remove', D.arm === 'remove' ? 'Bấm lần nữa để hủy kết nối' : 'Hủy kết nối', 'ghost', dis()), bt('dt-block', D.arm === 'block' ? 'Bấm lần nữa để chặn' : 'Chặn', 'ghost', dis()), bt('dt-tab', 'Báo cáo', 'ghost', ' data-v="bao"')) +
    (D.arm === 'block' ? mu('Người bị chặn không được báo; với họ, kết nối chỉ như đã bị hủy.') : '') + back();
}
const reportView = (c) => `<h2>Báo cáo ${who(c)}</h2>${mu(`Chỉ người kiểm duyệt thấy; người bị báo cáo không được báo. Chọn lý do:`)}${status()}` +
  REPORT.map((r) => rw(bt('dt-report', esc(r), 'btn alt', ` data-v="${esc(r)}"${dis()}`))).join('') + back('ban');

function inviteView() {
  const k = D.link, g = ready();
  if (!g.ok) return `<h2>Mời bạn tu cùng</h2>${gateNote(g)}` + back();
  let h = '<h2>Mời bạn tu cùng</h2>' + mu('Người bạn mở liên kết hoặc quét mã là hai bạn kết nối.') + status();
  if (!k) return h + (D.busy ? '' : rw(bt('dt-link', 'Tạo mã mời'))) + back();
  const share = typeof navigator !== 'undefined' && !!navigator.share;
  h += `<div class="dtq">${qr(shareUrl(false), 'Mã QR mời bạn tu cùng')}<div class="dtc" data-dt-code>${esc(showInviteCode(k.code))}</div>${mu(`Còn ${k.uses_left} lượt · hết hạn ngày ${date(k.expires_at)}`)}</div>` +
    `<label class="chk"><input type="checkbox" data-dt="kem"${D.kem ? ' checked' : ''}> Kèm tiến trình của mình (${esc(progressLine())})</label>` +
    `<div class="row dtsh">${bt('dt-copy', 'Sao chép')}${bt('dt-fb', 'Facebook', 'btn fb')}${share ? bt('dt-share', 'Chia sẻ…', 'btn alt') : ''}</div>` +
    mu('Ai có liên kết cũng thấy Tịnh danh · mã của bạn trên thẻ xem trước. Facebook chỉ nhận liên kết; «Sao chép» chép cả câu mời.') +
    rw(bt('dt-renew', D.arm === 'renew' ? 'Bấm lần nữa: mã cũ sẽ không dùng được' : 'Tạo mã mới', 'ghost', dis()));
  return h + guestNote() + back();
}
// Liên kết chia sẻ ra ngoài dạng /?ban=MÃ: Facebook có thể bỏ phần sau dấu #; ứng dụng đổi lại thành #ban= khi mở (main.js)
// Hợp đồng §12 (#160): /moi/MÃ có thẻ xem trước mang Tịnh danh · mã; ?d=1 khi kèm tiến trình (máy chủ vẫn xét quyền chia sẻ của mình)
const shareUrl = (d = D.kem) => `${location.origin}/moi/${encodeURIComponent(D.link.code)}${d ? '?d=1' : ''}`;
/** Một câu về tiến trình của mình để chia sẻ (không Kusala, không so sánh; hoàn thành thì chỉ nói «đã hoàn thành chương trình») */
const progressLine = () => (ctx.S.completed ? 'Mình đã hoàn thành chương trình 49 ngày' : `Mình đang ở ngày ${ctx.S.day || 1} của hành trình 49 ngày`);
const shareText = () => (D.kem ? `${progressLine()} trên Vân Đạo. ` : '') + `Mời bạn cùng tu tập với mình trên Vân Đạo: ${shareUrl()}`;

function findView() {
  const g = ready();
  if (!g.ok) return `<h2>Tìm bạn</h2>${gateNote(g)}` + back();
  return `<h2>Tìm bạn</h2>${mu(`Chỉ tìm đúng tên và mã người ấy đưa cho bạn.`)}<input id="dtFind" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="Tịnh danh · mã, ví dụ Tuệ Thái · 5696" value="${esc(D.q)}" data-dt="q">${rw(bt('dt-find', 'Gửi lời kết nối', 'btn', dis()))}${status()}` +
    (D.me && D.me.tinh_danh ? mu(`Tịnh danh · mã của bạn: <b>${who(D.me)}</b>. Đưa cho người bạn để người ấy tìm bạn.`) : '') + back();
}

function privacyView() {
  let h = '<h2>Quyền riêng tư</h2>' + status();
  if (!D.me) return h + (D.busy ? '' : ms('Đang tải…')) + back();
  const p = prefs(), an = D.me.visibility === 'an', box = (k, text, off = false) => `<label class="chk"><input type="checkbox" data-dt="${k}"${p[k] && !off ? ' checked' : ''}${off || D.busy ? ' disabled' : ''}> ${text}</label>`;
  h += box('hien_trang_thai', 'Hiện trạng thái với bạn đồng tu', an) + mu('Tắt thì bạn đồng tu không thấy bạn đang thiền, thưởng trà hay vắng mặt.') +
    box('cho_tim', 'Cho người khác gửi lời kết nối bằng Tịnh danh · mã', an) +
    box('hien_ngay', 'Hiện ngày hành trình với bạn đồng tu') +
    box('chia_se_tien_trinh', 'Chia sẻ tiến trình với bạn đồng tu', an) + mu('Số thời thiền, số bài giảng đã nghe và lần tu gần nhất. Mặc định tắt; không chia sẻ Kusala, sổ việc hay nhật ký.') +
    (an ? '<p class="note">Quyền hiển thị đang «Ẩn»: không ai tìm được và thấy trạng thái của bạn.</p>' : '') +
    `${mu(`Cổng Vân Môn: ${ctx.S.open ? 'Nghênh khách' : 'Độc cư'}. Đổi ở phân khu Cổng Vân Môn.`)}<h3>Đã chặn</h3>`;
  const B = D.blocks;
  h += !B ? mu('Đang tải…') : !B.length ? mu('Chưa chặn ai.')
    : B.map((x) => `<div class="dtf"><div class="dtn"><b>${x.tinh_danh ? who(x) : 'Tài khoản đã xóa'}</b></div>${rw(bt('dt-unblock', 'Bỏ chặn', 'ghost', di(x.id) + dis()))}</div>`).join('') + mu('Bỏ chặn không tự kết nối lại.');
  return h + back();
}

function linkNote() {
  const o = D.pend && D.pend.owner;
  let h = `<h2>Lời mời tu cùng</h2>${o ? `<p><b>${who(o)}</b> mời bạn cùng tu tập trên Vân Đạo.</p>` : '<p>Bạn vừa mở một liên kết mời tu cùng.</p>'}`;
  h += acct.on ? ms('Đang kết nối hai bạn…')
    : mu('Giữ hành trình để hai bạn tự kết nối.') + rw(bt('acct-open', 'Giữ hành trình của tôi'), bt('acct-open', 'Tôi đã có hành trình', 'ghost', ' data-v="have"'));
  return h + rw(bt('dt-close', '← Quay lại', 'ghost'));
}

/** Một dòng ở Cổng Vân Môn: bao nhiêu bạn đang ở Vân Đạo, và lối vào danh sách */
export function dtGateLine() {
  if (!dongTu.on) return '';
  const n = L('companions').filter((c) => c.presence && c.presence !== 'vang').length;
  return mu(`Bạn đồng tu${dongTu.list ? ` (${n} đang ở Vân Đạo)` : ''}.`) + rw(bt('dt-open', 'Bạn đồng tu', 'ghost'));
}

// ───────── Thẻ lời mời (lớp phủ trên bảng, luật #139: điện thoại đặt theo --subb) ─────────
function togetherCard({ inv, ph }) {
  const nm = nameOf(other(inv)), what = WHAT[inv.kind] || 'gặp nhau', where = PLACE[inv.place] || '';
  if (ph.phase === 'sap') return `<b>${what[0].toUpperCase() + what.slice(1)} với ${nm}</b><p>${where} · bắt đầu sau ${left(inv.start_at, 'c')}</p><p class="muted dtx">Đến giờ, thời thiền tự bắt đầu cho cả hai.</p>` +
    rw(bt('dt-go', inv.place === 'dtd' ? 'Vào Đại Thiền Đường' : 'Đến chỗ ngồi', 'btn', di(inv.id)), bt('dt-cancel', 'Hủy', 'ghost', di(inv.id)));
  return `<b>${nm} đang ${what} với bạn</b><p>${where}</p>` + rw(bt('dt-join', 'Vào ngồi cùng', 'btn', di(inv.id)), bt('dt-hide', 'Để sau', 'ghost', di(inv.id)));
}
function incomingCard({ inv }, n) {
  const where = PLACE[inv.place];
  return `<b>${nameOf(inv.from)}</b><p>${esc(LINES[inv.kind])}</p>${mu(`${where ? where + ' · ' : ''}còn ${left(inv.created_at + INVITE_TTL_MS, 'm')} để trả lời`)}` +
    (D.quietSeen.has(inv.id) ? mu('Lời mời đến trong lúc bạn thiền.') : '') +
    rw(bt('dt-yes', 'Đồng ý', 'btn', di(inv.id)), bt('dt-no', 'Để lúc khác', 'btn alt', di(inv.id)), n > 1 ? bt('dt-open', `+${n - 1} lời mời khác`, 'ghost') : '');
}
function card(I = invites()) {
  const el = ctx && ctx.cardEl; if (!el) return;
  let key = '', h = '';
  const quiet = ctx.quiet();
  if (dongTu.on && quiet) { for (const x of I.incoming) if (!D.chimed.has(x.inv.id)) D.quietSeen.add(x.inv.id); }
  else if (dongTu.on) {
    const tog = I.together.find((x) => !D.joined.has(x.inv.id) && !D.hide.has(x.inv.id)), sc = tog ? null : sesCard();
    const inc = ctx.viewOpen() ? null : I.incoming.find((x) => !D.hide.has(x.inv.id));
    if (tog) { key = `g${tog.inv.id}:${tog.ph.phase}:${tog.inv.kind}`; h = togetherCard(tog); }
    else if (sc) { key = sc.key; h = sc.h; if (!D.chimed.has(key)) { D.chimed.add(key); ctx.sfx('gift'); } }
    else if (inc) {
      key = `i${inc.inv.id}:${I.incoming.length}:${D.quietSeen.has(inc.inv.id) ? 'q' : ''}`; h = incomingCard(inc, I.incoming.length);
      if (!D.chimed.has(inc.inv.id)) { D.chimed.add(inc.inv.id); ctx.sfx('gift'); }   // một tiếng ngân nhỏ, chỉ khi không thiền
    }
  }
  if (key !== D.cardKey) { D.cardKey = key; el.innerHTML = h; el.hidden = !h; }
}
/** Thẻ nhắc hẹn (§9.4): lúc còn 10 phút, lúc còn 1 phút, và khi đang diễn ra mà mình chưa vào. «Để sau» ẩn tới mốc kế tiếp. */
function sesCard() {
  const t = now();
  for (const x of sessions()) {
    if (!x.going) continue;
    const k = 's:' + x.s.id, rest = x.s.start_at - t;
    const mark = x.ph === 'dang' ? (D.joined.has(k) ? '' : 'dang') : rest <= SESSION_REMIND_MS[1] ? '1' : rest <= SESSION_REMIND_MS[0] ? '10' : '';
    if (!mark || D.hide.has(k + ':' + mark)) continue;
    const later = bt('dt-hide', 'Để sau', 'ghost', ` data-id="${esc(k + ':' + mark)}"`);
    const h = mark === 'dang' ? '<b>Hẹn đồng tu đang diễn ra</b><p>Tại Đại Thiền Đường</p>' + rw(bt('dt-s-join', 'Vào ngồi cùng', 'btn', di(x.s.id)), later)
      : `<b>Sắp tới giờ đồng tu</b><p>Cùng ngồi thiền ở Đại Thiền Đường · bắt đầu sau ${left(x.s.start_at, mark === '1' ? 'c' : 'm')}</p>` +
        (mark === '1' ? '<p class="muted dtx">Đến giờ, thời thiền tự bắt đầu.</p>' : '') + rw(bt('dt-go', 'Vào Đại Thiền Đường', 'btn', ` data-s="${esc(x.s.id)}"`), later);
    return { key: k + ':' + mark, h };
  }
  return null;
}
/**
 * Người ngồi Đài Đồng Tu lúc này (#151): lời mời `thien` · `dtd` đã nhận, từ 60 giây trước giờ tới hết thời thiền. Chủ phiên ngồi trước.
 * Mình chỉ có `{ key, me: true }`, main.js điền Tịnh danh và hình dáng. Bạn đang thiền, ẩn trạng thái, hoặc còn trước giờ thì coi như đã ngồi;
 * đã tới giờ mà bạn chưa thiền thì Vân Tọa để trống, nhãn ghi «đang tới».
 */
function daisPeople(I) {
  const x = I.together.find((t) => t.inv.kind === 'thien' && t.inv.place === 'dtd');
  if (!x) return sesDais();
  return [x.inv.from, x.inv.to].map((id) => {
    if (id === acct.uid) return { key: id, me: true };
    const c = friend(id); if (!c) return null;
    return { key: id, name: label(c), look: c.look || {}, here: x.ph.phase === 'sap' || c.presence == null || c.presence === 'thien' };
  }).filter(Boolean);
}
/** Đài của hẹn nhóm: chủ phiên trước, rồi người đã nhận lời (tối đa SESSION_MAX). Người không là bạn của mình: không biết hiện diện, coi như đã ngồi. */
function sesDais() {
  const y = sessions().find((z) => z.going && (z.ph === 'sap' || z.ph === 'dang'));
  if (!y) return [];
  const ppl = [y.s.host, ...y.s.seats.filter((p) => p && p.status === 'nhan')].slice(0, SESSION_MAX);
  return ppl.map((p) => {
    if (p.id === acct.uid) return { key: p.id, me: true };
    const c = friend(p.id);
    return { key: p.id, name: label(p), look: (c && c.look) || p.look || {}, here: y.ph === 'sap' || !c || c.presence == null || c.presence === 'thien' };
  });
}
/** Cập nhật đếm ngược tại chỗ (không dựng lại thẻ/bảng, để nút đang chọn không mất tiêu điểm) */
function updateLeft() {
  for (const el of document.querySelectorAll('[data-dt-end]')) { const t = fmtLeft(+el.dataset.dtEnd - now(), el.dataset.dtF); if (el.textContent !== t) el.textContent = t; }
}

// ───────── Nhịp mỗi giây: hiện diện, bắt đầu cùng giờ, tải lại danh sách khi đang chờ ─────────
function tick() {
  if (!ctx) return;
  follow();
  setPresence(ctx.presence());
  if (!dongTu.on) { card(); if (ctx.dais) ctx.dais([]); return; }
  if (D.cheerHold && D.cheerRetry && Date.now() >= D.cheerRetry) { D.cheerRetry = 0; void loadMe(); }
  // Liên kết mời đã gửi mà sau 15 giây chưa thấy người mời trong danh sách: mô-đun mạng đã xóa mã (mã hỏng, hết lượt, mã của mình)
  // thì báo; còn mã (lỗi tạm) thì chờ tiếp
  if (D.pend && D.pend.on && dongTu.list && Date.now() - D.pend.at > 15_000) {
    if (inviteFromHash(location.hash)) D.pend.at = Date.now();
    // Mã đã rời địa chỉ nhưng danh sách chưa có người mời: tải lại danh sách một lần và chờ thêm trước khi báo lỗi
    // (máy chậm có thể nhận lời xong mà lượt tải danh sách sau đó chưa về kịp)
    else if (!D.pend.again) { D.pend.again = true; D.pend.at = Date.now(); void loadCompanions().catch(() => {}); }
    else { D.pend = null; ctx.toast('Chưa kết nối được bằng mã mời này. Mã có thể đã hết hạn, hết lượt, hoặc là mã của chính bạn.'); if (D.tab === 'loi') { D.tab = 'list'; if (ctx.viewOpen()) ctx.render(); } }
  }
  const I = invites(), t = now();
  for (const { inv, ph } of I.together) {
    if (ph.phase === 'sap') { D.watch.add(inv.id); continue; }
    if (D.joined.has(inv.id)) continue;
    if (ctx.quiet()) { D.joined.add(inv.id); continue; }   // đã tự ngồi rồi: không chen vào thời đang phát
    // vừa tới giờ khi máy đang theo dõi đếm ngược: tự bắt đầu cho cả hai; trễ (máy ngủ, mất mạng) thì để người dùng bấm «Vào ngồi cùng»
    if (D.watch.has(inv.id) && !D.hide.has(inv.id) && t - inv.start_at < 10_000) start(inv, t - inv.start_at);
  }
  // Hẹn nhóm: cùng cách với lời mời gặp. Đã bấm «Để sau» ở mốc 1 phút thì không tự kéo vào; thẻ «đang diễn ra» cho vào sau.
  const SS = sessions();
  for (const x of SS) {
    const k = 's:' + x.s.id;
    if (!x.going) continue;
    if (x.ph === 'sap') { D.watch.add(k); continue; }
    if (x.ph !== 'dang' || D.joined.has(k)) continue;
    if (ctx.quiet()) { D.joined.add(k); continue; }
    if (D.watch.has(k) && !D.hide.has(k + ':1') && t - x.s.start_at < 10_000) startS(x.s, t - x.s.start_at);
  }
  // Danh sách tự tải lại: 10 giây khi đang chờ bạn trả lời hoặc sắp bắt đầu; 15 giây khi đang cùng thiền (Đài Đồng Tu cần hiện diện mới
  // để thấy bạn vào muộn, kể cả khi màn Bạn đồng tu đã đóng); 30 giây khi màn đang mở (hợp đồng §5). Tab ẩn thì ngừng, để nhiều tab không
  // cùng ăn hạn mức; quay lại thì GET /me của net/account.js và nhịp này tải tiếp. loadCompanions đã gộp lượt gọi đang chạy.
  // Hẹn nhóm sắp tới (còn ≤ 11 phút) thì 30 giây, để thấy người nhận lời muộn hay hẹn bị hủy trước khi nhắc
  const wait = I.outgoing.length || I.together.some((x) => x.ph.phase === 'sap') || SS.some((x) => x.going && x.ph === 'sap');
  const sit = I.together.some((x) => x.ph.phase === 'dang') || SS.some((x) => x.going && x.ph === 'dang');
  const soon = SS.some((x) => x.going && x.ph === 'hen' && x.s.start_at - t <= SESSION_REMIND_MS[0] + 60_000);
  const gap = wait ? 10_000 : sit ? 15_000 : ctx.viewOpen() || soon ? 30_000 : 0;
  if (gap && document.visibilityState === 'visible' && Date.now() - D.lastLoad > gap) { D.lastLoad = Date.now(); void loadCompanions().catch(() => {}); }
  card(I);
  if (ctx.dais) ctx.dais(daisPeople(I));
  const vk = ['together', 'incoming', 'outgoing'].map((k) => I[k].map((x) => x.inv.id + x.ph.phase).join(',')).join('|') + '|' + SS.map((x) => x.s.id + x.ph).join(',');
  if (vk !== D.viewKey) { D.viewKey = vk; if (ctx.viewOpen()) ctx.render(); }
  updateLeft();
}
function start(inv, elapsed) {
  D.joined.add(inv.id);
  ctx.together(inv, Math.max(0, elapsed));
  ctx.toast(`Bắt đầu ${WHAT[inv.kind] || 'thực hành'} với ${plainName(other(inv))}.`);
  card();
}

function startS(s, elapsed) {
  D.joined.add('s:' + s.id);
  ctx.together(s, Math.max(0, elapsed));
  ctx.toast('Bắt đầu thời thiền đồng tu ở Đại Thiền Đường.');
  card();
}

function changed() {
  follow();
  if (dongTu.at !== D.at) {
    // Độ lệch giờ máy chủ − giờ máy. Mỗi mẫu đã trừ đi thời gian phản hồi, nên mẫu lớn nhất gần đúng nhất; đồng hồ máy nhảy (> 1 phút) thì lấy lại
    const off = dongTu.at ? dongTu.at - Date.now() : 0;
    D.skew = !D.at || Math.abs(off - D.skew) > 60_000 ? off : Math.max(D.skew, off);
    D.at = dongTu.at; D.lastLoad = Date.now();
  }
  if (D.pend && dongTu.on && !D.pend.on) { D.pend.on = true; D.pend.at = Date.now(); }
  const o = D.pend && D.pend.owner;
  if (o && dongTu.list && L('companions').some((c) => c.tinh_danh === o.tinh_danh && c.tag === o.tag)) {
    D.pend = null; ctx.toast(`Đã kết nối đồng tu với ${o.tinh_danh} · ${o.tag}.`);
    if (D.tab === 'loi') D.tab = 'list';
  }
  if (dongTu.on && D.me && !D.openSynced) syncOpen();
  if (D.msg && D.msgInv && !invites().outgoing.some((x) => x.inv.id === D.msgInv)) { D.msg = ''; D.msgInv = null; }   // lời mời vừa gửi đã được trả lời
  ctx.badge(); card();
  if (ctx.viewOpen()) ctx.render();
}

// ───────── Nạp dữ liệu ─────────
async function loadMe() {
  if (!dongTu.on) return;
  const uid = D.uid;
  try {
    const me = await getMe();
    if (!still(uid) || !me || !me.user || me.user.id !== uid) return;   // phản hồi chậm của phiên trước
    observeDongTuMe(uid, me); D.me = me.profile || D.me; D.meFail = false;
    if (D.cheerHold) { D.cheerHold = false; D.cheerRetry = 0; ctx.badge(); }
  } catch {
    if (!still(uid)) return;
    D.meFail = true;
    // Đang giữ chấm khích lệ ở 0 sau «đã xem» mà GET /me lỗi: thử lại sau, để lời mới đến sau đó không bị giấu mãi (review #151)
    if (D.cheerHold) D.cheerRetry = Date.now() + CHEER_RETRY_MS;
  }
  if (D.me && !D.openSynced) syncOpen();
  if (ctx.viewOpen()) ctx.render();
}
async function loadBlocks() {
  const uid = D.uid;
  try { const r = await listBlocks(); if (!still(uid)) return; D.blocks = (r && r.blocks) || []; } catch (e) { if (!still(uid)) return; D.blocks = []; D.err = human(e); }
  if (ctx.viewOpen()) ctx.render();
}
/** Chế độ cổng trên máy (S.open) là lựa chọn của người dùng; máy chủ lệch (vd. đổi cổng trước khi có Bạn đồng tu) thì đưa lên một lần */
function syncOpen() {
  D.openSynced = true;
  if (((D.me.island && D.me.island.open) === true) === !!ctx.S.open) return;
  void dtSyncOpen(!!ctx.S.open);
}
/** Gọi khi bấm đổi cổng ở Cổng Vân Môn */
export async function dtSyncOpen(open) {
  follow();
  if (!dongTu.on) return;
  const uid = D.uid;
  try {
    if (!D.me) { const me = await getMe(); if (!still(uid) || !me || !me.user || me.user.id !== uid) return; D.me = me.profile; }
    const r = await pushSocialPrefs({ ...prefs(), open });
    if (still(uid) && r && r.profile) D.me = r.profile;
  } catch { if (still(uid)) { ctx.toast('Chưa đồng bộ được chế độ cổng. Hãy thử lại khi có mạng.'); D.openSynced = false; } }
}

/** Chạy một thao tác mạng. `fn(ok)`: chỉ ghi vào D khi ok() còn đúng (tài khoản chưa đổi giữa chừng). */
async function run(label, fn, fromCard = false) {
  follow();
  const uid = D.uid, ok = () => still(uid);
  D.busy = label; D.err = ''; D.msg = ''; if (ctx.viewOpen()) ctx.render();
  try { await fn(ok); } catch (e) { if (!ok()) return; const m = human(e); if (fromCard || !ctx.viewOpen()) ctx.toast(m); else D.err = m; }
  if (!ok()) return;
  D.busy = ''; card(); if (ctx.viewOpen()) ctx.render();
}
function open(tab) {
  follow();
  D.tab = tab; D.err = ''; D.msg = ''; D.arm = '';
  ctx.show();
  if (tab === 'list') { D.lastLoad = Date.now(); void loadCompanions().catch(() => {}); void loadMe(); }
  // Mời bạn tu cùng: tạo mã chỉ sau khi đã nhận hồ sơ máy chủ của đúng tài khoản và nhân vật đã lưu đủ (ready)
  const fresh = () => !D.link || D.link.expires_at <= Date.now() || D.link.uses_left <= 0;
  if (tab === 'moi') void loadMe().then(() => { if (D.tab === 'moi' && ready().ok && fresh() && !D.busy) dtAct('link', { dataset: {} }); });
  if (tab === 'tim' || tab === 'rieng') void loadMe();
  if (tab === 'rieng') { D.blocks = null; void loadBlocks(); }
}
export const dtOpen = () => open('list');
const findInv = (id) => L('invites').find((x) => x && x.id === id);

export function dtAct(act, b) {
  follow();
  const id = b.dataset.id;
  if (act !== 'renew' && act !== 'remove' && act !== 'block' && act !== 's-cancel') D.arm = '';
  if (act === 'open') return open('list');
  if (act === 'close') { D.tab = 'list'; D.cheerMark = 0; return ctx.close(); }
  if (act === 'tab') return open(b.dataset.v);
  if (act === 'ban') { D.sel = id; return open('ban'); }
  if (act === 'me') return run('Đang kiểm tra', () => loadMe());
  if (act === 'link' && !ready().ok) return;
  if (act === 'link') return run('Đang tạo mã mời', async (ok) => { const k = await createLink(false); if (ok()) D.link = k; });
  if (act === 'renew') {
    if (D.arm !== 'renew') { D.arm = 'renew'; return ctx.render(); }
    D.arm = ''; return run('Đang tạo mã mới', async (ok) => { const k = await createLink(true); if (ok()) { D.link = k; D.msg = 'Đã tạo mã mới. Mã cũ không dùng được nữa.'; } });
  }
  if (act === 'peek') { D.peek = D.peek === id ? null : id; if (D.peek) void loadProg(id); return ctx.render(); }
  if (act === 'prog') { void loadProg(id); return ctx.render(); }
  if (act === 'creator') return ctx.creator();
  // Lưu nhân vật: chờ chính yêu cầu ghi hồ sơ (Tịnh danh + hình dáng), rồi đọc lại /me để mở nút theo hồ sơ máy chủ
  if (act === 'save') return run('Đang lưu nhân vật', async (ok) => { await updateProfile({ tinh_danh: ctx.S.name, look: ctx.S.look }); if (ok()) await loadMe(); });
  if (act === 'fb') {
    // Facebook chỉ nhận liên kết (u=). Máy tính: cửa sổ nhỏ; điện thoại: tab mới, ứng dụng Facebook nhận nếu có
    const u = 'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(shareUrl()), narrow = window.innerWidth <= 820;
    window.open(u, narrow ? '_blank' : 'vandao-fb', narrow ? 'noopener' : 'noopener,width=600,height=560');
    return;
  }
  if (act === 'share') return navigator.share({ text: shareText() }).catch(() => {});
  if (act === 'copy') return run('Đang chép', async (ok) => { await navigator.clipboard.writeText(shareText()); if (!ok()) return; D.msg = 'Đã chép lời mời.'; });
  if (act === 'find') {
    const el = document.getElementById('dtFind'); if (el) D.q = el.value.trim();
    const f = parseFriendQuery(D.q);
    if (!f) { D.msg = ''; D.err = 'Hãy gõ đúng dạng Tịnh danh · mã, ví dụ Tuệ Thái · 5696.'; return ctx.render(); }
    return run('Đang gửi', async (ok) => { await requestByName(`${f.tinh_danh} · ${f.tag}`); if (!ok()) return; D.q = ''; D.msg = `Đã gửi lời kết nối tới ${f.tinh_danh} · ${f.tag}. Khi người ấy đồng ý, hai bạn sẽ thấy nhau trong danh sách.`; });
  }
  if (act === 'req-yes' || act === 'req-no') return run('Đang trả lời', async (ok) => { await respondRequest(id, act === 'req-yes'); if (!ok()) return; D.msg = act === 'req-yes' ? 'Đã kết nối đồng tu.' : 'Đã bỏ qua lời kết nối.'; });
  if (act === 'withdraw') return run('Đang rút lại', async (ok) => { await withdrawRequest(id); if (!ok()) return; });
  if (act === 'meet') return run('Đang gửi lời mời', async (ok) => { const r = await meet(id, b.dataset.k, b.dataset.p || null); if (!ok()) return; D.lastLoad = Date.now(); D.msg = 'Đã gửi lời mời. Lời mời chờ trả lời trong 10 phút.'; D.msgInv = r && r.invite ? r.invite.id : null; });
  if (act === 'yes' || act === 'no') {
    const inv = findInv(id), fromCard = !!b.closest('#dtm');
    return run(act === 'yes' ? 'Đang nhận lời' : 'Đang trả lời', async (ok) => {
      await respondMeet(id, act === 'yes'); if (!ok()) return; D.answered.add(id);   // ẩn ngay, không đợi danh sách tải lại
      if (act === 'yes' && !(inv && MEET_KINDS[inv.kind] && MEET_KINDS[inv.kind].synced)) ctx.toast('Đã nhận lời.');
    }, fromCard);
  }
  if (act === 'cancel') return run('Đang hủy lời mời', async (ok) => { await cancelMeet(id); if (!ok()) return; D.hide.add(id); }, !!b.closest('#dtm'));
  if (act === 'go') { const x = b.dataset.s ? sesById(b.dataset.s) : null, inv = x ? x.s : findInv(id); if (inv) ctx.go(inv); return; }
  if (act === 'hen') return henSend();
  if (act === 'cheer') {
    const line = b.dataset.v, k = sentKey(id);
    if (!Object.prototype.hasOwnProperty.call(CHEER_LINES, line) || D.cheered.has(k)) return;
    return run('Đang gửi lời khích lệ', async (ok) => {
      try { await api(`/api/v1/companions/${encodeURIComponent(id)}/cheer`, { method: 'POST', body: { line } }); }
      catch (e) { if (e && e.code === 'cheer_today' && ok()) D.cheered.add(k); throw e; }
      if (!ok()) return;
      D.cheered.add(k); D.msg = `Đã gửi lời khích lệ tới ${plainName(id)}.`;
    });
  }
  if (act === 's-yes' || act === 's-no' || act === 's-leave') {
    const yes = act === 's-yes';
    return run(yes ? 'Đang nhận lời' : 'Đang trả lời', async (ok) => {
      await api(`/api/v1/sessions/${encodeURIComponent(id)}/respond`, { method: 'POST', body: { accept: yes } });
      if (!ok()) return;
      if (!yes) D.hide.add('s:' + id);   // ẩn ngay, không đợi danh sách tải lại
      reload(); D.msg = yes ? 'Đã nhận lời hẹn. Khi ứng dụng đang mở, bạn được nhắc trước giờ.' : 'Đã báo không tham gia.';
    }, !!b.closest('#dtm'));
  }
  if (act === 's-cancel') {
    if (D.arm !== 'sc:' + id) { D.arm = 'sc:' + id; return ctx.render(); }
    D.arm = '';
    return run('Đang hủy hẹn', async (ok) => { await api(`/api/v1/sessions/${encodeURIComponent(id)}/cancel`, { method: 'POST' }); if (!ok()) return; D.hide.add('s:' + id); reload(); D.msg = 'Đã hủy hẹn.'; });
  }
  if (act === 's-join') { const x = sesById(id); if (x) startS(x.s, now() - x.s.start_at); return; }
  if (act === 'ics') { const x = sesById(id); if (x) icsDownload(x.s, { host: location.host || 'vandao', url: location.origin + '/' }); return; }
  if (act === 'join') { const inv = findInv(id); if (inv) start(inv, now() - inv.start_at); return; }
  if (act === 'hide') { D.hide.add(id); return card(); }
  if (act === 'remove' || act === 'block') {
    if (D.arm !== act) { D.arm = act; return ctx.render(); }
    D.arm = ''; const nm = plainName(D.sel), sel = D.sel;
    return run(act === 'block' ? 'Đang chặn' : 'Đang hủy kết nối', async (ok) => {
      if (act === 'block') await block(sel); else await removeCompanion(sel);
      if (!ok()) return;
      D.tab = 'list'; D.msg = act === 'block' ? `Đã chặn ${nm}.` : `Đã hủy kết nối với ${nm}.`;
    });
  }
  if (act === 'report') return run('Đang gửi báo cáo', async (ok) => { await report(D.sel, b.dataset.v); if (!ok()) return; D.tab = 'ban'; D.msg = 'Đã gửi báo cáo. Người kiểm duyệt sẽ xem xét.'; });
  if (act === 'unblock') return run('Đang bỏ chặn', async (ok) => { await unblock(id); const r = await listBlocks(); if (ok()) D.blocks = (r && r.blocks) || []; });
}

/** Ô đánh dấu và ô chữ trong bảng (data-dt) */
export function dtInput(t) {
  follow();
  const k = t.dataset.dt;
  if (k === 'q') { D.q = t.value; return; }
  if (k === 'kem') { D.kem = t.checked; return; }
  if (k === 'hen-ban') { const id = t.dataset.id; if (t.checked && D.hen.pick.size < SESSION_MAX - 1) D.hen.pick.add(id); else D.hen.pick.delete(id); D.err = ''; return ctx.render(); }
  if (k === 'hen-when') { D.hen.when = t.value === 'ngay' ? 'ngay' : 'gio'; D.err = ''; return ctx.render(); }
  if (k === 'hen-at') { D.hen.at = t.value; D.err = ''; return; }
  if (k === 'than' || k === 'away') { const sel = D.sel; return run('Đang lưu', async () => { await setCompanion(sel, { [k]: t.checked }); }); }
  if (k === 'chia_se_tien_trinh') {   // §10.1: PATCH gộp theo từng khóa, chỉ gửi khóa này
    const on = t.checked;
    return run('Đang lưu', async (ok) => {
      const r = await updateProfile({ settings: { dong_tu: { chia_se_tien_trinh: on } } });
      if (ok()) D.me = r && r.profile ? r.profile : { ...D.me, settings: { ...(D.me.settings || {}), dong_tu: { ...prefs(), chia_se_tien_trinh: on } } };
    });
  }
  if (k in prefs()) {
    const next = { ...prefs(), [k]: t.checked };
    return run('Đang lưu', async (ok) => {
      const r = await pushSocialPrefs({ ...next, open: !!ctx.S.open });
      if (ok()) D.me = r && r.profile ? r.profile : { ...D.me, settings: { ...(D.me.settings || {}), dong_tu: next } };
    });
  }
}

/**
 * Khởi động. c: { S, render, toast, show (mở màn), close (đóng màn), viewOpen, badge (vẽ chấm nút), cardEl,
 * quiet (đang thiền: không hiện lời mời, không âm), presence (trạng thái hiện diện), sfx, together(inv, ms đã trôi), go(inv) }.
 */
export function dtInit(c) {
  ctx = c;
  onDongTu(changed);
  c.cardEl.addEventListener('click', (e) => { const b = e.target.closest('[data-act^="dt-"]'); if (b) dtAct(b.dataset.act.slice(3), b); });
  setInterval(tick, 1000);
  window.addEventListener('hashchange', checkLink);
  void checkLink();
}
/** Mở liên kết …/#ban=MÃ: mô-đun mạng tự nhận khi có phiên; ở đây cho biết ai mời, và chưa có phiên thì mời giữ hành trình */
async function checkLink() {
  const code = inviteFromHash(location.hash);
  if (!code || (D.pend && D.pend.code === code)) return;
  D.pend = { code, owner: null, at: Date.now(), on: false };
  try {
    const r = await linkInfo(code);
    if (!r) { D.pend = null; ctx.toast('Mã mời này không còn hiệu lực.'); return; }
    D.pend.owner = r.owner || null;
  } catch { /* mất mạng: vẫn giữ mã, mô-đun mạng gửi khi có mạng */ }
  if (!dongTu.on) { D.tab = 'loi'; ctx.show(); }
  else changed();
}

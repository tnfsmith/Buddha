// Bạn đồng tu (#124; hợp đồng docs/contracts/ban-dong-tu.md §5; thiết kế docs/thiet-ke/ban-dong-tu.md §6): danh sách bạn,
// mời bạn tu cùng (mã + QR), tìm đúng «Tịnh danh · mã», chi tiết bạn, quyền riêng tư, thẻ lời mời gặp và đếm ngược cùng giờ.
// Chỉ dùng mô-đun mạng net/dong-tu.js. Không chữ tự do (chỉ lời mẫu), không điểm, không xếp hạng, không hiện số bạn.
// Lời mời gặp không hiện và không có âm khi đang thiền; xuất thiền rồi mới hiện, kèm dòng «trong lúc bạn thiền».
import {
  INVITE_TTL_MS, LINES, MAX_COMPANIONS, MEET_KINDS, PRESENCE_TEXT, REASON_TEXT, SEEN_TEXT,
  canMeet, inviteFromHash, inviteUrl, isMeetKind, meetPhase, parseFriendQuery, showInviteCode,
} from '@vandao/shared/dong-tu.js';
import {
  block, cancelMeet, createLink, dongTu, linkInfo, listBlocks, loadCompanions, meet, observeDongTuMe, onDongTu, pushSocialPrefs,
  removeCompanion, report, respondMeet, respondRequest, requestByName, setCompanion, setPresence, unblock, withdrawRequest,
} from '../net/dong-tu.js';
import { acct } from '../net/account.js';
import { getMe } from '../net/api.js';
import { esc } from './dom.js';
import { qr } from './account.js';

/**
 * Trạng thái màn. `tab`: list · moi (mã mời) · tim (tìm bạn) · ban (một bạn) · bao (báo cáo) · rieng (quyền riêng tư) ·
 * loi (vừa mở liên kết mời khi chưa có phiên). `skew`: giờ máy chủ − giờ máy, để đếm ngược hai bên khớp nhau.
 */
const D = {
  tab: 'list', sel: null, busy: '', err: '', msg: '', arm: '', link: null, me: null, blocks: null, q: '', pend: null,
  skew: 0, at: 0, lastLoad: 0, msgInv: null, cardKey: '', viewKey: '', openSynced: false,
  quietSeen: new Set(), chimed: new Set(), watch: new Set(), joined: new Set(), hide: new Set(), answered: new Set(),
};
let ctx = null;

const L = (k) => { const v = dongTu.list && dongTu.list[k]; return Array.isArray(v) ? v : []; };
const now = () => Date.now() + D.skew;
const who = (p) => `${esc(p.tinh_danh)} · ${esc(p.tag)}`;
const friend = (id) => L('companions').find((c) => c.id === id) || null;
const nameOf = (id) => { const c = friend(id); return c ? who(c) : 'Bạn đồng tu'; };
const plainName = (id) => { const c = friend(id); return c ? `${c.tinh_danh} · ${c.tag}` : 'bạn đồng tu'; };
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
const prefs = () => { const s = (D.me && D.me.settings && D.me.settings.dong_tu) || {}; return { hien_trang_thai: s.hien_trang_thai !== false, cho_tim: s.cho_tim !== false, hien_ngay: s.hien_ngay !== false }; };

/** Số chấm trên nút: lời kết nối và lời mời gặp đang chờ mình. Không bao giờ là số bạn. */
export function dtBadge() {
  if (!dongTu.on) return 0;
  if (!dongTu.list) return (dongTu.social.requests || 0) + (dongTu.social.invites || 0);
  return L('incoming').length + invites().incoming.length;
}

// ───────── Các màn ─────────
const status = () => (D.busy ? `<p class="muted" role="status">${esc(D.busy)}…</p>` : '') + (D.err ? `<p class="note" role="alert">${esc(D.err)}</p>` : '') + (D.msg ? `<p class="muted" role="status">${esc(D.msg)}</p>` : '');
const dis = () => (D.busy ? ' disabled' : '');
const back = (to = 'list') => (to === 'list' ? '<div class="row"><button class="ghost" data-act="dt-tab" data-v="list">← Danh sách</button></div>'
  : `<div class="row"><button class="ghost" data-act="dt-ban" data-id="${esc(D.sel)}">← Quay lại</button></div>`);
const left = (end, f) => `<span data-dt-end="${end}" data-dt-f="${f}">${fmtLeft(end - now(), f)}</span>`;
const guestNote = () => (acct.on && acct.guest ? '<p class="note">Hành trình này đang giữ bằng phiên khách. Gắn vân tay / Face ID hoặc lưu mã khôi phục ở trang Tài khoản để không mất bạn đồng tu.</p><div class="row"><button class="ghost" data-act="acct-open">Tài khoản</button></div>' : '');

export function dtView() {
  if (D.tab === 'loi') return linkNote();
  if (!dongTu.on) return `<h2>Bạn đồng tu</h2>${acct.on ? '<p class="muted" role="status">Đang kết nối máy chủ…</p>' : '<p>Giữ hành trình để kết nối với người bạn tu cùng ngoài đời.</p><div class="row"><button class="btn" data-act="acct-open">Giữ hành trình của tôi</button></div>'}<div class="row"><button class="ghost" data-act="dt-close">← Quay lại</button></div>`;
  if (D.tab === 'moi') return inviteView();
  if (D.tab === 'tim') return findView();
  if (D.tab === 'rieng') return privacyView();
  const f = friend(D.sel);
  if (D.tab === 'ban' && f) return friendView(f);
  if (D.tab === 'bao' && f) return reportView(f);
  return listView();
}

function listView() {
  let h = `<h2>Bạn đồng tu</h2><div class="row"><button class="btn" data-act="dt-tab" data-v="moi">Mời bạn tu cùng</button><button class="btn alt" data-act="dt-tab" data-v="tim">Tìm bạn</button></div>` + status();
  if (!dongTu.list) return h + '<p class="muted" role="status">Đang tải danh sách…</p>' + foot();
  const I = invites(), cs = L('companions'), inc = L('incoming'), og = L('outgoing');
  if (I.incoming.length) h += `<h3>Lời mời đang chờ (${I.incoming.length})</h3>` + I.incoming.map(incomingRow).join('');
  if (inc.length) h += `<h3>Lời kết nối (${inc.length})</h3>` + inc.map(reqRow).join('');
  const than = cs.filter((c) => c.closeness === 'than'), quen = cs.filter((c) => c.closeness !== 'than');
  if (than.length) h += '<h3>Thân thiết</h3>' + than.map((c) => row(c, I)).join('');
  if (quen.length) h += '<h3>Quen biết</h3>' + quen.map((c) => row(c, I)).join('');
  if (og.length) h += '<h3>Đang chờ</h3>' + og.map(outRow).join('');
  if (!cs.length && !inc.length && !og.length) h += '<p class="muted">Chưa có bạn đồng tu. Hãy mời người bạn quen ngoài đời bằng mã mời, hoặc tìm đúng «Tịnh danh · mã» người ấy đưa cho bạn.</p>';
  return h + guestNote() + foot();
}
const foot = () => '<div class="row"><button class="ghost" data-act="dt-tab" data-v="rieng">Quyền riêng tư</button><button class="ghost" data-act="dt-close">← Quay lại</button></div>';

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
  if (tog) return `<p class="muted">${togetherText(tog)}</p>` + (tog.ph.phase === 'dang' && !D.joined.has(tog.inv.id) ? `<div class="row"><button class="btn" data-act="dt-join" data-id="${esc(tog.inv.id)}">Vào ngồi cùng</button></div>` : '');
  const out = I.outgoing.find((x) => x.inv.to === c.id);
  if (out) return `<p class="muted">Đã mời ${WHAT[out.inv.kind] || 'gặp'} · chờ trả lời, còn ${left(out.inv.created_at + INVITE_TTL_MS, 'm')}</p><div class="row"><button class="ghost" data-act="dt-cancel" data-id="${esc(out.inv.id)}"${dis()}>Hủy lời mời</button></div>`;
  if (I.incoming.some((x) => x.inv.from === c.id)) return '';
  const S = ctx.S, chk = canMeet('thien', { day: S.day, completed: !!S.completed, open: !!S.open },
    // bạn tắt hiện trạng thái: máy chủ coi như đang ở Vân Đạo khi kiểm (hợp đồng §3.3), máy khách cũng để nút mở
    { day: c.day, completed: c.completed === true, open: c.open === true, presence: c.presence == null ? 'online' : c.presence }, { accepted: true }, 'dtd');
  if (!chk.ok) return `<div class="row"><button class="btn alt" disabled>Mời cùng ngồi thiền</button></div><p class="muted">${esc(REASON_TEXT[chk.code] || '')}</p>`;
  return `<div class="row"><button class="btn alt" data-act="dt-meet" data-id="${esc(c.id)}" data-k="thien" data-p="dtd"${dis()}>Mời cùng ngồi thiền</button></div>` +
    (chk.quiet ? '<p class="muted">Bạn ấy đang tọa thiền: lời mời sẽ hiện khi bạn ấy xuất thiền.</p>' : '');
}
function row(c, I) {
  return `<div class="dtf" data-id="${esc(c.id)}"><button class="dtn" data-act="dt-ban" data-id="${esc(c.id)}">${dot(c)}<b>${who(c)}</b><span>${esc(presenceLine(c))}</span></button>${meetBlock(c, I)}</div>`;
}
function togetherText({ inv, ph }) {
  const what = WHAT[inv.kind] || 'gặp nhau';
  return ph.phase === 'sap' ? `Hẹn ${what} ${AT[inv.place] || ''} · bắt đầu sau ${left(inv.start_at, 'c')}` : `Đang ${what} · đã bắt đầu`;
}
function incomingRow({ inv }) {
  const where = PLACE[inv.place];
  return `<div class="dtf"><div class="dtn"><b>${nameOf(inv.from)}</b><span>${esc(LINES[inv.kind])}</span></div><p class="muted">${where ? where + ' · ' : ''}còn ${left(inv.created_at + INVITE_TTL_MS, 'm')} để trả lời</p>` +
    `<div class="row"><button class="btn" data-act="dt-yes" data-id="${esc(inv.id)}"${dis()}>Đồng ý</button><button class="btn alt" data-act="dt-no" data-id="${esc(inv.id)}"${dis()}>Để lúc khác</button></div></div>`;
}
const reqRow = (r) => `<div class="dtf"><div class="dtn"><b>${who(r.from || {})}</b><span>muốn kết nối đồng tu với bạn</span></div><div class="row"><button class="btn" data-act="dt-req-yes" data-id="${esc(r.id)}"${dis()}>Đồng ý</button><button class="btn alt" data-act="dt-req-no" data-id="${esc(r.id)}"${dis()}>Bỏ qua</button></div></div>`;
// Người gửi chỉ thấy «đã gửi» tới khi bên kia đồng ý hoặc hết hạn: không có tín hiệu từ chối hay «không tìm thấy» (hợp đồng §4)
const outRow = (r) => `<div class="dtf"><div class="dtn"><b>${who(r)}</b><span>Đã gửi lời kết nối · chờ người ấy đồng ý</span></div><div class="row"><button class="ghost" data-act="dt-withdraw" data-id="${esc(r.id)}"${dis()}>Rút lại</button></div></div>`;

function friendView(c) {
  const me = c.me || {}, than = c.closeness === 'than';
  return `<h2>${who(c)}</h2><p class="pali">Bạn đồng tu · ${than ? 'thân thiết' : 'quen biết'}</p><p>${dot(c)} ${esc(presenceLine(c))}</p>${meetBlock(c, invites())}${status()}
    <h3>Mức gần gũi</h3><label class="chk"><input type="checkbox" data-dt="than"${me.than ? ' checked' : ''}${dis()}> Thân thiết</label>
    <p class="muted">Hai người cùng chọn thì thành thân thiết. Không có nấc nào tự lên theo số lần gặp.</p>` +
    (than ? `<label class="chk"><input type="checkbox" data-dt="away"${me.away ? ' checked' : ''}${dis()}> Cho bạn ấy ghé Vân Đảo của mình khi mình vắng</label><p class="muted">Chỉ có tác dụng khi Cổng Vân Môn của bạn ở chế độ Nghênh khách.</p>` : '') +
    `<h3>Khác</h3><div class="row"><button class="ghost" data-act="dt-remove"${dis()}>${D.arm === 'remove' ? 'Bấm lần nữa để hủy kết nối' : 'Hủy kết nối'}</button><button class="ghost" data-act="dt-block"${dis()}>${D.arm === 'block' ? 'Bấm lần nữa để chặn' : 'Chặn'}</button><button class="ghost" data-act="dt-tab" data-v="bao">Báo cáo</button></div>` +
    (D.arm === 'block' ? '<p class="muted">Người bị chặn không được báo; với họ, kết nối chỉ như đã bị hủy.</p>' : '') + back();
}
const reportView = (c) => `<h2>Báo cáo ${who(c)}</h2><p class="muted">Chỉ người kiểm duyệt thấy báo cáo; người bị báo cáo không được thông báo. Chọn lý do:</p>${status()}` +
  REPORT.map((r) => `<div class="row"><button class="btn alt" data-act="dt-report" data-v="${esc(r)}"${dis()}>${esc(r)}</button></div>`).join('') + back('ban');

function inviteView() {
  const k = D.link;
  let h = '<h2>Mời bạn tu cùng</h2><p class="muted">Gửi cho người bạn quen ngoài đời. Người ấy mở liên kết hoặc quét mã là hai bạn kết nối.</p>' + status();
  if (!k) return h + (D.busy ? '' : '<div class="row"><button class="btn" data-act="dt-link">Tạo mã mời</button></div>') + back();
  const share = typeof navigator !== 'undefined' && !!navigator.share;
  h += `<div class="dtq">${qr(inviteUrl(location.origin, k.code), 'Mã QR mời bạn tu cùng')}<div class="dtc" data-dt-code>${esc(showInviteCode(k.code))}</div><p class="muted">Còn ${k.uses_left} lượt · hết hạn ngày ${date(k.expires_at)}</p></div>` +
    `<div class="row">${share ? `<button class="btn" data-act="dt-share">Chia sẻ</button><button class="btn alt" data-act="dt-copy">Sao chép</button>` : '<button class="btn" data-act="dt-copy">Sao chép lời mời</button>'}<button class="ghost" data-act="dt-renew"${dis()}>${D.arm === 'renew' ? 'Bấm lần nữa: mã cũ sẽ không dùng được' : 'Tạo mã mới'}</button></div>`;
  return h + guestNote() + back();
}
const shareText = () => `Mời bạn cùng tu tập với mình trên Vân Đạo: ${inviteUrl(location.origin, D.link.code)}`;

function findView() {
  return `<h2>Tìm bạn</h2><p class="muted">Chỉ tìm đúng tên và mã người ấy đưa cho bạn.</p>
    <input id="dtFind" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="Tịnh danh · mã, ví dụ Tuệ Thái · 5696" value="${esc(D.q)}" data-dt="q">
    <div class="row"><button class="btn" data-act="dt-find"${dis()}>Gửi lời kết nối</button></div>${status()}` +
    (D.me && D.me.tinh_danh ? `<p class="muted">Tịnh danh · mã của bạn: <b>${who(D.me)}</b>. Đưa cho người bạn để người ấy tìm bạn.</p>` : '') + back();
}

function privacyView() {
  let h = '<h2>Quyền riêng tư</h2>' + status();
  if (!D.me) return h + (D.busy ? '' : '<p class="muted" role="status">Đang tải…</p>') + back();
  const p = prefs(), an = D.me.visibility === 'an', box = (k, text, off = false) => `<label class="chk"><input type="checkbox" data-dt="${k}"${p[k] && !off ? ' checked' : ''}${off || D.busy ? ' disabled' : ''}> ${text}</label>`;
  h += box('hien_trang_thai', 'Hiện trạng thái với bạn đồng tu', an) + '<p class="muted">Tắt thì bạn đồng tu không thấy bạn đang thiền, thưởng trà hay vắng mặt.</p>' +
    box('cho_tim', 'Cho người khác gửi lời kết nối bằng Tịnh danh · mã', an) +
    box('hien_ngay', 'Hiện ngày hành trình với bạn đồng tu') +
    (an ? '<p class="note">Quyền hiển thị đang là «Ẩn» (trang Tài khoản): người khác không tìm được bạn và không thấy trạng thái của bạn.</p>' : '') +
    `<p class="muted">Cổng Vân Môn: ${ctx.S.open ? 'Nghênh khách' : 'Độc cư'}. Đổi ở phân khu Cổng Vân Môn.</p><h3>Đã chặn</h3>`;
  const B = D.blocks;
  h += !B ? '<p class="muted">Đang tải…</p>' : !B.length ? '<p class="muted">Chưa chặn ai.</p>'
    : B.map((x) => `<div class="dtf"><div class="dtn"><b>${x.tinh_danh ? who(x) : 'Tài khoản đã xóa'}</b></div><div class="row"><button class="ghost" data-act="dt-unblock" data-id="${esc(x.id)}"${dis()}>Bỏ chặn</button></div></div>`).join('') + '<p class="muted">Bỏ chặn không tự kết nối lại.</p>';
  return h + back();
}

function linkNote() {
  const o = D.pend && D.pend.owner;
  let h = `<h2>Lời mời tu cùng</h2>${o ? `<p><b>${who(o)}</b> mời bạn cùng tu tập trên Vân Đạo.</p>` : '<p>Bạn vừa mở một liên kết mời tu cùng.</p>'}`;
  h += acct.on ? '<p class="muted" role="status">Đang kết nối hai bạn…</p>'
    : '<p class="muted">Giữ hành trình để có chỗ lưu bạn đồng tu; hai bạn sẽ tự kết nối ngay sau đó.</p><div class="row"><button class="btn" data-act="acct-open">Giữ hành trình của tôi</button><button class="ghost" data-act="acct-open" data-v="have">Tôi đã có hành trình</button></div>';
  return h + '<div class="row"><button class="ghost" data-act="dt-close">← Quay lại</button></div>';
}

/** Một dòng ở Cổng Vân Môn: bao nhiêu bạn đang ở Vân Đạo, và lối vào danh sách */
export function dtGateLine() {
  if (!dongTu.on) return '';
  const n = L('companions').filter((c) => c.presence && c.presence !== 'vang').length;
  return `<p class="muted">Bạn đồng tu${dongTu.list ? ` (${n} đang ở Vân Đạo)` : ''}. Chế độ cổng được đồng bộ để bạn đồng tu biết có ghé được không.</p><div class="row"><button class="ghost" data-act="dt-open">Bạn đồng tu</button></div>`;
}

// ───────── Thẻ lời mời (lớp phủ trên bảng, luật #139: điện thoại đặt theo --subb) ─────────
function togetherCard({ inv, ph }) {
  const nm = nameOf(other(inv)), what = WHAT[inv.kind] || 'gặp nhau', where = PLACE[inv.place] || '';
  if (ph.phase === 'sap') return `<b>${what[0].toUpperCase() + what.slice(1)} với ${nm}</b><p>${where} · bắt đầu sau ${left(inv.start_at, 'c')}</p><p class="muted">Đến giờ, thời thiền tự bắt đầu cho cả hai.</p>` +
    `<div class="row"><button class="btn" data-act="dt-go" data-id="${esc(inv.id)}">${inv.place === 'dtd' ? 'Vào Đại Thiền Đường' : 'Đến chỗ ngồi'}</button><button class="ghost" data-act="dt-cancel" data-id="${esc(inv.id)}">Hủy</button></div>`;
  return `<b>${nm} đang ${what} với bạn</b><p>${where}</p><div class="row"><button class="btn" data-act="dt-join" data-id="${esc(inv.id)}">Vào ngồi cùng</button><button class="ghost" data-act="dt-hide" data-id="${esc(inv.id)}">Để sau</button></div>`;
}
function incomingCard({ inv }, n) {
  const where = PLACE[inv.place];
  return `<b>${nameOf(inv.from)}</b><p>${esc(LINES[inv.kind])}</p><p class="muted">${where ? where + ' · ' : ''}còn ${left(inv.created_at + INVITE_TTL_MS, 'm')} để trả lời</p>` +
    (D.quietSeen.has(inv.id) ? '<p class="muted">Lời mời đến trong lúc bạn thiền.</p>' : '') +
    `<div class="row"><button class="btn" data-act="dt-yes" data-id="${esc(inv.id)}">Đồng ý</button><button class="btn alt" data-act="dt-no" data-id="${esc(inv.id)}">Để lúc khác</button>${n > 1 ? `<button class="ghost" data-act="dt-open">+${n - 1} lời mời khác</button>` : ''}</div>`;
}
function card(I = invites()) {
  const el = ctx && ctx.cardEl; if (!el) return;
  let key = '', h = '';
  const quiet = ctx.quiet();
  if (dongTu.on && quiet) { for (const x of I.incoming) if (!D.chimed.has(x.inv.id)) D.quietSeen.add(x.inv.id); }
  else if (dongTu.on) {
    const tog = I.together.find((x) => !D.joined.has(x.inv.id) && !D.hide.has(x.inv.id));
    const inc = ctx.viewOpen() ? null : I.incoming.find((x) => !D.hide.has(x.inv.id));
    if (tog) { key = `g${tog.inv.id}:${tog.ph.phase}:${tog.inv.kind}`; h = togetherCard(tog); }
    else if (inc) {
      key = `i${inc.inv.id}:${I.incoming.length}:${D.quietSeen.has(inc.inv.id) ? 'q' : ''}`; h = incomingCard(inc, I.incoming.length);
      if (!D.chimed.has(inc.inv.id)) { D.chimed.add(inc.inv.id); ctx.sfx('gift'); }   // một tiếng ngân nhỏ, chỉ khi không thiền
    }
  }
  if (key !== D.cardKey) { D.cardKey = key; el.innerHTML = h; el.hidden = !h; }
}
/** Cập nhật đếm ngược tại chỗ (không dựng lại thẻ/bảng, để nút đang chọn không mất tiêu điểm) */
function updateLeft() {
  for (const el of document.querySelectorAll('[data-dt-end]')) { const t = fmtLeft(+el.dataset.dtEnd - now(), el.dataset.dtF); if (el.textContent !== t) el.textContent = t; }
}

// ───────── Nhịp mỗi giây: hiện diện, bắt đầu cùng giờ, tải lại danh sách khi đang chờ ─────────
function tick() {
  if (!ctx) return;
  setPresence(ctx.presence());
  if (!dongTu.on) { card(); return; }
  // Liên kết mời đã gửi mà sau 15 giây chưa thấy người mời trong danh sách: mô-đun mạng đã xóa mã (mã hỏng, hết lượt, mã của mình)
  // thì báo; còn mã (lỗi tạm) thì chờ tiếp
  if (D.pend && D.pend.on && dongTu.list && Date.now() - D.pend.at > 15_000) {
    if (inviteFromHash(location.hash)) D.pend.at = Date.now();
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
  // Danh sách tự tải lại: 10 giây khi đang chờ bạn trả lời hoặc sắp bắt đầu, 30 giây khi màn đang mở (hợp đồng §5)
  const wait = I.outgoing.length || I.together.some((x) => x.ph.phase === 'sap'), gap = wait ? 10_000 : ctx.viewOpen() ? 30_000 : 0;
  if (gap && Date.now() - D.lastLoad > gap) { D.lastLoad = Date.now(); void loadCompanions().catch(() => {}); }
  card(I);
  const vk = ['together', 'incoming', 'outgoing'].map((k) => I[k].map((x) => x.inv.id + x.ph.phase).join(',')).join('|');
  if (vk !== D.viewKey) { D.viewKey = vk; if (ctx.viewOpen()) ctx.render(); }
  updateLeft();
}
function start(inv, elapsed) {
  D.joined.add(inv.id);
  ctx.together(inv, Math.max(0, elapsed));
  ctx.toast(`Bắt đầu ${WHAT[inv.kind] || 'thực hành'} với ${plainName(other(inv))}.`);
  card();
}

function changed() {
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
  try { const me = await getMe(); observeDongTuMe(acct.uid, me); D.me = me && me.profile ? me.profile : D.me; } catch { /* giữ bản cũ */ }
  if (D.me && !D.openSynced) syncOpen();
  if (ctx.viewOpen()) ctx.render();
}
async function loadBlocks() {
  try { const r = await listBlocks(); D.blocks = (r && r.blocks) || []; } catch (e) { D.blocks = []; D.err = human(e); }
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
  if (!dongTu.on) return;
  try {
    if (!D.me) { const me = await getMe(); D.me = me && me.profile; }
    const r = await pushSocialPrefs({ ...prefs(), open });
    if (r && r.profile) D.me = r.profile;
  } catch { ctx.toast('Chưa đồng bộ được chế độ cổng. Hãy thử lại khi có mạng.'); D.openSynced = false; }
}

async function run(label, fn, fromCard = false) {
  D.busy = label; D.err = ''; D.msg = ''; if (ctx.viewOpen()) ctx.render();
  try { await fn(); } catch (e) { const m = human(e); if (fromCard || !ctx.viewOpen()) ctx.toast(m); else D.err = m; }
  D.busy = ''; card(); if (ctx.viewOpen()) ctx.render();
}
function open(tab) {
  D.tab = tab; D.err = ''; D.msg = ''; D.arm = '';
  ctx.show();
  if (tab === 'list') { D.lastLoad = Date.now(); void loadCompanions().catch(() => {}); void loadMe(); }
  if (tab === 'moi' && (!D.link || D.link.expires_at <= Date.now() || D.link.uses_left <= 0)) run('Đang tạo mã mời', async () => { D.link = await createLink(false); });
  if (tab === 'tim' || tab === 'rieng') void loadMe();
  if (tab === 'rieng') { D.blocks = null; void loadBlocks(); }
}
export const dtOpen = () => open('list');
const findInv = (id) => L('invites').find((x) => x && x.id === id);

export function dtAct(act, b) {
  const id = b.dataset.id;
  if (act !== 'renew' && act !== 'remove' && act !== 'block') D.arm = '';
  if (act === 'open') return open('list');
  if (act === 'close') { D.tab = 'list'; return ctx.close(); }
  if (act === 'tab') return open(b.dataset.v);
  if (act === 'ban') { D.sel = id; return open('ban'); }
  if (act === 'link') return run('Đang tạo mã mời', async () => { D.link = await createLink(false); });
  if (act === 'renew') {
    if (D.arm !== 'renew') { D.arm = 'renew'; return ctx.render(); }
    D.arm = ''; return run('Đang tạo mã mới', async () => { D.link = await createLink(true); D.msg = 'Đã tạo mã mới. Mã cũ không dùng được nữa.'; });
  }
  if (act === 'share') return navigator.share({ text: shareText() }).catch(() => {});
  if (act === 'copy') return run('Đang chép', async () => { await navigator.clipboard.writeText(shareText()); D.msg = 'Đã chép lời mời.'; });
  if (act === 'find') {
    const el = document.getElementById('dtFind'); if (el) D.q = el.value.trim();
    const f = parseFriendQuery(D.q);
    if (!f) { D.msg = ''; D.err = 'Hãy gõ đúng dạng Tịnh danh · mã, ví dụ Tuệ Thái · 5696.'; return ctx.render(); }
    return run('Đang gửi', async () => { await requestByName(`${f.tinh_danh} · ${f.tag}`); D.q = ''; D.msg = `Đã gửi lời kết nối tới ${f.tinh_danh} · ${f.tag}. Khi người ấy đồng ý, hai bạn sẽ thấy nhau trong danh sách.`; });
  }
  if (act === 'req-yes' || act === 'req-no') return run('Đang trả lời', async () => { await respondRequest(id, act === 'req-yes'); D.msg = act === 'req-yes' ? 'Đã kết nối đồng tu.' : 'Đã bỏ qua lời kết nối.'; });
  if (act === 'withdraw') return run('Đang rút lại', async () => { await withdrawRequest(id); });
  if (act === 'meet') return run('Đang gửi lời mời', async () => { const r = await meet(id, b.dataset.k, b.dataset.p || null); D.lastLoad = Date.now(); D.msg = 'Đã gửi lời mời. Lời mời chờ trả lời trong 10 phút.'; D.msgInv = r && r.invite ? r.invite.id : null; });
  if (act === 'yes' || act === 'no') {
    const inv = findInv(id), fromCard = !!b.closest('#dtm');
    return run(act === 'yes' ? 'Đang nhận lời' : 'Đang trả lời', async () => {
      await respondMeet(id, act === 'yes'); D.answered.add(id);   // ẩn ngay, không đợi danh sách tải lại
      if (act === 'yes' && !(inv && MEET_KINDS[inv.kind] && MEET_KINDS[inv.kind].synced)) ctx.toast('Đã nhận lời.');
    }, fromCard);
  }
  if (act === 'cancel') return run('Đang hủy lời mời', async () => { await cancelMeet(id); D.hide.add(id); }, !!b.closest('#dtm'));
  if (act === 'go') { const inv = findInv(id); if (inv) ctx.go(inv); return; }
  if (act === 'join') { const inv = findInv(id); if (inv) start(inv, now() - inv.start_at); return; }
  if (act === 'hide') { D.hide.add(id); return card(); }
  if (act === 'remove' || act === 'block') {
    if (D.arm !== act) { D.arm = act; return ctx.render(); }
    D.arm = ''; const nm = plainName(D.sel), sel = D.sel;
    return run(act === 'block' ? 'Đang chặn' : 'Đang hủy kết nối', async () => {
      if (act === 'block') await block(sel); else await removeCompanion(sel);
      D.tab = 'list'; D.msg = act === 'block' ? `Đã chặn ${nm}.` : `Đã hủy kết nối với ${nm}.`;
    });
  }
  if (act === 'report') return run('Đang gửi báo cáo', async () => { await report(D.sel, b.dataset.v); D.tab = 'ban'; D.msg = 'Đã gửi báo cáo. Người kiểm duyệt sẽ xem xét.'; });
  if (act === 'unblock') return run('Đang bỏ chặn', async () => { await unblock(id); const r = await listBlocks(); D.blocks = (r && r.blocks) || []; });
}

/** Ô đánh dấu và ô chữ trong bảng (data-dt) */
export function dtInput(t) {
  const k = t.dataset.dt;
  if (k === 'q') { D.q = t.value; return; }
  if (k === 'than' || k === 'away') { const sel = D.sel; return run('Đang lưu', async () => { await setCompanion(sel, { [k]: t.checked }); }); }
  if (k in prefs()) {
    const next = { ...prefs(), [k]: t.checked };
    return run('Đang lưu', async () => {
      const r = await pushSocialPrefs({ ...next, open: !!ctx.S.open });
      D.me = r && r.profile ? r.profile : { ...D.me, settings: { ...(D.me.settings || {}), dong_tu: next } };
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

// Bảng Hộ Trì và Sự kiện thiện nguyện ở Cổng Vân Môn (T5.2 #195; hợp đồng docs/contracts/ho-tri.md #191/#194; PROJECT_ROADMAP.md §10).
// Không tiền, không điểm, không xếp hạng, không cộng Kusala. Chữ người dùng luôn hiển thị dạng văn bản (esc), không chạy HTML.
// Mã kết bạn không có ở danh sách hay chi tiết: chỉ hiện trong ca nhận giúp đã nhận/xong, cho đúng hai bên (hợp đồng §Nhận giúp).
// Quyền tham gia (18+, điều khoản, ngưỡng hành trình) do máy chủ tính ở /me.community; UI chỉ đọc `allowed` và `reason`.
import { api } from '../net/api.js';
import { acct } from '../net/account.js';
import { esc } from './dom.js';
import { HELP_KINDS, HELP_AREAS, HELP_LIMITS, HO_TRI_REASON_TEXT, HO_TRI_V, checkHelpPost } from '@vandao/shared/ho-tri.js';

const ME_MS = 60_000;
const blankDraft = () => ({ kind: 'can_giup', title: '', body: '', area: '', anonymous: false });
const H = { uid: null, me: null, meAt: 0, meBusy: false, tab: 'bang', kind: '', area: '', list: null, next: null, mine: null, ev: null, evNext: null,
  det: null, matches: null, draft: blankDraft(), reply: '', src: '', adult: false, busy: '', err: '', msg: '', arm: '' };
const C = { render: () => {}, toast: () => {}, show: () => {}, close: () => {}, viewOpen: () => false };
export function htInit(c) { Object.assign(C, c); }

/** Đổi tài khoản: bỏ mọi dữ liệu của người trước */
function follow() {
  const uid = acct.on ? acct.uid : null;
  if (H.uid === uid) return;
  Object.assign(H, { uid, me: null, meAt: 0, list: null, next: null, mine: null, ev: null, evNext: null, det: null, matches: null, draft: blankDraft(), reply: '', src: '', adult: false, busy: '', err: '', msg: '', arm: '' });
}
const same = (uid) => acct.on && acct.uid === uid && H.uid === uid;
const why = (e) => HO_TRI_REASON_TEXT[e && e.code] || (e && e.code === 'offline' ? 'Chưa kết nối được máy chủ.' : 'Chưa làm được. Hãy thử lại sau.');
const redraw = () => { if (C.viewOpen()) C.render(); };

/** /me.community (chỉ dùng khi máy chủ báo đúng phiên bản hợp đồng); tải lại tối đa mỗi phút, hoặc ngay khi force */
function loadMe(force = false) {
  follow();
  if (!acct.on || H.meBusy || (!force && H.meAt && Date.now() - H.meAt < ME_MS)) return Promise.resolve(H.me);
  H.meBusy = true; const uid = H.uid;
  return api('/api/v1/me').then((r) => {
    if (!same(uid)) return;
    const was = JSON.stringify(H.me); H.me = r && r.community && r.community.v === HO_TRI_V ? r.community : null; H.meAt = Date.now();
    if (JSON.stringify(H.me) !== was) C.render();
  }).catch(() => { if (same(uid)) H.meAt = Date.now(); }).finally(() => { H.meBusy = false; });
}
/** Thao tác có trạng thái «đang …»; lỗi hiện bằng câu trong hợp đồng */
async function run(label, fn) {
  if (H.busy) return; const uid = H.uid;
  H.busy = label; H.err = ''; H.msg = ''; redraw();
  try { await fn(); } catch (e) { if (same(uid)) { H.err = why(e); if (e && e.code === 'terms_changed') void loadMe(true); } }
  if (!same(uid)) return;
  H.busy = ''; redraw();
}

// ───────── Dòng ở màn Cổng Vân Môn ─────────
export function htGateLine() {
  follow(); void loadMe();
  const m = H.me; if (!m) return '';
  const n = (Number(m.help_replies) || 0) + (Number(m.help_matches) || 0);
  return '<h3>Bảng Hộ Trì</h3><p class="muted">Cần giúp, có thể giúp, hỏi Pháp, tùy hỷ và sự kiện thiện nguyện. Chỉ giúp bằng lời khuyên, đồng hành, kỹ năng, sức lực; không kêu gọi tiền hay hiện vật cá nhân.</p>' +
    `<div class="row"><button class="btn alt" data-act="ht-open">Mở Bảng Hộ Trì${n ? ` · ${n} mới` : ''}</button></div>`;
}
export function htOpen() { follow(); H.tab = 'bang'; H.det = null; H.err = ''; H.msg = ''; C.show(); void loadMe(true); void loadList(); }

// ───────── Tải dữ liệu ─────────
const qs = (o) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v) p.set(k, v); const s = p.toString(); return s ? '?' + s : ''; };
async function loadList(more = false) {
  const uid = H.uid;
  try {
    const r = await api('/api/v1/help' + qs({ kind: H.kind, area: H.area, cursor: more ? H.next : '' }));
    if (!same(uid)) return;
    H.list = more ? [...(H.list || []), ...(r.items || [])] : r.items || []; H.next = r.next_cursor || null;
  } catch (e) { if (same(uid)) { H.err = why(e); if (!more) H.list = []; } }
  redraw();
}
async function loadMine() { const uid = H.uid; try { const r = await api('/api/v1/help/mine'); if (same(uid)) H.mine = r.items || []; } catch (e) { if (same(uid)) { H.err = why(e); H.mine = []; } } redraw(); }
async function loadEvents(more = false) {
  const uid = H.uid;
  try {
    const r = await api('/api/v1/events' + qs({ cursor: more ? H.evNext : '' }));
    if (!same(uid)) return;
    H.ev = more ? [...(H.ev || []), ...(r.items || [])] : r.items || []; H.evNext = r.next_cursor || null;
  } catch (e) { if (same(uid)) { H.err = why(e); if (!more) H.ev = []; } }
  redraw();
}
const owner = (d) => !!(d && d.actions && (d.actions.can_close || d.actions.can_delete));
async function loadDetail(id) {
  const uid = H.uid, p = '/api/v1/help/' + encodeURIComponent(id);
  const d = await api(p); if (!same(uid)) return;
  H.det = d; H.matches = null;
  if (owner(d) && d.item.kind === 'can_giup') { const m = await api(p + '/matches').catch(() => ({ items: [] })); if (same(uid)) H.matches = m.items || []; }
  // chủ bài đã xem các lời trả lời đang hiện: số mới ở Cổng Vân Môn trừ đi (máy chủ giữ mốc chỉ tăng)
  const last = Math.max(0, ...(d.replies || []).map((r) => Number(r.created_at) || 0));
  if (owner(d) && last) void api(p + '/replies/seen', { method: 'POST', body: { until: last } }).then(() => loadMe(true)).catch(() => {});
}

// ───────── Hiển thị ─────────
const rw = (...b) => `<div class="row">${b.filter(Boolean).join('')}</div>`;
const off = () => (H.busy ? ' disabled' : '');
const bt = (act, label, cls = 'btn alt', extra = '') => `<button class="${cls}" data-act="ht-${act}"${extra}${off()}>${esc(label)}</button>`;
const status = () => (H.busy ? `<p class="muted" role="status">${esc(H.busy)}…</p>` : '') + (H.err ? `<p class="note" role="alert">${esc(H.err)}</p>` : '') + (H.msg ? `<p class="muted" role="status">${esc(H.msg)}</p>` : '');
const when = (t) => { const d = new Date(Number(t)); return `${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const area = (a) => (a ? HELP_AREAS[a] || '' : '');
const who = (a) => (a && a.tinh_danh ? esc(a.tinh_danh) : 'Ẩn danh');
const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
const areaOpts = (cur, none) => opt('', none, cur) + Object.entries(HELP_AREAS).map(([k, v]) => opt(k, v, cur)).join('');
const STATUS = { cho_duyet: 'Đang chờ duyệt', hien: 'Đang hiện', an: 'Đã ẩn', dong: 'Đã đóng' };

/** Chưa được tham gia: xác nhận 18+ và điều khoản đúng phiên bản, hoặc chờ ngưỡng hành trình (máy chủ quyết) */
function gate(m) {
  if (m.allowed) return '';
  if (m.reason === 'need_gate') return `<p class="note">${esc(HO_TRI_REASON_TEXT.need_gate)} Bạn vẫn đọc được bảng.</p>`;
  const again = m.accepted_version && m.accepted_version !== m.terms_version;
  return `<div class="dtf"><p>${esc(again ? HO_TRI_REASON_TEXT.terms_changed : HO_TRI_REASON_TEXT.need_adult_confirmation)}</p>` +
    `<p class="muted">Bảng Hộ Trì dành cho người từ 18 tuổi. Không đăng số điện thoại hay địa chỉ chi tiết; khu vực chỉ tới tỉnh, thành phố; gặp nhau ở nơi công cộng.</p>` +
    (m.terms_url ? `<p><a href="${esc(m.terms_url)}" target="_blank" rel="noopener">Đọc điều khoản cộng đồng (bản ${esc(m.terms_version)})</a></p>` : '') +
    `<label class="chk"><input type="checkbox" data-ht="adult"${H.adult ? ' checked' : ''}> Tôi đủ 18 tuổi và đồng ý điều khoản cộng đồng</label>` +
    rw(bt('consent', 'Xác nhận', 'btn', H.adult ? '' : ' disabled')) + '</div>';
}
function row(it, mine) {
  const meta = [HELP_KINDS[it.kind], area(it.area), who(it.author), when(it.created_at), it.replies ? `${it.replies} trả lời` : '', it.match === 'da_co_nguoi_nhan' ? 'đã có người nhận' : ''].filter(Boolean).join(' · ');
  const st = mine ? `<span class="hts">${esc(STATUS[it.status] || '')}${it.status === 'an' && it.hidden_reason ? ': ' + esc(HO_TRI_REASON_TEXT[it.hidden_reason] || '') : ''}</span>` : '';
  return `<div class="dtf"><button class="dtn" data-act="ht-xem" data-id="${esc(it.id)}"><b>${esc(it.title)}</b><span>${meta}</span></button>${st}</div>`;
}
function boardView() {
  const kinds = opt('', 'Mọi loại bài', H.kind) + Object.entries(HELP_KINDS).map(([k, v]) => opt(k, v, H.kind)).join('');
  return `<div class="row"><select data-ht="kind" aria-label="Loại bài">${kinds}</select><select data-ht="area" aria-label="Khu vực">${areaOpts(H.area, 'Mọi khu vực')}</select></div>` +
    (H.list === null ? '<p class="muted">Đang tải bảng…</p>' : H.list.length ? H.list.map((it) => row(it)).join('') : '<p class="muted">Chưa có bài nào ở đây.</p>') +
    (H.next ? rw(bt('more', 'Xem thêm', 'ghost')) : '');
}
function mineView() {
  return H.mine === null ? '<p class="muted">Đang tải…</p>' : H.mine.length ? H.mine.map((it) => row(it, true)).join('') : '<p class="muted">Bạn chưa đăng bài nào.</p>';
}
function writeView(m) {
  if (!m.allowed) return '';
  const D = H.draft, L = HELP_LIMITS;
  return `<label class="fl">Loại bài</label><select data-ht="dkind">${Object.entries(HELP_KINDS).map(([k, v]) => opt(k, v, D.kind)).join('')}</select>` +
    `<label class="fl">Tiêu đề (${L.titleMin}–${L.titleMax} ký tự)</label><input type="text" data-ht="title" maxlength="${L.titleMax}" value="${esc(D.title)}">` +
    `<label class="fl">Nội dung (tối đa ${L.bodyMax} ký tự)</label><textarea data-ht="body" maxlength="${L.bodyMax}" rows="5">${esc(D.body)}</textarea>` +
    `<label class="fl">Khu vực</label><select data-ht="darea">${areaOpts(D.area, 'Không ghi khu vực')}</select>` +
    `<label class="chk"><input type="checkbox" data-ht="anon"${D.anonymous ? ' checked' : ''}> Đăng ẩn danh</label>` +
    '<p class="muted">Cần giúp chỉ là giúp không bằng tiền: lời khuyên, đồng hành, kỹ năng, sức lực. Không đăng số điện thoại, địa chỉ chi tiết hay lời kêu gọi tiền, hiện vật cá nhân. Bài của tài khoản mới và bài cần xem kỹ sẽ chờ người duyệt trước khi hiện.</p>' +
    rw(bt('post', 'Gửi bài', 'btn'));
}
function eventsView(m) {
  if (H.ev === null) return '<p class="muted">Đang tải sự kiện…</p>';
  if (!H.ev.length) return '<p class="muted">Chưa có sự kiện thiện nguyện nào đang mở.</p>';
  return H.ev.map((e) => {
    const org = e.organizer || {}, left = Number.isFinite(e.capacity) ? Math.max(0, e.capacity - (e.rsvp_count || 0)) : null;
    const btn = !m.allowed ? '' : e.my === 'dang_ky' ? bt('rsvp', 'Hủy đăng ký', 'ghost', ` data-id="${esc(e.id)}" data-v="huy"`) : bt('rsvp', 'Đăng ký tham gia', 'btn alt', ` data-id="${esc(e.id)}" data-v="dang_ky"`);
    return `<div class="dtf" data-ev="${esc(e.id)}"><b>${esc(e.title)}</b><p class="muted">${esc(org.name || '')}${org.verified ? (org.kind === 'group' ? ' · nhóm đồng tu' : ' · đối tác đã xác minh') : ''}</p>` +
      `<p>${esc(e.place || '')}${e.place && area(e.area) ? ' · ' : ''}${esc(area(e.area))} · ${when(e.starts_at)} – ${when(e.ends_at)}</p>` + (e.description ? `<p class="htb">${esc(e.description)}</p>` : '') +
      `<p class="muted">${e.rsvp_count || 0} người đã đăng ký${left === null ? '' : ` · còn ${left} chỗ`}${e.my === 'dang_ky' ? ' · bạn đã đăng ký' : ''}</p>${btn}</div>`;
  }).join('') + (H.evNext ? rw(bt('evmore', 'Xem thêm', 'ghost')) : '');
}
const DONE = 'Hai bên đã xác nhận giúp xong. Nếu muốn, bạn tự ghi việc này là việc Thiện (phục vụ) của hôm nay ở Bảng nhiệm vụ; ứng dụng không tự cộng điểm.';
/** Một ca nhận giúp nhìn từ phía mình: chủ bài (mine = false: ca của người giúp) */
function caseLine(c, asOwner) {
  const o = c.other, name = o && o.tinh_danh ? esc(o.tinh_danh) : 'chủ bài', id = ` data-id="${esc(c.id)}"`;
  const tag = o && o.tag ? ` <span class="dtid">mã ${esc(o.tag)}</span>` : '';
  if (c.state === 'de_nghi') return asOwner ? `<div class="dtf"><b>${name}</b> đề nghị giúp${rw(bt('match', 'Nhận người này giúp', 'btn alt', id + ' data-a="nhan"'))}</div>`
    : `<p class="muted">Bạn đã đề nghị giúp · chờ chủ bài nhận.</p>${rw(bt('match', 'Rút đề nghị', 'ghost', id + ' data-a="huy"'))}`;
  if (c.state === 'nhan') {
    const head = asOwner ? `Bạn đã nhận <b>${name}</b>${tag} giúp.` : `Chủ bài${o && o.tinh_danh ? ' <b>' + name + '</b>' + tag : ''} đã nhận bạn giúp.`;
    const done = c.me_done ? `<p class="muted">Bạn đã xác nhận xong · chờ ${asOwner ? 'người giúp' : 'chủ bài'} xác nhận.</p>` : rw(bt('match', 'Đã giúp xong', 'btn alt', id + ' data-a="xong"'));
    return `<div class="dtf"><p>${head}</p>${done}${rw(bt('match', 'Hủy', 'ghost', id + ' data-a="huy"'))}</div>`;
  }
  if (c.state === 'xong') return `<div class="dtf"><p>Đã giúp xong cùng <b>${name}</b>${tag}.</p><p class="muted">${esc(DONE)}</p>${rw('<button class="ghost" data-act="board">Mở Bảng nhiệm vụ</button>')}</div>`;
  return '';
}
function matchBlock(d, m) {
  if (d.item.kind !== 'can_giup') return '';
  if (owner(d)) {
    const L = (H.matches || []).filter((c) => c.state !== 'huy');
    return '<h3>Nhận giúp</h3>' + (H.matches === null ? '<p class="muted">Đang tải…</p>' : L.length ? L.map((c) => caseLine(c, true)).join('') + (L.some((c) => c.state === 'de_nghi') ? '<p class="muted">Khi bạn nhận, Tịnh danh và mã kết bạn của bạn chỉ hiện riêng cho người được nhận.</p>' : '') : '<p class="muted">Chưa có ai đề nghị giúp.</p>');
  }
  const c = d.my_match && d.my_match.state !== 'huy' ? d.my_match : null;
  if (c) return '<h3>Nhận giúp</h3>' + caseLine(c, false);
  return d.actions.can_match && m.allowed ? '<h3>Nhận giúp</h3>' + rw(bt('match', 'Đề nghị giúp', 'btn alt', ' data-a="de_nghi"')) : '';
}
function detailView(m) {
  const d = H.det, it = d.item, a = d.actions || {}, phap = it.kind === 'hoi_phap';
  const replies = (d.replies || []).map((r) => `<div class="dtf"><p class="htb">${esc(r.body)}</p>${r.source_ref ? `<p class="muted">Nguồn: ${esc(r.source_ref)}</p>` : ''}` +
    `<p class="muted">${who(r.author)} · ${when(r.created_at)}${r.status && r.status !== 'hien' ? ' · ' + esc(STATUS[r.status] || r.status) : ''}</p>` +
    rw(bt('report', 'Báo cáo', 'ghost', ` data-t="reply" data-id="${esc(r.id)}"`), r.can_delete ? bt('delr', H.arm === 'r' + r.id ? 'Bấm lần nữa để xóa' : 'Xóa lời của tôi', 'ghost', ` data-id="${esc(r.id)}"`) : '') + '</div>').join('');
  const form = a.can_reply && m.allowed ? `<label class="fl">Trả lời (tối đa ${HELP_LIMITS.replyMax} ký tự)</label><textarea data-ht="reply" maxlength="${HELP_LIMITS.replyMax}" rows="3">${esc(H.reply)}</textarea>` +
    (phap ? `<label class="fl">Nguồn tham khảo (bắt buộc với Hỏi Pháp)</label><input type="text" data-ht="src" maxlength="${HELP_LIMITS.sourceRefMax || 240}" value="${esc(H.src)}" placeholder="Ví dụ: MN 10 — Kinh Niệm Xứ">` : '') + rw(bt('reply', 'Gửi trả lời', 'btn'))
    : phap && !m.guide ? '<p class="muted">Lời trả lời Hỏi Pháp do người hướng dẫn viết, luôn kèm nguồn tham khảo.</p>' : '';
  const own = [a.can_close ? bt('closepost', H.arm === 'closepost' ? 'Bấm lần nữa để đóng bài' : 'Đóng bài', 'ghost') : '', a.can_delete ? bt('del', H.arm === 'del' ? 'Bấm lần nữa để xóa bài' : 'Xóa bài', 'ghost') : ''];
  return `<p class="pali">${esc(HELP_KINDS[it.kind] || '')}${area(it.area) ? ' · ' + esc(area(it.area)) : ''} · ${who(it.author)} · ${when(it.created_at)}</p><h3>${esc(it.title)}</h3><p class="htb">${esc(it.body)}</p>` +
    matchBlock(d, m) + `<h3>Trả lời (${(d.replies || []).length})</h3>` + (replies || '<p class="muted">Chưa có lời trả lời.</p>') + form +
    rw(a.can_report ? bt('report', 'Báo cáo bài', 'ghost', ` data-t="post" data-id="${esc(it.id)}"`) : '', a.can_block ? bt('block', H.arm === 'block' ? 'Bấm lần nữa để chặn' : 'Chặn người đăng', 'ghost', ` data-t="post" data-id="${esc(it.id)}"`) : '', ...own) +
    rw(bt('tab', '← Bảng', 'ghost', ' data-v="bang"'));
}
const TABS = [['bang', 'Bảng'], ['sk', 'Sự kiện'], ['mine', 'Bài của tôi'], ['viet', 'Viết bài']];
export function htView() {
  follow();
  const m = H.me;
  if (!m) return `<h2>Bảng Hộ Trì</h2><p class="muted">${acct.on ? 'Đang tải…' : 'Hãy Giữ hành trình (tài khoản) để vào Bảng Hộ Trì.'}</p>${rw(bt('close', '← Cổng Vân Môn', 'ghost'))}`;
  const tabs = rw(...TABS.filter(([k]) => k !== 'viet' || m.allowed).map(([k, label]) => bt('tab', label, H.tab === k && !H.det ? 'btn' : 'ghost', ` data-v="${k}"`)));
  const body = H.det ? detailView(m) : H.tab === 'sk' ? eventsView(m) : H.tab === 'mine' ? mineView() : H.tab === 'viet' ? writeView(m) : boardView();
  return `<h2>Bảng Hộ Trì</h2><p class="pali">Cổng Vân Môn · nơi nâng đỡ nhau</p>${gate(m)}${tabs}${status()}${body}${rw(bt('close', '← Cổng Vân Môn', 'ghost'))}`;
}

// ───────── Thao tác ─────────
export function htInput(t) {
  follow();
  const k = t.dataset.ht, v = t.type === 'checkbox' ? t.checked : t.value;
  if (k === 'kind' || k === 'area') { H[k] = v; H.list = null; H.next = null; C.render(); void loadList(); return; }
  if (k === 'adult') { H.adult = !!v; C.render(); return; }
  if (k === 'dkind') H.draft.kind = v; else if (k === 'title') H.draft.title = v; else if (k === 'body') H.draft.body = v;
  else if (k === 'darea') H.draft.area = v; else if (k === 'anon') H.draft.anonymous = !!v; else if (k === 'reply') H.reply = v; else if (k === 'src') H.src = v;
}
export function htAct(act, b) {
  follow();
  const id = b && b.dataset ? b.dataset.id : undefined, m = H.me;
  if (!['closepost', 'del', 'delr', 'block'].includes(act)) H.arm = '';
  if (act === 'open') return htOpen();
  if (act === 'close') { H.det = null; return C.close(); }
  if (act === 'tab') {
    H.tab = b.dataset.v; H.det = null; H.err = ''; H.msg = ''; C.render();
    if (H.tab === 'bang') void loadList(); else if (H.tab === 'mine') void loadMine(); else if (H.tab === 'sk') void loadEvents();
    return;
  }
  if (act === 'more') return void loadList(true);
  if (act === 'evmore') return void loadEvents(true);
  if (act === 'xem') return run('Đang mở bài', () => loadDetail(id));
  if (!m) return;
  if (act === 'consent') {
    return run('Đang ghi xác nhận', async () => {
      const r = await api('/api/v1/community/consent', { method: 'POST', body: { adult_confirmed: true, terms_version: m.terms_version } });
      if (r && r.community) { H.me = r.community; H.meAt = Date.now(); } H.adult = false; H.msg = 'Đã ghi xác nhận. Cảm ơn bạn.';
    });
  }
  if (act === 'post') {
    const D = H.draft, c = checkHelpPost({ kind: D.kind, title: D.title, body: D.body, area: D.area || null, anonymous: !!D.anonymous });
    if (!c.ok) { H.err = HO_TRI_REASON_TEXT[c.code] || HO_TRI_REASON_TEXT.invalid_payload; H.msg = ''; return C.render(); }
    return run('Đang gửi bài', async () => {
      const r = await api('/api/v1/help', { method: 'POST', body: c.post });
      H.draft = blankDraft(); H.tab = 'mine'; H.mine = null; void loadMine();
      H.msg = r && r.item && r.item.status === 'hien' ? 'Đã đăng lên Bảng Hộ Trì.' : 'Đã gửi. Bài đang chờ duyệt trước khi hiện trên bảng.';
    });
  }
  if (act === 'rsvp') {
    return run('Đang ghi', async () => {
      const r = await api('/api/v1/events/' + encodeURIComponent(id) + '/rsvp', { method: 'POST', body: { state: b.dataset.v } });
      const e = (H.ev || []).find((x) => x.id === id); if (e && r) { e.my = r.state === 'dang_ky' ? 'dang_ky' : 'huy'; if (Number.isFinite(r.rsvp_count)) e.rsvp_count = r.rsvp_count; }
      H.msg = r && r.state === 'dang_ky' ? 'Đã đăng ký tham gia.' : 'Đã hủy đăng ký.';
    });
  }
  const d = H.det; if (!d) return;
  const p = '/api/v1/help/' + encodeURIComponent(d.item.id);
  if (act === 'reply') {
    const body = H.reply.normalize('NFC').trim(), src = H.src.normalize('NFC').trim();
    if (!body || [...body].length > HELP_LIMITS.replyMax) { H.err = HO_TRI_REASON_TEXT.invalid_reply; return C.render(); }
    if (d.item.kind === 'hoi_phap' && !src) { H.err = HO_TRI_REASON_TEXT.source_required; return C.render(); }
    return run('Đang gửi trả lời', async () => {
      const r = await api(p + '/reply', { method: 'POST', body: d.item.kind === 'hoi_phap' ? { body, source_ref: src } : { body } });
      H.reply = ''; H.src = ''; await loadDetail(d.item.id);
      H.msg = r && r.reply && r.reply.status === 'cho_duyet' ? 'Đã gửi. Lời trả lời đang chờ duyệt.' : 'Đã gửi lời trả lời.';
    });
  }
  if (act === 'report') return run('Đang gửi báo cáo', async () => { await api('/api/v1/help/reports', { method: 'POST', body: { target_type: b.dataset.t, target_id: id } }); H.msg = 'Đã gửi báo cáo. Người kiểm duyệt sẽ xem; người bị báo cáo không được báo.'; });
  if (act === 'block') {
    if (H.arm !== 'block') { H.arm = 'block'; return C.render(); }
    H.arm = ''; return run('Đang chặn', async () => { await api('/api/v1/help/blocks', { method: 'POST', body: { target_type: b.dataset.t, target_id: id } }); H.det = null; H.tab = 'bang'; await loadList(); H.msg = 'Đã chặn. Bạn và người ấy không còn thấy nội dung của nhau.'; });
  }
  if (act === 'closepost' || act === 'del' || act === 'delr') return htOwn(act, b);
  if (act === 'match') {
    const a = b.dataset.a;
    return run('Đang ghi', async () => {
      await api(p + '/match', { method: 'POST', body: a === 'de_nghi' ? { action: a } : { action: a, match_id: id } });
      await loadDetail(d.item.id);
      H.msg = a === 'de_nghi' ? 'Đã gửi đề nghị giúp.' : a === 'nhan' ? 'Đã nhận. Hai bạn thấy Tịnh danh và mã kết bạn của nhau trong ca này.' : a === 'xong' ? 'Đã ghi xác nhận của bạn.' : 'Đã hủy.';
    });
  }
}
/** Đóng bài, xóa bài hoặc lời trả lời của mình: bấm hai lần mới làm */
function htOwn(act, b) {
  follow();
  const d = H.det; if (!d) return;
  const p = '/api/v1/help/' + encodeURIComponent(d.item.id), key = act === 'delr' ? 'r' + b.dataset.id : act;
  if (H.arm !== key) { H.arm = key; return C.render(); }
  H.arm = '';
  if (act === 'closepost') return run('Đang đóng bài', async () => { await api(p + '/close', { method: 'POST', body: {} }); await loadDetail(d.item.id); H.msg = 'Đã đóng bài. Ca đã nhận vẫn xác nhận xong được.'; });
  if (act === 'del') return run('Đang xóa bài', async () => { await api(p, { method: 'DELETE' }); H.det = null; H.tab = 'mine'; H.mine = null; void loadMine(); H.msg = 'Đã xóa bài.'; });
  if (act === 'delr') return run('Đang xóa', async () => { await api('/api/v1/help/replies/' + encodeURIComponent(b.dataset.id), { method: 'DELETE' }); await loadDetail(d.item.id); H.msg = 'Đã xóa lời trả lời.'; });
}

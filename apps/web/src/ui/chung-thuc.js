// Chứng thực cuối tuần (#104, roadmap §9.4; hợp đồng docs/contracts/practice-gd3.md «Chứng thực cuối tuần», API #146 của Codex).
// Ngày cuối mỗi tuần hành trình (7, 14, …, 49) chủ có thể mời một người thân hay bạn đồng tu xác nhận điều họ thấy mình thực hành.
// Hoàn toàn tùy chọn: không cộng điểm, không ảnh hưởng mở tầng, không xếp hạng.
// Mã mời nằm trong fragment `#attest=` của liên kết. Script đầu <head> (index.template.html) đọc mã vào window.__vdAttest rồi xóa khỏi URL
// trước mọi beacon số liệu; ở đây mã chỉ nằm trong bộ nhớ và gửi qua `Authorization: Bearer`, không bao giờ nằm trong URL hay log.
// Trên máy chỉ giữ op_id theo (tài khoản, chu kỳ, tuần) để mở lại đúng liên kết đang hiệu lực, và SHA-256 của mã đã tạo để nhận ra
// khi chủ mở nhầm liên kết của chính mình. Không giữ mã.
import { esc } from './dom.js';
import { acct } from '../net/account.js';
import { api } from '../net/api.js';

const KEY = 'vandao.attest.v1', MAX = 300;
const LABELS = [['nguoi_than', 'Người thân'], ['dong_tu', 'Bạn đồng tu'], ['ban_be', 'Bạn bè']];
const LINES = ['Tôi thấy bạn giữ lời và nói năng nhẹ nhàng hơn trong tuần qua.', 'Tôi thấy bạn dành thời gian ngồi yên, lắng nghe nhiều hơn.', 'Tôi thấy bạn quan tâm và giúp đỡ người quanh mình.'];
const ERR = {
  attest_week_not_due: 'Chỉ mời được vào ngày cuối tuần hành trình (ngày 7, 14, …, 49). Ngày trên máy chủ có thể khác máy này: hãy đồng bộ rồi thử lại.',
  attest_already_invited: 'Tuần này đã có lời mời chứng thực từ một thiết bị khác.',
  journey_not_found: 'Máy chủ chưa có hành trình của bạn. Hãy giữ hành trình trước.',
  attest_unavailable: 'Chứng thực chưa sẵn sàng trên máy chủ.',
  attest_not_found: 'Liên kết chứng thực không còn hiệu lực: đã dùng, đã hết hạn hoặc thuộc chu kỳ trước.',
  invalid_attestation: 'Nội dung chưa hợp lệ.',
  rate_limited: 'Bạn thao tác hơi nhanh. Thử lại sau ít phút.',
  offline: 'Chưa kết nối được máy chủ.',
};
const errText = (code, fallback) => ERR[code] || fallback;
const fmtDay = (t) => { try { return new Date(t).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return ''; } };

let store = {}; try { store = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { store = {}; }
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* chỉ giữ trong bộ nhớ */ } };
const slotKey = (w) => `${acct.uid || 'x'}|${acct.cycle || 0}|${w}`;
const sha = async (s) => { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } };

// C: hàm của main.js; O: phía chủ (liên kết vừa tạo trong phiên, lỗi); A: phía người nhận liên kết
const C = { render: () => {}, toast: () => {}, show: () => {} };
const O = { link: {}, err: '', busy: false };
const A = { code: null, info: null, err: '', own: false, busy: false, done: null, label: null, line: -1, note: '' };

/** Tuần vừa trọn hôm nay (ngày 7k của hành trình) — chỉ ngày này mới mời được (khóa một nấc mỗi ngày nên ngày không tự tăng) */
export const atWeek = (S) => (S && !S.completed && S.day && S.day % 7 === 0 ? S.day / 7 : 0);

/**
 * Gắn với main.js: render, toast, show (mở màn chứng thực). Nhận mã từ script đầu trang nếu có (rồi xóa khỏi window) và tải thông tin.
 * Trả true khi trang được mở bằng một liên kết chứng thực.
 */
export function atInit(c) {
  Object.assign(C, c);
  const w = typeof window !== 'undefined' ? window : {}, code = typeof w.__vdAttest === 'string' && /^[A-Za-z0-9_-]{43}$/.test(w.__vdAttest) ? w.__vdAttest : null;
  w.__vdAttest = null;
  if (!code) return false;
  A.code = code; C.show(); void loadLink();
  return true;
}

// ───────── Phía chủ: kết quả các tuần (GET /api/v1/attest của #146, chỉ của chính mình, chu kỳ hiện tại) ─────────
// Máy chủ chưa có route (404) thì im lặng. Tải lại tối đa mỗi phút khi Bia mở, và ngay sau khi tạo lời mời.
const R = { uid: null, at: 0, busy: false, weeks: null };
function loadResults(force = false) {
  if (R.uid !== acct.uid) { R.uid = acct.uid; R.weeks = null; R.at = 0; }
  if (R.busy || (!force && R.at && Date.now() - R.at < 60_000)) return;
  R.busy = true; const uid = acct.uid;
  api('/api/v1/attest').then((r) => {
    if (acct.uid !== uid) return;
    const w = r && Array.isArray(r.weeks) ? r.weeks : [], changed = JSON.stringify(w) !== JSON.stringify(R.weeks); R.weeks = w; R.at = Date.now(); if (changed) C.render();
  }).catch(() => { if (acct.uid === uid) R.at = Date.now(); }).finally(() => { R.busy = false; });
}
const labelOf = (k) => (LABELS.find(([v]) => v === k) || [])[1] || 'Người được mời';
const ST = {
  cho: (x) => `Đã gửi lời mời, đang chờ${x.expires_at ? ' (hết hạn ngày ' + fmtDay(x.expires_at) + ')' : ''}.`,
  da_xac_nhan: (x) => `${labelOf(x.attester_label)} đã xác nhận${x.confirmed_at ? ' ngày ' + fmtDay(x.confirmed_at) : ''}.`,
  tu_choi: () => 'Người được mời chọn không xác nhận. Không sao cả: chứng thực chỉ là tùy chọn.',
  het_han: () => 'Lời mời đã hết hạn mà chưa ai dùng.',
};
/** Khối «Chứng thực các tuần» ở Bia: mọi ngày, khi đã có ít nhất một lời mời trong chu kỳ này */
function resultsBlock() {
  const L = (R.weeks || []).filter((x) => x && Number.isInteger(x.week) && ST[x.status]);
  if (!L.length) return '';
  return '<div class="note at"><p><b>Chứng thực các tuần</b> · chỉ bạn thấy; không cộng điểm, không ảnh hưởng mở tầng.</p>' +
    L.map((x) => `<p data-at-week="${x.week}">Tuần ${x.week}: ${esc(ST[x.status](x))}${x.status === 'da_xac_nhan' && x.note ? `<br><span class="muted">«${esc(x.note)}»</span>` : ''}</p>`).join('') + '</div>';
}

// ───────── Phía chủ: thẻ ở Bia Tích Lũy ─────────
/** Thẻ «Chứng thực tuần N» ở Bia vào ngày cuối tuần; cần phiên máy chủ (tài khoản hoặc khách đã giữ hành trình) */
export function atCard(S) {
  if (!acct.available || !acct.on) return '';
  loadResults();
  const w = atWeek(S); if (!w) return resultsBlock();
  const s = store[slotKey(w)], url = O.link[w], live = s && s.exp > Date.now();
  let h = `<div class="note at"><p><b>Chứng thực tuần ${w}</b> · tùy chọn. Mời một người thân hay bạn đồng tu xác nhận điều họ thấy bạn thực hành trong tuần. Không cộng điểm, không ảnh hưởng việc mở tầng.</p>`;
  if (url) {
    h += `<p class="muted">Gửi liên kết này cho một người. Liên kết dùng một lần, hết hạn ngày ${esc(fmtDay(s.exp))}.</p><input class="at-url" readonly value="${esc(url)}" aria-label="Liên kết chứng thực tuần ${w}">` +
      `<div class="row"><button class="btn alt" data-act="at-copy" data-w="${w}">Sao chép</button>${typeof navigator !== 'undefined' && navigator.share ? `<button class="btn alt" data-act="at-share" data-w="${w}">Chia sẻ</button>` : ''}<button class="ghost" data-act="at-hide" data-w="${w}">Ẩn liên kết</button></div>`;
  } else if (live) h += `<p class="muted">Đã tạo lời mời tuần ${w}, hiệu lực tới ngày ${esc(fmtDay(s.exp))}.</p><div class="row"><button class="btn alt" data-act="at-invite" data-w="${w}"${O.busy ? ' disabled' : ''}>Mở lại liên kết</button></div>`;
  else h += `<div class="row"><button class="btn alt" data-act="at-invite" data-w="${w}"${O.busy ? ' disabled' : ''}>Tạo liên kết mời</button></div>`;
  return h + (O.err ? `<p class="note warn">${esc(O.err)}</p>` : '') + '</div>' + resultsBlock();
}

async function invite(w) {
  const k = slotKey(w), s = (store[k] = store[k] || { op: crypto.randomUUID() }); keep();
  O.busy = true; O.err = ''; C.render();
  try {
    const r = await api('/api/v1/attest/invite', { method: 'POST', body: { week: w, op_id: s.op } });
    const code = String(r.link || '').replace(/^.*[#&]attest=/, '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(code)) throw Object.assign(new Error('bad link'), { code: 'attest_unavailable' });
    s.exp = r.expires_at; s.h = await sha(code); keep();
    O.link[w] = `${location.origin}/#attest=${code}`; loadResults(true);
  } catch (e) { O.err = errText(e.code, 'Chưa tạo được liên kết. Thử lại sau.'); }
  O.busy = false; C.render();
}

// ───────── Phía người nhận liên kết ─────────
// Gọi /attest/link với mã trong Authorization (không đặt mã trong URL: nhật ký Worker có thể ghi URL); không gửi Referer
const linkCall = (method, body) => fetch('/api/v1/attest/link', {
  method, credentials: 'same-origin', referrerPolicy: 'no-referrer', cache: 'no-store',
  headers: { Authorization: `Bearer ${A.code}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined,
}).then(async (res) => { let d = null; try { d = await res.json(); } catch (e) { /* thân rỗng */ } if (!res.ok) throw Object.assign(new Error('attest'), { code: (d && d.error && d.error.code) || (res.status === 404 ? 'attest_not_found' : 'http_' + res.status) }); return d; },
  (e) => { throw e && e.code ? e : Object.assign(new Error('offline'), { code: 'offline' }); });

async function loadLink() {
  A.err = ''; A.info = null;
  const h = await sha(A.code); A.own = !!h && Object.values(store).some((s) => s && s.h === h);
  if (A.own) { C.render(); return; }
  try { A.info = await linkCall('GET'); } catch (e) { A.err = errText(e.code, 'Chưa mở được liên kết chứng thực.'); }
  C.render();
}

/** Màn người nhận: thông tin tuần, chọn mình là ai, một câu mẫu hoặc vài dòng tùy chọn, xác nhận hoặc không */
export function atView() {
  const back = '<div class="row"><button class="ghost" data-act="at-close">← Vân Đảo</button></div>';
  if (A.own) return '<h2>Chứng thực tuần</h2><p>Đây là liên kết chứng thực bạn đã tạo. Hãy gửi cho người thân hay bạn đồng tu để họ xác nhận; bạn không tự chứng thực cho mình được.</p>' + back;
  if (A.done) return `<h2>Cảm ơn bạn</h2><p>${A.done === 'da_xac_nhan' ? 'Lời xác nhận của bạn đã được gửi tới người mời.' : 'Đã ghi nhận: bạn không xác nhận tuần này.'} Liên kết đã dùng xong và không mở lại được.</p><p class="muted">Vân Đạo là không gian tu tập 3D, thiền tọa và học kinh. Nếu muốn, bạn có thể ở lại dạo Vân Đảo.</p>` + back;
  if (A.err) return `<h2>Chứng thực tuần</h2><p class="note warn">${esc(A.err)}</p>` + back;
  if (!A.info) return '<h2>Chứng thực tuần</h2><p class="muted">Đang mở liên kết…</p>';
  const w = A.info.week, note = A.note;
  return `<h2>Chứng thực tuần ${esc(String(w))}</h2><p>Một người bạn trên Vân Đạo mời bạn xác nhận tuần thực hành thứ ${esc(String(w))} của họ: điều bạn thực sự thấy ngoài đời, không cần hơn. Liên kết dùng một lần, hết hạn ngày ${esc(fmtDay(A.info.expires_at))}.</p>` +
    `<label class="fl">Bạn là</label><div class="seg wrap">${LABELS.map(([v, t]) => `<button data-act="at-label" data-v="${v}" class="${A.label === v ? 'on' : ''}">${t}</button>`).join('')}<button data-act="at-label" data-v="" class="${A.label === null ? 'on' : ''}">Không nói</button></div>` +
    `<label class="fl">Một câu gửi người mời (không bắt buộc)</label><div class="seg wrap col">${LINES.map((t, i) => `<button data-act="at-line" data-i="${i}" class="${A.line === i ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>` +
    `<textarea id="at-note" data-at="" maxlength="${MAX}" placeholder="Hoặc vài dòng của bạn, tối đa ${MAX} ký tự">${esc(note)}</textarea>` +
    `<div class="row"><button class="btn" data-act="at-yes"${A.busy ? ' disabled' : ''}>Xác nhận</button><button class="ghost" data-act="at-no"${A.busy ? ' disabled' : ''}>Không xác nhận</button></div>` +
    '<p class="muted">Lời của bạn chỉ người mời và bạn thấy. Chứng thực không cộng điểm cho ai và không phải là đánh giá.</p>';
}

/** Gõ trong ô ghi chú: giữ chữ (để chọn nhãn hay câu mẫu không làm mất chữ đang gõ) */
export function atInput(t) { if (t.id === 'at-note') { A.note = t.value; A.line = -1; } }

async function answer(accept) {
  const el = typeof document !== 'undefined' && document.getElementById('at-note'); if (el) A.note = el.value;
  const note = accept ? (A.note.normalize('NFC').trim() || (A.line >= 0 ? LINES[A.line] : '')) : '';
  if ([...note].length > MAX) { C.toast(`Lời nhắn tối đa ${MAX} ký tự.`); return; }
  A.busy = true; C.render();
  try { const r = await linkCall('POST', { accept, attester_label: A.label, ...(note ? { note } : {}) }); A.done = (r && r.status) || (accept ? 'da_xac_nhan' : 'tu_choi'); A.code = null; }
  catch (e) { A.err = errText(e.code, 'Chưa gửi được. Thử lại sau.'); if (e.code === 'attest_not_found') A.code = null; }
  A.busy = false; C.render();
}

/** Nút at-*: phía chủ (invite/copy/share/hide) và phía người nhận (label/line/yes/no/close) */
export function atAct(act, el) {
  const w = +(el.dataset.w || 0);
  if (act === 'invite') { if (!O.busy && w) void invite(w); return; }
  if (act === 'copy') { const u = O.link[w]; if (u && navigator.clipboard) navigator.clipboard.writeText(u).then(() => C.toast('Đã sao chép liên kết.'), () => C.toast('Chưa sao chép được; hãy chọn và sao chép liên kết.')); return; }
  if (act === 'share') { const u = O.link[w]; if (u && navigator.share) navigator.share({ title: 'Vân Đạo · chứng thực tuần', text: `Mời bạn xác nhận tuần thực hành thứ ${w} của mình trên Vân Đạo.`, url: u }).catch(() => {}); return; }
  if (act === 'hide') { delete O.link[w]; C.render(); return; }
  if (act === 'label') { A.label = el.dataset.v || null; C.render(); return; }
  if (act === 'line') { const i = +el.dataset.i; A.line = A.line === i ? -1 : i; A.note = ''; C.render(); return; }
  if (act === 'yes' || act === 'no') { if (!A.busy && A.code) void answer(act === 'yes'); return; }
  if (act === 'close') { A.info = null; A.err = ''; A.own = false; C.close && C.close(); }
}

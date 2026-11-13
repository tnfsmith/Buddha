// apps/web/src/ui/account.js
// T2.3 (#12): màn "Giữ hành trình của tôi" / "Tôi đã có hành trình" và trang Tài khoản (PROJECT_ROADMAP.md §6.1, §6.2, §6.4).
// Chỉ dựng HTML cho bảng bên (panel) và xử lý các nút `data-act="acct-…"`; mọi lệnh gọi máy chủ nằm ở net/.
// Không có email hay mật khẩu: passkey, mã khôi phục, hoặc liên kết với máy đang giữ hành trình.
import { esc } from './dom.js';
import { encode } from 'uqr';
import * as api from '../net/api.js';
import { turnstileToken } from '../net/turnstile.js';
import { idbSet } from '../net/idb.js';
import { acct, initAccount, keepJourney, afterSignIn, useSaved, useLocal, signOutHere, markSecured } from '../net/account.js';

const A = { tab: 'main', busy: '', err: '', msg: '', info: null, code: '', link: null, ask: null, conflict: null, arm: '' };
let ctx = null, pollT = 0;

const ERR = {
  offline: 'Không kết nối được máy chủ. Hãy thử lại khi có mạng.', turnstile_failed: 'Chưa xác minh được trình duyệt. Hãy thử lại.',
  rate_limited: 'Thao tác quá nhanh, xin thử lại sau một phút.', invalid_recovery_code: 'Mã khôi phục không đúng.',
  link_expired: 'Mã liên kết đã hết hạn hoặc không đúng.', auth_unavailable: 'Máy chủ chưa sẵn sàng cho việc đăng nhập.', unauthorized: 'Phiên đăng nhập đã hết hạn.',
};
const human = (e) => ERR[e.code] || (e.name === 'NotAllowedError' || e.name === 'AbortError' ? 'Thiết bị chưa xác nhận (bạn đã hủy, hoặc máy không có passkey cho Vân Đạo).' : e.message || 'Có lỗi, xin thử lại.');
const date = (ms) => new Date(ms).toLocaleDateString('vi-VN');
const btn = (act, text, cls = 'btn', extra = '') => `<button class="${cls}" data-act="acct-${act}"${A.busy ? ' disabled' : ''}${extra}>${text}</button>`;
const back = (to = 'home') => (to === 'home' ? '<button class="ghost" data-act="home">← Vân Đảo</button>' : btn('tab', '← Quay lại', 'ghost', ` data-v="${to}"`));
const status = () => (A.busy ? `<p class="muted" role="status">${esc(A.busy)}…</p>` : '') + (A.err ? `<p class="note" role="alert">${esc(A.err)}</p>` : '') + (A.msg ? `<p class="muted" role="status">${esc(A.msg)}</p>` : '');

/** Mã QR dạng SVG (một path), viền trắng 2 ô */
function qr(text) {
  const { data, size } = encode(text, { ecc: 'M', border: 2 }); let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (data[y][x]) d += `M${x} ${y}h1v1h-1z`;
  return `<svg class="qr" viewBox="0 0 ${size} ${size}" width="168" height="168" role="img" aria-label="Mã QR liên kết thiết bị"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#231f1c"/></svg>`;
}

function applyFields(fields, reload) {
  Object.assign(ctx.S, fields); ctx.save();
  if (reload) { try { sessionStorage.setItem('vandao.welcome', '1'); } catch { /* không sao */ } location.reload(); } else ctx.remote();
}
async function run(label, fn) {
  A.busy = label; A.err = ''; A.msg = ''; ctx.render();
  try { await fn(); } catch (e) { A.err = human(e); if (e.code === 'unauthorized' && acct.on && A.tab === 'main') { await signOutHere(); A.info = null; } }
  A.busy = ''; ctx.render();
}
async function loadInfo() {
  if (!acct.on) return;
  const [me, rc, ss, pk] = await Promise.allSettled([api.getMe(), api.recoveryStatus(), api.listSessions(), api.listPasskeys()]);
  if (me.status === 'rejected' && me.reason.code === 'unauthorized') { await signOutHere(); A.info = null; A.err = 'Phiên trên máy này đã hết hạn. Chọn "Tôi đã có hành trình" để đăng nhập lại; dữ liệu trên máy vẫn còn.'; return ctx.render(); }
  const v = (r, d) => (r.status === 'fulfilled' ? r.value : d);
  A.info = { me: v(me, null), code: v(rc, {}), sessions: v(ss, []), passkeys: v(pk, []) };
  if (A.info.me && !A.info.me.user.isAnonymous && acct.guest) markSecured();
  ctx.render();
}
const stopPoll = () => { clearInterval(pollT); pollT = 0; A.link = null; };

async function settle(r, pushedMsg) {
  if (r.mode === 'restore') return applyFields(r.fields, true);
  if (r.mode === 'pushed') { A.tab = 'main'; A.msg = pushedMsg; return loadInfo(); }
  A.conflict = r; A.tab = 'conflict';
}
const finishSignIn = async () => settle(await afterSignIn(ctx.S), 'Đã giữ hành trình trên máy này vào tài khoản.');

// ───────── Dựng HTML ─────────
function mainOff() {
  return `<h2>Giữ hành trình của tôi</h2>
    <p class="muted">Hành trình hiện chỉ nằm trên máy này. Giữ hành trình để khi đổi máy, đổi trình duyệt hay cài lại vẫn còn nguyên Tịnh danh, diện mạo, ngày tu tập và Kusala. Không cần email, không cần mật khẩu.</p>
    <div class="row">${btn('keep', 'Giữ hành trình của tôi')}${btn('tab', 'Tôi đã có hành trình', 'btn alt', ' data-v="have"')}</div>${status()}<div class="row">${back()}</div>`;
}
function mainOn() {
  const S = ctx.S, I = A.info, me = I && I.me, guest = me ? me.user.isAnonymous : acct.guest, vis = me ? me.profile.visibility : '';
  const seg = [['an', 'Ẩn'], ['dong_tu', 'Đồng tu'], ['cong_khai', 'Công khai']].map(([v, t]) => `<button data-act="acct-vis" data-v="${v}" class="${v === vis ? 'on' : ''}">${t}</button>`).join('');
  return `<h2>Tài khoản</h2><p class="pali">Hành trình đang được giữ · ${esc(S.name || 'chưa đặt Tịnh danh')}${me && me.profile.tinh_danh ? ' · ' + esc(me.profile.tag) : ''}</p>` +
    (guest ? `<p class="note">Chưa có cách đăng nhập lại. Hãy gắn passkey hoặc lấy mã khôi phục: nếu mất máy này sẽ không lấy lại được hành trình. Hành trình chưa gắn cách đăng nhập sẽ bị dọn nếu không hoạt động 90 ngày${me && me.guest_purge_after ? ' (hạn hiện tại: ' + date(me.guest_purge_after) + ')' : ''}.</p>` : '') +
    (acct.rejected.length ? `<p class="note">Có ${acct.rejected.length} thao tác máy chủ chưa nhận (thường do lệch ngày giữa máy và máy chủ). Tiến trình trên máy này vẫn giữ nguyên.</p>` : '') + status() +
    `<h3>Cách đăng nhập lại</h3><div class="row">${api.passkeySupported() ? btn('passkey', 'Gắn vân tay / Face ID') : ''}${btn('code', I && I.code.has_code ? 'Tạo mã khôi phục mới' : 'Lấy mã khôi phục', 'btn alt')}</div>
    <p class="muted">${I ? `Passkey đã gắn: ${I.passkeys.length}. Mã khôi phục: ${I.code.has_code ? 'đã tạo ngày ' + date(I.code.created_at) : 'chưa có'}.` : 'Đang tải…'}</p>
    <h3>Thêm thiết bị</h3><p class="muted">Trên máy mới chọn "Tôi đã có hành trình" → "Liên kết với máy đang giữ hành trình", rồi nhập mã hiện ở máy đó vào đây (hoặc dùng máy này quét mã QR).</p>
    <input id="acLink" type="text" maxlength="9" placeholder="XXXX-XXXX" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Mã liên kết"><div class="row">${btn('ask', 'Xem yêu cầu', 'btn alt')}</div>
    <h3>Hiển thị với người khác</h3><div class="seg wrap">${seg}</div>
    <h3>Thiết bị đang đăng nhập</h3><p class="muted">${I ? I.sessions.length + ' phiên đang hoạt động.' : ''}</p><div class="row">${btn('revoke', 'Đăng xuất mọi nơi khác', 'btn alt')}</div>
    <h3>Dữ liệu của tôi</h3><div class="row">${btn('export', 'Xuất dữ liệu', 'btn alt')}${btn('out', A.arm === 'out' ? 'Bấm lần nữa để đăng xuất' : 'Đăng xuất máy này', 'ghost')}${btn('del', A.arm === 'del' ? 'Bấm lần nữa để xóa' : 'Xóa tài khoản', 'ghost')}${btn('undel', 'Hủy yêu cầu xóa', 'ghost')}</div>
    <p class="muted">Đăng xuất không xóa dữ liệu trên máy. Xóa tài khoản có 7 ngày để hủy.</p><div class="row">${back()}</div>`;
}
function have() {
  return `<h2>Tôi đã có hành trình</h2><p class="muted">Chọn cách bạn đã dùng khi giữ hành trình. Tịnh danh, diện mạo, ngày và Kusala sẽ trở lại trên máy này.</p>${status()}` +
    (api.passkeySupported() ? `<div class="row">${btn('in-passkey', 'Vân tay / Face ID (passkey)')}</div>` : '') +
    `<h3>Mã khôi phục</h3><input id="acCode" type="text" maxlength="40" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XX" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Mã khôi phục"><div class="row">${btn('in-code', 'Dùng mã này', 'btn alt')}</div>
    <h3>Liên kết với máy đang giữ hành trình</h3><p class="muted">Dùng khi điện thoại (hoặc máy khác) của bạn đang mở được hành trình.</p><div class="row">${btn('in-link', 'Hiện mã liên kết', 'btn alt')}</div><div id="acTs"></div><div class="row">${back(acct.on ? 'main' : 'main')}</div>`;
}
function link() {
  const L = A.link;
  return `<h2>Liên kết thiết bị</h2><p class="muted">Trên máy đang giữ hành trình: quét mã QR này, hoặc mở Vân Đạo → Tài khoản → Thêm thiết bị và nhập mã. Mã có hiệu lực 2 phút.</p>
    <p class="accode" aria-label="Mã liên kết">${esc(L.code)}</p>${qr(L.qr)}<p class="muted" role="status">Đang chờ máy kia đồng ý…</p>${status()}<div class="row">${btn('tab', 'Hủy', 'ghost', ' data-v="have"')}</div>`;
}
function ask() {
  return `<h2>Thêm thiết bị</h2>${status()}` + (A.ask && A.ask.device
    ? `<p>Thiết bị xin vào hành trình của bạn: <b>${esc(A.ask.device)}</b></p><p class="note">Chỉ đồng ý nếu chính bạn đang mở Vân Đạo trên máy đó. Máy đó sẽ xem và ghi được hành trình của bạn.</p><div class="row">${btn('approve', 'Đồng ý')}${btn('tab', 'Từ chối', 'ghost', ' data-v="main"')}</div>`
    : `<div class="row">${back('main')}</div>`);
}
function code() {
  return `<h2>Mã khôi phục của bạn</h2><p class="accode" id="acShown">${esc(A.code)}</p>
    <p class="note">Chép lại và cất ở nơi an toàn. Mã chỉ hiện một lần; ai có mã này đều vào được hành trình của bạn. Tạo mã mới thì mã cũ hết hiệu lực.</p>${status()}
    <div class="row">${btn('copy', 'Chép mã', 'btn alt')}${btn('code-done', 'Tôi đã cất mã')}</div>`;
}
function conflict() {
  const C = A.conflict, S = ctx.S;
  return `<h2>Chọn hành trình để tiếp tục</h2><p class="muted">Máy này và bản đã lưu đang khác nhau. Bản không chọn vẫn được giữ lại, không mất.</p>${status()}
    <div class="row">${btn('use-saved', `Giữ hành trình đã lưu (ngày ${C.me.journey.day})`)}</div><p class="muted">Hành trình trên máy này được cất thành bản sao lưu trên máy.</p>
    <div class="row">${btn('use-local', `Dùng hành trình trên máy này (ngày ${S.day})`, 'btn alt')}</div><p class="muted">Bản đã lưu thành chu kỳ cũ trong tài khoản.</p>`;
}
export function accountView() {
  if (!acct.available) return `<h2>Giữ hành trình</h2><p class="note">Bản tải về chạy không cần mạng nên không có tài khoản. Mở vandao.ainextbrain.com để giữ hành trình.</p><div class="row">${back()}</div>`;
  if (A.tab === 'link' && A.link) return link();
  if (A.tab === 'ask') return ask();
  if (A.tab === 'code' && A.code) return code();
  if (A.tab === 'conflict' && A.conflict) return conflict();
  if (A.tab === 'have') return have();
  return acct.on ? mainOn() : mainOff();
}
/** Một dòng gợi ý nhẹ (Bia Tích Lũy, bảng Vân Đảo): không chặn, không hiện khi đã giữ */
export const accountHint = () => (!acct.available ? '' : acct.on ? '<button class="ghost" data-act="acct-open">Tài khoản</button>' : '<button class="ghost" data-act="acct-open">Giữ hành trình của tôi</button>');
export const accountOn = () => acct.on;

// ───────── Xử lý nút ─────────
export function accountOpen(tab = 'main') { stopPoll(); A.tab = tab; A.err = ''; A.msg = ''; A.arm = ''; ctx.show(); if (acct.on && tab === 'main') loadInfo(); }
export function accountAct(act, b) {
  const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  if (act !== 'out' && act !== 'del') A.arm = '';
  if (act === 'open') return accountOpen(b.dataset.v || 'main');
  if (act === 'tab') return accountOpen(b.dataset.v);
  if (act === 'keep') return run('Đang giữ hành trình', async () => settle(await keepJourney(ctx.S), 'Đã giữ hành trình. Hãy gắn một cách đăng nhập lại bên dưới.'));
  if (act === 'passkey') return run('Chờ thiết bị xác nhận', async () => { await api.passkeyRegister(ctx.S.name || 'Vân Đạo'); markSecured(); A.msg = 'Đã gắn passkey. Lần sau chọn "Tôi đã có hành trình" → Vân tay / Face ID.'; await loadInfo(); });
  if (act === 'code') return run('Đang tạo mã', async () => { A.code = (await api.generateRecoveryCode()).code; markSecured(); A.tab = 'code'; });
  if (act === 'copy') return run('Đang chép', async () => { await navigator.clipboard.writeText(A.code); A.msg = 'Đã chép mã.'; });
  if (act === 'code-done') { A.code = ''; return accountOpen('main'); }
  if (act === 'in-passkey') return run('Chờ thiết bị xác nhận', async () => { await api.passkeySignIn(); await finishSignIn(); });
  if (act === 'in-code') { const c = val('acCode'); if (c.replace(/[\s-]/g, '').length < 26) { A.err = 'Mã khôi phục có 26 ký tự.'; return ctx.render(); } return run('Đang kiểm tra mã', async () => { await api.signInRecoveryCode(c, await turnstileToken(document.getElementById('acTs'))); await finishSignIn(); }); }
  if (act === 'in-link') return run('Đang tạo mã liên kết', async () => {
    const L = await api.linkStart(await turnstileToken(document.getElementById('acTs'))); A.link = L; A.tab = 'link';
    let asking = false;   // mạng chậm hơn 2 giây thì không hỏi chồng: mã đã duyệt chỉ đổi lấy phiên được một lần
    pollT = setInterval(async () => {
      if (asking) return;
      if (!A.link || Date.now() > L.expires_at) { stopPoll(); A.tab = 'have'; A.err = 'Mã liên kết đã hết hạn. Hãy tạo mã mới.'; return ctx.render(); }
      asking = true;
      try { const r = await api.linkPoll(L.code, L.secret); if (r.status === 'approved') { stopPoll(); await run('Đang tải hành trình', finishSignIn); } } catch (e) { if (e.code !== 'rate_limited' && e.code !== 'offline') { stopPoll(); A.tab = 'have'; A.err = human(e); ctx.render(); } }
      asking = false;
    }, 2000);
  });
  if (act === 'ask') { const c = b.dataset.v || val('acLink'); return run('Đang tìm yêu cầu', async () => { A.ask = { code: c, ...(await api.linkInfo(c)) }; A.tab = 'ask'; }); }
  if (act === 'approve') return run('Đang đồng ý', async () => { const r = await api.linkApprove(A.ask.code); A.ask = null; A.tab = 'main'; A.msg = `Đã đồng ý cho ${r.device}. Máy đó sẽ tự vào hành trình sau vài giây.`; await loadInfo(); });
  if (act === 'vis') return run('Đang lưu', async () => { await api.updateProfile({ visibility: b.dataset.v }); await loadInfo(); });
  if (act === 'revoke') return run('Đang đăng xuất các máy khác', async () => { await api.revokeOtherSessions(); A.msg = 'Đã đăng xuất mọi nơi khác.'; await loadInfo(); });
  if (act === 'export') return run('Đang xuất dữ liệu', async () => {
    const blob = new Blob([JSON.stringify(await api.exportData(), null, 2)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `van-dao-du-lieu-${new Date().toISOString().slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); A.msg = 'Đã tải tệp dữ liệu (tối đa 2 lần mỗi ngày).';
  });
  if (act === 'out') { if (A.arm !== 'out') { A.arm = 'out'; A.msg = acct.guest ? 'Hành trình này chưa có cách đăng nhập lại: đăng xuất rồi sẽ không vào lại được bản đã lưu (dữ liệu trên máy vẫn còn).' : ''; return ctx.render(); } return run('Đang đăng xuất', async () => { await signOutHere(); A.info = null; A.msg = 'Đã đăng xuất máy này. Dữ liệu trên máy vẫn còn.'; }); }
  if (act === 'del') { if (A.arm !== 'del') { A.arm = 'del'; return ctx.render(); } return run('Đang gửi yêu cầu xóa', async () => { const r = await api.requestDelete(); A.msg = `Đã ghi nhận. Tài khoản sẽ bị xóa sau ngày ${date(r.execute_after)}; trước đó bấm "Hủy yêu cầu xóa" nếu đổi ý.`; }); }
  if (act === 'undel') return run('Đang hủy', async () => { const r = await api.cancelDelete(); A.msg = r.cancelled ? 'Đã hủy yêu cầu xóa.' : 'Không có yêu cầu xóa nào.'; });
  if (act === 'use-saved') return run('Đang tải hành trình đã lưu', async () => { await idbSet('meta', 'localBackup', { at: Date.now(), state: JSON.parse(JSON.stringify(ctx.S)) }).catch(() => {}); useSaved(); applyFields(A.conflict.fields, true); });
  if (act === 'use-local') return run('Đang lưu hành trình trên máy này', async () => { await useLocal(ctx.S); A.conflict = null; A.tab = 'main'; A.msg = 'Đã dùng hành trình trên máy này. Bản đã lưu trước đó thành chu kỳ cũ.'; await loadInfo(); });
}

/**
 * Khởi động. ctx: { S, save, render, show (mở bảng Tài khoản), remote (thiết bị khác vừa cập nhật S: vẽ lại) }.
 * Trả về lời chào sau khi khôi phục (nếu có) để giao diện báo cho người dùng.
 */
export async function accountInit(c) {
  ctx = c;
  await initAccount(c.S, applyFields);
  const m = /(?:^|[#&])lienket=([0-9A-Za-z-]{8,9})/.exec(location.hash);
  if (m) { history.replaceState(null, '', location.pathname + location.search); A.tab = 'main'; ctx.show(); if (acct.on) accountAct('ask', { dataset: { v: m[1] } }); else { A.err = 'Máy này chưa giữ hành trình nên chưa duyệt được thiết bị khác. Hãy mở liên kết trên máy đang giữ hành trình.'; ctx.render(); } }
  let welcome = false; try { welcome = sessionStorage.getItem('vandao.welcome') === '1'; sessionStorage.removeItem('vandao.welcome'); } catch { /* không sao */ }
  return { welcome };
}

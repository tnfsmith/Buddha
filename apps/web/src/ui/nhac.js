// Màn cài đặt nhắc nhở (#106, hợp đồng docs/contracts/reminder-clock.md §1, §6; API GET/PUT /reminders của #149,
// đăng ký push của #150). Mặc định tắt; tối đa 2 nhắc đang bật; giờ yên lặng 21:30–05:00; Tịnh khẩu 1–30 ngày.
// Lời nhắc không gây áy náy; push chỉ mang loại nhắc, câu chữ do service worker hiện (#172).
import { MAX_ACTIVE, REMINDER_KINDS, inQuiet } from '@vandao/shared/reminder.js';
import { api } from '../net/api.js';
import { acct } from '../net/account.js';
import { esc } from './dom.js';

const NAME = { thien: 'Giờ ngồi thiền', nhiem_vu: 'Việc nhỏ hôm nay', ghi_nhan: 'Ghi nhận cuối ngày', uposatha: 'Ngày trai', tong_ket_tuan: 'Phản tỉnh tuần' };
const HM0 = { thien: '06:00', nhiem_vu: '07:30', ghi_nhan: '20:30', uposatha: '06:30', tong_ket_tuan: '19:00' };
const WD = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const PAUSE = [1, 3, 7, 30];
// pause: null = giữ nguyên (không gửi pause_days), 0 = bỏ Tịnh khẩu, 1–30 ngày. here: máy này đã đăng ký push chưa.
const R = { uid: null, view: null, draft: null, pause: null, here: false, busy: '', err: '', msg: '', loading: false };

const pushOk = () => typeof navigator !== 'undefined' && 'serviceWorker' in navigator && typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
function follow() { const uid = acct.on ? acct.uid : null; if (R.uid !== uid) { R.uid = uid; R.view = null; R.draft = null; R.pause = null; R.here = false; R.busy = ''; R.err = ''; R.msg = ''; } }
/** Đăng ký service worker hiện có (không chờ `ready`, vì bản chạy thử có thể không có SW) */
const swReg = async () => (pushOk() ? (await navigator.serviceWorker.getRegistration()) || null : null);
const localSub = async () => { const reg = await swReg(); return reg ? reg.pushManager.getSubscription() : null; };
function toDraft(v) {
  const by = Object.fromEntries((v.reminders || []).map((r) => [r.kind, r]));
  return REMINDER_KINDS.map((k) => { const r = by[k]; return { kind: k, local_hm: r ? r.local_hm : HM0[k], days_mask: r ? r.days_mask : k === 'tong_ket_tuan' ? 1 : 127, active: !!(r && r.active) }; });
}
/**
 * API nhắc (#149/#150) đã lên chưa: null = chưa biết, true = có, false = chưa có (route trả 404). Chưa có thì ẩn dòng ở Bia
 * và màn nhắc, để UI có thể gộp trước API mà không hiện tính năng hỏng; API lên thì lần mở ứng dụng sau tự hiện.
 */
let HAS = null, probing = false;
async function probe(render) {
  if (probing || HAS !== null) return;
  probing = true;
  try { await api('/api/v1/reminders'); HAS = true; }
  catch (e) { HAS = !(e && e.status === 404); }   // 401 khi chưa đăng nhập: route có, tính năng có
  probing = false; render();
}
async function load(render) {
  const uid = R.uid;
  try {
    const v = await api('/api/v1/reminders'), here = !!(await localSub().catch(() => null));
    if (R.uid !== uid) return;
    R.view = v; R.draft = toDraft(v); R.pause = null; R.here = here; R.err = '';
  }
  catch (e) {
    if (e && e.status === 404) HAS = false;
    if (R.uid !== uid) return;
    R.err = 'Chưa tải được lịch nhắc.';
  }
  render();
}
/** Dòng ngắn ở Bia Tích Lũy (tải lịch một lần khi đã giữ hành trình) */
export function nhLine(render) {
  follow();
  if (!acct.available || HAS === false) return '';   // bản HTML đơn (file://) không có máy chủ: không dò, không hiện
  if (!acct.on) { if (HAS === null) { void probe(render); return ''; } }
  if (!acct.on) return '<p class="muted">Nhắc nhở: giữ hành trình để bật · <button class="link" data-act="nh-open">Xem</button></p>';
  if (!R.view && !R.err && !R.loading) { R.loading = true; void load(render).finally(() => { R.loading = false; }); }
  const on = R.view ? R.view.reminders.filter((r) => r.active).length : 0;
  return `<p class="muted">Nhắc nhở: ${on ? `${on} nhắc đang bật` : 'đang tắt'}${R.view && R.view.paused_until ? ' · đang Tịnh khẩu' : ''} · <button class="link" data-act="nh-open">Thiết lập</button></p>`;
}

export function nhView(render) {
  follow();
  let h = '<h2>Nhắc nhở</h2><p class="muted">Mặc định tắt. Tối đa hai nhắc mỗi ngày, không nhắc từ 21:30 đến 05:00. Lời nhắc nhẹ nhàng, không đếm ngày bỏ lỡ.</p>';
  const back = '<div class="row"><button class="ghost" data-act="board">← Bia Tích Lũy</button></div>';
  if (HAS === false) return h + '<p class="note">Tính năng nhắc nhở đang được cập nhật.</p>' + back;
  if (!acct.on) return h + '<p class="note">Giữ hành trình để bật nhắc trên các thiết bị của bạn.</p><div class="row"><button class="btn" data-act="acct-open">Giữ hành trình của tôi</button></div>' + back;
  if (!R.view) { if (!R.err && !R.loading) { R.loading = true; void load(render).finally(() => { R.loading = false; }); } return h + (R.err ? `<p class="note" role="alert">${R.err}</p><div class="row"><button class="ghost" data-act="nh-reload">Thử lại</button></div>` : '<p class="muted" role="status">Đang tải…</p>') + back; }
  const v = R.view, D = R.draft, on = D.filter((r) => r.active).length, dis = R.busy ? ' disabled' : '';
  if (!pushOk()) h += '<p class="note">Trình duyệt này chưa nhận thông báo đẩy. Trên iPhone, hãy «Thêm vào Màn hình chính» rồi mở Vân Đạo từ đó.</p>';
  else if (!v.push_available) h += '<p class="note">Máy chủ chưa bật gửi nhắc. Lịch vẫn được lưu và sẽ chạy khi bật.</p>';
  if (v.paused_until) h += `<p class="note">Đang Tịnh khẩu đến ${esc(new Date(v.paused_until).toLocaleDateString('vi-VN'))}.</p>`;
  h += D.map((r, i) => {
    const full = !r.active && on >= MAX_ACTIVE, quiet = inQuiet(r.local_hm);
    return `<div class="nh"><label class="chk"><input type="checkbox" data-nh="on" data-i="${i}"${r.active ? ' checked' : ''}${full || R.busy ? ' disabled' : ''}> ${NAME[r.kind]}</label>` +
      `<input type="time" data-nh="hm" data-i="${i}" value="${esc(r.local_hm)}" step="300" aria-label="Giờ nhắc ${NAME[r.kind]}"${dis}>` +
      (r.kind === 'tong_ket_tuan' ? `<select data-nh="wd" data-i="${i}" aria-label="Ngày phản tỉnh tuần"${dis}>${WD.map((w, d) => `<option value="${d}"${r.days_mask === 1 << d ? ' selected' : ''}>${w}</option>`).join('')}</select>` : '') +
      (r.kind === 'uposatha' ? '<span class="muted">theo lịch ngày trai ở Duyên khởi</span>' : '') +
      (quiet ? '<span class="note">Giờ yên lặng, hãy chọn giờ khác.</span>' : '') + (full ? '<span class="muted">Đã đủ hai nhắc.</span>' : '') + '</div>';
  }).join('');
  const opt = (val, t) => `<option value="${val}"${String(R.pause ?? '') === String(val) ? ' selected' : ''}>${t}</option>`;
  h += `<label class="fl" for="nh-pause">Tịnh khẩu (tạm dừng mọi nhắc)</label><select id="nh-pause" data-nh="pause"${dis}>` +
    opt('', v.paused_until ? 'Giữ nguyên' : 'Không') + (v.paused_until ? opt(0, 'Bỏ Tịnh khẩu') : '') + PAUSE.map((d) => opt(d, `${d} ngày`)).join('') + '</select>';
  h += `<div class="row"><button class="btn" data-act="nh-save"${dis}>Lưu</button>${R.here ? `<button class="ghost" data-act="nh-off"${dis}>Không nhận thông báo trên máy này</button>` : ''}</div>`;
  h += (R.busy ? `<p class="muted" role="status">${R.busy}…</p>` : '') + (R.err ? `<p class="note" role="alert">${R.err}</p>` : '') + (R.msg ? `<p class="muted" role="status">${R.msg}</p>` : '');
  return h + back;
}

export function nhInput(t) {
  follow();
  const k = t.dataset.nh, D = R.draft; if (!D) return false;
  if (k === 'pause') { R.pause = t.value === '' ? null : +t.value; return false; }
  const r = D[+t.dataset.i]; if (!r) return false;
  if (k === 'on') r.active = t.checked;
  else if (k === 'hm' && /^\d\d:\d\d$/.test(t.value)) r.local_hm = t.value;
  else if (k === 'wd') r.days_mask = 1 << (+t.value || 0);
  R.err = ''; R.msg = '';
  return k === 'on';   // bật/tắt thì vẽ lại (giới hạn hai nhắc); đổi giờ, ngày thì giữ ô đang gõ
}

const b64 = (s) => { const t = s.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(t + '='.repeat((4 - (t.length % 4)) % 4)), (c) => c.charCodeAt(0)); };
/** Xin quyền và đăng ký push cho máy này (chỉ khi người dùng bấm Lưu với ít nhất một nhắc bật). Trả true nếu đã đăng ký. */
async function subscribe(v) {
  if (!pushOk() || !v.push_available || !v.vapid_public_key) return false;
  if (Notification.permission !== 'granted' && (await Notification.requestPermission()) !== 'granted') return false;
  const reg = await swReg(); if (!reg) return false;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(v.vapid_public_key) }));
  await api('/api/v1/push/subscription', { method: 'POST', body: sub.toJSON() });
  return true;
}
const ERR = {
  reminder_quiet_hours: 'giờ này nằm trong giờ yên lặng 21:30–05:00, hãy chọn giờ khác.', reminder_limit: 'Tối đa hai nhắc đang bật.',
  invalid_reminder: 'Lịch nhắc chưa hợp lệ.', invalid_pause: 'Tịnh khẩu nhận từ 1 đến 30 ngày.',
  reminder_conflict: 'Lịch vừa đổi trên thiết bị khác. Đã tải lại, hãy xem rồi lưu lần nữa.',
};

export async function nhAct(act, render, toast) {
  follow();
  if (act === 'nh-reload') { R.err = ''; render(); return load(render); }
  if (!acct.on || !R.draft || R.busy) return;
  const uid = R.uid;
  if (act === 'nh-save') {
    // Máy chủ kiểm giờ yên lặng cho mọi nhắc gửi lên, kể cả nhắc đang tắt
    const q = R.draft.find((r) => inQuiet(r.local_hm));
    if (q) { R.err = `${NAME[q.kind]}: ${ERR.reminder_quiet_hours}`; return render(); }
    R.busy = 'Đang lưu'; R.err = ''; R.msg = ''; render();
    let pushed = false;
    try {
      if (R.draft.some((r) => r.active)) pushed = await subscribe(R.view).catch(() => false);
      const body = { reminders: R.draft.map(({ kind, local_hm, days_mask, active }) => ({ kind, local_hm, days_mask, active })) };
      if (R.pause !== null) body.pause_days = R.pause;
      const v = await api('/api/v1/reminders', { method: 'PUT', body });
      if (R.uid !== uid) return;
      R.view = v; R.draft = toDraft(v); R.pause = null; R.here = R.here || pushed;
      const on = v.reminders.some((r) => r.active);
      R.msg = !on ? 'Đã lưu. Mọi nhắc đang tắt.' : R.here ? 'Đã lưu. Máy này sẽ nhận nhắc.' : 'Đã lưu lịch. Máy này chưa nhận thông báo (chưa cho phép hoặc trình duyệt chưa hỗ trợ).';
    } catch (e) {
      if (R.uid !== uid) return;
      const code = e && e.code;
      if (code === 'reminder_conflict') { await load(render); R.msg = ERR.reminder_conflict; }
      else R.err = code === 'reminder_quiet_hours' ? `Có nhắc: ${ERR[code]}` : ERR[code] || 'Chưa lưu được. Hãy thử lại khi có mạng.';
    }
    R.busy = ''; render(); return;
  }
  if (act === 'nh-off') {
    R.busy = 'Đang tắt'; render();
    try {
      const sub = await localSub();
      if (sub) { await api('/api/v1/push/subscription', { method: 'DELETE', body: { endpoint: sub.endpoint } }); await sub.unsubscribe(); }
      if (R.uid !== uid) return;
      R.here = false; toast('Máy này không nhận thông báo nhắc nữa.');
    } catch { if (R.uid === uid) R.err = 'Chưa tắt được. Hãy thử lại.'; }
    R.busy = ''; render();
  }
}

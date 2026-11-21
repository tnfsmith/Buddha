// Trà Đạo Tỉnh Thức (#125; thiết kế docs/thiet-ke/ban-dong-tu.md §5.7): một tuần trà 10 phút — pha trà → rót chén → ngắm mây → lời hồi hướng ngắn.
// Một mình ở bàn trà Vân Đảo, hoặc hai người cùng giờ khi nhận lời mời Trà Đạo (start_at của máy chủ, vào trễ thì bắt kịp): hai chén, ngồi đối diện.
// Âm thanh sinh bằng Web Audio (music.js: pour, chime, gift), không dùng tệp âm thanh. Không điểm, không Kusala, không ghi gì lên máy chủ.
// Cảnh đọc world.tea = { cups: [0..1, 0..1], pour: { cup, k } | null, two } (island.js H.teaRitual).
import { esc } from './dom.js';

export const TRA_SEC = 600;
const STEPS = [
  { at: 0, name: 'Pha trà', lines: ['Tráng ấm bằng nước nóng, lắng nghe tiếng nước.', 'Cho trà vào ấm, rót nước, chờ trà ngấm.'] },
  { at: 60, name: 'Rót trà', lines: ['Rót chậm rãi, biết mình đang rót.', 'Mời chén trà bằng hai tay.'] },
  { at: 110, name: 'Ngắm mây', lines: ['Nâng chén bằng hai tay, cảm nhận hơi ấm.', 'Uống một ngụm nhỏ, biết vị trà.', 'Nhìn mây trôi: ý nghĩ đến rồi đi như mây.', 'Thở ra chậm, thả lỏng đôi vai.', 'Ở yên với chén trà và người bên cạnh.', 'Nghe gió, nghe chim, nghe hơi thở của mình.', 'Một ngụm nữa, chậm hơn ngụm trước.', 'Không cần nói gì; im lặng cũng là chia sẻ.', 'Mây vẫn trôi; mình vẫn ở đây.'] },
  { at: 540, name: 'Hồi hướng', lines: ['Nguyện hơi ấm chén trà này lan đến mọi người.', 'Nguyện tất cả chúng sinh được an lành.'] },
];
// rót chén [bắt đầu, xong] (giây): chén của mình, rồi chén của bạn khi uống cùng
const POUR = [[62, 78], [84, 100]];
const C = { world: null, sfx: () => {}, toast: () => {}, render: () => {}, gaze: () => {} };
let T = null, timer = 0;

/** Gắn với main.js: world (cảnh), sfx(kind, o), toast, render, gaze (máy quay ngắm mây) */
export function tdInit(c) { Object.assign(C, c); }
export const tdOn = () => !!T;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const stepAt = (e) => { let i = 0; STEPS.forEach((s, k) => { if (e >= s.at) i = k; }); return i; };
const lineAt = (e, i) => STEPS[i].lines[Math.floor((e - STEPS[i].at) / 50) % STEPS[i].lines.length];
const elapsed = () => (T ? (now() - T.t0) / 1000 : 0);

/** Bắt đầu một tuần trà. elapsed (giây): đã trôi từ giờ hẹn chung; two: uống cùng bạn; name: Tịnh danh của bạn */
export function tdStart({ two = false, elapsed: e0 = 0, name = '' } = {}) {
  const late = Math.max(0, Math.min(TRA_SEC - 1, e0));
  T = { t0: now() - late * 1000, late, two, name, cues: new Set() };
  clearInterval(timer); timer = setInterval(tick, 250); tick(); C.render();
}
/** Dừng (người dùng bấm Kết thúc) hoặc trọn tuần trà (done). Trọn thì báo C.done(số phút có mặt, uống cùng bạn) để tự ghi nhận tra_dao */
export function tdStop(done = false) {
  if (!T) return; clearInterval(timer); const t = T; T = null; if (C.world) C.world.tea = null;
  if (done) { C.sfx('gift', { k: 0.6 }); C.toast('Tuần trà đã trọn. Cảm ơn bạn đã ngồi cùng chén trà.'); if (C.done) C.done(Math.round((TRA_SEC - t.late) / 6) / 10, t.two); }
  C.render();
}

function tick() {
  if (!T) return;
  const e = elapsed(); if (e >= TRA_SEC) { tdStop(true); return; }
  // âm thanh theo mốc, mỗi mốc một lần; vào trễ (bắt kịp giờ chung) thì bỏ các mốc đã qua hơn 3 giây
  const cue = (key, at, fn) => { if (!T.cues.has(key) && e >= at) { T.cues.add(key); if (e - at < 3) fn(); } };
  cue('bat', 0, () => C.sfx('chime', { k: 0.25 })); cue('nuoc', 4, () => C.sfx('pour', { k: 0.35, dur: 3.2 }));
  POUR.forEach(([a, b], i) => { if (!i || T.two) cue('rot' + i, a, () => C.sfx('pour', { k: 0.8, dur: (b - a) * 0.55 })); });
  cue('may', STEPS[2].at, () => C.gaze()); cue('hoi', STEPS[3].at, () => C.sfx('chime', { k: 0.6 }));
  const cups = POUR.map(([a, b], i) => (i && !T.two ? 0 : Math.max(0, Math.min(1, (e - a) / (b - a)))));
  const pi = POUR.findIndex(([a, b], i) => (!i || T.two) && e >= a - 3 && e <= b + 2), [a, b] = pi >= 0 ? POUR[pi] : [0, 0];
  if (C.world) C.world.tea = { cups, two: T.two, pour: pi >= 0 ? { cup: pi, k: e < a ? (e - a + 3) / 3 : e <= b ? 1 : 1 - (e - b) / 2 } : null };
  // chữ trong bảng đổi tại chỗ (không vẽ lại cả bảng mỗi giây)
  const i = stepAt(e), set = (id, t) => { const el = typeof document !== 'undefined' && document.getElementById(id); if (el && el.textContent !== t) el.textContent = t; };
  set('td-step', STEPS[i].name); set('td-line', lineAt(e, i)); set('td-left', mmss(TRA_SEC - e));
}

/** Khối Trà Đạo trong bảng (khu Trà Đạo Tỉnh Thức, hoặc ở đảo bạn khi đang uống cùng) */
export function tdView(canStart = true) {
  if (!T) return canStart ? '<h3>Tuần trà</h3><p class="muted">Mười phút với một chén trà: pha trà, rót chén, ngắm mây, hồi hướng. Muốn uống cùng bạn đồng tu, hãy mời Trà Đạo trong mục Bạn đồng tu.</p><div class="row"><button class="btn alt" data-act="td-start">Bắt đầu một tuần trà</button></div>' : '';
  const e = elapsed(), i = stepAt(e);
  return `<h3>Tuần trà${T.two ? ' cùng ' + esc(T.name || 'bạn đồng tu') : ''}</h3><p><b id="td-step">${STEPS[i].name}</b> · còn <span id="td-left">${mmss(TRA_SEC - e)}</span></p>` +
    `<p class="muted" id="td-line">${esc(lineAt(e, i))}</p><div class="row"><button class="ghost" data-act="td-stop">Kết thúc tuần trà</button></div>`;
}
/** Nút td-*: bắt đầu một mình / kết thúc */
export function tdAct(act, start) { if (act === 'start') { if (start) start(); tdStart(); } else if (act === 'stop') tdStop(false); }
/** Kiểm thử: tua tới (giây) và đọc số giây đã trôi */
export function tdSkip(sec) { if (T) { T.t0 -= sec * 1000; tick(); } }
export const tdAt = () => elapsed();

// Phản tỉnh tuần (#104, roadmap §8.4, §9.1): cuối mỗi tuần nhìn lại tham, sân, si bằng lời của chính mình.
// Chỉ lưu trên máy này, theo tài khoản và chu kỳ; không gửi máy chủ, không ghi log, không tính điểm hay Kusala.
// Lời nhắc nhận diện, không trách: «chỉ cần nhận ra».
import { esc } from './dom.js';
import { acct } from '../net/account.js';

const KEY = 'vandao.pt.v1', MAX = 200;
const Q = [
  ['t', 'Tham', 'muốn có thêm, bám giữ điều dễ chịu'],
  ['s', 'Sân', 'bực bội, khó chịu, muốn đẩy ra'],
  ['si', 'Si', 'sống quên lãng, không biết mình đang làm gì'],
];
const LV = [['it', 'Hiếm khi'], ['vua', 'Đôi lúc'], ['nhieu', 'Thường']];

let all = {}; try { all = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { all = {}; }
// Sổ theo tài khoản (hoặc máy chưa giữ hành trình) và chu kỳ: chu kỳ mới không kế thừa phản tỉnh của chu kỳ cũ
const accOf = () => (acct.on && acct.uid ? acct.uid : 'local');
const keyOf = (S) => accOf() + '|' + (acct.on && acct.cycle ? 'c' + acct.cycle : 's' + (S.seed || 0));
const bookAt = (k) => (all[k] = all[k] || { w: {}, skip: null });
const book = (S) => bookAt(keyOf(S));
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* chỉ giữ trong bộ nhớ */ } };

/** Tuần mới nhất đã tới lượt phản tỉnh: ngày 7 → tuần 1, … ngày 49 hay đã hoàn thành → tuần 7; chưa tới thì 0 */
export const dueWeek = (S) => (S.completed ? 7 : Math.min(7, Math.floor((S.day || 0) / 7)));

/** Lời mời ở Bia khi tuần mới nhất chưa phản tỉnh và hôm nay chưa bấm «Để sau» */
export function ptCard(S, date) {
  const w = dueWeek(S), b = book(S);
  if (!w || b.w[w] || b.skip === date) return '';
  return `<div class="note"><p><b>Phản tỉnh tuần ${w}.</b> Vài phút nhìn lại tham, sân, si trong tuần. Không để tự trách, chỉ cần nhận ra. Chỉ lưu trên máy này.</p>` +
    `<div class="row"><button class="btn" data-act="pt-open" data-w="${w}">Phản tỉnh</button><button class="ghost" data-act="pt-skip">Để sau</button></div></div>`;
}

/** Dòng trong «Tích lũy tu học»: các tuần đã phản tỉnh, mở lại để xem hoặc sửa */
export function ptLine(S) {
  const done = Object.keys(book(S).w).map(Number).sort((a, b) => a - b);
  return done.length ? `<p class="muted">Phản tỉnh tuần (chỉ trên máy này): ${done.map((w) => `<button class="link" data-act="pt-open" data-w="${w}">tuần ${w} ✓</button>`).join(' · ')}</p>` : '';
}

// Tuần đang mở, bản đang sửa (mức đã chọn, chữ đã gõ) và phạm vi gắn lúc mở: tài khoản + chu kỳ (`K`), để chữ của
// chu kỳ/tài khoản này không lọt sang sổ khác nếu đồng bộ đổi chu kỳ hay đổi tài khoản trong lúc biểu mẫu đang mở.
let W = 0, draft = { x: {} }, K = null;
export function ptView(S) {
  const r = draft;
  return `<h2>Phản tỉnh tuần ${W}</h2><p class="muted">Nhìn lại không để tự trách. Chỉ cần nhận ra tâm đã khởi lên thế nào. Câu trả lời chỉ lưu trên máy này: không gửi đi, không tính điểm.</p>` +
    Q.map(([k, name, hint]) => `<label class="fl">${name}: ${hint}</label><div class="seg wrap">${LV.map(([v, t]) => `<button data-act="pt-lv" data-k="${k}" data-v="${v}" class="${r[k] === v ? 'on' : ''}">${t}</button>`).join('')}</div>` +
      `<textarea id="pt-${k}" maxlength="${MAX}" placeholder="Một lúc bạn đã nhận ra (không bắt buộc)">${esc((r.x || {})[k] || '')}</textarea>`).join('') +
    `<label class="fl">Một điều muốn giữ cho tuần tới</label><textarea id="pt-giu" maxlength="${MAX}" placeholder="Không bắt buộc">${esc((r.x || {}).giu || '')}</textarea>` +
    `<div class="row"><button class="btn" data-act="pt-save">Lưu phản tỉnh</button><button class="ghost" data-act="pt-back">← Bia Tích Lũy</button>${book(S).w[W] ? '<button class="ghost" data-act="pt-del">Xóa bản này</button>' : ''}</div>`;
}

// Đọc lại ô chữ trước khi vẽ lại, để chữ đang gõ không mất khi bấm chọn mức
const grab = () => { const x = {}; for (const k of ['t', 's', 'si', 'giu']) { const el = document.getElementById('pt-' + k); if (el) x[k] = el.value.normalize('NFC').trim().slice(0, MAX); } return x; };

/** Nút pt-*: trả { view, msg } */
export function ptAct(act, el, S, date) {
  const b = book(S);
  if (act === 'pt-open') { W = Math.min(7, Math.max(1, +el.dataset.w || dueWeek(S) || 1)); K = { acc: accOf(), key: keyOf(S) }; const r = b.w[W]; draft = r ? { t: r.t, s: r.s, si: r.si, x: { ...r.x } } : { x: {} }; return { view: 'phantinh' }; }
  if (act === 'pt-skip') { b.skip = date; keep(); return {}; }
  if (act === 'pt-back') { draft = { x: {} }; K = null; return { view: 'board' }; }
  if (act === 'pt-lv') { draft.x = grab(); draft[el.dataset.k] = draft[el.dataset.k] === el.dataset.v ? null : el.dataset.v; return {}; }
  if (act === 'pt-save' || act === 'pt-del') {
    // Phạm vi đã đổi trong lúc mở: khác tài khoản thì không ghi gì; cùng tài khoản mà khác chu kỳ thì ghi/xóa đúng sổ
    // của chu kỳ lúc mở (không bao giờ vào sổ chu kỳ mới).
    if (!K || K.acc !== accOf()) { draft = { x: {} }; K = null; return { view: 'board', msg: 'Tài khoản đã đổi trong lúc mở phản tỉnh. Bản này chưa được lưu.' }; }
    const tb = bookAt(K.key), moved = K.key !== keyOf(S);
    if (act === 'pt-save') { const x = grab(); tb.w[W] = { t: draft.t || null, s: draft.s || null, si: draft.si || null, x: Object.fromEntries(Object.entries(x).filter(([, v]) => v)), at: date }; }
    else delete tb.w[W];
    draft = { x: {} }; K = null; keep();
    return { view: 'board', msg: `Đã ${act === 'pt-save' ? 'lưu' : 'xóa'} phản tỉnh tuần ${W}${moved ? ' của chu kỳ trước' : ''} trên máy này.` };
  }
  return {};
}

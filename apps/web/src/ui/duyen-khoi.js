// Duyên khởi hành trình (#104, roadmap §8.3) và gợi ý biến thể theo trục ở Bia Tích Lũy (#112).
// Máy chủ chỉ nhận tám trường của hợp đồng hồ sơ #111.
// Gợi ý chỉ là gợi ý: đổi gợi ý không hoàn tất trục, không cộng Kusala. Mỗi trục đổi tối đa một lần mỗi ngày.
import { variantCatalog, rankVariants, swapVariant, toVariant } from '@vandao/shared/variant.js';
import { esc } from './dom.js';
import { acct } from '../net/account.js';
import { api } from '../net/api.js';

const KEY = 'vandao.dk.v1', CT = 'vandao.ct.v1';
const Q = [
  ['minutes', 'Mỗi ngày dành được', [[10, '10 phút'], [15, '15 phút'], [30, '20–30 phút'], [45, '45 phút trở lên']]],
  ['level', 'Sức thực hành', [['nhe', 'Nhẹ nhàng'], ['vua', 'Vừa sức'], ['sau', 'Sâu hơn']]],
  ['time_window', 'Khung giờ thuận tiện', [['sang', 'Sáng'], ['trua', 'Trưa'], ['toi', 'Tối'], ['linh_hoat', 'Linh hoạt']]],
  ['familiarity', 'Quen thuộc với Phật pháp', [['moi', 'Mới tìm hiểu'], ['da_quy_y', 'Đã quy y'], ['tu_lau', 'Tu tập lâu năm'], ['', 'Không muốn nói']]],
  ['uposatha', 'Ngày trai mỗi tháng âm lịch', [['vn_2', '2 ngày'], ['vn_4', '4 ngày'], ['vn_6', '6 ngày'], ['vn_10', '10 ngày'], ['khong', 'Chưa giữ']]],
];
const GIOI = ['Không sát sinh', 'Không lấy của không cho', 'Không tà dâm', 'Không nói dối', 'Không dùng chất say'];
// Giới hạn hiện tại → hai cờ của hợp đồng #111. Hoàn cảnh riêng (câu 3, phần còn lại câu 6 ở §8.3) chưa hỏi vì chưa tính năng nào dùng: không thu thập dữ liệu thừa.
const LIM = [['at_home', 'Ít di chuyển'], ['no_money', 'Không muốn chi tiền']];
const LV = (m) => (m <= 10 ? 'nhe' : m >= 45 ? 'sau' : 'vua');

/** Danh mục biến thể: state idle → loading → ok | error; offline dùng bản lưu lần trước */
// `pub`: mọi cặp id@version hợp lệ mà API thực sự trả (kể cả bản cũ còn công khai), để kiểm lựa chọn đã lưu
export const ct = { state: 'idle', cat: variantCatalog([]), pub: new Set(), p: null, at: 0 };
export function loadVariants(force) {
  if (ct.p && !force) return ct.p;
  ct.state = 'loading';
  return (ct.p = (async () => {
    let items = null;
    try {
      if (!/^https?:$/.test(location.protocol)) throw new Error('file');
      const r = await fetch('/api/v1/content?kind=chuong_trinh&tier=0', { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error('http ' + r.status);
      items = (await r.json()).items; ct.at = Date.now();
      try { localStorage.setItem(CT, JSON.stringify(items)); } catch (e) { /* chỉ giữ trong bộ nhớ */ }
    } catch (e) { try { items = JSON.parse(localStorage.getItem(CT) || 'null'); } catch (er) { /* bản lưu hỏng */ } }
    ct.cat = variantCatalog(items); ct.state = Array.isArray(items) ? 'ok' : 'error';
    ct.pub = new Set((Array.isArray(items) ? items : []).map(toVariant).filter(Boolean).map((v) => `${v.id}@${v.version}`));
  })());
}
export const variantsStale = () => ct.state !== 'loading' && Date.now() - ct.at > 600000;

// Sổ trên máy theo từng tài khoản: { prof, rev, dirty, asked, pick: { ngày: { trục: { id, v, t, x, s } | null } }, swp: { ngày: { trục: 1 } } }
let all = {}; try { all = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { all = {}; }
const who = () => (acct.on && acct.uid ? acct.uid : 'local');
// Mỗi tài khoản một sổ riêng (hợp đồng #111: hồ sơ theo tài khoản, đọc không tự ghi). Không chép sổ của máy hay của
// tài khoản khác sang; chỉ thao tác «Lưu lựa chọn» trong đúng tài khoản đang mở mới đánh dấu cần gửi (dirty).
const me = () => { const k = who(); return (all[k] = all[k] || { prof: null, rev: 0, dirty: false, asked: false, pick: {}, swp: {} }); };
/** Ngày trai của Bia theo hồ sơ của đúng tài khoản/máy đang mở; chưa có hồ sơ thì về mặc định */
const applyUpo = (S) => { const p = me().prof; if (p) S.uposatha = p.uposatha; else delete S.uposatha; };
// Gợi ý (pick) và lượt đổi (swp) dọn riêng, mỗi loại giữ 3 ngày gần nhất của chính nó: xóa gợi ý để tính lại
// không bao giờ làm mất lượt đổi đã dùng trong ngày (giới hạn một lần đổi/trục/ngày).
const prune = (o) => { const ds = Object.keys(o).sort().slice(-3); for (const k of Object.keys(o)) if (!ds.includes(k)) delete o[k]; };
const keep = () => { const m = me(); prune(m.pick); prune(m.swp); try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) { /* chỉ giữ trong bộ nhớ */ } };
export const dkProfile = () => me().prof;

/** Đọc hồ sơ trên máy chủ (GET /practice/profile); bản máy chủ mới hơn thì dùng, bản trên máy chưa gửi thì gửi lại */
const pulled = {};   // lần đọc gần nhất theo từng tài khoản
export async function dkPull(S, force) {
  applyUpo(S);
  if (!acct.on || (!force && Date.now() - (pulled[who()] || 0) < 600000)) return;
  pulled[who()] = Date.now();
  const m = me();
  try {
    const r = await api('/api/v1/practice/profile');
    if (m.dirty && m.prof && r.rev === m.rev) return void (await put(S));
    if (r.profile && r.rev !== m.rev) { m.prof = r.profile; m.rev = r.rev; m.dirty = false; keep(); }
    applyUpo(S);
  } catch (e) { /* offline: dùng bản trên máy */ }
}
async function put(S) {
  const m = me();
  try {
    const r = await api('/api/v1/practice/profile', { method: 'PUT', body: { profile: m.prof, rev: m.rev } });
    m.rev = r.rev; m.dirty = false; keep(); return 'Đã lưu Duyên khởi.';
  } catch (e) {
    if (e.code === 'practice_profile_conflict') { pulled[who()] = 0; m.dirty = false; m.rev = -1; await dkPull(S, true); return 'Thiết bị khác vừa lưu lựa chọn khác. Đã tải bản mới nhất; xem lại rồi lưu nếu muốn đổi.'; }
    return e.status ? 'Chưa lưu được lên máy chủ (' + esc(e.code) + '). Lựa chọn vẫn giữ trên máy này.' : 'Đã lưu trên máy này; sẽ gửi khi có mạng.';
  }
}

/** Đầu vào bộ chọn: người dùng của phiên (chưa giữ hành trình thì theo máy), chu kỳ, ngày 1–49, trục */
const input = (S, pillar) => ({ userId: acct.on && acct.uid ? acct.uid : 'local:' + (S.seed || 0), cycle: acct.cycle || 1, day: Math.min(49, Math.max(1, S.day || 1)), pillar });

/**
 * Gợi ý của một trục hôm nay, giữ cố định trong ngày kể cả khi danh mục cập nhật. null → dùng gợi ý tuần.
 * Theo hợp đồng #132 mục 2: lựa chọn đã ghi mà không còn hợp hồ sơ (đánh dấu null khi Lưu) hoặc đã bị rút khỏi danh mục
 * thì hiện gợi ý tuần, không tự chọn lại; lượt đổi đã dùng vẫn giữ.
 */
function pickOf(S, pillar, date) {
  const m = me(); if (!m.prof || !ct.cat.n) return null;
  const day = (m.pick[date] = m.pick[date] || {});
  if (!Object.prototype.hasOwnProperty.call(day, pillar)) {
    const v = rankVariants(ct.cat, m.prof, input(S, pillar))[0]; if (!v) return null;
    day[pillar] = { id: v.id, v: v.version, t: v.title, x: v.text, s: v.source_ref }; keep();
  }
  const p = day[pillar];
  // Đúng phiên bản đã chọn phải còn công khai: v1 còn công khai khi đã có v3 thì giữ; v1 đã rút thì về gợi ý tuần
  if (!p || (ct.state === 'ok' && !ct.pub.has(`${p.id}@${p.v}`))) return null;
  return p;
}

/** Phần đầu thẻ trục ở Bia: tiêu đề + câu gợi ý + nguồn + nút đổi; '' khi chưa có Duyên khởi hay danh mục */
export function variantHtml(S, pillar, date, done, theme) {
  const p = pickOf(S, pillar, date); if (!p) return '';
  const swapped = !!(me().swp[date] || {})[pillar];
  return `<h4>${esc(p.t)}</h4><p>${esc(p.x)}</p><p class="muted">Gợi ý hôm nay theo Duyên khởi${theme ? ' · chủ đề tuần: ' + esc(theme) : ''}${done || swapped ? '' : ` · <button class="link" data-act="dk-swap" data-p="${pillar}">Đổi gợi ý</button>`}</p>` +
    (p.s ? `<details><summary>Nguồn</summary><p class="muted">${esc(p.s)}</p></details>` : '');
}

/** Lời mời ở đầu Bia khi chưa trả lời và chưa bỏ qua */
export const dkCard = () => (me().prof || me().asked ? '' : '<div class="note"><p><b>Duyên khởi hành trình.</b> Vài câu để Bia gợi việc vừa sức bạn. Bỏ qua được, sửa lại lúc nào cũng được.</p>' +
  '<div class="row"><button class="btn" data-act="dk-open">Trả lời</button><button class="ghost" data-act="dk-skip">Để sau</button></div></div>');

let D = null;   // bản nháp đang sửa
const chips = (k, list, cur) => `<div class="seg wrap">${list.map(([v, t]) => `<button data-act="dk-set" data-k="${k}" data-v="${v}" class="${String(v) === String(cur ?? '') ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>`;
const tog = (act, v, on, t) => `<button class="gioi${on ? ' on' : ''}" data-act="${act}" data-v="${v}" aria-pressed="${on}">${on ? '✓' : '○'} ${esc(t)}</button>`;

export function dkView() {
  if (!D) { const m = me(), p = m.prof || { level: 'vua', minutes: 15, time_window: 'linh_hoat', familiarity: null, precepts: [1, 2, 3, 4, 5], uposatha: 'vn_4', no_money: false, at_home: false };
    D = { ...p, precepts: [...p.precepts], lim: LIM.map((x) => x[0]).filter((k) => p[k]), lvSet: !!m.prof }; }
  return '<h2>Duyên khởi hành trình</h2><p class="muted">Bia dùng các lựa chọn này để gợi việc vừa sức cho ba trục mỗi ngày. Sửa lại lúc nào cũng được.</p>' +
    Q.map(([k, t, list]) => `<label class="fl">${t}</label>${chips(k, list, D[k])}`).join('') +
    '<label class="fl">Giới nguyện trong chu kỳ</label><p class="muted">Khuyến khích đủ năm giới; chọn các giới bạn phát nguyện giữ trọn.</p><div class="gioi-list">' +
    GIOI.map((t, i) => tog('dk-gioi', i + 1, D.precepts.includes(i + 1), t)).join('') + '</div>' +
    '<label class="fl">Giới hạn hiện tại</label><div class="gioi-list">' + LIM.map(([v, t]) => tog('dk-lim', v, D.lim.includes(v), t)).join('') + '</div>' +
    '<div class="row"><button class="btn" data-act="dk-save">Lưu lựa chọn</button><button class="ghost" data-act="dk-back">← Bia Tích Lũy</button></div>';
}

/** Xử lý nút dk-*: trả { view, msg } hoặc Promise của nó */
export function dkAct(act, el, S, date) {
  const m = me(), v = el.dataset.v;
  if (act === 'dk-open') { D = null; return { view: 'duyen' }; }
  if (act === 'dk-skip') { m.asked = true; keep(); return {}; }
  if (act === 'dk-back') { D = null; return { view: 'board' }; }
  if (act === 'dk-set') { const k = el.dataset.k; D[k] = k === 'minutes' ? +v : k === 'familiarity' ? v || null : v; if (k === 'level') D.lvSet = true; if (k === 'minutes' && !D.lvSet) D.level = LV(+v); return {}; }
  if (act === 'dk-gioi') { const g = +v; D.precepts = D.precepts.includes(g) ? D.precepts.filter((x) => x !== g) : [...D.precepts, g].sort(); return {}; }
  if (act === 'dk-lim') { D.lim = D.lim.includes(v) ? D.lim.filter((x) => x !== v) : [...D.lim, v]; return {}; }
  if (act === 'dk-save') {
    m.prof = { level: D.level, minutes: D.minutes, time_window: D.time_window, familiarity: D.familiarity || null, precepts: [...D.precepts].sort(), uposatha: D.uposatha, no_money: D.lim.includes('no_money'), at_home: D.lim.includes('at_home') };
    // Lựa chọn hôm nay còn hợp hồ sơ mới thì giữ (Lưu mà không đổi gì thì không đổi gợi ý); không còn hợp thì đánh dấu
    // null → gợi ý tuần, không tự chọn lại (#132 mục 2). Lượt đổi đã dùng (swp) giữ nguyên.
    const day = m.pick[date] || {};
    for (const p of Object.keys(day)) if (day[p] && !rankVariants(ct.cat, m.prof, input(S, p)).some((v) => v.id === day[p].id)) day[p] = null;
    m.asked = true; m.dirty = true; S.uposatha = m.prof.uposatha; D = null; keep();
    return acct.on ? put(S).then((msg) => ({ view: 'board', msg })) : { view: 'board', msg: 'Đã lưu Duyên khởi trên máy này.' };
  }
  if (act === 'dk-swap') {
    const p = el.dataset.p, cur = pickOf(S, p, date); if (!cur || (m.swp[date] || {})[p]) return {};
    const r = swapVariant(ct.cat, m.prof, input(S, p), cur.id);
    if (r.same || !r.variant) return { msg: 'Trục này chỉ còn một gợi ý hợp với Duyên khởi của bạn.' };
    m.pick[date][p] = { id: r.variant.id, v: r.variant.version, t: r.variant.title, x: r.variant.text, s: r.variant.source_ref };
    (m.swp[date] = m.swp[date] || {})[p] = 1; keep();
    return { msg: 'Đã đổi gợi ý. Mỗi trục đổi được một lần mỗi ngày.' };
  }
  return {};
}

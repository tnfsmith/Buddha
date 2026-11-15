// Hành trình Sơ nhập — đợt C (#85, #91): Giữ giới hôm nay, Hạnh của tuần, Nguyện tuần, ngày trai.
// Danh mục là nội dung `kind: nhiem_vu` (đợt B, content/nhiem-vu/so-nhap/), máy chủ chỉ trả mục đã chọn phát hành.
// Người dùng tự xác nhận; không cộng Kusala, không khóa nấc ngày (quyết định 2–3 của chủ dự án, docs/noi-dung/nhiem-vu-so-nhap.md).
// Sổ S.viec chỉ có mã việc và mã Ba-la-mật, không chữ tự do.
import { catalog, dayPlan, setAct, isTraiDay } from '@vandao/shared/missions.js';
import { lunarOf } from '@vandao/shared/amlich.js';
import { PARAMI } from '@vandao/shared/parami.js';
import { esc } from './dom.js';

const CACHE = 'vandao.nv.v1';
/** state: idle → loading → ok | error; cat: danh mục đã gom nhóm (rỗng khi chưa có mục nào phát hành) */
export const nv = { state: 'idle', cat: catalog([]), p: null };

/** Tải danh mục; mất mạng thì dùng bản đã lưu lần trước (offline-first) */
export function loadMissions(force) {
  if (nv.p && !force) return nv.p;
  nv.state = 'loading';
  nv.p = (async () => {
    try {
      if (!/^https?:$/.test(location.protocol)) throw new Error('file');
      const r = await fetch('/api/v1/content?kind=nhiem_vu&tier=0', { headers: { accept: 'application/json' } });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json(), items = Array.isArray(j.items) ? j.items : [];
      nv.cat = catalog(items); nv.state = 'ok';
      try { localStorage.setItem(CACHE, JSON.stringify(items)); } catch (e) { /* chỉ giữ trong bộ nhớ */ }
    } catch (e) {
      let items = null; try { items = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (er) { /* bản lưu hỏng */ }
      if (Array.isArray(items)) { nv.cat = catalog(items); nv.state = 'ok'; } else nv.state = 'error';
    }
  })();
  return nv.p;
}

const week = (S) => Math.min(7, Math.max(1, Math.ceil((S.day || 1) / 7)));
/** Việc của hôm nay theo ngày lịch, tuần hành trình và hạt giống của máy */
export const planFor = (S, date) => dayPlan(nv.cat, { date, week: week(S), seed: S.seed || 0 });
const findItem = (id) => { const c = nv.cat; for (const L of [...Object.values(c.gioi), ...Object.values(c.hanh)]) { const x = L.find((y) => y.id === id); if (x) return x; } return null; };

/** HTML của ba thẻ cho Bia Tích Lũy; rỗng khi chưa có mục nào được phát hành */
export function soNhapView(S, date) {
  const c = nv.cat;
  if (!c.n) return nv.state === 'loading' ? '<p class="muted">Đang tải việc nhỏ của hôm nay…</p>' : '';
  const P = planFor(S, date), day = (S.viec || {})[date] || {}, G = day.gioi || {};
  let h = '';
  // Ngày trai: lời mời tự nguyện, không bắt buộc, kèm lưu ý sức khỏe
  const lunar = lunarOf(new Date()), tr = c.trai;
  if (tr && isTraiDay(lunar, S.uposatha || 'vn_4')) {
    h += `<div class="trai"><p><b>Hôm nay là ngày trai</b> (${lunar.day}/${lunar.month} âm lịch). ${esc(tr.text)}</p>` +
      `<details><summary>Tám giới của ngày trai</summary><ol>${tr.trai.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>` +
      (tr.safety ? `<p class="muted safety">${esc(tr.safety)}</p>` : '') +
      `<button class="gioi${day.trai ? ' on' : ''}" data-act="nv-trai" aria-pressed="${!!day.trai}">${day.trai ? '✓ Đã tự nguyện thọ trì hôm nay' : 'Tôi tự nguyện thọ trì hôm nay'}</button></div>`;
  }
  h += '<h3>Giữ giới hôm nay</h3><div class="gioi-list">';
  for (let g = 1; g <= 5; g++) {
    const x = P.gioi[g]; if (!x) continue; const on = !!G[g];
    h += `<div class="gioi-row"><button class="gioi${on ? ' on' : ''}" data-act="nv-gioi" data-g="${g}" data-id="${esc(x.id)}" aria-pressed="${on}">${on ? '✓' : '○'} ${esc(x.title)}</button>` +
      `<p class="muted">${esc(x.text)}</p>${x.safety ? `<p class="muted safety">${esc(x.safety)}</p>` : ''}</div>`;
  }
  h += '</div><p class="muted">Chạm vào giới bạn đã giữ hôm nay. Lỡ phạm thì thành thật «Sám hối» ở dưới, không bị trừ gì.</p>';
  // Hạnh của tuần: chọn 1 trong 3 (quyết định 2), làm xong thì xác nhận
  const hd = day.hanh;
  h += `<h3>Hạnh của tuần: ${esc(P.focus.map((p) => PARAMI[p]).join(' · '))}</h3>`;
  if (hd && hd.done) { const x = findItem(hd.id); h += `<p class="hanh-done">✓ Đã làm: ${esc(x ? x.text : 'một việc nhỏ của hạnh tuần')}</p>`; }
  else if (P.hanh.length) {
    h += '<div class="hanh-list">' + P.hanh.map((x) => `<button class="hanh${hd && hd.id === x.id ? ' on' : ''}" data-act="nv-hanh" data-id="${esc(x.id)}" aria-pressed="${!!(hd && hd.id === x.id)}">${esc(x.text)}<em>${esc(PARAMI[x.parami[0]])}${x.minutes ? ` · ~${x.minutes} phút` : ''}</em></button>`).join('') + '</div>' +
      (hd ? '<div class="row"><button class="btn" data-act="nv-hanh-done">Đã làm xong việc này</button></div>' : '<p class="muted">Chọn một việc nhỏ để làm trong hôm nay.</p>');
  }
  // Nguyện tuần (Quyết định – adhiṭṭhāna): phát một lần mỗi tuần, mỗi ngày tự đánh dấu đã giữ
  const ng = P.nguyen;
  if (ng) {
    const vowed = S.nguyen && S.nguyen[P.week] && S.nguyen[P.week].id === ng.id;
    h += `<h3>Nguyện tuần ${P.week}</h3><p class="nguyen">${esc(ng.text)}</p>` + (vowed
      ? `<div class="row"><button class="gioi${day.nguyen ? ' on' : ''}" data-act="nv-nguyen-keep" aria-pressed="${!!day.nguyen}">${day.nguyen ? '✓ Hôm nay đã giữ nguyện' : 'Hôm nay đã giữ nguyện'}</button></div>`
      : '<div class="row"><button class="btn alt" data-act="nv-nguyen-vow">Phát nguyện cho tuần này</button></div>');
  }
  return h;
}

/** Xử lý chạm trong ba thẻ; trả câu báo ngắn (đã xử lý) hoặc null (không phải của mô-đun này) */
export function soNhapAct(act, el, S, date) {
  if (!act.startsWith('nv-')) return null;
  const P = planFor(S, date), day = (S.viec || {})[date] || {};
  if (act === 'nv-gioi') {
    const g = el.dataset.g, x = P.gioi[g]; if (!x) return '';
    const on = !(day.gioi && day.gioi[g]);
    S.viec = setAct(S.viec, date, `gioi.${g}`, on ? { id: x.id, parami: x.parami } : null);
    return on ? `Đã giữ: ${x.title}` : `Bỏ đánh dấu: ${x.title}`;
  }
  if (act === 'nv-hanh') {
    if (day.hanh && day.hanh.done) return '';
    const x = P.hanh.find((y) => y.id === el.dataset.id); if (!x) return '';
    S.viec = setAct(S.viec, date, 'hanh', { id: x.id, parami: x.parami, done: false });
    return 'Đã chọn việc nhỏ của hạnh tuần';
  }
  if (act === 'nv-hanh-done') {
    if (!day.hanh || day.hanh.done) return '';
    S.viec = setAct(S.viec, date, 'hanh', { ...day.hanh, done: true });
    return `Đã làm việc nhỏ của hạnh ${PARAMI[day.hanh.parami[0]] ? PARAMI[day.hanh.parami[0]].toLowerCase() : 'tuần'}: cánh sen sáng thêm`;
  }
  if (act === 'nv-nguyen-vow') {
    if (!P.nguyen) return '';
    S.nguyen = { ...(S.nguyen || {}), [P.week]: { id: P.nguyen.id, at: Date.now() } };
    return 'Đã phát nguyện cho tuần này';
  }
  if (act === 'nv-nguyen-keep') {
    if (!P.nguyen) return '';
    const on = !day.nguyen;
    S.viec = setAct(S.viec, date, 'nguyen', on ? { tuan: P.week, parami: [...new Set([...P.nguyen.parami, 'adhitthana'])] } : null);
    return on ? 'Hôm nay đã giữ nguyện tuần' : 'Bỏ đánh dấu giữ nguyện';
  }
  if (act === 'nv-trai') {
    const tr = nv.cat.trai; if (!tr) return '';
    const on = !day.trai;
    S.viec = setAct(S.viec, date, 'trai', on ? { id: tr.id, parami: tr.parami } : null);
    return on ? 'Đã tự nguyện thọ trì ngày trai' : 'Bỏ đánh dấu ngày trai';
  }
  return '';
}

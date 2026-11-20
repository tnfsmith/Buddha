import * as THREE from 'three';
import { World, ANCHORS, TIER_LABEL, groundH } from './world.js';
import { Player, TR, EV, offlineProbe } from './audio.js';
import { DUR, STAGES, TIERS, ZONES, WEEKS, PILLARS, valueAt, breathEnv, stageAt, kusala } from './data.js';
import { Sermon, library, loadSermons, LOAT, LOAT0, loatTabs, aiVoiceLabel, providerOf } from './sermon.js';
import { Ambient, SONGS, SONG, MOODS, GROUPS, songsOf, pickSong, probeSong, probeSfx } from './music.js';
import { OPTIONS, PRESETS, checkName, suggestNames } from './people.js';
import { S, mem, save, allDone, today, resetState, stateReady, fixMusic } from './state.js';
import { PASSIVE, MIN_VANDU, heardEnough, listenCode, logPassive, lotus, weakest, calendar, weekSitMinutes, heardIds, fullGioi } from '@vandao/shared/missions.js';
import { PARAMI } from '@vandao/shared/parami.js';
import { nv, loadMissions, soNhapView, soNhapAct, todayBox, todayLeft, missionsStale } from './ui/so-nhap.js';
import { ct, loadVariants, variantsStale, variantHtml, dkCard, dkView, dkAct, dkPull } from './ui/duyen-khoi.js';
import { ptCard, ptLine, ptView, ptAct, ptSaved } from './ui/phan-tinh.js';
import { tierOpened, tierMigrate, tierLoad, tierBlock, tierAct } from './ui/tang-1.js';
import { registerPWA, persistStorage } from './boot.js';
import { startMetrics } from './net/metrics.js';
import { $, fmt, esc } from './ui/dom.js';
import { accountView, accountAct, accountHint, accountOn, accountInit } from './ui/account.js';
import { acct, record, recordProfile, recordPractice, syncNow } from './net/account.js';
import { dtInit, dtView, dtAct, dtInput, dtOpen, dtBadge, dtGateLine, dtSyncOpen } from './ui/dong-tu.js';
import { dongTu, onDongTu, meet as dtMeet, visitAway } from './net/dong-tu.js';
import { MEET_KINDS, PRESENCE_TEXT, REASON_TEXT } from '@vandao/shared/dong-tu.js';


// #151/#160: liên kết mời chia sẻ ra ngoài dạng /moi/MÃ[?d=1] (hợp đồng §12) hoặc /?ban=MÃ (dạng cũ; Facebook có thể bỏ phần sau #).
// Đổi về /#ban= trước khi đọc hash và trước khi net/dong-tu.js nhận mã (lúc khởi động tài khoản), giữ các tham số hash khác nếu có
{
  const q = new URLSearchParams(location.search), m = /^\/moi\/([^/]+)\/?$/.exec(location.pathname), b = m ? m[1] : q.get('ban');
  if (b) {
    q.delete('ban'); if (m) q.delete('d');
    const rest = q.toString(), h = location.hash.slice(1), code = m ? b : encodeURIComponent(b);
    history.replaceState(null, '', (m ? '/' : location.pathname) + (rest ? '?' + rest : '') + '#' + (h ? h + '&' : '') + 'ban=' + code);
  }
}

// ───────── Lưu trạng thái trên máy: xem state.js ─────────

const U = { mode: 'island', view: 'home', zone: null, tier: null, sim: null, bio: 'samadhi', bioAt: 0, quietManual: false, idleAt: performance.now(), drag: null, resetArm: false, friend: null, draft: null, pose: 'stand', chips: suggestNames(6) };
const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));

const player = new Player();
// lưu vị trí gần nhất của nhân vật trên Vân Đảo
function savePos() { if (!world || !world.av || world.av.where !== 'home' || world.av.state === 'travel' || world.av.state === 'walk') return; const a = world.av, p = { x: +a.pos.x.toFixed(2), z: +a.pos.z.toFixed(2), rot: +a.rot.toFixed(2), sit: a.state === 'sit' ? a.id : null }; if (!S.pos || S.pos.x !== p.x || S.pos.z !== p.z || S.pos.sit !== p.sit || S.pos.rot !== p.rot) { S.pos = p; save(); } }
setInterval(savePos, 1500); window.addEventListener('pagehide', savePos); document.addEventListener('visibilitychange', () => { if (document.hidden) savePos(); });
// ── Thuyết giảng ──
const sermon = new Sermon();
// #79: chữ khi giảng chỉ gồm nguồn, câu đang đọc và chữ phụ; không còn dòng nhãn giọng AI (ghi ở chú thích của bảng)
sermon.online = (o) => { const el = $('#sub'); if (!el) return; el.innerHTML = o ? `<div class="src">${esc(o.src)}</div><div class="ln">${esc(o.ln)}</div>${o.pl ? `<div class="pl">${esc(o.pl)}</div>` : ''}` : ''; };
sermon.onend = (done) => {
  if (done) { S.sermons = (S.sermons || 0) + 1; heardLog(sermon.report); save(); }
  // nghe lần lượt: còn bài thì sang bài tiếp, giữ máy quay và Vân Nhạc nhỏ
  const q = U.queue; if (done && q && q.k < q.ids.length - 1) { q.k++; return queuePlay(); }
  U.queue = null; if (world) { world.wide = false; if (U.mode === 'hall') world.setMode('hall'); } document.body.classList.remove('sermon'); amb.setVolume(S.music.vol);
  if (done) toast(q ? 'Đã nghe trọn cả loạt. Sādhu!' : 'Bài giảng đã viên mãn. Sādhu!'); render(); };
// Chỉ phát bài có trong danh sách đã phát hành tải từ máy chủ (#39): mã bài lạ, kể cả qua #sermon=…, không phát gì.
// Đọc thành tiếng bằng giọng máy của thiết bị là mặc định khi bài chưa có giọng đọc (#79: bỏ ô tùy chọn).
function sermonStart(id, o) { const su = library.items.find((x) => x.id === id); if (!su) { U.queue = null; toast('Bài giảng này chưa được phát hành.'); return render(); } U.sutta = su.id; U.loat = su.loat; if (player.playing) player.pause(); if (U.mode !== 'hall') setMode('hall'); U.hallTab = 'sermon';
  document.body.classList.add('sermon'); amb.setVolume(S.music.vol * 0.4); if (amb.on && amb.voice && amb.ctx) { try { amb.voice.bowl(amb.ctx.currentTime + 0.1, 136.1, 0.3, 0); } catch (e) { /* bỏ qua */ } }
  sermon.start(su, true, o); if (world) U.sCam = null; render(); }
function sermonStop() { U.queue = null; sermon.stop(); if (world) { world.wide = false; if (U.mode === 'hall') world.setMode('hall'); } }
/** Một lần tự ghi nhận: vào sổ trên máy và gửi cho các thiết bị khác của cùng tài khoản (#93). `ref` chỉ là mã bài/nơi ngồi. */
function logTu(code, minutes = 0, ref = '') {
  const t = today(), r = /^[a-z0-9][a-z0-9-]{0,79}$/.test(ref) ? ref : '';
  S.tu = logPassive(S.tu, t, code, { minutes, ref: r }); recordPractice('tu', code, { n: 1, min: minutes, refs: r ? [r] : [] }, t);
}
/** Tự ghi nhận nghe Pháp (#88): nghe thật ≥ 70 % bài (giọng đọc hoặc đọc trọn bằng chữ); nghe ≥ 80 % hồi hướng. Không cộng Kusala. */
function heardLog(r) { if (!r) return; if (heardEnough(r.ratio, 1)) logTu(listenCode(r.loat), 0, r.id); if (r.rite) logTu('hoi_huong'); }
/** Đợt E (#104): Vân Đảo phản chiếu sổ trên máy — số chương Đường Xưa đã nghe trọn, số ngày giữ đủ năm giới, 10 cánh sen. Tính lại tối đa mỗi giây. */
let refAt = 0, refV = null;
function reflectState() {
  const n = performance.now(); if (refV && n - refAt < 1000) return refV; refAt = n;
  const L = lotus(S.tu, S.done, S.sacca, S.viec);
  return (refV = { lamps: heardIds(S.tu)['duong-xua'].size, buds: Object.values(S.viec || {}).filter(fullGioi).length, petals: Object.keys(PARAMI).map((k) => L.norm[k] || 0) });
}
// Nghe lần lượt (#79): mọi bài của loạt đang chọn, từ bài đang chọn tới cuối; lời mở đầu trước bài đầu, lời kết sau bài cuối
function sermonAll() { const ids = inLoat().map((x) => x.id); if (!ids.length) return; const k = Math.max(0, ids.indexOf(U.sutta)); U.queue = { ids, k, k0: k }; queuePlay(); }
function queuePlay() { const q = U.queue, last = q.k === q.ids.length - 1, nx = !last && library.items.find((x) => x.id === q.ids[q.k + 1]);
  sermonStart(q.ids[q.k], { open: q.k === q.k0, close: last, next: nx ? nx.name : '' }); }
// Menu loạt bài (ADR 0002): mỗi loạt một thẻ; trong loạt chia theo phần nếu có
const inLoat = () => library.items.filter((x) => x.loat === (U.loat || LOAT0));
/** Sau khi tải danh sách: chọn thẻ loạt đầu tiên có bài (nếu thẻ đang chọn trống) và bài đầu của loạt */
function sermonPick() { const L = library.items; if (!L.some((x) => x.loat === U.loat)) { const t = loatTabs(L).find(([k]) => L.some((x) => x.loat === k)); U.loat = t ? t[0] : LOAT0; } const mine = inLoat(); if (!mine.some((x) => x.id === U.sutta)) U.sutta = mine[0] && mine[0].id; }
function sermonList(list) {
  const cur = U.loat || LOAT0, mine = list.filter((x) => x.loat === cur), heard = heardIds(S.tu)[cur] || new Set(); let ph = -1;
  return seg('loat', loatTabs(list), cur) + (mine.length ? mine.map((x) => {
    let hd = ''; if (x.phan !== ph) { ph = x.phan; const t = LOAT[cur] && LOAT[cur].phan[x.phan]; if (t) hd = `<p class="phan">${esc(t)}</p>`; }
    return hd + `<button class="sut ${U.sutta === x.id ? 'on' : ''}" data-sut="${esc(x.id)}"><b>${esc(x.name)}</b><em>${esc(x.ref)}${x.audio ? ' · có giọng đọc' : ''}${heard.has(x.id) ? ' · <span class="heard">❀ đã nghe</span>' : ''}</em></button>`;
  }).join('') : '<p class="sermon-empty muted">Loạt này đang được soạn. Bài sẽ hiện ở đây khi được phát hành.</p>');
}
// ── Vân Nhạc: nhạc nền toàn Vân Đảo ──
const amb = new Ambient(); amb.volume = S.music.vol;
const wantSong = () => pickSong(S.music, S.day, new Date().getHours());
const musBtn = () => { const b = $('#mus'); if (!b) return; b.textContent = amb.on && amb.cur ? '♪ ' + SONG[amb.cur].name : 'Nhạc'; b.classList.toggle('on', amb.on); };
const musicSync = () => { musBtn(); renderDock(); if (U.view === 'zone') render(); };
const musicStart = (id, again) => amb.play(id || wantSong(), { len: fixMusic(S.music).len, again }).then(() => { S.music.on = true; save(); musicSync(); }).catch((e) => toast('Chưa phát được nhạc: ' + e.message));
const musicStop = () => { amb.stop(); S.music.on = false; save(); musicSync(); };
// Hết một khúc "phát 1 lần": ba tiếng chuông bát rồi lắng hẳn
const musicEnd = () => { amb.end(); S.music.on = false; save(); musicSync(); toast('Khúc nhạc đã trọn.'); if (!player.playing) U.sit = null; };   // thời ngồi theo nhạc đã trọn: Vân Du (nếu có) trở về bên nhân vật
// Khúc kế tiếp trong thể loại đang chọn. `manual`: người dùng bấm "Khúc khác" → từ nay giữ khúc tự chọn, không để lịch/giờ đổi lại
function musicNext(manual) {
  const M = S.music, pool = songsOf(M.genre), i = pool.findIndex((x) => x.id === amb.cur); let id = pool[(i + 1) % pool.length].id;
  if (M.order === 'shuf' && pool.length > 1) { do { id = pool[Math.floor(Math.random() * pool.length)].id; } while (id === amb.cur); }
  if (manual && M.order === 'loop') M.source = 'pick'; if (M.source === 'pick') M.song = id; save(); musicStart(id, true);
}
setInterval(() => { amb.duck(player.playing); }, 300);
setInterval(() => { if (!amb.on || amb.ducked) return; const M = fixMusic(S.music);
  if (M.len && amb.minutes >= M.len) { if (M.order === 'once') musicEnd(); else if (M.order === 'loop') musicStart(M.source === 'pick' ? amb.cur : wantSong(), true); else musicNext(); }
  else if (!M.len && M.source !== 'pick' && wantSong() !== amb.cur) musicStart(wantSong());   // phát liên tục theo giờ/lịch/tâm trạng: sang buổi khác thì hòa sang khúc mới
  const el = dock.querySelector('[data-left]'); if (el) el.textContent = leftTxt(); }, 5000);
window.addEventListener('pointerdown', () => { if (S.music.on && !amb.on) musicStart(); }, { once: true });
let world = null;
try { world = new World($('#gl'), S.look, hash.q !== undefined ? +hash.q : undefined, S.pos); world.onChirp = (pan, n, seed) => amb.chirp(pan, n, seed, S.birds.vol); world.onSfx = (kind, o) => amb.sfx(kind, o, S.music.vol); world.birdOpts = S.birds; if (hash.snap) world.snap = true; } catch (e) {
  $('#err').style.display = 'block'; $('#err').textContent = 'Trình duyệt này không mở được WebGL nên chưa dựng được cảnh 3D. Âm thanh và bảng 49 ngày vẫn dùng được. (' + e.message + ')'; console.error(e);
}

// ───────── Trạng thái cảnh ─────────
function islandState() {
  const tier = U.tier ?? (tierOpened(S) ? 1 : 0), d = U.sim ?? S.day, wk = Math.ceil(d / 7), p = (d - 1) / 48, up = tier >= 1;
  return { tier, mist: up ? 0.1 : 0.75 - 0.6 * p, bodhi: up ? 1 : 0.04 + 0.96 * p, water: Math.min(1, d / 7), clarity: wk >= 2 || up ? 1 : 0,
    lotus: up ? 12 : Math.min(12, Math.floor(d / 4)), goldCount: tier >= 2 ? 12 : wk >= 4 || up ? 7 : 0, gold: wk >= 4 || up ? 1 : 0,
    tea: d >= 15 || up, gate: d >= 43 || up ? 1 : d >= 29 ? 0.5 : 0, open: S.open, stream: up, sky: wk >= 6 && !up ? 0.6 : 0, lv: up ? 1 : Math.max(0, Math.min(1, p)), day: d, ref: reflectState() };
}
const unlocked = (z) => (U.tier ?? (tierOpened(S) ? 1 : 0)) >= 1 || (U.sim ?? S.day) >= z.unlock;
function visAt(t) {
  const g = (k) => valueAt(TR[k], t);
  const v = { breath: g('vBreath'), amber: g('vAmber'), night: g('vNight'), beams: g('vBeams'), fila: g('vFila'), calm: g('vCalm'), haloWhite: g('vHaloWhite'), rainbow: g('vRainbow'), jade: g('vJade'), merit: g('vMerit') };
  const k = Math.min(1, (performance.now() - U.bioAt) / 5000);
  if (U.bio === 'uddhacca') v.amber = Math.max(v.amber, k);
  if (U.bio === 'thina') { v.beams = Math.max(v.beams, k); v.night *= 1 - 0.5 * k; }
  return v;
}

// ───────── Thanh điều khiển ─────────
const track = $('#track'), fill = $('#track .fill'), thumb = $('#track .thumb');
STAGES.slice(1).forEach((s) => { const d = document.createElement('div'); d.className = 'tick'; d.style.left = (s.t0 / DUR) * 100 + '%'; track.appendChild(d); });
function updateBar(t) {
  const shown = U.drag ?? t, pc = (shown / DUR) * 100;
  fill.style.width = pc + '%'; thumb.style.left = pc + '%'; $('#time').textContent = fmt(shown) + ' / ' + fmt(DUR);
  const st = STAGES[stageAt(shown)];
  if (updateBar.last !== st.id + player.playing) {
    updateBar.last = st.id + player.playing;
    $('#stage').innerHTML = esc(st.name) + '<small>' + esc(st.pali) + '</small>'; $('#play').textContent = player.playing ? '❚❚' : '▶';
    track.setAttribute('aria-valuenow', Math.round(shown)); if (U.mode === 'hall') render();
  }
}
const posT = (e) => { const r = track.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * DUR; };
track.addEventListener('pointerdown', (e) => { track.setPointerCapture(e.pointerId); U.drag = posT(e); });
track.addEventListener('pointermove', (e) => { if (U.drag !== null) U.drag = posT(e); });
track.addEventListener('pointerup', (e) => { if (U.drag !== null) { player.seek(posT(e)); U.drag = null; } });
track.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') player.seek(player.time + 10); if (e.key === 'ArrowLeft') player.seek(player.time - 10); });
track.tabIndex = 0;
const togglePlay = () => { if (player.playing) player.pause(); else player.play().catch((e) => toast('Chưa phát được âm thanh: ' + e.message)); };
$('#play').addEventListener('click', togglePlay);
// Thu nhỏ / mở rộng thanh phát thời thiền (#79): thu về một nút nhỏ ở góc dưới để đỡ chiếm chỗ trên điện thoại; nhớ lựa chọn
const barBtn = $('#barmin'), barSync = () => { const m = !!S.barmin; document.body.classList.toggle('barmin', m); barBtn.textContent = m ? '▴' : '▾'; barBtn.title = m ? 'Mở rộng' : 'Thu nhỏ'; barBtn.setAttribute('aria-label', m ? 'Mở rộng thanh phát thời thiền' : 'Thu nhỏ thanh phát thời thiền'); };
barBtn.addEventListener('click', () => { S.barmin = !S.barmin; save(); barSync(); }); barSync(); stateReady.then(barSync, () => {});
$('#vol').addEventListener('input', (e) => player.setVolume(+e.target.value));
$('#bin').addEventListener('change', (e) => player.setBinaural(e.target.checked));
$('#bio').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  U.bio = b.dataset.b; U.bioAt = performance.now(); player.setBio(U.bio);
  document.querySelectorAll('#bio button').forEach((x) => x.classList.toggle('on', x === b));
  toast({ samadhi: 'Định tĩnh: trở về kịch bản chuẩn', uddhacca: 'Trị phóng dật: âm trầm 136,1 Hz dâng từ dưới Vân Tọa', thina: 'Trị hôn trầm: chuông tỉnh giác từ đỉnh đầu' }[U.bio] + (player.playing ? '' : ' (nghe được khi đang phát)'));
});
// Tự ghi nhận (#88): thời thiền viên mãn; đang Vân Du trên đảo đủ 5 phút thì ghi thêm Vân Du
player.onend = () => { const vd = S.vandu && U.mode === 'island' && sitMin() >= MIN_VANDU ? Math.round(sitMin()) : 0;
  // #107: ghi số phút thực sự đã ngồi theo đồng hồ âm thanh (tua tới không cộng); ≥ 12 phút mới là «thời trọn» khi xét mở Tầng 1
  const sat = player.lastSat, min = Math.min(15, Math.floor(sat / 60));
  logTu('thoi_thien', min, U.mode === 'hall' ? 'dai-thien-duong' : 'dai-thien'); if (vd) logTu('van_du', vd);
  U.sit = null; S.sessions++; save(); record('session.done', { kind: 'thien15', duration_s: Math.min(900, Math.round(sat)) }); toast('Sādhu! Thời thiền đã viên mãn. Hồi hướng công đức.'); render(); };
/** Mở Bia: kéo ngay bản mới nhất từ các thiết bị khác và danh mục việc nếu đã cũ (#93) */
function boardFresh() {
  if (missionsStale()) loadMissions(true).then(() => { if (U.view === 'board') render(); });
  if (variantsStale()) loadVariants(true).then(() => { if (U.view === 'board') render(); });   // #104: biến thể theo Duyên khởi
  dkPull(S).then(() => { if (U.view === 'board') render(); });
  const p = syncNow(true); if (U.view === 'board') render();
  p.then(() => { if (U.view === 'board') render(); }, () => {});
}
/** Nhắc nhẹ khi mở app hoặc quay lại: còn việc trong ngày thì báo một dòng, tối đa 3 giờ một lần, sau 6 giờ sáng (#93) */
function remind() {
  if (!S.name || S.completed || U.view === 'board' || new Date().getHours() < 6) return;
  let last = 0; try { last = Number(localStorage.getItem('vandao.nhac') || 0); } catch (e) { /* không sao */ }
  if (Date.now() - last < 3 * 3600000) return;
  const d = S.day, left = todayLeft(S, today(), allDone(d) ? 0 : 3 - Object.keys(S.done[d] || {}).length);
  if (!left.length) return;
  try { localStorage.setItem('vandao.nhac', String(Date.now())); } catch (e) { /* không sao */ }
  toast('Hôm nay còn: ' + left.map((x) => x.text).join(', ') + '. Mở Bia Tích Lũy để làm tiếp.');
}
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3800); }

// ───────── Nhãn trong cảnh ─────────
const L = $('#labels'), mkLabel = (cls, fn) => { const b = document.createElement('button'); b.className = cls; b.style.opacity = '0'; L.appendChild(b); if (fn) b.addEventListener('click', fn); return b; };
const zoneLb = {}; ZONES.forEach((z) => (zoneLb[z.id] = mkLabel('zl', () => goZone(z.id))));
const meLb = mkLabel('zl me', () => openCreator());
const friendLb = world ? Array.from({ length: 8 }, (_, i) => mkLabel('zl fr', () => openFriend(i))) : [];   // #125: tối đa 8 đảo bạn (4 thân thiết + 4 quen biết)
const tierLb = TIER_LABEL.map((p, i) => mkLabel('tl ladder', () => pickTier(i)));
const daisLb = Array.from({ length: 6 }, () => mkLabel('zl fr dais'));   // #151: tên người trên Đài Đồng Tu
function place(el, v, on, margin = 20) {
  const p = on ? world.project(v) : null, ok = !!p && p.vis && p.x > margin && p.x < world.w - margin && p.y > 56 && p.y < world.h - 96;
  el.style.opacity = ok ? '1' : '0'; el.style.pointerEvents = ok ? 'auto' : 'none'; if (ok) { el.style.left = p.x.toFixed(1) + 'px'; el.style.top = p.y.toFixed(1) + 'px'; }
}
function updateLabels() {
  if (!world) return;
  const home = world.av.where === 'home', isl = U.mode === 'island' && !world.tween, oy = world.home.group.position.y, creator = U.view === 'creator';
  ZONES.forEach((z) => {
    const el = zoneLb[z.id], a = ANCHORS[z.id].label, lock = !unlocked(z), key = z.id + lock + (U.zone === z.id);
    if (el.dataset.k !== key) { el.dataset.k = key; el.className = 'zl' + (lock ? ' lock' : '') + (U.zone === z.id ? ' on' : ''); el.innerHTML = esc(z.name) + (lock ? '<small>mở ngày ' + z.unlock + '</small>' : ''); }
    place(el, new THREE.Vector3(a[0], groundH(a[0], a[1]) + a[2] + oy, a[1]), isl && home && !creator);
  });
  const nm = S.name || 'Bạn'; if (meLb.dataset.k !== nm) { meLb.dataset.k = nm; meLb.textContent = nm; }
  place(meLb, world.headPos().add(new THREE.Vector3(0, 0.9, 0)), isl && !creator && world.av.state !== 'travel');
  friendLb.forEach((el, i) => { const f = world.friends[i]; if (!f) place(el, null, false); else if (el.textContent !== f.name) el.dataset.k = ''; el.style.visibility = f && f.id && world.camera.position.distanceTo(f.head) > 170 ? 'hidden' : ''; });   // #125: danh sách đổi thì đổi tên; nhãn bạn thật chỉ hiện khi đến gần
  world.friends.forEach((f, i) => { const el = friendLb[i]; if (!el.dataset.k) { el.dataset.k = '1'; el.textContent = f.name; } place(el, f.head, isl && !creator); });
  // Đài Đồng Tu: «Tịnh danh · mã» từng bạn, mình là «Tịnh danh (bạn)», chưa vào thì «đang tới».
  // Toàn cảnh: các bạn chỉ cách nhau vài điểm ảnh, nên gộp thành một nhãn đặt giữa đài
  const dh = world.daisHeads(), inHall = U.mode === 'hall' && !creator, one = world.daisView === 'far' && dh.length > 1;
  const nameOf = (h) => (h.me ? `${h.name} (bạn)` : h.here ? h.name : `${h.name} · đang tới`);
  daisLb.forEach((el, i) => {
    const h = dh[i], t = !h || (one && i) ? '' : one ? dh.map(nameOf).join(', ') : nameOf(h);
    if (el.dataset.k !== t) { el.dataset.k = t; el.textContent = t; }
    place(el, h ? (one ? h.head.clone().lerp(dh[dh.length - 1].head, 0.5) : h.head) : null, inHall && !!t);
  });
  // Nhãn các tầng xếp bậc thang đều: Sơ nhập dưới cùng, Tầng 1 → Tầng 4 lên dần và thụt đều về phía Tôn tượng
  tierLb.forEach((el, i) => { if (!el.dataset.k) { el.dataset.k = '1'; el.textContent = TIERS[i].name.replace(' · ', ': '); } });
  const showT = U.mode === 'journey' && !world.tween && world.mode === 'overview';
  const pTop = showT ? world.project(new THREE.Vector3(0, 362, -760)) : null, pEdge = showT ? world.project(new THREE.Vector3(-150, 300, -760)) : null, pBot = showT ? world.project(new THREE.Vector3(-150, 30, 40)) : null;
  if (pTop && pTop.vis && pEdge && pEdge.vis) {
    const w4 = tierLb[4].offsetWidth || 200, gap = 26, narrow = world.w < 700;
    let step = narrow ? 14 : Math.min(60, Math.max(24, world.w * 0.03)), x0 = pEdge.x - gap - w4 - 4 * step;
    if (x0 < 12) { step = Math.max(8, (pEdge.x - gap - w4 - 12) / 4); x0 = 12; }
    const pr = panel.getBoundingClientRect(), floor = narrow ? Math.min(world.h - 130, pr.top - 26) : world.h - 100;
    const yTop = Math.max(narrow ? 130 : 90, pTop.y), yBot = Math.max(yTop + 4 * (narrow ? 34 : 46), Math.min(floor, pBot && pBot.vis ? pBot.y : world.h * 0.8)), dy = (yBot - yTop) / 4;
    tierLb.forEach((el, i) => { el.style.left = (x0 + i * step).toFixed(1) + 'px'; el.style.top = (yBot - i * dy).toFixed(1) + 'px'; el.style.opacity = '1'; el.style.pointerEvents = 'auto'; });
  } else tierLb.forEach((el) => { el.style.opacity = '0'; el.style.pointerEvents = 'none'; });
}
function goZone(id) {
  if (world && world.av.where !== 'home') return toast('Bạn đang ở đảo bạn. Hãy về đảo trước.');
  const here = !!world && world.av.state === 'sit' && world.av.id === id;   // đang ngồi sẵn ở khu này: chỉ đổi góc nhìn, không bắt đứng dậy đi lại
  if (!here && meditating()) return move(() => goZone(id));
  U.zone = id; U.view = id === 'stele' ? 'board' : 'zone'; render();
  if (world) { if (here || !world.goZone(id, () => { if (id === 'pad') toast('Đã an tọa tại Đài Thiền. Bấm ▶ để bắt đầu thời thiền.'); savePos(); })) world.setMode('zone', { zone: id }); }
}

// ───────── Xả thiền: đang tọa thiền mà ra lệnh di chuyển thì hỏi trước ─────────
// U.sit: người dùng đã chủ động an tọa (Tịnh Thất, cùng bạn đồng tu). Nhân vật ngồi sẵn khi mở lại trang thì không tính là đang thiền.
const meditating = () => !!world && world.av.state === 'sit' && (player.playing || !!U.sit);
const wakeEl = $('#wake');
function hideWake() { clearTimeout(U.wakeT); wakeEl.hidden = true; U.wakeFn = null; }
/** Chạy một lệnh di chuyển. Đang tọa thiền thì hỏi; người dùng đồng ý mới xả thiền rồi chạy lệnh. */
function move(fn) {
  if (!meditating()) { U.sit = null; return fn(); }
  U.wakeFn = fn; wakeEl.querySelector('span').textContent = U.vd ? `Đang Vân Du, đã ngồi yên ${Math.floor(sitMin())} phút. Xả thiền để trở về?` : player.playing ? 'Thời thiền đang diễn ra. Xả thiền để di chuyển?' : 'Bạn đang tọa thiền. Xả thiền để di chuyển?';
  wakeEl.hidden = false; U.quietManual = false; wake(); clearTimeout(U.wakeT); U.wakeT = setTimeout(hideWake, 12000);   // không trả lời thì coi như ngồi tiếp
}
function endSit(then) { if (player.playing) player.pause(); U.sit = null; world.wake(() => { toast('Đã xả thiền.'); if (then) then(); render(); }); render(); }
wakeEl.addEventListener('click', (e) => { const b = e.target.closest('[data-wake]'); if (!b) return; const fn = U.wakeFn; hideWake(); if (b.dataset.wake === 'yes') endSit(fn); });
// Rời phân khu bằng chân: bảng trở về Vân Đảo nhưng máy quay ở lại bên nhân vật
function leaveZone() { if (U.view === 'zone' || U.view === 'board') { U.view = 'home'; U.zone = null; world.mode = 'island'; world.setLimits(); render(); } }
function walkPoint(x, z) { if (world.walkToPoint(x, z)) leaveZone(); }

// ───────── Vân Du: khi tọa thiền, máy quay rời chỗ ngồi đi viếng các cảnh ─────────
// Chặng tính theo số phút NGỒI YÊN liên tục, không phải thước đo tầng thiền hay quả vị (AGENTS.md mục 1.6): chỉ gọi tên cảnh đang viếng.
const VD = [['An trú', 0], ['Vân Đảo', 1], ['Biển mây', 4], ['Tịnh Cảnh', 9], ['Thanh Lương', 16], ['Tịnh Quang', 26], ['Vô Biên', 40]];
const CALM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, vdEl = $('#vd');
const sitMin = () => (U.sit ? (Date.now() - U.sit.at) / 60000 : 0);
/** Vị trí trên hành trình Vân Du (0…6, có phần lẻ khi đang lướt giữa hai cảnh); null khi không Vân Du */
function vanduK() {
  if (U.vdForce !== undefined) return U.vdForce;
  if (!S.vandu || !world || U.mode !== 'island' || U.view === 'creator' || !U.sit || !meditating()) return null;
  const T = sitMin(); let i = VD.length - 1; while (i > 0 && T < VD[i][1]) i--;
  if (i === VD.length - 1 || CALM) return i;   // người chọn "giảm chuyển động": chỉ đổi cảnh ở mốc, không lướt liên tục
  const f = (T - VD[i][1]) / (VD[i + 1][1] - VD[i][1]); return i + f * f * (3 - 2 * f);
}
function vanduTick() {
  const k = vanduK(), on = k !== null; if (world) { world.calm = CALM; world.setVandu(k); }
  if (on !== !!U.vd) { U.vd = on; document.body.classList.toggle('vandu', on); vdEl.hidden = !on;
    // giữ màn hình sáng suốt thời ngồi dài (điện thoại không tự tắt giữa chừng); trình duyệt không hỗ trợ thì bỏ qua
    if (on && navigator.wakeLock) navigator.wakeLock.request('screen').then((l) => { if (U.vd) U.lock = l; else l.release(); }).catch(() => {});
    if (!on && U.lock) { U.lock.release().catch(() => {}); U.lock = null; } }
  if (on) { const i = Math.min(VD.length - 1, Math.floor(k + 0.5)), T = sitMin() * 60, txt = `Vân Du · ${VD[i][0]} · chặng ${i + 1}/${VD.length}` + (U.sit ? ` · ngồi yên ${fmt(T)}` : ''); if (vdEl.textContent !== txt) vdEl.textContent = txt; }
}

// Phím mũi tên hoặc W A S D: bước đi theo hướng đang nhìn
const typing = (e) => !!(e.target && e.target.matches && e.target.matches('textarea,input,select,[role=slider]'));   // đang gõ chữ hoặc kéo thanh trượt: phím không điều khiển nhân vật
const KEYS = { arrowup: [0, 1], arrowdown: [0, -1], arrowleft: [-1, 0], arrowright: [1, 0], w: [0, 1], s: [0, -1], a: [-1, 0], d: [1, 0] }, held = new Set();
function steerNow() { if (!world) return; let x = 0, z = 0; if (!meditating()) held.forEach((k) => { x += KEYS[k][0]; z += KEYS[k][1]; }); world.steer(Math.sign(x), Math.sign(z)); if (x || z) leaveZone(); }
window.addEventListener('keydown', (e) => {
  const k = (e.key || '').toLowerCase(); if (!KEYS[k] || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
  if (!world || U.mode !== 'island' || U.view === 'creator' || world.av.where !== 'home') return;
  e.preventDefault(); if (held.has(k)) return; held.add(k); move(steerNow);
});
window.addEventListener('keyup', (e) => { if (held.delete((e.key || '').toLowerCase())) steerNow(); });
window.addEventListener('blur', () => { held.clear(); steerNow(); });
$('#cam').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cam]'); if (!b || !world) return; const k = b.dataset.cam;
  if (k === 'in') world.dolly(0.7); else if (k === 'out') world.dolly(1.43);
  else if (k === 'dais') { world.daisSpin = false; world.daisShot(world.daisView === 'far' ? 'near' : 'far'); daisCam(); }   // #151: Cùng ngồi ⇄ Toàn cảnh
  else if (k === 'spin') { world.daisSpin = !world.daisSpin; daisCam(); }
  else if (U.mode === 'hall' && world.dais) { world.daisShot('near'); daisCam(); }
  else if (U.mode === 'island') world.focusAvatar();
});
/** Nút góc máy Đài Đồng Tu chỉ hiện khi đài có người */
function daisCam() {
  const on = !!(world && world.dais), far = on && world.daisView === 'far', db = $('#cam [data-cam="dais"]'), sb = $('#cam [data-cam="spin"]');
  db.hidden = sb.hidden = !on;
  const t = far ? 'Cùng ngồi: nhìn gần các bạn trên Đài Đồng Tu' : 'Toàn cảnh: thấy trọn Tôn tượng và Đài Đồng Tu'; db.textContent = far ? '⌂' : '⛰'; db.title = t; db.setAttribute('aria-label', t);
  sb.setAttribute('aria-pressed', on && world.daisSpin ? 'true' : 'false');
}
if (world) world.onDaisSpin = () => daisCam();
function openFriend(i) { U.friend = i; U.view = 'friend'; U.zone = null; render(); }
function pickTier(k) { U.tier = k; U.sim = null; if (world) world.setMode(k === 0 ? 'island' : 'tier', { tier: k }); render(); }

// Bấm lên mặt đảo để đi tới đó (phân biệt với kéo xoay cảnh)
let down = null;
$('#gl').addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; U.quietManual = false; });
$('#gl').addEventListener('pointerup', (e) => {
  if (!down || !world) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
  if (U.vd) return move(() => {});   // đang Vân Du: mọi cái chạm vào cảnh đều là lời hỏi xả thiền hay ngồi tiếp
  if (moved > 6 || dt > 400 || U.mode !== 'island' || U.view === 'creator') return;
  const r = e.target.getBoundingClientRect(), p = world.pickGround(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  clearTimeout(U.walkT); if (p) U.walkT = setTimeout(() => move(() => walkPoint(p.x, p.z)), 260);   // chờ một nhịp: nếu là nhấp đúp thì không đi
});
$('#gl').addEventListener('dblclick', (e) => { if (!world || U.view === 'creator' || U.vd) return; clearTimeout(U.walkT); world.stopWalk(); const r = e.target.getBoundingClientRect(); world.zoomAt(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); });

// ───────── Bảng bên phải ─────────
const panel = $('#panel');
const bars = () => '<div class="bars">' + PILLARS.map((p) => `<div class="bar3"><span>${p.name}</span><i><b style="width:${Math.min(100, (S.totals[p.key] / (49 * 12)) * 100)}%;background:${p.color}"></b></i><span>${S.totals[p.key].toFixed(1)}</span></div>`).join('') + '</div>';
const seg = (key, list, cur) => `<div class="seg wrap" data-opt="${key}">` + list.map(([v, t]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${esc(t)}</button>`).join('') + '</div>';
const sw = (key, list, cur) => `<div class="sws" data-opt="${key}">` + list.map(([t, hex], i) => `<button class="sw${i === cur ? ' on' : ''}" data-v="${i}" title="${esc(t)}" aria-label="${esc(t)}" style="background:${hex || 'linear-gradient(135deg,#888 50%,#ccc 50%)'}"></button>`).join('') + '</div>';
function nameBlock(raw) { const c = checkName(raw); return { c, html: `<div id="nmMean" class="pali">${c.meaning ? esc(c.name) + ': ' + esc(c.meaning) : '&nbsp;'}</div><ul class="rules">` + c.rules.map((r) => `<li class="${r.ok ? 'ok' : 'no'}">${esc(r.text)}</li>`).join('') + '</ul>' }; }

/** Các dòng tự ghi nhận của một ngày, theo thứ tự danh mục */
function passiveLines(day) { return Object.keys(PASSIVE).filter((c) => day[c]).map((c) => { const x = day[c]; return PASSIVE[c].name + (x.min ? ` ${Math.round(x.min)} phút` : '') + (x.n > 1 ? ` (${x.n} lần)` : ''); }); }
/** Hoa sen 10 cánh (§9.1): độ sáng mỗi cánh theo tỉ lệ so với cánh mạnh nhất; không có con số tổng */
function lotusSvg(L) {
  const keys = Object.keys(PARAMI);
  const petals = keys.map((k, i) => { const a = (i * 36 - 90) * Math.PI / 180, o = (0.14 + 0.86 * L.norm[k]).toFixed(2), x = (50 + 26 * Math.cos(a)).toFixed(1), y = (50 + 26 * Math.sin(a)).toFixed(1);
    return `<ellipse cx="${x}" cy="${y}" rx="9" ry="19" transform="rotate(${i * 36} ${x} ${y})" fill="#e9b949" fill-opacity="${o}" stroke="#b8862b" stroke-opacity=".5"><title>${PARAMI[k]}: ${L.counts[k]} lần</title></ellipse>`; }).join('');
  return `<svg class="lotus" viewBox="0 0 100 100" role="img" aria-label="Hoa sen 10 cánh Ba-la-mật">${petals}<circle cx="50" cy="50" r="9" fill="#f6dc8a"/></svg>`;
}
/** «Tích lũy tu học» (quyết định 1, #85): hoa sen, lịch tu 49 ngày, nhịp thiền, sổ nghe Pháp. Không xếp hạng, không điểm thưởng. */
function tichLuy() {
  const t = today(), L = lotus(S.tu, S.done, S.sacca, S.viec), cal = calendar(S.tu, S.done, t, 49, S.viec), mins = weekSitMinutes(S.tu, t), hd = heardIds(S.tu), lib = library.items;
  const nL = lib.filter((x) => x.loat === 'loi-phat-day').length, nD = lib.filter((x) => x.loat === 'duong-xua').length, weak = weakest(L), days = cal.filter((c) => c.any).length;
  const top = Object.keys(PARAMI).filter((k) => L.norm[k] >= 0.6).map((k) => PARAMI[k]);
  return `<h3>Tích lũy tu học</h3><div class="tlhoc">${lotusSvg(L)}<div><p>${L.total ? `Cánh sáng rõ: ${esc(top.join(', '))}.` : 'Hoa sen sẽ sáng dần theo từng việc bạn thực hành.'}</p>` +
    (weak ? `<p class="muted">Cánh còn nhạt: ${esc(PARAMI[weak])}. Tuần này thử thêm một việc nhỏ của hạnh này.</p>` : '') + `</div></div>` +
    `<div class="cal" aria-label="Lịch tu 49 ngày">${cal.map((c) => `<i class="${c.any ? 'on' : ''}${c.sit ? ' s' : ''}${c.listen ? ' l' : ''}${c.gioi ? ' g' : ''}" title="${c.date}${c.sit ? ' · thiền' : ''}${c.listen ? ' · nghe Pháp' : ''}${c.gioi ? ' · giữ đủ năm giới' : ''}${c.confirm ? ' · ghi nhận' : ''}"></i>`).join('')}</div>` +
    `<p class="muted">49 ngày qua: ${days} ngày có thực hành · nhịp thiền 7 ngày: ${mins} phút · đã nghe trọn: Lời Phật dạy ${hd['loi-phat-day'].size}${nL ? '/' + nL : ''}, Đường Xưa ${hd['duong-xua'].size}${nD ? '/' + nD : ''}</p>` + ptLine(S);
}
function render() {
  if (U.view === 'board' || (U.view === 'zone' && U.zone === 'gate')) void tierLoad(render);   // #107: tình trạng cổng Tầng 1 (tối đa mỗi phút một lần)
  const d = S.day, wk = Math.ceil(d / 7), W = WEEKS[wk - 1], keep = panel.scrollTop;
  // thẻ Thuyết giảng: ẩn thanh phát thời thiền (trừ khi thời thiền đang phát) cho đỡ rối (#79)
  document.body.classList.toggle('stab', U.mode === 'hall' && U.hallTab === 'sermon' && !player.playing);
  let h = '';
  if (U.view === 'dongtu') {
    h = dtView();   // #124: Bạn đồng tu mở được ở mọi không gian; đang giảng thì phụ đề vẫn chạy
  } else if (U.mode === 'hall' && U.hallTab === 'sermon') {
    const L = library, list = L.items, q = sermon.on && U.queue;
    if (L.state === 'idle') loadSermons().then(() => { sermonPick(); render(); });
    // khi đang giảng, hàng nút điều khiển đứng ngay dưới tên: trên điện thoại bảng thu gọn vẫn thấy Dừng, Tạm dừng, ‹ › (#79)
    const ctl = sermon.on ? `<div class="row sctl"><button class="btn" data-act="sermon-stop">Dừng giảng</button><button class="btn alt" data-act="sermon-pause">${sermon.paused ? 'Tiếp tục' : 'Tạm dừng'}</button><button class="btn alt" data-act="sermon-prev" aria-label="Câu trước" title="Câu trước">‹</button><button class="btn alt" data-act="sermon-next" aria-label="Câu sau" title="Câu sau">›</button></div>` : '';
    // #79: bỏ đoạn mô tả và ô «Đọc thành tiếng…» cho gọn; thêm «Nghe lần lượt» cả loạt
    h = `<h2>Đại Thiền Đường Vô Tận</h2>${ctl}${q ? `<p class="muted sq">Nghe lần lượt · bài ${q.k + 1}/${q.ids.length}</p>` : ''}${seg('htab', [['sit', 'Thời thiền'], ['sermon', 'Thuyết giảng']], 'sermon')}` +
      (list.length ? (sermon.on ? '' : '<div class="row"><button class="btn" data-act="sermon-go">Thỉnh giảng</button><button class="btn alt" data-act="sermon-all" title="Nghe hết các bài của loạt đang chọn, từ bài đang chọn">Nghe lần lượt</button></div>') +
      '<h3>Bài giảng</h3>' + sermonList(list) +
      `<p class="note">Bài giảng tóm lược để tham khảo, viết bằng lời mới theo kinh điển; nguồn kinh ghi dưới tên bài.${list.some((x) => x.audio) ? ' Giọng đọc được tạo bằng AI.' : ''}</p>`
      : L.state === 'error' ? `<p class="sermon-empty">Chưa tải được danh sách bài giảng. Cần kết nối mạng; bản HTML đơn mở từ tệp trên máy không tải được bài giảng.</p><div class="row"><button class="btn alt" data-act="sermon-reload">Thử lại</button></div>`
      : L.state === 'ok' ? '<p class="sermon-empty">Chưa có bài chia sẻ. Nội dung đang được cập nhật.</p>'
      : '<p class="sermon-empty muted">Đang tải bài giảng…</p>') +
      `<p class="muted">Số bài đã nghe trọn: ${S.sermons || 0}.</p>`;
  } else if (U.mode === 'hall') {
    const cur = stageAt(U.drag ?? player.time);
    h = `<h2>Đại Thiền Đường Vô Tận</h2>${seg('htab', [['sit', 'Thời thiền'], ['sermon', 'Thuyết giảng']], 'sit')}<p class="pali">Ananta-megha mahā-sālā</p>
      <p>Mỗi người một Vân Tọa giữa biển mây không chân trời, cùng hướng về Tôn tượng ở phương Đông. Hai bên là các bậc Vân Đảo dâng cao dần về phía hào quang.</p><h3>Thời thiền 15 phút</h3>` +
      STAGES.map((s, i) => `<button class="stg${i === cur ? ' on' : ''}" data-seek="${s.t0}"><span>${fmt(s.t0)}</span><div><b>${esc(s.name)}</b><em>${esc(s.sound)}</em></div></button>`).join('') +
      `<p class="note">Nên dùng tai nghe để nghe rõ hướng của chuông. Trình duyệt chỉ cho phát âm thanh sau khi bạn bấm ▶.</p>
      <p class="muted">Số thời thiền đã ngồi trọn: ${S.sessions}. Những người ngồi quanh là mô phỏng; bản nhiều người cần máy chủ.</p>`;
  } else if (U.mode === 'journey') {
    const cur = U.tier ?? (tierOpened(S) ? 1 : 0);
    h = `<h2>Các tầng tỉnh thức</h2>
      <p class="note">Tên tầng là biểu trưng để định hướng thực hành. Ứng dụng không chứng nhận quả vị; tiến trình đo bằng giới, thiền và việc thiện ngoài đời.</p>
      <div class="row"><button class="btn alt" data-act="overview">Toàn cảnh</button><button class="btn alt" data-act="realm">Toàn cõi</button><button class="btn alt" data-act="mine">Vân Đảo của tôi ở tầng này</button></div>` +
      TIERS.map((t) => `<button class="tier${t.key === cur ? ' on' : ''}" data-tier="${t.key}"><b>${esc(t.name)}</b> <span class="pali">${esc(t.pali)}</span>
        <div><strong>Nền tảng:</strong> ${esc(t.base)}</div><div><strong>Thực hành:</strong> ${esc(t.tasks)}</div><div><strong>Không gian:</strong> ${esc(t.space)}</div></button>`).join('') +
      `<p class="muted">Bấm một tầng để bay tới đó. Càng lên cao, Vân Đảo càng giản lược; ở Tầng 4 chỉ còn Vân Tọa sáng quanh hào quang.</p>`;
  } else if (U.view === 'account') {
    h = accountView();
  } else if (U.view === 'duyen') {
    h = dkView();
  } else if (U.view === 'phantinh') {
    h = ptView(S);
  } else if (U.view === 'creator') {
    const D = U.draft, k = D.look, nb = nameBlock(D.name);
    h = `<h2>Nhân vật của bạn</h2>${S.name ? '' : '<div class="row"><button class="ghost" data-act="acct-open" data-v="have">Tôi đã có hành trình</button></div>'}
      <h3>Tịnh danh</h3><input id="nm" type="text" maxlength="20" value="${esc(D.name)}" placeholder="Ví dụ: Tâm An" autocomplete="off" spellcheck="false"><div id="nmBox">${nb.html}</div>
      <div class="chips" data-opt="chip">${U.chips.map((n) => `<button class="chip" data-v="${esc(n)}">${esc(n)}</button>`).join('')}<button class="chip more" data-act="chips">Gợi ý khác</button></div>
      <p class="muted">Tịnh danh là tên tu tập trong ứng dụng. Nếu đã có pháp danh do thầy ban khi quy y, hãy dùng pháp danh ấy.</p>
      <h3>Phong cách</h3><div class="chips" data-opt="preset">${PRESETS.map((p, i) => `<button class="chip" data-v="${i}" title="${esc(p.note)}">${esc(p.name)}</button>`).join('')}</div>
      <h3>Diện mạo</h3>
      <label class="fl">Giới tính</label>${seg('gender', OPTIONS.gender, k.gender || 'nam')}
      <label class="fl">Dáng người</label>${seg('build', OPTIONS.build, k.build)}
      <div class="sl"><span>Chiều cao</span><input type="range" data-opt="height" min="0.94" max="1.06" step="0.01" value="${k.height}"><b></b></div>
      <label class="fl">Màu da</label>${sw('skin', OPTIONS.skin, k.skin)}
      <label class="fl">Kiểu tóc</label>${seg('hair', OPTIONS.hair, k.hair)}
      <label class="fl">Màu tóc</label>${sw('hairColor', OPTIONS.hairColor, k.hairColor)}
      <label class="fl">Tuổi</label>${seg('age', OPTIONS.age, k.age)}
      <label class="fl">Thần thái</label>${seg('mood', OPTIONS.mood, k.mood)}
      <h3>Y phục</h3>
      <label class="fl">Màu áo tràng</label>${sw('robe', OPTIONS.robe, k.robe)}
      <label class="fl">Viền và đai</label>${seg('trim', OPTIONS.trim.map((t, i) => [i, t[0]]), k.trim)}
      <label class="fl">Vật tùy thân</label>${seg('acc', OPTIONS.acc, k.acc)}
      <p class="muted">Bảng màu chỉ gồm áo của người tại gia; y vàng dành cho chư Tăng.</p>
      <h3>Thú cưng đồng hành</h3>
      <label class="fl">Loài</label>${seg('pet', OPTIONS.pet, k.pet || 'khong')}
      ${OPTIONS.petv[k.pet] ? `<label class="fl">Bộ lông</label>${seg('petv', OPTIONS.petv[k.pet], k.petv || '0')}<p class="muted">Thú cưng theo bạn quanh Vân Đảo, ngồi cạnh khi bạn tọa thiền, và lớn dần theo hành trình 49 ngày.</p>` : ''}
      <h3>Chim cảnh trên Vân Đảo</h3>
      <label class="fl">Số chim ghé đảo: <strong data-bnv>${S.birds.n}</strong></label><input type="range" data-bn min="0" max="12" step="1" value="${S.birds.n}" aria-label="Số chim ghé đảo">
      <label class="fl">Tần suất ghé</label>${seg('bfreq', [[0.5, 'Thưa'], [1, 'Vừa'], [2, 'Năng ghé']], S.birds.freq)}
      <label class="fl">Tiếng hót: <strong data-bvv>${S.birds.vol > 0 ? Math.round(S.birds.vol * 100) + '%' : 'tắt'}</strong></label><input type="range" data-bvol min="0" max="1" step="0.05" value="${S.birds.vol}" aria-label="Âm lượng tiếng chim">
      <div class="row"><button class="ghost" data-act="chirp">Nghe thử tiếng chim</button></div>
      <h3>Xem tư thế</h3>${seg('pose', [['stand', 'Đứng'], ['anjali', 'Chắp tay'], ['sit', 'Tọa thiền']], U.pose)}
      <div class="row"><button class="btn" data-act="saveLook" ${nb.c.ok ? '' : 'disabled'}>Lưu nhân vật</button><button class="btn alt" data-act="rand">Ngẫu nhiên hài hòa</button><button class="ghost" data-act="home">← Vân Đảo</button></div>`;
  } else if (U.view === 'friend' && world) {
    const f = world.friends[U.friend], away = world.av.where === U.friend, gateOk = islandState().gate >= 0.5, moving = world.av.state === 'travel';
    h = f.id ? friendReal(f, away, gateOk, moving) : `<h2>${esc(f.name)}</h2><p class="pali">Bạn đồng tu · Vân Đảo láng giềng${f.day ? ` · ngày ${f.day}/49 của hành trình` : ''}</p>
      <p>${away ? 'Bạn đang ở đảo của ' + esc(f.name) + '. Hãy giữ sự tĩnh lặng của chủ nhà.' : esc(f.name) + ' đang tọa thiền trên đảo bên cạnh. Bạn có thể chào, tùy hỷ, hoặc du vân sang thăm.'}</p>
      <div class="row"><button class="btn" data-act="greet">Chắp tay chào</button><button class="btn alt" data-act="rejoice">Tùy hỷ công đức</button></div><div class="row">` +
      (away ? '<button class="btn alt" data-act="sitwith">Mời cùng tọa thiền</button><button class="btn alt" data-act="gohome">Về đảo của mình</button>' : `<button class="btn alt" data-act="visit" ${gateOk && !moving && world.av.where === 'home' ? '' : 'disabled'}>Du vân sang thăm</button>`) + '</div>' +
      (!away && !gateOk ? '<p class="note">Cổng Vân Môn mở nửa từ ngày 29. Muốn thử ngay, kéo thanh “Xem trước tiến trình” tới ngày 29 trở lên.</p>' : '') +
      `<p class="muted">Bạn đồng tu trong bản này là mô phỏng. Tùy hỷ ở đây là cử chỉ; điểm Thiện chỉ ghi khi bạn thật sự giúp người ngoài đời.</p><div class="row"><button class="ghost" data-act="home">← Vân Đảo</button></div>`;
  } else if (U.view === 'board') {
    h = `<h2>Bia Tích Lũy</h2><p class="pali">Ngày ${d}/49 · Tuần ${wk}: ${esc(W.title)}</p>${bars()}`;
    // #93: việc còn lại hôm nay và trạng thái đồng bộ giữa các thiết bị
    h += todayBox(S, today(), S.completed || allDone(d) ? 0 : 3 - Object.keys(S.done[d] || {}).length) + '<span id="nv-chinh"></span>' + dkCard() + ptCard(S, today()) + tierBlock(S, ptSaved(S, 7));   // #107: cổng Tầng 1
    if (ct.state === 'idle') loadVariants().then(render);
    const tdy = S.tu[today()] || {}, ev = passiveLines(tdy);
    if (library.state === 'idle') loadSermons().then(render);
    PILLARS.forEach((p) => {
      const [title, text] = W[p.key], dn = S.done[d] && S.done[d][p.key];
      // #104: có Duyên khởi và danh mục biến thể thì hiện gợi ý hôm nay; không thì gợi ý chung của tuần
      h += `<div class="task${dn ? ' done' : ''}" data-p="${p.key}"><div class="k" style="color:${p.color}">${p.name} · ${p.sub}</div>${variantHtml(S, p.key, today(), dn, title) || `<h4>${esc(title)}</h4><p>${esc(text)}</p>`}` +
        // quyết định 3 (#85): tự ghi nhận không tự hoàn thành trục Tuệ, chỉ là bằng chứng để tự quán chiếu
        (p.key === 'tue' && !dn && ev.length ? `<p class="muted ev">Đã tự ghi nhận hôm nay: ${esc(ev.join(' · '))}. Hãy tự quán chiếu rồi xác nhận.</p>` : '') +
        (dn ? `<p class="muted" style="margin-top:6px">Đã ghi nhận hôm nay · +${dn.E.toFixed(2)}</p>` :
          `<details><summary>Quán chiếu tác ý rồi xác nhận</summary>
            <div class="sl"><span>Trước khi làm</span><input type="range" data-c="pre" min="0.5" max="1.2" step="0.05" value="1"><b>1.00</b></div>
            <div class="sl"><span>Trong khi làm</span><input type="range" data-c="during" min="0.5" max="1.2" step="0.05" value="1"><b>1.00</b></div>
            <div class="sl"><span>Sau khi làm</span><input type="range" data-c="post" min="0.5" max="1.2" step="0.05" value="1"><b>1.00</b></div>
            <label class="chk"><input type="checkbox" data-c="wise"> Có như lý tác ý và hồi hướng (×1,5)</label>
            <label class="chk"><input type="checkbox" data-c="self"> Tự giác, không cần nhắc (×1,25)</label>
            <textarea data-c="note" placeholder="Một hai dòng quán chiếu (không bắt buộc)"></textarea>
            <div class="row"><button class="btn" data-act="confirm">Xác nhận đã thực hành</button><span class="muted">Năng lượng thiện: <b data-e>10.00</b></span></div></details>`) + '</div>';
    });
    // đợt C (#91): Giữ giới hôm nay, Hạnh của tuần, Nguyện tuần, ngày trai (danh mục đợt B, chỉ mục đã phát hành)
    if (nv.state === 'idle') loadMissions().then(render);
    h += soNhapView(S, today());
    h += `<h3>Tự ghi nhận hôm nay</h3>` + (ev.length ? `<ul class="auto">${ev.map((x) => `<li>✓ ${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Ngồi một thời thiền hay nghe trọn một bài Pháp, Vân Đạo sẽ tự ghi nhận ở đây.</p>') + tichLuy();
    h += `<p class="note">Phần thưởng của tuần: ${esc(W.reward)}</p>` +
      (allDone(d) ? `<p><strong>${d < 49 ? 'Đã trọn ba việc hôm nay. Ngày mai sẽ mở ngày ' + (d + 1) + '.' : 'Đã viên mãn 49 ngày: Cổng Vân Môn mở, bước lên Tầng 1.'}</strong></p>` : '') +
      `<div class="row"><button class="btn alt" data-act="sacca">Sám hối chân thật</button><span class="muted">Hạt Chân thật: ${S.sacca}</span></div>
      <p class="muted">Mỗi ngày chỉ mở một nấc. Các hệ số là tự khai để quán chiếu, không phải phép đo tâm.</p>
      <div class="row"><button class="ghost" data-act="home">← Vân Đảo</button><button class="ghost" data-act="dk-open">Duyên khởi</button><button class="ghost" data-act="reset">${U.resetArm ? 'Bấm lần nữa để xóa hành trình' : 'Bắt đầu lại từ ngày 1'}</button>${d > 1 || accountOn() ? accountHint() : ''}</div>`;
  } else if (U.view === 'zone' && U.zone) {
    const z = ZONES.find((x) => x.id === U.zone), ok = unlocked(z);
    h = `<h2>${esc(z.name)}</h2><p class="pali">${esc(z.pali)}</p><p>${esc(z.text)}</p>` + (z.note ? `<p class="note">${esc(z.note)}</p>` : '') +
      (!ok ? `<p class="note">Phân khu này mở ở ngày ${z.unlock} của hành trình 49 ngày.</p>` : '') + '<div class="row">' +
      (z.action === 'sit' ? '<button class="btn" data-act="play">Bắt đầu thời thiền</button><button class="btn alt" data-act="hall">Sang Đại Thiền Đường</button>' : '') +
      (z.action === 'gate' && ok ? `<button class="btn" data-act="gate">${S.open ? 'Chuyển sang Độc cư (khép cổng)' : 'Chuyển sang Nghênh khách (mở cổng)'}</button>` : '') +
      (z.id === 'kuti' ? '<button class="btn" data-act="kuti-sit">Tọa thiền tại đây</button>' : '') +
      (z.action === 'board' ? '<button class="btn" data-act="board">Mở bảng nhiệm vụ</button>' : '') + '<button class="ghost" data-act="home">← Vân Đảo</button></div>' + (z.id === 'kuti' ? '<h3>Hướng ngồi</h3>' + seg('kface', [[0, 'Cửa chính'], [1, 'Bên phải'], [2, 'Vào trong'], [3, 'Bên trái']], S.kface || 0) : '') +
      ((z.id === 'kuti' || z.id === 'tea') && ok ? `<h3>Nhạc thiền</h3><div class="row"><button class="btn alt" data-act="mus-toggle">${amb.on ? 'Tạm ngưng nhạc' : 'Mở nhạc thiền'}</button><button class="ghost" data-act="mus-open">Chọn khúc và thời lượng</button></div>
        <p class="muted">${amb.on && amb.cur ? 'Đang phát: ' + esc(SONG[amb.cur].name) + leftTxt() + '.' : 'Nhạc đang tắt.'} ${S.music.len ? 'Mỗi khúc ' + S.music.len + ' phút, ' + ORDER[S.music.order].toLowerCase() + '.' : 'Phát liên tục.'}</p>` : '') +
      (['kuti', 'pad', 'tea'].includes(z.id) && ok ? `<h3>Vân Du</h3><label class="chk"><input type="checkbox" data-vandu ${S.vandu ? 'checked' : ''}> Khi tọa thiền, máy quay rời chỗ ngồi đi viếng cảnh</label>
        <p class="muted">Ngồi yên càng lâu, cảnh càng xa: ${VD.slice(1).map((v) => v[0] + ' (' + v[1] + '′)').join(', ')}. Vân Du chỉ đếm thời gian ngồi yên; đó không phải thước đo tầng thiền hay quả vị. Chạm vào cảnh để xả thiền hoặc ngồi tiếp.</p>` : '') +
      (z.action === 'gate' && ok ? `<p class="muted">Hiện tại: ${S.open ? 'Nghênh khách. Bấm tên một bạn đồng tu ở đảo bên để chào hoặc sang thăm.' : 'Độc cư.'}</p>` : '') +
      (z.action === 'gate' ? dtGateLine() + tierBlock(S, ptSaved(S, 7)) : '');
  } else {
    const sim = U.sim ?? d;
    h = `<h2>Vân Đảo của ${esc(S.name || 'bạn')}</h2><p class="pali">Sơ nhập Tịnh Cảnh · ngày ${d}/49 · tuần ${wk}: ${esc(W.title)}</p>${bars()}
      <p class="muted">Bấm tên một phân khu, bấm thẳng lên mặt đảo, hoặc dùng phím mũi tên (W A S D) để đi. Kéo để xoay cảnh; cuộn hoặc nút + − để phóng to, thu nhỏ; ◎ đưa máy quay về bên nhân vật. Bấm tên bạn đồng tu ở đảo bên để chào.</p>
      <div class="row"><button class="btn" data-act="board">Nhiệm vụ hôm nay</button><button class="btn alt" data-act="sit">Đến Đài Thiền</button><button class="btn alt" data-act="creator">${S.name ? 'Sửa nhân vật' : 'Tạo nhân vật'}</button></div>
      <div class="row">${accountHint()}${S.name || accountOn() ? '' : '<button class="ghost" data-act="acct-open" data-v="have">Tôi đã có hành trình</button>'}</div>
      <h3>Xem trước tiến trình</h3>
      <div class="sl"><span>Ngày thứ</span><input type="range" id="sim" min="1" max="49" step="1" value="${sim}"><b id="simv">${sim}</b></div>
      <p class="muted" id="simt">${esc(WEEKS[Math.ceil(sim / 7) - 1].reward)}</p>
      <div class="row"><button class="ghost" data-act="nosim">Về ngày hiện tại</button></div>` +
      (mem ? '<p class="note">Trình duyệt đang chặn lưu trữ cục bộ, nên tiến trình chỉ giữ đến khi đóng trang.</p>' : '');
  }
  panel.innerHTML = '<button class="ghost pm" data-act="pmin">' + (document.body.classList.contains('pmin') ? 'Mở bảng' : 'Thu gọn') + '</button>' + h;
  panel.scrollTop = keep;
  fitSub();
}

// #139: phụ đề Thuyết giảng (#sub) luôn nằm trên mép trên thực tế của bảng. Đo khoảng từ đáy #ui tới mép trên #panel
// (theo vùng nhìn thấy thật, kể cả khi thanh địa chỉ trình duyệt điện thoại hiện) rồi đặt --subb cho CSS điện thoại.
// Đo lại khi bảng đổi cỡ, khi lớp của body đổi (thu gọn, thanh nhạc, thẻ giảng), khi xoay màn hình.
function fitSub() {
  const ui = $('#ui'); if (!ui || !panel) return;
  const gap = ui.getBoundingClientRect().bottom - panel.getBoundingClientRect().top;
  document.documentElement.style.setProperty('--subb', Math.max(8, Math.round(gap + 10)) + 'px');
}
if (typeof ResizeObserver === 'function') new ResizeObserver(fitSub).observe(panel);
new MutationObserver(fitSub).observe(document.body, { attributes: true, attributeFilter: ['class'] });
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitSub);

// ───────── Trình tạo nhân vật ─────────
function openCreator() {
  if (!world) return; if (world.av.where !== 'home') return toast('Hãy về đảo của mình rồi sửa nhân vật.');
  if (meditating()) return move(openCreator);
  if (U.mode !== 'island') setMode('island');
  U.draft = { name: S.name || U.chips[0], look: { ...S.look } }; U.pose = world.fig.pose === 'sit' ? 'sit' : 'stand'; U.view = 'creator'; U.zone = null; panel.scrollTop = 0; render(); world.setMode('creator');
}
let lookTimer = 0;
function applyDraft() { clearTimeout(lookTimer); lookTimer = setTimeout(() => { world.setLook(U.draft.look); world.fig.setPose(U.pose); world.av.state = U.pose === 'sit' ? 'sit' : 'idle'; if (U.pose === 'anjali') world.av.hold = 1e9; }, 30); }
function closeCreator(saved) { if (!saved && world) { world.setLook(S.look); } if (world) { world.av.hold = 0; if (world.fig.pose === 'anjali') world.fig.setPose('stand'); } U.draft = null; }
panel.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.dt !== undefined) return dtInput(t);
  if (t.dataset.bn !== undefined) { S.birds.n = +t.value; const o = panel.querySelector('[data-bnv]'); if (o) o.textContent = S.birds.n; save(); return; }
  if (t.dataset.bvol !== undefined) { S.birds.vol = +t.value; const o = panel.querySelector('[data-bvv]'); if (o) o.textContent = S.birds.vol > 0 ? Math.round(S.birds.vol * 100) + '%' : 'tắt'; save(); return; }
  if (t.dataset.tts !== undefined) { S.tts = t.checked; save(); return; }
  if (t.dataset.vandu !== undefined) { S.vandu = t.checked; save(); return; }
  if (t.id === 'sim') { U.sim = +t.value; U.tier = null; $('#simv').textContent = t.value; $('#simt').textContent = WEEKS[Math.ceil(U.sim / 7) - 1].reward; return; }
  if (t.id === 'nm') { U.draft.name = t.value; const nb = nameBlock(t.value); $('#nmBox').innerHTML = nb.html; const b = panel.querySelector('[data-act="saveLook"]'); if (b) b.disabled = !nb.c.ok; return; }
  if (t.dataset.opt === 'height') { U.draft.look.height = +t.value; applyDraft(); return; }
  const card = t.closest('.task'); if (!card) return;
  if (t.type === 'range') t.nextElementSibling.textContent = (+t.value).toFixed(2);
  card.querySelector('[data-e]').textContent = kusala(readCard(card)).toFixed(2);
});
const readCard = (card) => { const q = (k) => card.querySelector(`[data-c="${k}"]`); return { pre: +q('pre').value, during: +q('during').value, post: +q('post').value, wise: q('wise').checked, self: q('self').checked, note: q('note').value.trim() }; };
panel.addEventListener('click', (e) => {
  const sk = e.target.closest('[data-seek]'); if (sk) { player.seek(+sk.dataset.seek); if (!player.playing) togglePlay(); return; }
  const tr = e.target.closest('[data-tier]'); if (tr) return pickTier(+tr.dataset.tier);
  if (musicAct(e)) return;
  const su = e.target.closest('[data-sut]'); if (su) { U.sutta = su.dataset.sut; if (!sermon.on) return render();
    const q = U.queue, k = q ? q.ids.indexOf(U.sutta) : -1; if (k >= 0) { q.k = k; q.k0 = -1; return queuePlay(); } U.queue = null; sermonStart(U.sutta); return; }
  const ob = e.target.closest('[data-opt] button');
  if (ob && ob.parentElement.dataset.opt === 'bfreq') { S.birds.freq = +ob.dataset.v; save(); render(); return; }
  if (ob && ob.parentElement.dataset.opt === 'kface') { S.kface = +ob.dataset.v; save(); if (world) world.setFace(S.kface); render(); setTimeout(savePos, 1200); return; }
  if (ob && ob.parentElement.dataset.opt === 'loat') { U.loat = ob.dataset.v; if (!sermon.on && !inLoat().some((x) => x.id === U.sutta)) U.sutta = inLoat()[0] && inLoat()[0].id; render(); return; }
  if (ob && ob.parentElement.dataset.opt === 'htab') { if (ob.dataset.v !== 'sermon' && sermon.on) sermonStop(); U.hallTab = ob.dataset.v; if (U.hallTab === 'sermon') loadSermons().then(() => { sermonPick(); render(); }); render(); return; }
  if (ob && U.draft && !ob.dataset.act) {
    const key = ob.parentElement.dataset.opt, v = ob.dataset.v, D = U.draft;
    if (key === 'chip') D.name = v; else if (key === 'preset') Object.assign(D.look, PRESETS[+v].look); else if (key === 'pose') U.pose = v;
    else D.look[key] = ['skin', 'robe', 'trim', 'hairColor'].includes(key) ? +v : v;
    if (key === 'gender') { const h = D.look.hair; if (v === 'nu' && (h === 'ngan' || h === 'cao')) D.look.hair = 'xoa'; if (v === 'nam' && h === 'xoa') D.look.hair = 'ngan'; }   // đổi giới tính thì gợi kiểu tóc hợp, vẫn đổi lại được
    if (key === 'pet') D.look.petv = '0';
    applyDraft(); render(); return;
  }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act !== 'reset') U.resetArm = false;
  if (act.startsWith('acct-')) return accountAct(act.slice(5), b);   // T2.3: Giữ hành trình, Tài khoản (ui/account.js)
  if (act.startsWith('dt-')) return dtAct(act.slice(3), b);   // #124: Bạn đồng tu (ui/dong-tu.js)
  if (act === 'nv-jump') { const t = panel.querySelector('#' + b.dataset.to); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
  if (act.startsWith('tg-')) { void tierAct(act, render, toast); return; }   // #107: ui/tang-1.js
  if (act.startsWith('pt-')) { const r = ptAct(act, b, S, today()); if (r.view) U.view = r.view; if (r.msg) toast(r.msg); render(); return; }   // #104: ui/phan-tinh.js, chỉ trên máy
  if (act.startsWith('dk-')) { const end = (r) => { if (r.view) U.view = r.view; if (r.msg) toast(r.msg); save(); render(); }, r = dkAct(act, b, S, today()); if (r && r.then) r.then(end); else end(r); return; }   // #104: ui/duyen-khoi.js
  if (act.startsWith('nv-')) { const msg = soNhapAct(act, b, S, today()); save(); if (msg) { toast(msg); if (world && /cánh sen|Đã giữ|thọ trì|giữ nguyện/.test(msg)) world.burst(0xf3d27a, null, 0.7); } render(); return; }   // đợt C (#91): ui/so-nhap.js
  if (['board', 'sit', 'visit'].includes(act) && meditating()) return move(() => { const again = panel.querySelector('[data-act="' + act + '"]'); if (again) again.click(); });
  if (act === 'kuti-sit') { const sat = () => { world.setFace(S.kface || 0); savePos(); U.sit = { at: Date.now(), zone: 'kuti' }; toast('Đã an tọa tại Tịnh Thất.'); render(); };
    if (world) { if (world.av.state === 'sit' && world.av.id === 'kuti') sat(); else world.goZone('kuti', sat); } return; }
  if (act === 'chirp') { amb.chirp(0, 4, Math.random() * 9, Math.max(0.15, S.birds.vol)); return; }
  if (act === 'sermon-all') { sermonAll(); return; }
  if (act === 'sermon-go') { const mine = inLoat(); sermonStart(mine.some((x) => x.id === U.sutta) ? U.sutta : mine[0] && mine[0].id); return; }
  if (act === 'sermon-reload') { loadSermons(true).then(() => { sermonPick(); render(); }); render(); return; }
  if (act === 'sermon-stop') { sermonStop(); render(); return; }
  if (act === 'sermon-pause') { if (sermon.paused) sermon.resume(); else sermon.pause(); render(); return; }
  if (act === 'sermon-prev' || act === 'sermon-next') { sermon.step(act === 'sermon-next' ? 1 : -1); return; }
  if (act === 'pmin') { document.body.classList.toggle('pmin'); render(); return; }
  if (act === 'creator') return openCreator();
  if (act === 'chips') { U.chips = suggestNames(6); render(); return; }
  if (act === 'rand') { const R = (n) => Math.floor(Math.random() * n), pk = (l) => l[R(l.length)][0]; Object.assign(U.draft.look, PRESETS[R(PRESETS.length)].look, { skin: R(5), build: pk(OPTIONS.build), age: pk(OPTIONS.age), hairColor: R(2) }); if (U.draft.look.age === 'cao') U.draft.look.hairColor = 2 + R(2); U.draft.name = suggestNames(1)[0]; applyDraft(); render(); return; }
  if (act === 'saveLook') { const c = checkName(U.draft.name); if (!c.ok) return; S.name = c.name; S.look = { ...U.draft.look }; save(); persistStorage(); recordProfile(S); closeCreator(true); U.view = 'home'; world.setMode('island'); toast('Đã lưu: ' + c.name + (c.meaning ? ' (' + c.meaning + ')' : '')); render(); return; }
  if (act === 'board') { if (U.view === 'creator') closeCreator(false); U.view = 'board'; U.zone = 'stele'; boardFresh(); if (world && world.av.where === 'home') { if (!world.goZone('stele', () => savePos())) world.setMode('zone', { zone: 'stele' }); } }
  else if (act === 'home') { if (U.view === 'creator') closeCreator(false); U.view = 'home'; U.zone = null; if (world) world.setMode('island'); }
  else if (act === 'sit') { goZone('pad'); return; }
  else if (act === 'play') { if (!player.playing) togglePlay(); }
  else if (act === 'hall') { setMode('hall'); return; }
  else if (act === 'overview') { world.setMode('overview'); }
  else if (act === 'realm') { U.tier = null; world.setMode('realm'); render(); }
  else if (act === 'mine') { world.setMode('island'); }
  else if (act === 'gate') { S.open = !S.open; save(); void dtSyncOpen(S.open); toast(S.open ? 'Nghênh khách: cổng mây mở' : 'Độc cư: cổng mây khép'); }   // #124: máy chủ kiểm quyền ghé thăm theo chế độ cổng
  else if (act === 'nosim') { U.sim = null; }
  else if (act === 'greet') { world.greet(U.friend); toast('Bạn chắp tay chào. ' + world.friends[U.friend].name + ' mỉm cười đáp lễ.'); }
  else if (act === 'rejoice') { world.rejoice(U.friend); toast('Sādhu! Tùy hỷ công đức của ' + world.friends[U.friend].name + '.'); }
  else if (act === 'visit') { const i = U.friend; world.setMode('island'); world.visit(i, () => { toast('Đã đến đảo của ' + world.friends[i].name + '.'); world.greet(i); render(); }); toast('Du vân theo vân lộ…'); }
  else if (act === 'gohome') { world.goHome(() => { toast('Đã về Vân Đảo của mình.'); U.view = 'home'; world.setMode('island'); render(); }); toast('Du vân trở về…'); }
  else if (act === 'xin-tham' || act === 'ghe-vang') void askVisit(world.friends[U.friend], act === 'ghe-vang');   // #125: bạn đồng tu thật
  else if (act === 'sitwith') { world.sitWith(U.friend, 'thien', () => { if (!player.playing) togglePlay(); U.sit = { at: Date.now(), zone: null }; render(); }); toast('Hai người cùng an tọa, hướng về Tôn tượng.'); }   // #125: tới ngồi cạnh chủ đảo
  else if (act === 'sacca') { S.sacca++; save(); record('sacca.add'); if (world) world.burst(0xbfeee4, null, 0.5); toast('Thành thật nhận lỗi và nguyện phòng hộ ngày mai: mặt hồ trong trở lại.'); }
  else if (act === 'reset') { if (U.resetArm) { const keep = { name: S.name, look: S.look, tier1v: S.tier1v, tier1Legacy: S.tier1Legacy }; resetState(keep); save(); record('journey.reset_cycle'); U.resetArm = false; toast('Đã trở về ngày 1.'); } else U.resetArm = true; }
  else if (act === 'confirm') {
    const card = b.closest('.task'), key = card.dataset.p, c = readCard(card), E = kusala(c);
    S.done[S.day] = S.done[S.day] || {}; S.done[S.day][key] = { E, ...c, at: Date.now() };
    S.totals[key] = Math.round((S.totals[key] + E) * 100) / 100; S.lastDate = today(); if (S.day === 49 && allDone(49)) S.completed = true; save();
    record('kusala.confirm', { day: S.day, pillar: key, pre: c.pre, during: c.during, post: c.post, wise: c.wise, self: c.self });   // ghi chú quán chiếu không gửi lên
    const p = PILLARS.find((x) => x.key === key); if (world) world.burst(new THREE.Color(p.color).lerp(new THREE.Color('#ffe7a8'), 0.5).getHex(), null, E / 22.5);   // tỉ lệ so với mức Kusala tối đa: lớn thì có máy quay dõi theo
    toast(`+${E.toFixed(2)} ${p.name}: hạt sáng thấm vào cội Bồ-đề`);
  }
  render();
});

// ───────── Chuyển không gian ─────────
function setMode(m) {
  if (U.view === 'creator') closeCreator(false);
  if (U.view === 'dongtu') U.view = 'home';
  if (m !== 'hall' && sermon.on) sermon.stop(); U.mode = m; document.body.classList.toggle('hall', m === 'hall'); document.body.classList.toggle('journey', m === 'journey');
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x.dataset.m === m));
  if (m !== 'journey') U.tier = null;
  if (window.innerWidth <= 820) document.body.classList.toggle('pmin', m === 'hall' || m === 'island' || m === 'journey');   // điện thoại: mở cảnh trước, bảng thu gọn
  if (m === 'island') { U.view = world && world.av.where !== 'home' ? 'friend' : 'home'; U.zone = null; }
  if (world) world.setMode(m === 'hall' ? 'hall' : m === 'journey' ? 'overview' : 'island');
  render();
}
$('#rad').addEventListener('click', () => { S.radar = !S.radar; save(); document.body.classList.toggle('radar', !!S.radar); $('#rad').classList.toggle('on', !!S.radar); });
document.body.classList.toggle('radar', !!S.radar); $('#rad').classList.toggle('on', !!S.radar);
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
$('#who').addEventListener('click', () => openCreator());
// ───────── Vân Nhạc: thanh nhạc thu gọn / mở rộng (không chiếm bảng bên phải) ─────────
const dock = $('#mdock'), ORDER = { loop: 'Lặp lại', seq: 'Lần lượt', shuf: 'Ngẫu nhiên', once: 'Phát 1 lần' };
function leftTxt() { const l = amb.left; return l === null ? '' : l < 1 ? ' · sắp trọn' : ' · còn ' + Math.ceil(l) + ' phút'; }
function renderDock() {
  const M = fixMusic(S.music), cur = amb.on ? amb.cur : null, open = !!U.dock;
  dock.hidden = !open && !amb.on; dock.classList.toggle('open', open); if (dock.hidden) return;
  dock.style.right = window.innerWidth > 820 ? Math.round(window.innerWidth - panel.getBoundingClientRect().left + 10) + 'px' : '';   // máy tính: nằm sát mép trái của bảng, ngay dưới nút Nhạc
  const now = cur ? `<strong>${esc(SONG[cur].name)}</strong><span data-left>${leftTxt()}</span>` : 'Nhạc đang tắt';
  if (!open) { dock.innerHTML = `<button class="mb" data-act="mus-toggle" aria-label="${cur ? 'Tạm ngưng nhạc' : 'Phát nhạc'}">${cur ? '❚❚' : '▶'}</button><button class="mt" data-act="mus-open" title="Mở Vân Nhạc">♪ ${now}</button><button class="mb" data-act="mus-next" title="Khúc khác" aria-label="Khúc khác">⏭</button><button class="mb" data-act="mus-open" title="Mở rộng" aria-label="Mở rộng Vân Nhạc">▾</button>`; return; }
  const w = wantSong(), d = S.day, wk = Math.ceil(d / 7);
  const why = M.source === 'time' ? `Bây giờ ${new Date().getHours()} giờ → khúc ${esc(SONG[w].name)}.` : M.source === 'plan' ? `Ngày ${d}/49, tuần ${wk} → khúc ${esc(SONG[w].name)}.` : M.source === 'mood' ? `Gợi ý cho lúc này → khúc ${esc(SONG[w].name)}.` : 'Giữ khúc bạn đã chọn ở trên.';
  dock.innerHTML = `<div class="mh"><h3>Vân Nhạc</h3><button class="ghost" data-act="mus-min">Thu gọn ▴</button></div>
    <div class="row"><button class="btn" data-act="mus-toggle">${amb.on ? 'Tạm ngưng' : 'Phát nhạc'}</button><button class="btn alt" data-act="mus-next">Khúc khác</button><input type="range" data-mvol min="0" max="1" step="0.01" value="${M.vol}" aria-label="Âm lượng nhạc nền" title="Âm lượng"></div>
    <div class="np">${cur ? 'Đang phát: ' + now + (player.playing ? ' (đang nhường thời thiền)' : '') : 'Nhạc đang tắt.'}</div>
    <label class="fl">Thời lượng mỗi khúc</label>${seg('mlen', [[5, '5′'], [15, '15′'], [30, '30′'], [45, '45′'], [60, '60′'], [0, 'Liên tục']], M.len)}
    ${M.len ? '<label class="fl">Khi hết khúc</label>' + seg('morder', Object.entries(ORDER), M.order) : '<p class="muted">Phát liên tục: nhạc sinh trực tiếp nên không lặp lại y nguyên.</p>'}
    <label class="fl">Thể loại</label>${seg('mgenre', GROUPS, M.genre)}
    <div class="songs">${songsOf(M.genre).map((x) => `<button class="chip${cur === x.id ? ' on' : ''}" data-song="${x.id}" title="${esc(x.sub + ': ' + x.desc)}">${esc(x.name)}</button>`).join('')}</div>
    <p class="muted">${cur ? esc(SONG[cur].sub + ': ' + SONG[cur].desc) + '.' : 'Bấm một khúc để nghe.'}</p>
    <label class="fl">Để Vân Đạo chọn khúc theo</label>${seg('msrc', [['time', 'Buổi trong ngày'], ['plan', 'Lịch tu tập'], ['mood', 'Tâm trạng'], ['pick', 'Tự chọn']], M.source)}
    ${M.source === 'mood' ? seg('mmood', MOODS.map((m) => [m.id, m.label]), M.mood) : ''}<p class="muted">${why} Khi vào thời thiền 15 phút, nhạc tự lắng xuống rồi dâng lại sau đó.</p>
    <a class="ext" href="https://music.youtube.com/watch?v=5FCcXCchXDk" target="_blank" rel="noopener" data-ext><strong>Bài thiền anh chọn</strong> <em>mở trên YouTube Music</em><div>Phát ở thẻ mới bằng tài khoản YouTube của bạn; ứng dụng không chép hay nhúng tệp nhạc này. Nhạc nền sẽ tạm ngưng.</div></a>`;
}
/** Mọi thao tác nhạc, dùng chung cho thanh nhạc và các nút nhạc trong bảng phân khu. Trả true nếu đã xử lý. */
function musicAct(e) {
  if (e.target.closest('[data-ext]')) { if (amb.on) musicStop(); return true; }
  const sg = e.target.closest('[data-song]'); if (sg) { S.music.source = 'pick'; S.music.song = sg.dataset.song; save(); musicStart(sg.dataset.song, true); return true; }
  const ob = e.target.closest('[data-opt] button'), k = ob && ob.parentElement.dataset.opt, M = S.music;
  if (ob && ['msrc', 'mmood', 'morder', 'mlen', 'mgenre'].includes(k)) { const v = ob.dataset.v;
    if (k === 'msrc') M.source = v; else if (k === 'mmood') M.mood = v; else if (k === 'mgenre') M.genre = v;
    else if (k === 'morder') M.order = v; else { M.len = +v; if (!M.len) M.order = 'loop'; }
    if (M.source === 'pick' && !SONG[M.song]) M.song = amb.cur || 'van-thuy'; save();
    if (amb.on && (k === 'msrc' || k === 'mmood')) musicStart(wantSong()); else if (amb.on && k === 'mlen') musicStart(amb.cur); else musicSync();   // đổi thời lượng: áp cho khúc đang phát, tính từ lúc khúc bắt đầu
    return true; }
  const b = e.target.closest('[data-act]'), act = b && b.dataset.act; if (!act || !act.startsWith('mus-')) return false;
  if (act === 'mus-toggle') { if (amb.on) musicStop(); else musicStart(); } else if (act === 'mus-next') musicNext(true); else { U.dock = act === 'mus-open'; renderDock(); }
  return true;
}
dock.addEventListener('click', musicAct);
dock.addEventListener('input', (e) => { if (e.target.dataset.mvol !== undefined) { S.music.vol = +e.target.value; amb.setVolume(S.music.vol); save(); } });
$('#mus').addEventListener('click', () => { U.dock = !U.dock; renderDock(); });
musBtn(); renderDock();

// ───────── Ẩn giao diện khi tọa thiền ─────────
const wake = () => { U.idleAt = performance.now(); };
['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
$('#hide').addEventListener('click', (e) => { e.stopPropagation(); U.quietManual = true; toast('Giao diện đã ẩn. Bấm phím H hoặc chạm vào cảnh để hiện lại.'); });
window.addEventListener('keydown', (e) => {
  if (e.target && e.target.matches && e.target.matches('textarea,input')) return;
  if (e.key === 'h' || e.key === 'H') U.quietManual = !U.quietManual;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
});
window.addEventListener('resize', () => { if (world) world.resize(); renderDock(); fitSub(); });

// ───────── Radar và dao động ký ─────────
const rc = $('#radar').getContext('2d'), sc = $('#scope').getContext('2d'), scopeBuf = new Float32Array(1024);
function drawRadar(t) {
  const W = 380, cx = 170, cy = 190, R = 148, st = STAGES[stageAt(t)], rr = (el) => R * (1 - Math.abs(el) / 90);
  const pt = (az, el) => { const a = (az * Math.PI) / 180, r = rr(el); return [cx + r * Math.sin(a), cy - r * Math.cos(a)]; };
  rc.clearRect(0, 0, W, W); rc.lineWidth = 1.5; rc.strokeStyle = 'rgba(43,41,54,.18)';
  [0, 30, 60].forEach((el) => { rc.beginPath(); rc.arc(cx, cy, rr(el), 0, 6.3); rc.stroke(); });
  rc.beginPath(); rc.moveTo(cx - R, cy); rc.lineTo(cx + R, cy); rc.moveTo(cx, cy - R); rc.lineTo(cx, cy + R); rc.stroke();
  rc.fillStyle = '#a9792c'; rc.font = '600 19px Georgia,serif'; rc.textAlign = 'center'; rc.fillText('Tôn tượng · Đông', cx, 24);
  const dot = (x, y, r, col, a = 1) => { const g = rc.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)'); rc.globalAlpha = a; rc.fillStyle = g; rc.beginPath(); rc.arc(x, y, r, 0, 6.3); rc.fill(); rc.globalAlpha = 1; };
  const ring = (el, col, w, a) => { rc.globalAlpha = a; rc.strokeStyle = col; rc.lineWidth = w; rc.beginPath(); rc.arc(cx, cy, rr(el), 0, 6.3); rc.stroke(); rc.globalAlpha = 1; };
  const b = breathEnv(t);
  if (st.id === 's1') dot(...pt(0, 0), 34, '#e0a94a', 0.9);
  if (st.id === 's2') ring(-30, '#4d9c8f', 10 + 12 * b, 0.35 + 0.4 * b);
  if (st.id === 's3a') dot(cx, cy, rr(-45) + 8, '#e8a64a', 0.75);
  if (st.id === 's3b') dot(cx, cy, 22, '#6672b8', 0.8);
  if (st.id === 's3c') { ring(60, '#8fa6e8', 8, 0.7); dot(cx, cy, 26, '#ffffff', 0.9); }
  if (st.id === 's4') { const az = (t * 0.05 * 360) % 360; for (let i = 0; i < 10; i++) dot(...pt(az - i * 9, 0), 26 - i * 1.6, '#e0a94a', 0.9 - i * 0.085); }
  if (st.id === 's5') { dot(...pt(0, 0), 30, '#e0a94a', 0.9); ring(0, '#e0a94a', 6, 0.5); }
  if (U.bio === 'uddhacca') dot(cx, cy, rr(-45) + 8, '#e8a64a', 0.55);
  if (U.bio === 'thina') ring(60, '#8fa6e8', 8, 0.6);
  EV.forEach((e) => { const age = t - e.t; if (age >= 0 && age < 4) dot(...pt(e.az, e.el), 16 + age * 9, '#d99a2b', 1 - age / 4); });
  const gx = 352, y = (el) => 322 - ((el + 45) / 105) * 264;
  rc.strokeStyle = 'rgba(43,41,54,.3)'; rc.lineWidth = 2; rc.beginPath(); rc.moveTo(gx, y(-45)); rc.lineTo(gx, y(60)); rc.stroke();
  rc.fillStyle = 'rgba(43,41,54,.6)'; rc.font = '15px system-ui,sans-serif'; rc.textAlign = 'right';
  [[60, '+60°'], [0, '0°'], [-45, '−45°']].forEach(([el, s]) => rc.fillText(s, gx - 8, y(el) + 5));
  const el = U.bio === 'uddhacca' ? -45 : U.bio === 'thina' ? 60 : st.el;
  rc.fillStyle = '#a9792c'; rc.beginPath(); rc.arc(gx, y(el), 7, 0, 6.3); rc.fill();
  $('#hudtxt').textContent = st.radar + ' · ' + st.sound;
}
function drawScope() {
  const W = 380, H = 76; sc.clearRect(0, 0, W, H); sc.strokeStyle = '#a9792c'; sc.lineWidth = 2; sc.beginPath();
  const ok = player.scope(scopeBuf) && player.playing;
  for (let i = 0; i < 190; i++) { const v = ok ? scopeBuf[Math.floor((i / 190) * 1024)] : 0, x = (i / 189) * W, y = H / 2 - v * H * 0.9; if (i) sc.lineTo(x, y); else sc.moveTo(x, y); }
  sc.stroke();
}

// ───────── Vòng lặp ─────────
let last = performance.now(), frames = 0;
function frame(now) {
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; frames++;
  const t = player.time, started = player.scheduled || hash.t !== undefined;
  let vis = visAt(t), waves = started ? EV.filter((e) => e.wave && t - e.t >= 0 && t - e.t < 14).map((e) => t - e.t) : [];
  const sm = sermon.tick(dt); if (sm.on || sm.waves.length) { waves = sm.waves; vis = { ...vis, night: 0, amber: 0, haloWhite: 0, beams: Math.max(vis.beams * 0.6, sm.merit), rainbow: Math.max(vis.rainbow * 0.5, sm.merit * 0.9), merit: Math.max(vis.merit, sm.merit) }; }
  // máy quay khi giảng: cận Tôn tượng lúc nói, toàn cảnh hội chúng lúc đảnh lễ
  // khung dọc (điện thoại): lùi và hạ máy quay để thấy trọn Tôn tượng, tượng nằm nửa trên màn hình, chừa đáy cho chữ (#79)
  if (sm.on && world && U.mode === 'hall') { const want = sermon.cam;
    if (U.sCam !== want) { U.sCam = want; const V3 = World.V3, pt = world.portrait; world.wide = true;
      if (want === 'close') { if (pt) world.flyTo(new V3(-20, 240, -175), new V3(0, 365, -760), 58, 2.6); else world.flyTo(new V3(-30, 96, -300), new V3(0, 318, -760), 56, 2.6); }
      else if (pt) world.flyTo(new V3(0, 110, 40), new V3(0, 215, -620), 66, 2.6); else world.flyTo(new V3(0, 40, -150), new V3(0, 150, -560), 62, 2.6); } }
  if (world) world.update(dt, { vis, breath: breathEnv(started ? t : now / 1000), waves, isl: islandState(), sermon: sm });
  // bấm ▶ khi nhân vật đang ngồi: thời ngồi tính từ lúc đó
  if (player.playing && !U.sit && world && U.mode === 'island' && world.av.state === 'sit') U.sit = { at: Date.now(), zone: world.av.id };
  if (frames % 6 === 0) vanduTick();
  updateBar(t); updateLabels();
  if (U.mode === 'hall' && S.radar && frames % 2 === 0) { drawRadar(t); drawScope(); }
  document.body.classList.toggle('quiet', U.quietManual || (now - U.idleAt > 9000 && U.drag === null && wakeEl.hidden && ((player.playing && U.mode === 'hall') || !!U.vd)));
  requestAnimationFrame(frame);
}

window.addEventListener('error', (e) => { const el = $('#err'); el.style.display = 'block'; el.textContent = 'Lỗi: ' + e.message; });
if (hash.sim) U.sim = +hash.sim;
if (hash.t !== undefined) player.T0 = +hash.t;
if (window.innerWidth <= 820 && (!hash.mode || hash.mode === 'island') && !hash.view && !hash.zone) document.body.classList.add('pmin');
render();
if (hash.mode && hash.mode !== 'island') setMode(hash.mode);
if (hash.tier !== undefined) pickTier(+hash.tier);
if (hash.realm && world) world.setMode('realm');
// #sermon=1 (bài đầu) hoặc #sermon=<mã bài>: mở Thuyết giảng; chỉ phát khi bài đó có trong danh sách đã phát hành
if (hash.sermon) { U.hallTab = 'sermon'; setMode('hall'); loadSermons().then(() => { sermonPick(); const id = hash.sermon === '1' ? library.items[0] && library.items[0].id : hash.sermon; if (!id) return render(); sermonStart(id); if (sermon.on && hash.sk) { for (let i = 0; i < +hash.sk * 20; i++) sermon.tick(0.05); } }); }
if (hash.music) { U.dock = true; renderDock(); }
if (hash.vandu !== undefined) U.vdForce = +hash.vandu;   // xem thử một chặng Vân Du: #vandu=0…6
if (hash.view === 'board') { U.view = 'board'; boardFresh(); render(); }
if (hash.view === 'creator') openCreator();
if (hash.at && world && World.NODES[hash.at]) { const n = World.NODES[hash.at]; world.av.pos.set(n[0], 0, n[1]); world.av.pos.y = World.floorH(n[0], n[1]); world.snap = true; }
if (hash.zone) goZone(hash.zone);
if (world && world.tween && hash.snap !== undefined) world.tween.k = 0.999;
if (tierMigrate(S)) save();   // #107: máy đã ở Tầng 1 trước khi có cổng máy chủ thì giữ quyền đã mở (#169, mặc định điểm 3)
window.__app = { tier: () => (U.tier ?? (tierOpened(S) ? 1 : 0)), player, world, offlineProbe, amb, probeSong, probeSfx, SONGS, state: () => S, U, stateReady, sermon, library, voiceLabel: (j) => aiVoiceLabel(providerOf(j)) };
registerPWA();
startMetrics();   // T1.3 (#8): số liệu ẩn danh, chỉ khi chạy qua http(s) và không bật Do Not Track
if (S.name) persistStorage();
// T2.3: tài khoản. `show` mở bảng Tài khoản; `remote` chạy khi thiết bị khác vừa cập nhật hành trình.
accountInit({
  S, save, render,
  show: () => { if (U.view === 'creator') { closeCreator(false); if (world) world.setMode('island'); } U.view = 'account'; U.zone = null; document.body.classList.remove('pmin'); panel.scrollTop = 0; render(); },
  remote: () => { if (world && JSON.stringify(Object.entries(S.look || {}).sort()) !== JSON.stringify(Object.entries(world.look || {}).filter(([k]) => k in (S.look || {})).sort())) world.setLook(S.look); fixMusic(S.music); render(); renderDock(); },
}).then((r) => { if (r.welcome) toast('Hành trình đã trở lại trên máy này.'); }).catch(() => {});
// ───────── Bạn đồng tu (#124) ─────────
// Nút trên thanh chính chỉ hiện khi máy chủ báo dong_tu: 1 cho phiên này; chấm số là lời kết nối và lời mời gặp đang chờ, không phải số bạn.
const dtBtn = $('#dt');
function dtMark() { const on = dongTu.on, n = dtBadge(); dtBtn.hidden = !on; dtBtn.querySelector('.n').textContent = n ? String(n) : ''; dtBtn.setAttribute('aria-label', 'Bạn đồng tu' + (n ? `, ${n} đang chờ` : '')); }
dtBtn.addEventListener('click', () => (U.view === 'dongtu' ? dtAct('close', { dataset: {} }) : dtOpen()));
/** Hiện diện gửi cho bạn đồng tu: đang thiền / thưởng trà / thăm đảo bạn / ở Vân Đạo */
function presence() {
  if (player.playing || meditating()) return U.zone === 'tea' ? 'tra' : 'thien';
  if (world && world.av.where !== 'home') return 'tham';
  return U.view === 'zone' && U.zone === 'tea' ? 'tra' : 'online';
}
/** Tới giờ hẹn: cả hai cùng bắt đầu, `ms` là thời gian đã trôi từ giờ hẹn (vào trễ thì bắt kịp đúng chỗ của người kia) */
function together(inv, ms) {
  if (inv.kind === 'tra') { if (inv.place === 'dao' && islandMeet(inv)) return; if (U.mode !== 'island') setMode('island'); goZone('tea'); return; }
  goMeet(inv);
  player.seek(Math.min(DUR - 5, ms / 1000)); if (!player.playing) togglePlay(); render();
}
// Nơi gặp: Đại Thiền Đường; hoặc Vân Đảo của chủ (#125, islandMeet); không dựng được đảo chủ thì ngồi ở Đài Thiền của mình như trước
function goMeet(inv) {
  if (U.view === 'dongtu') { U.view = 'home'; render(); }
  if (inv.place === 'dtd') { if (U.mode !== 'hall') setMode('hall'); if (U.hallTab === 'sermon') { sermonStop(); U.hallTab = 'sit'; render(); } }
  else if (!islandMeet(inv)) { if (U.mode !== 'island') setMode('island'); goZone('pad'); }
}
/**
 * #125: gặp trên Vân Đảo (place 'dao'), chủ đảo theo MEET_KINDS[kind].host. Mình là khách: du vân sang đảo chủ (bạn ngoài tám ô gần thì tạm dựng
 * vào ô quen biết cuối); thiền ngồi cạnh chủ, trà ở bàn trà của chủ. Mình là chủ: ở nhà, khách hiện ngồi cạnh (không thời gian thực tới GĐ4).
 * false: không dựng được (chưa có danh sách, đang ở đảo khác, đang du vân) để goMeet làm như cũ.
 */
function islandMeet(inv) {
  const K = MEET_KINDS[inv.kind]; if (!K || !world || !acct.uid || inv.place !== 'dao') return false;
  const host = String(K.host === 'from' ? inv.from : inv.to), guest = String(host === String(inv.from) ? inv.to : inv.from), how = inv.kind === 'tra' ? 'tra' : inv.kind === 'thien' ? 'thien' : null;
  const comps = (dongTu.list && dongTu.list.companions) || [], A = world.av;
  if (host === String(acct.uid)) {
    const g = comps.find((c) => String(c.id) === guest); if (U.mode !== 'island') setMode('island');
    world.setGuest(g ? { look: g.look, name: g.tinh_danh, kind: inv.kind, sec: (K.min || 20) * 60 + 60 } : null);
    if (how) goZone(how === 'tra' ? 'tea' : 'pad');
    if (g) toast(how === 'tra' ? `${g.tinh_danh} ngồi đối diện bên bàn trà.` : how ? `${g.tinh_danh} ngồi cạnh bạn ở Đài Thiền.` : `${g.tinh_danh} đang ghé thăm Vân Đảo của bạn.`);
    return true;
  }
  let i = world.friends.findIndex((f) => f.id === host);
  if (i < 0) { world.setCompanions(comps, host); i = world.friends.findIndex((f) => f.id === host); }
  if (i < 0 || A.state === 'travel' || (A.where !== 'home' && A.where !== i)) return false;
  if (U.mode !== 'island') setMode('island');
  U.friend = i; U.view = 'friend';
  if (A.where === i) { if (how) world.sitWith(i, how); render(); return true; }
  world.visit(i, () => { if (how) world.sitWith(i, how); else world.greet(i); toast('Đã đến đảo của ' + world.friends[i].name + '.'); render(); }, how);
  toast('Du vân theo vân lộ…'); render(); return true;
}
/** #125: màn một bạn đồng tu thật: hiện diện, ngày hành trình bạn cho hiện; Xin ghé thăm khi bạn đang ở Vân Đạo, Ghé khi vắng khi bạn thân thiết cho phép */
function friendReal(f, away, gateOk, moving) {
  const c = f.c || {}, open = c.open !== false, home = world.av.where === 'home' && !moving, canAway = !f.here && c.closeness === 'than' && !!(c.them && c.them.away) && open;
  const act = away ? '<button class="btn alt" data-act="sitwith">Cùng tọa thiền</button><button class="btn alt" data-act="gohome">Về đảo của mình</button>'
    : f.here ? `<button class="btn alt" data-act="xin-tham" ${gateOk && home && open ? '' : 'disabled'}>Xin ghé thăm</button>`
      : canAway ? `<button class="btn alt" data-act="ghe-vang" ${gateOk && home ? '' : 'disabled'}>Ghé khi vắng</button>` : '';
  const note = away ? (f.here ? `Bạn đang ở đảo của ${esc(f.name)}. Hãy giữ sự tĩnh lặng của chủ nhà.` : `${esc(f.name)} đang vắng. Bạn có thể chắp tay, tùy hỷ rồi về.`)
    : !open ? `${esc(f.name)} đang Độc cư: cổng mây khép.` : !gateOk ? 'Cổng Vân Môn của bạn mở nửa từ ngày 29.' : f.here ? 'Gửi lời xin ghé thăm; khi bạn nhận lời, vân mây sẽ đưa bạn sang.' : canAway ? 'Bạn thân thiết đã cho phép ghé khi vắng.' : '';
  return `<h2>${esc(f.name)}</h2><p class="pali">Bạn đồng tu · ${esc(PRESENCE_TEXT[f.presence] || PRESENCE_TEXT.vang)}${c.completed ? ' · đã hoàn thành chương trình Sơ nhập' : c.day ? ` · ngày ${c.day}/49 của hành trình` : ''}</p>` +
    '<div class="row"><button class="btn" data-act="greet">Chắp tay chào</button><button class="btn alt" data-act="rejoice">Tùy hỷ công đức</button></div>' + (act ? `<div class="row">${act}</div>` : '') +
    (note ? `<p class="muted">${note}</p>` : '') + '<p class="muted">Chào và tùy hỷ ở đây là cử chỉ trên Vân Đảo, không cộng điểm.</p><div class="row"><button class="ghost" data-act="home">← Vân Đảo</button></div>';
}
/** #125: Xin ghé thăm (lời mời xin_tham, đi khi bạn nhận lời) hoặc Ghé khi vắng (máy chủ kiểm canVisitAway rồi đi ngay) */
async function askVisit(f, away) {
  if (!f || !f.id) return;
  if (!away) { const r = await dtMeet(f.id, 'xin_tham', 'dao').catch((e) => ({ code: e && e.code })); return toast(r && r.invite ? `Đã gửi lời xin ghé thăm ${f.name}. Khi bạn nhận lời, vân mây sẽ đưa bạn sang.` : REASON_TEXT[r && r.code] || 'Chưa gửi được lời xin ghé thăm.'); }
  const r = await visitAway(f.id), i = world.friends.indexOf(f);
  if (!r || r.code || i < 0) return toast(REASON_TEXT[r && r.code] || 'Chưa ghé được lúc này.');
  world.setMode('island'); world.visit(i, () => { world.greet(i); toast(`Đã đến đảo của ${f.name}. Bạn ấy đang vắng: chắp tay, tùy hỷ rồi về.`); render(); }); toast('Du vân theo vân lộ…');
}
dtInit({
  S, render, toast, cardEl: $('#dtm'), badge: dtMark, presence, together, go: goMeet,
  // #151: Đài Đồng Tu trong Đại Thiền Đường; mình mang Tịnh danh và hình dáng đang dùng
  dais: (people) => { if (!world) return; if (world.setDais(people.map((p) => (p.me ? { ...p, name: S.name || 'Bạn', look: S.look } : p)))) daisCam(); },
  creator: () => openCreator(),   // #151: phải tạo và lưu nhân vật trước khi mời bạn
  show: () => { if (U.view === 'creator') { closeCreator(false); if (world) world.setMode('island'); } if (U.view !== 'dongtu') U.back = U.view; U.view = 'dongtu'; document.body.classList.remove('pmin'); panel.scrollTop = 0; render(); dtMark(); },
  close: () => { U.view = ['home', 'zone', 'board', 'friend'].includes(U.back) && (U.back !== 'zone' || U.zone) ? U.back : 'home'; render(); dtMark(); },
  viewOpen: () => U.view === 'dongtu',
  quiet: () => player.playing || meditating() || !!U.vd,   // đang thiền: không hiện lời mời, không âm
  sfx: (k) => amb.sfx(k, { k: 0.4 }, S.music.vol),
});
dtMark();
// #125: bạn đồng tu thật dựng đảo gần Vân Đảo; danh sách đổi (kết bạn, hiện diện, ngày) thì cập nhật cảnh, giữ đúng bạn đang mở
if (world) {
  onDongTu(() => { const cur = U.view === 'friend' && world.friends[U.friend], key = cur && (cur.id || 's' + cur.sim);
    world.setCompanions((dongTu.on && dongTu.list && dongTu.list.companions) || []);
    if (key) { const i = world.friends.findIndex((f) => (f.id || 's' + f.sim) === key); if (i >= 0) U.friend = i; else U.view = 'home'; render(); } });
  Object.assign(window.__app, { goMeet, acct, dongTu });   // kiểm thử e2e gặp trên đảo (#125)
}
// #93: tải danh mục việc sớm để nhắc việc còn lại trong ngày; quay lại app sau một lúc thì nhắc lại
stateReady.then(() => { if (S.name) return loadMissions().then(() => setTimeout(remind, 4000)); }).catch(() => {});
window.addEventListener('focus', () => setTimeout(remind, 1500));
requestAnimationFrame(frame);

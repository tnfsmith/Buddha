import * as THREE from 'three';
import { World, ANCHORS, TIER_LABEL, TIER_LABEL_LEFT, groundH } from './world.js';
import { Player, TR, EV, offlineProbe } from './audio.js';
import { DUR, STAGES, TIERS, ZONES, WEEKS, PILLARS, valueAt, breathEnv, stageAt, kusala } from './data.js';
import { SUTTAS, Sermon } from './sermon.js';
import { Ambient, SONGS, SONG, MOODS, pickSong, probeSong } from './music.js';
import { OPTIONS, PRESETS, defaultLook, checkName, suggestNames, tidyName } from './people.js';

const $ = (s, r = document) => r.querySelector(s);
const fmt = (t) => { t = Math.max(0, Math.floor(t)); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ───────── Lưu trạng thái trên máy ─────────
const KEY = 'vandao.v1';
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const fresh = () => ({ v: 1, day: 1, lastDate: null, done: {}, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: '', look: defaultLook(), music: { on: false, source: 'time', song: 'van-thuy', mood: 'an', order: 'one', span: 5, vol: 0.6 } });
let S = fresh(), mem = true;
try { const raw = localStorage.getItem(KEY); if (raw) S = Object.assign(fresh(), JSON.parse(raw)); S.look = { ...defaultLook(), ...S.look }; S.music = { ...fresh().music, ...S.music }; localStorage.setItem(KEY, JSON.stringify(S)); mem = false; } catch (e) { mem = true; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* chỉ giữ trong bộ nhớ */ } };
const allDone = (d) => { const x = S.done[d]; return !!(x && x.duc && x.thien && x.tue); };
(function advance() { if (S.lastDate && S.lastDate < today() && allDone(S.day) && S.day < 49) S.day++; if (S.day === 49 && allDone(49)) S.completed = true; save(); })();

const U = { mode: 'island', view: 'home', zone: null, tier: null, sim: null, bio: 'samadhi', bioAt: 0, quietManual: false, idleAt: performance.now(), drag: null, resetArm: false, friend: null, draft: null, pose: 'stand', chips: suggestNames(6) };
const hash = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));

const player = new Player();
// lưu vị trí gần nhất của nhân vật trên Vân Đảo
function savePos() { if (!world || !world.av || world.av.where !== 'home' || world.av.state === 'travel' || world.av.state === 'walk') return; const a = world.av, p = { x: +a.pos.x.toFixed(2), z: +a.pos.z.toFixed(2), rot: +a.rot.toFixed(2), sit: a.state === 'sit' ? a.id : null }; if (!S.pos || S.pos.x !== p.x || S.pos.z !== p.z || S.pos.sit !== p.sit || S.pos.rot !== p.rot) { S.pos = p; save(); } }
setInterval(savePos, 1500); window.addEventListener('pagehide', savePos); document.addEventListener('visibilitychange', () => { if (document.hidden) savePos(); });
// ── Thuyết giảng ──
const sermon = new Sermon();
sermon.online = (o) => { const el = $('#sub'); if (!el) return; el.innerHTML = o ? `<div class="src">${esc(o.src)}</div><div class="ln">${esc(o.ln)}</div>${o.pl ? `<div class="pl">${esc(o.pl)}</div>` : ''}` : ''; };
sermon.onend = (done) => { if (world) { world.wide = false; if (U.mode === 'hall') world.setMode('hall'); } document.body.classList.remove('sermon'); amb.setVolume(S.music.vol); if (done) { S.sermons = (S.sermons || 0) + 1; save(); toast('Bài giảng đã viên mãn. Sādhu!'); } render(); };
function sermonStart(id) { const su = SUTTAS.find((x) => x.id === id) || SUTTAS[0]; U.sutta = su.id; if (player.playing) player.pause(); if (U.mode !== 'hall') setMode('hall'); U.hallTab = 'sermon';
  document.body.classList.add('sermon'); amb.setVolume(S.music.vol * 0.4); if (amb.on && amb.voice && amb.ctx) { try { amb.voice.bowl(amb.ctx.currentTime + 0.1, 136.1, 0.3, 0); } catch (e) { /* bỏ qua */ } }
  sermon.start(su, S.tts !== false); if (world) U.sCam = null; render(); }
function sermonStop() { sermon.stop(); if (world) { world.wide = false; if (U.mode === 'hall') world.setMode('hall'); } }
// ── Vân Nhạc: nhạc nền toàn Vân Đảo ──
const amb = new Ambient(); amb.volume = S.music.vol;
const wantSong = () => pickSong(S.music, S.day, new Date().getHours());
const musBtn = () => { const b = $('#mus'); if (!b) return; b.textContent = amb.on && amb.cur ? '♪ ' + SONG[amb.cur].name : 'Nhạc'; b.classList.toggle('on', amb.on); };
const musicStart = (id) => amb.play(id || wantSong()).then(() => { S.music.on = true; save(); musBtn(); if (U.musicOpen) render(); }).catch((e) => toast('Chưa phát được nhạc: ' + e.message));
const musicStop = () => { amb.stop(); S.music.on = false; save(); musBtn(); if (U.musicOpen) render(); };
const musicNext = () => { const i = SONGS.findIndex((x) => x.id === amb.cur); let id; if (S.music.order === 'shuf') { do { id = SONGS[Math.floor(Math.random() * SONGS.length)].id; } while (id === amb.cur); } else id = SONGS[(i + 1) % SONGS.length].id; if (S.music.order === 'one') { S.music.source = 'pick'; S.music.song = id; save(); } musicStart(id); };
setInterval(() => { amb.duck(player.playing); }, 300);
setInterval(() => { if (!amb.on || amb.ducked) return; const M = S.music;
  if (M.order === 'one') { const w = wantSong(); if (M.source !== 'pick' && w !== amb.cur) musicStart(w); } else if (amb.minutes >= M.span) musicNext(); }, 5000);
window.addEventListener('pointerdown', () => { if (S.music.on && !amb.on) musicStart(); }, { once: true });
let world = null;
try { world = new World($('#gl'), S.look, hash.q !== undefined ? +hash.q : undefined, S.pos); world.onChirp = (pan, n, seed) => amb.chirp(pan, n, seed); if (hash.snap) world.snap = true; } catch (e) {
  $('#err').style.display = 'block'; $('#err').textContent = 'Trình duyệt này không mở được WebGL nên chưa dựng được cảnh 3D. Âm thanh và bảng 49 ngày vẫn dùng được. (' + e.message + ')'; console.error(e);
}

// ───────── Trạng thái cảnh ─────────
function islandState() {
  const tier = U.tier ?? (S.completed ? 1 : 0), d = U.sim ?? S.day, wk = Math.ceil(d / 7), p = (d - 1) / 48, up = tier >= 1;
  return { tier, mist: up ? 0.1 : 0.75 - 0.6 * p, bodhi: up ? 1 : 0.04 + 0.96 * p, water: Math.min(1, d / 7), clarity: wk >= 2 || up ? 1 : 0,
    lotus: up ? 12 : Math.min(12, Math.floor(d / 4)), goldCount: tier >= 2 ? 12 : wk >= 4 || up ? 7 : 0, gold: wk >= 4 || up ? 1 : 0,
    tea: d >= 15 || up, gate: d >= 43 || up ? 1 : d >= 29 ? 0.5 : 0, open: S.open, stream: up, sky: wk >= 6 && !up ? 0.6 : 0, lv: up ? 1 : Math.max(0, Math.min(1, p)), day: d };
}
const unlocked = (z) => (U.tier ?? (S.completed ? 1 : 0)) >= 1 || (U.sim ?? S.day) >= z.unlock;
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
$('#vol').addEventListener('input', (e) => player.setVolume(+e.target.value));
$('#bin').addEventListener('change', (e) => player.setBinaural(e.target.checked));
$('#bio').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  U.bio = b.dataset.b; U.bioAt = performance.now(); player.setBio(U.bio);
  document.querySelectorAll('#bio button').forEach((x) => x.classList.toggle('on', x === b));
  toast({ samadhi: 'Định tĩnh: trở về kịch bản chuẩn', uddhacca: 'Trị phóng dật: âm trầm 136,1 Hz dâng từ dưới Vân Tọa', thina: 'Trị hôn trầm: chuông tỉnh giác từ đỉnh đầu' }[U.bio] + (player.playing ? '' : ' (nghe được khi đang phát)'));
});
player.onend = () => { S.sessions++; save(); toast('Sādhu! Thời thiền đã viên mãn. Hồi hướng công đức.'); render(); };
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3800); }

// ───────── Nhãn trong cảnh ─────────
const L = $('#labels'), mkLabel = (cls, fn) => { const b = document.createElement('button'); b.className = cls; b.style.opacity = '0'; L.appendChild(b); if (fn) b.addEventListener('click', fn); return b; };
const zoneLb = {}; ZONES.forEach((z) => (zoneLb[z.id] = mkLabel('zl', () => goZone(z.id))));
const meLb = mkLabel('zl me', () => openCreator());
const friendLb = world ? world.friends.map((f, i) => mkLabel('zl fr', () => openFriend(i))) : [];
const tierLb = TIER_LABEL.map((p, i) => mkLabel(TIER_LABEL_LEFT[i] ? 'tl tlr' : 'tl', () => pickTier(i)));
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
  world.friends.forEach((f, i) => { const el = friendLb[i]; if (!el.dataset.k) { el.dataset.k = '1'; el.textContent = f.name; } place(el, f.head, isl && !creator); });
  TIER_LABEL.forEach((p, i) => { const el = tierLb[i]; if (!el.dataset.k) { el.dataset.k = '1'; el.textContent = TIERS[i].name.replace(' · ', ': '); } place(el, new THREE.Vector3(p[0], p[1], p[2]), U.mode === 'journey' && !world.tween && world.mode === 'overview', 60); });
}
function goZone(id) {
  if (world && world.av.where !== 'home') return toast('Bạn đang ở đảo bạn. Hãy về đảo trước.');
  U.zone = id; U.view = id === 'stele' ? 'board' : 'zone'; render();
  if (world) { if (!world.goZone(id, () => { if (id === 'pad') toast('Đã an tọa tại Đài Thiền. Bấm ▶ để bắt đầu thời thiền.'); savePos(); })) world.setMode('zone', { zone: id }); }
}
function openFriend(i) { U.friend = i; U.view = 'friend'; U.zone = null; render(); }
function pickTier(k) { U.tier = k; U.sim = null; if (world) world.setMode(k === 0 ? 'island' : 'tier', { tier: k }); render(); }

// Bấm lên mặt đảo để đi tới đó (phân biệt với kéo xoay cảnh)
let down = null;
$('#gl').addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; U.quietManual = false; });
$('#gl').addEventListener('pointerup', (e) => {
  if (!down || !world) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t; down = null;
  if (moved > 6 || dt > 400 || U.mode !== 'island' || U.view === 'creator') return;
  const r = e.target.getBoundingClientRect(), p = world.pickGround(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  clearTimeout(U.walkT); if (p) U.walkT = setTimeout(() => world.walkToPoint(p.x, p.z), 260);   // chờ một nhịp: nếu là nhấp đúp thì không đi
});
$('#gl').addEventListener('dblclick', (e) => { if (!world || U.view === 'creator') return; clearTimeout(U.walkT); world.stopWalk(); const r = e.target.getBoundingClientRect(); world.zoomAt(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); });

// ───────── Bảng bên phải ─────────
const panel = $('#panel');
const bars = () => '<div class="bars">' + PILLARS.map((p) => `<div class="bar3"><span>${p.name}</span><i><b style="width:${Math.min(100, (S.totals[p.key] / (49 * 12)) * 100)}%;background:${p.color}"></b></i><span>${S.totals[p.key].toFixed(1)}</span></div>`).join('') + '</div>';
const seg = (key, list, cur) => `<div class="seg wrap" data-opt="${key}">` + list.map(([v, t]) => `<button data-v="${v}" class="${String(v) === String(cur) ? 'on' : ''}">${esc(t)}</button>`).join('') + '</div>';
const sw = (key, list, cur) => `<div class="sws" data-opt="${key}">` + list.map(([t, hex], i) => `<button class="sw${i === cur ? ' on' : ''}" data-v="${i}" title="${esc(t)}" aria-label="${esc(t)}" style="background:${hex || 'linear-gradient(135deg,#888 50%,#ccc 50%)'}"></button>`).join('') + '</div>';
function nameBlock(raw) { const c = checkName(raw); return { c, html: `<div id="nmMean" class="pali">${c.meaning ? esc(c.name) + ': ' + esc(c.meaning) : '&nbsp;'}</div><ul class="rules">` + c.rules.map((r) => `<li class="${r.ok ? 'ok' : 'no'}">${esc(r.text)}</li>`).join('') + '</ul>' }; }

function render() {
  const d = S.day, wk = Math.ceil(d / 7), W = WEEKS[wk - 1], keep = panel.scrollTop;
  let h = '';
  if (U.musicOpen) {
    const M = S.music, cur = amb.on ? amb.cur : null, w = wantSong(), hr = new Date().getHours();
    const why = M.source === 'time' ? `Bây giờ ${hr} giờ → khúc <strong>${esc(SONG[w].name)}</strong>` : M.source === 'plan' ? `Ngày ${d}/49 · tuần ${wk}: ${esc(W.title)} → khúc <strong>${esc(SONG[w].name)}</strong>` : M.source === 'mood' ? `Gợi ý cho lúc này → khúc <strong>${esc(SONG[w].name)}</strong>` : 'Bấm một khúc trong danh sách bên dưới.';
    h = `<h2>Vân Nhạc</h2><div class="sub">Nhạc nền tĩnh tâm cho toàn Vân Đảo</div>
      <p>Cùng hệ âm với thời thiền và sinh trực tiếp, nên phát mãi mà không lặp lại y nguyên. Khi vào thời thiền 15 phút, nhạc nền tự lắng xuống rồi dâng lại sau đó.</p>
      <div class="row"><button class="btn" data-act="mus-toggle">${amb.on ? 'Tạm ngưng' : 'Phát nhạc'}</button><button class="btn alt" data-act="mus-next">Khúc khác</button><button class="btn alt" data-act="mus-close">Xong</button></div>
      <div class="np">${cur ? `Đang phát: <strong>${esc(SONG[cur].name)}</strong> · ${esc(SONG[cur].sub)}${player.playing ? ' (đang nhường thời thiền)' : ''}` : 'Nhạc đang tắt.'}</div>
      <h3>Chọn khúc theo</h3>${seg('msrc', [['time', 'Buổi trong ngày'], ['plan', 'Lịch tu tập'], ['mood', 'Tâm trạng'], ['pick', 'Tự chọn']], M.source)}
      ${M.source === 'mood' ? seg('mmood', MOODS.map((m) => [m.id, m.label]), M.mood) : ''}<p class="muted">${why}</p>
      <h3>Cách phát</h3>${seg('morder', [['one', 'Liên tục một khúc'], ['seq', 'Lần lượt'], ['shuf', 'Ngẫu nhiên']], M.order)}
      ${M.order !== 'one' ? '<p class="muted">Đổi khúc sau</p>' + seg('mspan', [[3, '3 phút'], [5, '5 phút'], [10, '10 phút']], M.span) : ''}
      <h3>Âm lượng nhạc nền</h3><input type="range" data-mvol min="0" max="1" step="0.01" value="${M.vol}" aria-label="Âm lượng nhạc nền">
      <h3>Bảy khúc</h3>` + `<a class="ext" href="https://music.youtube.com/watch?v=5FCcXCchXDk" target="_blank" rel="noopener" data-ext><strong>Bài thiền anh chọn</strong> <em>mở trên YouTube Music</em><div>Phát ở thẻ mới bằng tài khoản YouTube của bạn; ứng dụng không chép hay nhúng tệp nhạc này. Nhạc nền sẽ tạm ngưng.</div></a>` + SONGS.map((x) => `<button class="tier song ${cur === x.id ? 'on' : ''}" data-song="${x.id}"><strong>${esc(x.name)}</strong> <em>${esc(x.sub)}</em><div>${esc(x.desc)}</div></button>`).join('');
  } else if (U.mode === 'hall' && U.hallTab === 'sermon') {
    const hasVoice = !!Sermon.viVoice();
    h = `<h2>Đại Thiền Đường Vô Tận</h2>${seg('htab', [['sit', 'Thời thiền'], ['sermon', 'Thuyết giảng']], 'sermon')}
      <p>Chọn một bài. Khi giảng, Tôn tượng mở mắt nhìn xuống hội chúng và giơ ấn thuyết pháp; hội chúng chắp tay lắng nghe, đảnh lễ lúc mở đầu và ba lần khi kết thúc, rồi công đức lan tỏa ra khắp cõi.</p>
      <div class="row">${sermon.on ? '<button class="btn" data-act="sermon-stop">Dừng giảng</button>' : `<button class="btn" data-act="sermon-go">Thỉnh giảng</button>`}</div>
      <label class="tog" style="display:block;margin:10px 0 4px"><input type="checkbox" data-tts ${S.tts !== false && hasVoice ? 'checked' : ''} ${hasVoice ? '' : 'disabled'}> Đọc thành tiếng (giọng máy tiếng Việt${hasVoice ? '' : ': thiết bị này chưa có'})</label>
      <h3>Bảy bài tóm lược</h3>` + SUTTAS.map((x) => `<button class="sut ${U.sutta === x.id ? 'on' : ''}" data-sut="${x.id}"><b>${esc(x.name)}</b><em>${esc(x.pali)} · ${esc(x.ref)}</em></button>`).join('') +
      `<p class="note">Đây là bản <strong>tóm lược ý kinh</strong> do nhóm dự án viết lại bằng lời mới, không phải bản dịch nguyên văn. Câu Pāli là nguyên bản. Nội dung cần được hội đồng cố vấn Pháp học duyệt.</p>
      <p class="muted">Số bài đã nghe trọn: ${S.sermons || 0}.</p>`;
  } else if (U.mode === 'hall') {
    const cur = stageAt(U.drag ?? player.time);
    h = `<h2>Đại Thiền Đường Vô Tận</h2>${seg('htab', [['sit', 'Thời thiền'], ['sermon', 'Thuyết giảng']], 'sit')}<p class="pali">Ananta-megha mahā-sālā</p>
      <p>Mỗi người một Vân Tọa giữa biển mây không chân trời, cùng hướng về Tôn tượng ở phương Đông. Hai bên là các bậc Vân Đảo dâng cao dần về phía hào quang.</p><h3>Thời thiền 15 phút</h3>` +
      STAGES.map((s, i) => `<button class="stg${i === cur ? ' on' : ''}" data-seek="${s.t0}"><span>${fmt(s.t0)}</span><div><b>${esc(s.name)}</b><em>${esc(s.sound)}</em></div></button>`).join('') +
      `<p class="note">Nên dùng tai nghe để nghe rõ hướng của chuông. Trình duyệt chỉ cho phát âm thanh sau khi bạn bấm ▶.</p>
      <p class="muted">Số thời thiền đã ngồi trọn: ${S.sessions}. Những người ngồi quanh là mô phỏng; bản nhiều người cần máy chủ.</p>`;
  } else if (U.mode === 'journey') {
    const cur = U.tier ?? (S.completed ? 1 : 0);
    h = `<h2>Các tầng tỉnh thức</h2>
      <p class="note">Tên tầng là biểu trưng để định hướng thực hành. Ứng dụng không chứng nhận quả vị; tiến trình đo bằng giới, thiền và việc thiện ngoài đời.</p>
      <div class="row"><button class="btn alt" data-act="overview">Toàn cảnh</button><button class="btn alt" data-act="realm">Toàn cõi</button><button class="btn alt" data-act="mine">Vân Đảo của tôi ở tầng này</button></div>` +
      TIERS.map((t) => `<button class="tier${t.key === cur ? ' on' : ''}" data-tier="${t.key}"><b>${esc(t.name)}</b> <span class="pali">${esc(t.pali)}</span>
        <div><strong>Nền tảng:</strong> ${esc(t.base)}</div><div><strong>Thực hành:</strong> ${esc(t.tasks)}</div><div><strong>Không gian:</strong> ${esc(t.space)}</div></button>`).join('') +
      `<p class="muted">Bấm một tầng để bay tới đó. Càng lên cao, Vân Đảo càng giản lược; ở Tầng 4 chỉ còn Vân Tọa sáng quanh hào quang.</p>`;
  } else if (U.view === 'creator') {
    const D = U.draft, k = D.look, nb = nameBlock(D.name);
    h = `<h2>Nhân vật của bạn</h2>
      <h3>Tịnh danh</h3><input id="nm" type="text" maxlength="20" value="${esc(D.name)}" placeholder="Ví dụ: Tâm An" autocomplete="off" spellcheck="false"><div id="nmBox">${nb.html}</div>
      <div class="chips" data-opt="chip">${U.chips.map((n) => `<button class="chip" data-v="${esc(n)}">${esc(n)}</button>`).join('')}<button class="chip more" data-act="chips">Gợi ý khác</button></div>
      <p class="muted">Tịnh danh là tên tu tập trong ứng dụng. Nếu đã có pháp danh do thầy ban khi quy y, hãy dùng pháp danh ấy.</p>
      <h3>Phong cách</h3><div class="chips" data-opt="preset">${PRESETS.map((p, i) => `<button class="chip" data-v="${i}" title="${esc(p.note)}">${esc(p.name)}</button>`).join('')}</div>
      <h3>Diện mạo</h3>
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
      <h3>Xem tư thế</h3>${seg('pose', [['stand', 'Đứng'], ['anjali', 'Chắp tay'], ['sit', 'Tọa thiền']], U.pose)}
      <div class="row"><button class="btn" data-act="saveLook" ${nb.c.ok ? '' : 'disabled'}>Lưu nhân vật</button><button class="btn alt" data-act="rand">Ngẫu nhiên hài hòa</button><button class="ghost" data-act="home">← Vân Đảo</button></div>`;
  } else if (U.view === 'friend' && world) {
    const f = world.friends[U.friend], away = world.av.where === U.friend, gateOk = islandState().gate >= 0.5, moving = world.av.state === 'travel';
    h = `<h2>${esc(f.name)}</h2><p class="pali">Bạn đồng tu · Vân Đảo láng giềng</p>
      <p>${away ? 'Bạn đang ở đảo của ' + esc(f.name) + '. Hãy giữ sự tĩnh lặng của chủ nhà.' : esc(f.name) + ' đang tọa thiền trên đảo bên cạnh. Bạn có thể chào, tùy hỷ, hoặc du vân sang thăm.'}</p>
      <div class="row"><button class="btn" data-act="greet">Chắp tay chào</button><button class="btn alt" data-act="rejoice">Tùy hỷ công đức</button></div><div class="row">` +
      (away ? '<button class="btn alt" data-act="sitwith">Mời cùng tọa thiền</button><button class="btn alt" data-act="gohome">Về đảo của mình</button>' : `<button class="btn alt" data-act="visit" ${gateOk && !moving && world.av.where === 'home' ? '' : 'disabled'}>Du vân sang thăm</button>`) + '</div>' +
      (!away && !gateOk ? '<p class="note">Cổng Vân Môn mở nửa từ ngày 29. Muốn thử ngay, kéo thanh “Xem trước tiến trình” tới ngày 29 trở lên.</p>' : '') +
      `<p class="muted">Bạn đồng tu trong bản này là mô phỏng. Tùy hỷ ở đây là cử chỉ; điểm Thiện chỉ ghi khi bạn thật sự giúp người ngoài đời.</p><div class="row"><button class="ghost" data-act="home">← Vân Đảo</button></div>`;
  } else if (U.view === 'board') {
    h = `<h2>Bia Tích Lũy</h2><p class="pali">Ngày ${d}/49 · Tuần ${wk}: ${esc(W.title)}</p>${bars()}`;
    PILLARS.forEach((p) => {
      const [title, text] = W[p.key], dn = S.done[d] && S.done[d][p.key];
      h += `<div class="task${dn ? ' done' : ''}" data-p="${p.key}"><div class="k" style="color:${p.color}">${p.name} · ${p.sub}</div><h4>${esc(title)}</h4><p>${esc(text)}</p>` +
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
    h += `<p class="note">Phần thưởng của tuần: ${esc(W.reward)}</p>` +
      (allDone(d) ? `<p><strong>${d < 49 ? 'Đã trọn ba việc hôm nay. Ngày mai sẽ mở ngày ' + (d + 1) + '.' : 'Đã viên mãn 49 ngày: Cổng Vân Môn mở, bước lên Tầng 1.'}</strong></p>` : '') +
      `<div class="row"><button class="btn alt" data-act="sacca">Sám hối chân thật</button><span class="muted">Hạt Chân thật: ${S.sacca}</span></div>
      <p class="muted">Mỗi ngày chỉ mở một nấc. Các hệ số là tự khai để quán chiếu, không phải phép đo tâm.</p>
      <div class="row"><button class="ghost" data-act="home">← Vân Đảo</button><button class="ghost" data-act="reset">${U.resetArm ? 'Bấm lần nữa để xóa hành trình' : 'Bắt đầu lại từ ngày 1'}</button></div>`;
  } else if (U.view === 'zone' && U.zone) {
    const z = ZONES.find((x) => x.id === U.zone), ok = unlocked(z);
    h = `<h2>${esc(z.name)}</h2><p class="pali">${esc(z.pali)}</p><p>${esc(z.text)}</p>` + (z.note ? `<p class="note">${esc(z.note)}</p>` : '') +
      (!ok ? `<p class="note">Phân khu này mở ở ngày ${z.unlock} của hành trình 49 ngày.</p>` : '') + '<div class="row">' +
      (z.action === 'sit' ? '<button class="btn" data-act="play">Bắt đầu thời thiền</button><button class="btn alt" data-act="hall">Sang Đại Thiền Đường</button>' : '') +
      (z.action === 'gate' && ok ? `<button class="btn" data-act="gate">${S.open ? 'Chuyển sang Độc cư (khép cổng)' : 'Chuyển sang Nghênh khách (mở cổng)'}</button>` : '') +
      (z.id === 'kuti' ? '<button class="btn" data-act="kuti-sit">Tọa thiền tại đây</button>' : '') +
      (z.action === 'board' ? '<button class="btn" data-act="board">Mở bảng nhiệm vụ</button>' : '') + '<button class="ghost" data-act="home">← Vân Đảo</button></div>' + (z.id === 'kuti' ? '<h3>Hướng ngồi</h3>' + seg('kface', [[0, 'Cửa chính'], [1, 'Bên phải'], [2, 'Vào trong'], [3, 'Bên trái']], S.kface || 0) : '') +
      (z.action === 'gate' && ok ? `<p class="muted">Hiện tại: ${S.open ? 'Nghênh khách. Bấm tên một bạn đồng tu ở đảo bên để chào hoặc sang thăm.' : 'Độc cư.'}</p>` : '');
  } else {
    const sim = U.sim ?? d;
    h = `<h2>Vân Đảo của ${esc(S.name || 'bạn')}</h2><p class="pali">Sơ nhập Tịnh Cảnh · ngày ${d}/49 · tuần ${wk}: ${esc(W.title)}</p>${bars()}
      <p class="muted">Bấm tên một phân khu, hoặc bấm thẳng lên mặt đảo để đi tới đó. Kéo để xoay cảnh, cuộn để phóng to. Bấm tên bạn đồng tu ở đảo bên để chào.</p>
      <div class="row"><button class="btn" data-act="board">Nhiệm vụ hôm nay</button><button class="btn alt" data-act="sit">Đến Đài Thiền</button><button class="btn alt" data-act="creator">${S.name ? 'Sửa nhân vật' : 'Tạo nhân vật'}</button></div>
      <h3>Xem trước tiến trình</h3>
      <div class="sl"><span>Ngày thứ</span><input type="range" id="sim" min="1" max="49" step="1" value="${sim}"><b id="simv">${sim}</b></div>
      <p class="muted" id="simt">${esc(WEEKS[Math.ceil(sim / 7) - 1].reward)}</p>
      <div class="row"><button class="ghost" data-act="nosim">Về ngày hiện tại</button></div>` +
      (mem ? '<p class="note">Trình duyệt đang chặn lưu trữ cục bộ, nên tiến trình chỉ giữ đến khi đóng trang.</p>' : '');
  }
  panel.innerHTML = '<button class="ghost pm" data-act="pmin">' + (document.body.classList.contains('pmin') ? 'Mở bảng' : 'Thu gọn') + '</button>' + h;
  panel.scrollTop = keep;
}

// ───────── Trình tạo nhân vật ─────────
function openCreator() {
  if (!world) return; if (world.av.where !== 'home') return toast('Hãy về đảo của mình rồi sửa nhân vật.');
  if (U.mode !== 'island') setMode('island');
  U.draft = { name: S.name || U.chips[0], look: { ...S.look } }; U.pose = world.fig.pose === 'sit' ? 'sit' : 'stand'; U.view = 'creator'; U.zone = null; panel.scrollTop = 0; render(); world.setMode('creator');
}
let lookTimer = 0;
function applyDraft() { clearTimeout(lookTimer); lookTimer = setTimeout(() => { world.setLook(U.draft.look); world.fig.setPose(U.pose); world.av.state = U.pose === 'sit' ? 'sit' : 'idle'; if (U.pose === 'anjali') world.av.hold = 1e9; }, 30); }
function closeCreator(saved) { if (!saved && world) { world.setLook(S.look); } if (world) { world.av.hold = 0; if (world.fig.pose === 'anjali') world.fig.setPose('stand'); } U.draft = null; }
panel.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.tts !== undefined) { S.tts = t.checked; save(); return; }
  if (t.dataset.mvol !== undefined) { S.music.vol = +t.value; amb.setVolume(S.music.vol); save(); return; }
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
  if (e.target.closest('[data-ext]')) { if (amb.on) musicStop(); return; }
  const su = e.target.closest('[data-sut]'); if (su) { U.sutta = su.dataset.sut; if (sermon.on) sermonStart(U.sutta); else render(); return; }
  const sg = e.target.closest('[data-song]'); if (sg) { S.music.source = 'pick'; S.music.song = sg.dataset.song; save(); musicStart(sg.dataset.song); render(); return; }
  const ob = e.target.closest('[data-opt] button');
  if (ob && ob.parentElement.dataset.opt === 'kface') { S.kface = +ob.dataset.v; save(); if (world) world.setFace(S.kface); render(); setTimeout(savePos, 1200); return; }
  if (ob && ob.parentElement.dataset.opt === 'htab') { if (ob.dataset.v !== 'sermon' && sermon.on) sermonStop(); U.hallTab = ob.dataset.v; if (!U.sutta) U.sutta = SUTTAS[0].id; render(); return; }
  if (ob && ['msrc', 'mmood', 'morder', 'mspan'].includes(ob.parentElement.dataset.opt)) { const k = ob.parentElement.dataset.opt, v = ob.dataset.v, M = S.music;
    if (k === 'msrc') M.source = v; else if (k === 'mmood') M.mood = v; else if (k === 'morder') M.order = v; else M.span = +v;
    if (M.source === 'pick' && !SONG[M.song]) M.song = 'van-thuy'; save(); if (amb.on && k !== 'mspan' && k !== 'morder') musicStart(wantSong()); render(); return; }
  if (ob && U.draft && !ob.dataset.act) {
    const key = ob.parentElement.dataset.opt, v = ob.dataset.v, D = U.draft;
    if (key === 'chip') D.name = v; else if (key === 'preset') Object.assign(D.look, PRESETS[+v].look); else if (key === 'pose') U.pose = v;
    else D.look[key] = ['skin', 'robe', 'trim', 'hairColor'].includes(key) ? +v : v;
    applyDraft(); render(); return;
  }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act !== 'reset') U.resetArm = false;
  if (act === 'kuti-sit') { if (world) world.goZone('kuti', () => { world.setFace(S.kface || 0); savePos(); }); return; }
  if (act === 'sermon-go') { sermonStart(U.sutta || SUTTAS[0].id); return; }
  if (act === 'sermon-stop') { sermonStop(); render(); return; }
  if (act === 'mus-toggle') { if (amb.on) musicStop(); else musicStart(); return; }
  if (act === 'mus-next') { musicNext(); return; }
  if (act === 'mus-close') { U.musicOpen = false; render(); return; }
  if (act === 'pmin') { document.body.classList.toggle('pmin'); render(); return; }
  if (act === 'creator') return openCreator();
  if (act === 'chips') { U.chips = suggestNames(6); render(); return; }
  if (act === 'rand') { const R = (n) => Math.floor(Math.random() * n), pk = (l) => l[R(l.length)][0]; Object.assign(U.draft.look, PRESETS[R(PRESETS.length)].look, { skin: R(5), build: pk(OPTIONS.build), age: pk(OPTIONS.age), hairColor: R(2) }); if (U.draft.look.age === 'cao') U.draft.look.hairColor = 2 + R(2); U.draft.name = suggestNames(1)[0]; applyDraft(); render(); return; }
  if (act === 'saveLook') { const c = checkName(U.draft.name); if (!c.ok) return; S.name = c.name; S.look = { ...U.draft.look }; save(); closeCreator(true); U.view = 'home'; world.setMode('island'); toast('Đã lưu: ' + c.name + (c.meaning ? ' (' + c.meaning + ')' : '')); render(); return; }
  if (act === 'board') { if (U.view === 'creator') closeCreator(false); U.view = 'board'; U.zone = 'stele'; if (world && world.av.where === 'home') { if (!world.goZone('stele', () => savePos())) world.setMode('zone', { zone: 'stele' }); } }
  else if (act === 'home') { if (U.view === 'creator') closeCreator(false); U.view = 'home'; U.zone = null; if (world) world.setMode('island'); }
  else if (act === 'sit') { goZone('pad'); return; }
  else if (act === 'play') { if (!player.playing) togglePlay(); }
  else if (act === 'hall') { setMode('hall'); return; }
  else if (act === 'overview') { world.setMode('overview'); }
  else if (act === 'realm') { U.tier = null; world.setMode('realm'); render(); }
  else if (act === 'mine') { world.setMode('island'); }
  else if (act === 'gate') { S.open = !S.open; save(); toast(S.open ? 'Nghênh khách: cổng mây mở' : 'Độc cư: cổng mây khép'); }
  else if (act === 'nosim') { U.sim = null; }
  else if (act === 'greet') { world.greet(U.friend); toast('Bạn chắp tay chào. ' + world.friends[U.friend].name + ' mỉm cười đáp lễ.'); }
  else if (act === 'rejoice') { world.rejoice(U.friend); toast('Sādhu! Tùy hỷ công đức của ' + world.friends[U.friend].name + '.'); }
  else if (act === 'visit') { const i = U.friend; world.setMode('island'); world.visit(i, () => { toast('Đã đến đảo của ' + world.friends[i].name + '.'); world.greet(i); render(); }); toast('Du vân theo vân lộ…'); }
  else if (act === 'gohome') { world.goHome(() => { toast('Đã về Vân Đảo của mình.'); U.view = 'home'; world.setMode('island'); render(); }); toast('Du vân trở về…'); }
  else if (act === 'sitwith') { world.fig.setPose('sit'); world.av.state = 'sit'; world.av.rotTo = Math.atan2(-world.av.pos.x, -760 - world.av.pos.z); if (!player.playing) togglePlay(); toast('Hai người cùng an tọa, hướng về Tôn tượng.'); }
  else if (act === 'sacca') { S.sacca++; save(); if (world) world.burst(0xbfeee4); toast('Thành thật nhận lỗi và nguyện phòng hộ ngày mai: mặt hồ trong trở lại.'); }
  else if (act === 'reset') { if (U.resetArm) { const keep = { name: S.name, look: S.look }; S = Object.assign(fresh(), keep); save(); U.resetArm = false; toast('Đã trở về ngày 1.'); } else U.resetArm = true; }
  else if (act === 'confirm') {
    const card = b.closest('.task'), key = card.dataset.p, c = readCard(card), E = kusala(c);
    S.done[S.day] = S.done[S.day] || {}; S.done[S.day][key] = { E, ...c, at: Date.now() };
    S.totals[key] = Math.round((S.totals[key] + E) * 100) / 100; S.lastDate = today(); if (S.day === 49 && allDone(49)) S.completed = true; save();
    const p = PILLARS.find((x) => x.key === key); if (world) world.burst(new THREE.Color(p.color).lerp(new THREE.Color('#ffe7a8'), 0.5).getHex());
    toast(`+${E.toFixed(2)} ${p.name}: hạt sáng thấm vào cội Bồ-đề`);
  }
  render();
});

// ───────── Chuyển không gian ─────────
function setMode(m) {
  if (U.view === 'creator') closeCreator(false);
  if (m !== 'hall' && sermon.on) sermon.stop(); U.mode = m; document.body.classList.toggle('hall', m === 'hall');
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x.dataset.m === m));
  if (m !== 'journey') U.tier = null;
  if (window.innerWidth <= 820) document.body.classList.toggle('pmin', m === 'hall' || m === 'island');   // điện thoại: mở cảnh trước, bảng thu gọn
  if (m === 'island') { U.view = world && world.av.where !== 'home' ? 'friend' : 'home'; U.zone = null; }
  if (world) world.setMode(m === 'hall' ? 'hall' : m === 'journey' ? 'overview' : 'island');
  render();
}
$('#rad').addEventListener('click', () => { S.radar = !S.radar; save(); document.body.classList.toggle('radar', !!S.radar); $('#rad').classList.toggle('on', !!S.radar); });
document.body.classList.toggle('radar', !!S.radar); $('#rad').classList.toggle('on', !!S.radar);
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
$('#who').addEventListener('click', () => { U.musicOpen = false; openCreator(); });
$('#mus').addEventListener('click', () => { U.musicOpen = !U.musicOpen; if (U.musicOpen && U.view === 'creator') { closeCreator(false); U.view = 'home'; if (world) world.setMode('island'); } document.body.classList.remove('pmin'); render(); });
musBtn();

// ───────── Ẩn giao diện khi tọa thiền ─────────
const wake = () => { U.idleAt = performance.now(); };
['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, wake, { passive: true }));
$('#hide').addEventListener('click', (e) => { e.stopPropagation(); U.quietManual = true; toast('Giao diện đã ẩn. Bấm phím H hoặc chạm vào cảnh để hiện lại.'); });
window.addEventListener('keydown', (e) => {
  if (e.target.matches('textarea,input')) return;
  if (e.key === 'h' || e.key === 'H') U.quietManual = !U.quietManual;
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
});
window.addEventListener('resize', () => world && world.resize());

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
  if (sm.on && world && U.mode === 'hall') { const want = sermon.phase === 'line' || sermon.phase === 'gap' || sermon.phase === 'dedicate' ? 'close' : 'wide';
    if (U.sCam !== want) { U.sCam = want; const V3 = World.V3; world.wide = true; if (want === 'close') world.flyTo(new V3(-30, 96, -300), new V3(0, 318, -760), 56, 2.6); else world.flyTo(new V3(0, 40, -150), new V3(0, 150, -560), 62, 2.6); } }
  if (world) world.update(dt, { vis, breath: breathEnv(started ? t : now / 1000), waves, isl: islandState(), sermon: sm });
  updateBar(t); updateLabels();
  if (U.mode === 'hall' && S.radar && frames % 2 === 0) { drawRadar(t); drawScope(); }
  document.body.classList.toggle('quiet', U.quietManual || (player.playing && U.mode === 'hall' && now - U.idleAt > 9000 && U.drag === null));
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
if (hash.sermon) { U.hallTab = 'sermon'; setMode('hall'); sermonStart(hash.sermon === '1' ? SUTTAS[0].id : hash.sermon); if (hash.sk) { for (let i = 0; i < +hash.sk * 20; i++) sermon.tick(0.05); } }
if (hash.music) { U.musicOpen = true; render(); }
if (hash.view === 'board') { U.view = 'board'; render(); }
if (hash.view === 'creator') openCreator();
if (hash.at && world && World.NODES[hash.at]) { const n = World.NODES[hash.at]; world.av.pos.set(n[0], 0, n[1]); world.av.pos.y = World.floorH(n[0], n[1]); world.snap = true; }
if (hash.zone) goZone(hash.zone);
if (world && world.tween && hash.snap !== undefined) world.tween.k = 0.999;
window.__app = { player, world, offlineProbe, amb, probeSong, SONGS, state: () => S, U };
requestAnimationFrame(frame);

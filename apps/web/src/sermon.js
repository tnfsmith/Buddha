// Thuyết giảng: CHỈ phát bài giảng đã được Hội đồng cố vấn Pháp học duyệt (AGENTS.md mục 1.6, PROJECT_ROADMAP.md §16).
// Văn bản bài giảng không nằm trong mã client: tải từ GET /api/v1/content?kind=bai_giang, máy chủ chỉ trả status = 'da_duyet'.
// Bảy bài tóm lược Nikāya trước đây viết cứng ở đây đã rút khỏi client (#39); bản nháp chờ chuyển vào content/ ở trạng thái cho_duyet.
export const HOMAGE = 'Namo tassa bhagavato arahato sammāsambuddhassa.';

/**
 * Đổi một dòng content_item (API) thành bài giảng; không đủ điều kiện thì trả null và bài đó không hiện.
 * Điều kiện: kind 'bai_giang', có dấu duyệt (reviewed_at), có id, tên, nguồn kinh, và ít nhất một ý.
 * body_inline (đề xuất, chốt ở hợp đồng nội dung GĐ3): mỗi dòng không trống là một ý; dòng bắt đầu bằng '>' là câu Pāli gốc.
 * Nội dung chỉ để ở body_r2_key (bài dài trên R2) chưa hỗ trợ ở client này nên cũng bỏ qua.
 */
export function toSermon(it) {
  if (!it || (it.kind && it.kind !== 'bai_giang') || !it.reviewed_at || !it.id || !it.title || !it.source_ref || typeof it.body_inline !== 'string') return null;
  const rows = it.body_inline.split(/\r?\n/).map((x) => x.trim()).filter(Boolean), pali = rows.filter((x) => x.startsWith('>')), lines = rows.filter((x) => !x.startsWith('>'));
  return lines.length ? { id: String(it.id), version: it.version, name: String(it.title), ref: String(it.source_ref), key: pali.length ? pali[0].replace(/^>\s*/, '') : '', lines } : null;
}

/** Danh sách bài đã duyệt của phiên này. state: idle → loading → ok (items có thể rỗng) | error (mất mạng, bản HTML đơn mở từ máy, máy chủ lỗi) */
export const library = { state: 'idle', items: [] };
let pending = null;
export function loadSermons(force) {
  if (pending) return pending;
  if (library.state === 'ok' && !force) return Promise.resolve(library);
  library.state = 'loading';
  pending = (async () => {
    try {
      if (!/^https?:$/.test(location.protocol)) throw new Error('Bản mở từ tệp trên máy không gọi được máy chủ');
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 8000);
      const r = await fetch('/api/v1/content?kind=bai_giang', { signal: ac.signal, headers: { accept: 'application/json' } }).finally(() => clearTimeout(tm));
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(), seen = new Set();
      // máy chủ xếp các phiên bản cùng id theo version giảm dần: giữ bản đầu tiên (mới nhất đã duyệt)
      library.items = (Array.isArray(j.items) ? j.items : []).map(toSermon).filter((x) => x && !seen.has(x.id) && seen.add(x.id));
      library.state = 'ok';
    } catch (e) { library.items = []; library.state = 'error'; library.why = e.message; }
    pending = null; return library;
  })();
  return pending;
}
const DEDICATE = 'Nguyện công đức nghe Pháp này lan đến mọi loài: cho ai khổ được hết khổ, ai sợ được hết sợ, ai sầu được hết sầu.';

export class Sermon {
  constructor() { this.on = false; this.online = null; this.onend = null; this.tts = false; this.voice = null; this.st = { on: false, speak: 0, bow: 0, anjali: false, waves: [], merit: 0 }; }
  static viVoice() { try { return (speechSynthesis.getVoices() || []).find((v) => /^vi/i.test(v.lang)) || null; } catch (e) { return null; } }
  start(sutta, tts) {
    this.stop(true); this.s = sutta; this.on = true; this.tts = !!tts && !!(this.voice = Sermon.viVoice()); this.t = 0; this.i = -1; this.phase = 'homage'; this.left = 6.5; this.waves = []; this.spoken = false;
    this._show({ src: [sutta.pali, sutta.ref].filter(Boolean).join(' · '), ln: HOMAGE, pl: 'Thành kính đảnh lễ đức Thế Tôn, bậc Ứng Cúng, Chánh Đẳng Giác.' });
  }
  stop(silent) { if (!this.on && !silent) return; this.on = false; try { speechSynthesis.cancel(); } catch (e) { /* không có TTS */ } this.st = { on: false, speak: 0, bow: 0, anjali: false, waves: [], merit: 0 }; if (!silent) { this._show(null); if (this.onend) this.onend(false); } }
  _show(o) { if (this.online) this.online(o); }
  _say(text) {
    this.spoken = true; this.left = Math.max(4.5, text.length * 0.085) + 0.6; this.ttsBusy = false;
    if (this.tts) { try { const u = new SpeechSynthesisUtterance(text); u.voice = this.voice; u.lang = this.voice.lang; u.rate = 0.82; u.pitch = 0.85; this.ttsBusy = true; this.left += 8; const done = () => { if (this.ttsBusy) { this.ttsBusy = false; this.left = Math.min(this.left, 0.2); } }; u.onend = done; u.onerror = done; speechSynthesis.speak(u); } catch (e) { this.ttsBusy = false; } }
  }
  _next() {
    const s = this.s; this.i++;
    if (this.i < s.lines.length) { this.phase = 'line'; this._show({ src: `${s.name} · ${s.ref} · ý ${this.i + 1}/${s.lines.length}`, ln: s.lines[this.i], pl: this.i === 0 && s.key ? s.key : '' }); this._say(s.lines[this.i]); }
    else if (this.phase !== 'sadhu' && this.phase !== 'dedicate') { this.phase = 'sadhu'; this.left = 9; this.spoken = false; this._show({ src: `${s.name} · kết thúc`, ln: 'Sādhu! Sādhu! Sādhu!', pl: 'Lành thay! Hội chúng đảnh lễ ba lần.' }); }
  }
  tick(dt) {
    const st = this.st; if (!this.on) return st;
    this.t += dt; this.left -= dt; st.on = true; st.anjali = true; st.merit = 0;
    this.waves = this.waves.map((a) => a + dt).filter((a) => a < 14); st.waves = this.waves;
    const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    if (this.phase === 'homage') { const k = 6.5 - this.left; st.bow = ease((k - 1.2) / 1.3) * (1 - ease((k - 4.0) / 1.4)); st.speak = 0; if (this.left <= 0) this._next(); }
    else if (this.phase === 'line') { const sp = this.left > 0.7; st.speak = sp ? Math.pow(Math.abs(Math.sin(this.t * 10.6)) * (0.55 + 0.45 * Math.sin(this.t * 2.3 + 1)), 0.7) : 0; st.bow = 0;
      if (this.left <= 0) { if ((this.i + 1) % 3 === 0 && this.i + 1 < this.s.lines.length) { this.phase = 'nod'; this.left = 2.4; } else { this.phase = 'gap'; this.left = 1.1; } } }
    else if (this.phase === 'nod') { const k = 2.4 - this.left; st.speak = 0; st.bow = 0.32 * Math.sin(Math.PI * Math.min(1, k / 2.2)); if (this.left <= 0) this._next(); }
    else if (this.phase === 'gap') { st.speak = 0; st.bow = 0; if (this.left <= 0) this._next(); }
    else if (this.phase === 'sadhu') { const k = 9 - this.left, c = (k % 3) / 3; st.speak = 0; st.bow = Math.pow(Math.sin(Math.PI * c), 2); const n = Math.floor(k / 3); if (n !== this._wn && c > 0.45) { this._wn = n; this.waves.push(0); }
      if (this.left <= 0) { this._wn = -1; this.phase = 'dedicate'; this._show({ src: 'Hồi hướng', ln: DEDICATE, pl: 'Idaṃ me ñātīnaṃ hotu, sukhitā hontu ñātayo.' }); this._say(DEDICATE); this.waves.push(0); } }
    else if (this.phase === 'dedicate') { st.speak = this.left > 0.7 ? Math.abs(Math.sin(this.t * 10.6)) * 0.8 : 0; st.bow = 0; st.merit = 1; if (this.left <= 0) { this.on = false; this.st = { on: false, speak: 0, bow: 0, anjali: false, waves: this.waves, merit: 0 }; this._show(null); if (this.onend) this.onend(true); } }
    return this.st;
  }
}

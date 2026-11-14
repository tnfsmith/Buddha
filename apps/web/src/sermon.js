// Thuyết giảng: chỉ phát bài giảng đã được chọn phát hành (máy chủ chỉ trả status = 'da_duyet', PROJECT_ROADMAP.md §16).
// #55 (chủ dự án, 14/11/2026): Hội đồng là tư vấn tùy chọn, không phải điều kiện hiển thị; reviewed_at không bắt buộc ở client.
// Văn bản bài giảng không nằm trong mã client: tải từ GET /api/v1/content?kind=bai_giang, máy chủ chỉ trả status = 'da_duyet'.
// Giọng đọc (ADR 0002): tệp MP3 sinh trước, trên R2, phát qua /media/<body_r2_key>; chữ từng ý chạy theo <khóa>.cues.json.
export const HOMAGE = 'Namo tassa bhagavato arahato sammāsambuddhassa.';
export const AI_VOICE = 'Giọng đọc do AI tạo (OpenAI)';
/** Menu các loạt bài (chỉ là tên loạt và tên phần; nội dung bài nằm ở máy chủ). Bài chưa có meta.loat vào loạt mặc định. */
export const LOAT = {
  'loi-phat-day': { name: 'Lời Phật dạy', phan: [] },
  'duong-xua': { name: 'Đường Xưa Mây Trắng', phan: ['', 'Phần Một — Ánh sao mai', 'Phần Hai — Thương là hiểu', 'Phần Ba — Về với mây trắng'] },
};
export const LOAT0 = 'loi-phat-day';
const R2KEY = /^[a-z0-9][a-z0-9._/-]*\.mp3$/i;
const metaOf = (m) => { if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { m = null; } } return m && typeof m === 'object' ? m : {}; };

/**
 * Đổi một dòng content_item (API) thành bài giảng; không đủ điều kiện thì trả null và bài đó không hiện.
 * Điều kiện: kind 'bai_giang', có id, tên, nguồn kinh, và ít nhất một ý (reviewed_at không bắt buộc, #55).
 * body_inline: mỗi dòng không trống là một ý; dòng bắt đầu bằng '>' là câu Pāli gốc. Bài chỉ có body_r2_key mà không có chữ: bỏ qua.
 * body_r2_key (khóa MP3 trên R2) và meta (loat, phan, thu_tu; chuỗi JSON hoặc đối tượng) là tùy chọn.
 */
export function toSermon(it) {
  if (!it || (it.kind && it.kind !== 'bai_giang') || !it.id || !it.title || !it.source_ref || typeof it.body_inline !== 'string') return null;
  const rows = it.body_inline.split(/\r?\n/).map((x) => x.trim()).filter(Boolean), pali = rows.filter((x) => x.startsWith('>')), lines = rows.filter((x) => !x.startsWith('>'));
  if (!lines.length) return null;
  const m = metaOf(it.meta), k = typeof it.body_r2_key === 'string' && R2KEY.test(it.body_r2_key) && !it.body_r2_key.includes('..') ? it.body_r2_key : '';
  return { id: String(it.id), version: it.version, name: String(it.title), ref: String(it.source_ref), key: pali.length ? pali[0].replace(/^>\s*/, '') : '', lines,
    audio: k ? { src: '/media/' + k, cues: '/media/' + k.replace(/\.mp3$/i, '.cues.json') } : null,
    loat: typeof m.loat === 'string' && /^[a-z0-9-]{1,40}$/.test(m.loat) ? m.loat : LOAT0, phan: Number(m.phan) || 0, order: m.thu_tu != null && m.thu_tu !== '' && Number.isFinite(+m.thu_tu) ? +m.thu_tu : null };
}
/** Trong mỗi loạt: xếp theo thu_tu; bài không có thu_tu giữ thứ tự máy chủ, đứng sau */
export function sortSermons(list) {
  return list.map((x, i) => ({ x, i })).sort((a, b) => (a.x.order == null) - (b.x.order == null) || (a.x.order || 0) - (b.x.order || 0) || a.i - b.i).map((o) => o.x);
}
/** Các thẻ menu: mọi loạt đã biết, thêm loạt lạ có trong danh sách */
export function loatTabs(list) { return [...new Set([...Object.keys(LOAT), ...list.map((x) => x.loat)])].map((k) => [k, (LOAT[k] && LOAT[k].name) || k]); }

/** Danh sách bài đã phát hành của phiên này. state: idle → loading → ok (items có thể rỗng) | error (mất mạng, bản HTML đơn mở từ máy, máy chủ lỗi) */
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
      // máy chủ xếp các phiên bản cùng id theo version giảm dần: giữ bản đầu tiên (mới nhất đã phát hành)
      library.items = sortSermons((Array.isArray(j.items) ? j.items : []).map(toSermon).filter((x) => x && !seen.has(x.id) && seen.add(x.id)));
      library.state = 'ok';
    } catch (e) { library.items = []; library.state = 'error'; library.why = e.message; }
    pending = null; return library;
  })();
  return pending;
}
const DEDICATE = 'Nguyện công đức nghe Pháp này lan đến mọi loài: cho ai khổ được hết khổ, ai sợ được hết sợ, ai sầu được hết sầu.';

/** Giọng đọc một bài: tệp MP3 + mốc từng ý. state: loading → ready | fail (thiếu tệp, cues lệch số ý, bị chặn phát) */
class Track {
  constructor(s) {
    this.state = 'loading'; this.cues = null; this.live = false;
    const el = (this.el = new Audio()); el.preload = 'auto'; el.src = s.audio.src;
    el.addEventListener('error', () => this.fail('media'));
    // Safari iOS chỉ cho phát khi có cú chạm: phát câm rồi dừng ngay trong cú chạm "Thỉnh giảng" để mở khóa cho lúc vào bài
    try { el.muted = true; const p = el.play(); if (p && p.then) p.then(() => { if (!this.live) { el.pause(); el.currentTime = 0; } el.muted = false; }, () => { el.muted = false; }); } catch (e) { el.muted = false; }
    const ac = (this.ac = new AbortController()), tm = setTimeout(() => ac.abort(), 8000);
    fetch(s.audio.cues, { signal: ac.signal, headers: { accept: 'application/json' } })
      .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then((j) => { const c = j && Array.isArray(j.cues) ? j.cues : [];
        if (c.length !== s.lines.length || c.some((q, i) => !q || q.i !== i || !(q.t >= 0) || !(q.e > q.t))) throw new Error('cues lệch số ý');
        this.cues = c; if (this.state === 'loading') this.state = 'ready'; })
      .catch(() => this.fail('cues')).finally(() => clearTimeout(tm));
  }
  fail(why) { if (this.state !== 'fail') { this.state = 'fail'; this.why = why; } }
  play() { this.live = true; this.el.muted = false; try { this.el.currentTime = 0; } catch (e) { /* chưa có dữ liệu */ } const p = this.el.play(); if (p && p.catch) p.catch(() => this.fail('play')); }
  at(t) { let i = 0; while (i + 1 < this.cues.length && this.cues[i + 1].t <= t) i++; return i; }
  dispose() { this.live = false; try { this.ac.abort(); } catch (e) { /* đã xong */ } try { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); } catch (e) { /* bỏ qua */ } }
}
const mouth = (t) => Math.pow(Math.abs(Math.sin(t * 10.6)) * (0.55 + 0.45 * Math.sin(t * 2.3 + 1)), 0.7);

export class Sermon {
  constructor() { this.on = false; this.online = null; this.onend = null; this.tts = false; this.voice = null; this.au = null; this.paused = false; this.st = { on: false, speak: 0, bow: 0, anjali: false, waves: [], merit: 0 }; }
  static viVoice() { try { return (speechSynthesis.getVoices() || []).find((v) => /^vi/i.test(v.lang)) || null; } catch (e) { return null; } }
  /** Gọi trong cú chạm của người nghe (để mở khóa phát tiếng trên iOS). Bài có giọng đọc thì không dùng giọng máy của thiết bị. */
  start(sutta, tts) {
    this.stop(true); this.s = sutta; this.on = true; this.paused = false;
    this.au = sutta.audio && /^https?:$/.test(location.protocol) ? new Track(sutta) : null;
    this.tts = !this.au && !!tts && !!(this.voice = Sermon.viVoice()); this.t = 0; this.i = -1; this.phase = 'homage'; this.left = 6.5; this.waves = []; this.spoken = false;
    this._show({ src: [sutta.pali, sutta.ref].filter(Boolean).join(' · '), ln: HOMAGE, pl: 'Thành kính đảnh lễ đức Thế Tôn, bậc Ứng Cúng, Chánh Đẳng Giác.' });
  }
  stop(silent) { if (!this.on && !silent) return; this.on = false; this.paused = false; this._drop(); try { speechSynthesis.cancel(); } catch (e) { /* không có TTS */ } this.st = { on: false, speak: 0, bow: 0, anjali: false, waves: [], merit: 0 }; if (!silent) { this._show(null); if (this.onend) this.onend(false); } }
  pause() { if (!this.on || this.paused) return; this.paused = true; if (this.au && this.phase === 'audio') this.au.el.pause(); try { speechSynthesis.pause(); } catch (e) { /* không có TTS */ } }
  resume() { if (!this.paused) return; this.paused = false; if (this.au && this.phase === 'audio') { const p = this.au.el.play(); if (p && p.catch) p.catch(() => this.au && this.au.fail('play')); } try { speechSynthesis.resume(); } catch (e) { /* không có TTS */ } }
  /** d = 1: sang ý sau; d = -1: về ý trước */
  step(d) {
    if (!this.on) return; const n = this.s.lines.length;
    if (this.phase === 'audio' && this.au) {
      if (d > 0 && this.i >= n - 1) { this._drop(); this.phase = 'gap'; this.left = 0.3; return; }
      const j = Math.max(0, Math.min(n - 1, this.i + d)); try { this.au.el.currentTime = this.au.cues[j].t; } catch (e) { /* chưa tua được */ } this._line(j); return;
    }
    if (this.phase === 'line' || this.phase === 'gap' || this.phase === 'nod') { try { speechSynthesis.cancel(); } catch (e) { /* không có TTS */ } this.ttsBusy = false; if (d < 0) this.i = Math.max(-1, this.i - 2); this._next(); }
  }
  _drop() { if (this.au) { this.au.dispose(); this.au = null; } }
  _show(o) { if (this.online) this.online(o); }
  _line(i) { const s = this.s; this.i = i; this._show({ src: `${s.name} · ${s.ref} · ý ${i + 1}/${s.lines.length}`, ln: s.lines[i], pl: i === 0 && s.key ? s.key : '', ai: !!this.au }); }
  _say(text) {
    this.spoken = true; this.left = Math.max(4.5, text.length * 0.085) + 0.6; this.ttsBusy = false;
    if (this.tts) { try { const u = new SpeechSynthesisUtterance(text); u.voice = this.voice; u.lang = this.voice.lang; u.rate = 0.82; u.pitch = 0.85; this.ttsBusy = true; this.left += 8; const done = () => { if (this.ttsBusy) { this.ttsBusy = false; this.left = Math.min(this.left, 0.2); } }; u.onend = done; u.onerror = done; speechSynthesis.speak(u); } catch (e) { this.ttsBusy = false; } }
  }
  _next() {
    const s = this.s;
    if (this.au && this.i < 0) {
      // vào bài: có tiếng thì phát; chưa tải xong thì chờ thêm tối đa 4 giây; lỗi thì đọc bằng chữ như bài không có giọng đọc
      if (this.au.state === 'ready') { this.phase = 'audio'; this.au.play(); this._line(0); return; }
      if (this.au.state === 'loading' && this.phase !== 'wait') { this.phase = 'wait'; this.left = 4; return; }
      this._drop();
    }
    this.i++;
    if (this.i < s.lines.length) { this.phase = 'line'; this._line(this.i); this._say(s.lines[this.i]); }
    else if (this.phase !== 'sadhu' && this.phase !== 'dedicate') { this.phase = 'sadhu'; this.left = 9; this.spoken = false; this._show({ src: `${s.name} · kết thúc`, ln: 'Sādhu! Sādhu! Sādhu!', pl: 'Lành thay! Hội chúng đảnh lễ ba lần.' }); }
  }
  tick(dt) {
    const st = this.st; if (!this.on) return st;
    if (this.paused) { st.speak = 0; return st; }
    this.t += dt; this.left -= dt; st.on = true; st.anjali = true; st.merit = 0;
    this.waves = this.waves.map((a) => a + dt).filter((a) => a < 14); st.waves = this.waves;
    const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
    if (this.phase === 'homage') { const k = 6.5 - this.left; st.bow = ease((k - 1.2) / 1.3) * (1 - ease((k - 4.0) / 1.4)); st.speak = 0; if (this.left <= 0) this._next(); }
    else if (this.phase === 'wait') { st.speak = 0; st.bow = 0; if (!this.au || this.au.state !== 'loading' || this.left <= 0) this._next(); }
    else if (this.phase === 'audio') {
      const au = this.au; st.bow = 0;
      if (!au || au.state === 'fail') { this._drop(); this.i = Math.max(-1, this.i - 1); this.phase = 'gap'; this.left = 0.3; st.speak = 0; }   // mất tiếng (kể cả ngay khi vừa phát): đọc lại ý đang dở bằng chữ
      else if (au.el.ended) { this._drop(); this.i = this.s.lines.length - 1; this.phase = 'gap'; this.left = 1.2; st.speak = 0; }
      else { const tt = au.el.currentTime, i = au.at(tt), q = au.cues[i]; if (i !== this.i) this._line(i); st.speak = !au.el.paused && tt >= q.t && tt < q.e - 0.15 ? mouth(this.t) : 0;
        // kẹt quá 20 giây (mất mạng, hệ điều hành dừng tiếng): chuyển sang đọc bằng chữ
        if (tt === au.lt) { au.stall = (au.stall || 0) + dt; if (au.stall > 20) au.fail('stall'); } else { au.lt = tt; au.stall = 0; } }
    }
    else if (this.phase === 'line') { st.speak = this.left > 0.7 ? mouth(this.t) : 0; st.bow = 0;
      if (this.left <= 0) { if ((this.i + 1) % 3 === 0 && this.i + 1 < this.s.lines.length) { this.phase = 'nod'; this.left = 2.4; } else { this.phase = 'gap'; this.left = 1.1; } } }
    else if (this.phase === 'nod') { const k = 2.4 - this.left; st.speak = 0; st.bow = 0.32 * Math.sin(Math.PI * Math.min(1, k / 2.2)); if (this.left <= 0) this._next(); }
    else if (this.phase === 'gap') { st.speak = 0; st.bow = 0; if (this.left <= 0) this._next(); }
    else if (this.phase === 'sadhu') { const k = 9 - this.left, c = (k % 3) / 3; st.speak = 0; st.bow = Math.pow(Math.sin(Math.PI * c), 2); const n = Math.floor(k / 3); if (n !== this._wn && c > 0.45) { this._wn = n; this.waves.push(0); }
      if (this.left <= 0) { this._wn = -1; this.phase = 'dedicate'; this._show({ src: 'Hồi hướng', ln: DEDICATE, pl: 'Idaṃ me ñātīnaṃ hotu, sukhitā hontu ñātayo.' }); this._say(DEDICATE); this.waves.push(0); } }
    else if (this.phase === 'dedicate') { st.speak = this.left > 0.7 ? Math.abs(Math.sin(this.t * 10.6)) * 0.8 : 0; st.bow = 0; st.merit = 1; if (this.left <= 0) { this.on = false; this.st = { on: false, speak: 0, bow: 0, anjali: false, waves: this.waves, merit: 0 }; this._show(null); if (this.onend) this.onend(true); } }
    return this.st;
  }
}

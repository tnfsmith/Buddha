import { DUR, PAD_FREQS, BELLS, buildTracks, buildEvents, valueAt, breathEnv } from './data.js';

export const TR = buildTracks();
export const EV = buildEvents();

// Đường bao chuông: khởi âm cosine nâng, tắt dần hàm mũ, cửa sổ đuôi ép về đúng 0.
const curveCache = {};
function bellCurve(type) {
  if (curveCache[type]) return curveCache[type];
  const d = BELLS[type], sr = 200, N = Math.ceil(d.dur * sr) + 1, a = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / sr, u = t / d.dur;
    const att = t < d.att ? 0.5 * (1 - Math.cos((Math.PI * t) / d.att)) : 1;
    const dec = t < d.att ? 1 : Math.exp(-(t - d.att) / d.tau);
    const tail = u > 0.7 ? 0.5 * (1 + Math.cos((Math.PI * (u - 0.7)) / 0.3)) : 1;
    a[i] = att * dec * tail;
  }
  a[0] = 0; a[N - 1] = 0;
  return (curveCache[type] = a);
}

export function dirVec(az, el, d = 3) {
  const A = (az * Math.PI) / 180, E = (el * Math.PI) / 180;
  return [d * Math.cos(E) * Math.sin(A), d * Math.sin(E), -d * Math.cos(E) * Math.cos(A)];
}

// Đồ thị âm thanh: mọi bộ dao động nền chạy liên tục từ đầu đến cuối, chỉ điều khiển bằng AudioParam.
export class Engine {
  constructor(ctx) {
    const c = (this.ctx = ctx);
    this.master = c.createGain(); this.master.gain.value = 0;
    this.vol = c.createGain(); this.vol.gain.value = 0.9;
    this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024;
    this.pre = c.createGain(); this.pre.gain.value = 1.6; // đưa đỉnh lên khoảng −3 dBFS, vẫn chừa khoảng dự trữ cho can thiệp sinh học
    this.master.connect(this.pre); this.pre.connect(this.vol); this.vol.connect(c.destination); this.vol.connect(this.analyser);

    // Nền hòa âm
    this.padSum = c.createGain();
    this.breathVCA = c.createGain();
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 0.5; this.lp.frequency.value = 5000;
    this.pan = c.createStereoPanner();
    this.padSum.connect(this.breathVCA); this.breathVCA.connect(this.lp); this.lp.connect(this.pan); this.pan.connect(this.master);
    this.voices = PAD_FREQS.map((f) => {
      const osc = c.createOscillator(); osc.frequency.value = f;
      const g = c.createGain(); g.gain.value = 0;
      osc.connect(g); g.connect(this.padSum); osc.start();
      return { f, g };
    });

    // Nhịp thở 4 giây hít – 6 giây thở: chạy trên luồng âm thanh, không cập nhật bằng JavaScript.
    const sr = c.sampleRate, buf = c.createBuffer(1, Math.round(sr * 10), sr), ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = breathEnv(i / sr);
    this.breathBuf = buf;
    this.breathDepth = c.createGain(); this.breathDepth.gain.value = 0;
    this.breathDepth.connect(this.breathVCA.gain);

    // Quỹ đạo xoay chậm
    this.orbitOsc = c.createOscillator(); this.orbitOsc.frequency.value = 0.05;
    this.orbitDepth = c.createGain(); this.orbitDepth.gain.value = 0;
    this.orbitOsc.connect(this.orbitDepth); this.orbitDepth.connect(this.pan.pan); this.orbitOsc.start();

    // Nhịp phách hai tai (tùy chọn, mức rất nhỏ)
    this.binL = c.createOscillator(); this.binL.frequency.value = 200;
    this.binR = c.createOscillator(); this.binR.frequency.value = 212;
    const merger = c.createChannelMerger(2);
    this.binL.connect(merger, 0, 0); this.binR.connect(merger, 0, 1);
    this.binGain = c.createGain(); this.binGain.gain.value = 0.03;
    merger.connect(this.binGain); this.binGain.connect(this.master);
    this.binL.start(); this.binR.start();

    // Chuông
    this.bellBus = c.createGain(); this.bellBus.connect(this.master);
    this.live = [];

    // Âm trầm lắng dịu (can thiệp phóng dật): 136,1 Hz (âm «Om» của năm Trái Đất), quãng tám dưới cho chỗ dựa sâu, một bè lệch 0,25 Hz
    // để tiếng ngân như chuông bát thay vì một nốt điện tử đứng yên; quãng năm và quãng tám trên rất nhẹ, lọc mềm dưới 480 Hz.
    // Âm lượng thở theo nhịp 0,1 Hz (mỗi chu kỳ 10 giây, như hít 4 – thở 6) để dẫn hơi thở người nghe chậm lại.
    this.ov = c.createGain(); this.ov.gain.value = 0;
    const ovLP = c.createBiquadFilter(); ovLP.type = 'lowpass'; ovLP.frequency.value = 480;
    const sw = c.createGain(); sw.gain.value = 0.7; const lfo = c.createOscillator(); lfo.frequency.value = 0.1; const ld = c.createGain(); ld.gain.value = 0.3;
    lfo.connect(ld); ld.connect(sw.gain); lfo.start();
    this.ov.connect(sw); sw.connect(ovLP); ovLP.connect(this.master);
    [[68.05, 0.24], [136.1, 0.45], [136.35, 0.2], [204.15, 0.15], [272.2, 0.09]].forEach(([f, w]) => {
      const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = w;
      o.connect(g); g.connect(this.ov); o.start();
    });
  }

  _set(param, pts, fromT, when, map = (v) => v) {
    param.cancelScheduledValues(0);
    param.setValueAtTime(map(valueAt(pts, fromT)), when);
    for (const [t, v] of pts) if (t > fromT) param.linearRampToValueAtTime(map(v), when + (t - fromT));
  }

  // Lập lịch toàn bộ phần còn lại của bản nhạc, tính từ giây fromT, bắt đầu tại thời điểm when của AudioContext.
  schedule(fromT, when) {
    const c = this.ctx;
    this.voices.forEach((v) => this._set(v.g.gain, TR['pad' + v.f], fromT, when));
    this._set(this.breathDepth.gain, TR.breathDepth, fromT, when);
    this._set(this.breathVCA.gain, TR.breathDepth, fromT, when, (v) => 1 - v);
    this._set(this.lp.frequency, TR.lowpass, fromT, when);
    this._set(this.orbitDepth.gain, TR.orbit, fromT, when);
    this._set(this.binR.frequency, TR.beat, fromT, when, (v) => 200 + v);
    if (this.bsrc) { try { this.bsrc.stop(); } catch (e) { /* đã dừng */ } this.bsrc.disconnect(); }
    this.bsrc = c.createBufferSource(); this.bsrc.buffer = this.breathBuf; this.bsrc.loop = true;
    this.bsrc.connect(this.breathDepth); this.bsrc.start(when, fromT % 10);
    this.killBells();
    for (const e of EV) if (e.t >= fromT && e.t < DUR) this.bell(e, when + (e.t - fromT));
  }

  bell(e, at) {
    const c = this.ctx, d = BELLS[e.type];
    const env = c.createGain(); env.gain.value = 0;
    env.gain.setValueCurveAtTime(bellCurve(e.type), at, d.dur);
    const lvl = c.createGain(); lvl.gain.value = e.gain;
    env.connect(lvl);
    let out = lvl;
    if (!d.wide) {
      const p = c.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 0;
      const [x, y, z] = dirVec(e.az, e.el);
      if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
      lvl.connect(p); out = p;
    }
    out.connect(this.bellBus);
    const W = d.parts.reduce((s, q) => s + q[1], 0);
    const oscs = d.parts.map(([f, w]) => {
      const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = w / W;
      o.connect(g); g.connect(env); o.start(at); o.stop(at + d.dur + 0.05);
      return o;
    });
    const v = { oscs, out, at, end: at + d.dur, bio: !!e.bio };
    oscs[0].onended = () => { try { out.disconnect(); } catch (er) { /* đã ngắt */ } this.live = this.live.filter((x) => x !== v); };
    this.live.push(v);
    return v;
  }

  killBells(onlyPending = false, bioOnly = false) {
    const now = this.ctx.currentTime;
    this.live = this.live.filter((v) => {
      if (bioOnly && !v.bio) return true;
      if (onlyPending && v.at <= now + 0.05) return true;
      v.oscs.forEach((o) => { try { o.stop(); } catch (e) { /* chưa phát */ } });
      try { v.out.disconnect(); } catch (e) { /* đã ngắt */ }
      return false;
    });
  }

  setBio(mode) {
    const c = this.ctx, now = c.currentTime, g = this.ov.gain;
    g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
    if (mode === 'uddhacca') { g.linearRampToValueAtTime(0.12, now + 6); g.setValueAtTime(0.12, now + 180); g.linearRampToValueAtTime(0, now + 192); }
    else g.linearRampToValueAtTime(0, now + 4);
    this.killBells(true, true);
    if (mode === 'thina') for (let i = 0; i < 9; i++) this.bell({ type: 'tinh', az: (i * 80) % 360, el: 60, gain: 0.15, bio: true }, now + 0.3 + i * 10);
  }
}

// Chế độ can thiệp đang chọn (Định tĩnh, Trị phóng dật, Trị hôn trầm) và lúc chọn: world.js vẽ sóng âm theo đây
export const BIO = { mode: 'samadhi', at: 0 };

// Trình phát thời gian thực: đồng hồ AudioContext là đồng hồ chủ cho cả cảnh 3D.
export class Player {
  constructor() { this.T0 = 0; this.C0 = 0; this.playing = false; this.ctx = null; this.eng = null; this.scheduled = false; this.volume = 0.9; this.bin = true; this.bio = 'samadhi'; this.onend = null; this.sat = 0; this.satAt = null; this.lastSat = 0; }

  /**
   * Số giây đã thực sự phát của thời đang chạy (#107, hợp đồng mở Tầng 1 §1): đếm theo đồng hồ AudioContext lúc đang phát,
   * nên kéo thanh thời gian (tua tới) không cộng thêm. `lastSat` giữ giá trị của thời vừa viên mãn cho onend.
   */
  get practiced() { return this.sat + (this.satAt !== null && this.ctx ? Math.max(0, this.ctx.currentTime - this.satAt) : 0); }
  _satStop() { if (this.satAt !== null && this.ctx) this.sat += Math.max(0, this.ctx.currentTime - this.satAt); this.satAt = null; }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'playback' });
    this.eng = new Engine(this.ctx);
    this.eng.vol.gain.value = this.volume;
    this.eng.binGain.gain.value = this.bin ? 0.03 : 0;
    setInterval(() => { if (this.playing && this.time >= DUR - 0.02) this._end(); }, 200);
  }

  get time() {
    if (!this.ctx || !this.scheduled || this._seeking) return this.T0;
    return Math.max(0, Math.min(DUR, this.T0 + Math.max(0, this.ctx.currentTime - this.C0)));
  }

  _ramp(to, dur, at) {
    const p = this.eng.master.gain, t = at === undefined ? this.ctx.currentTime : at;
    p.cancelScheduledValues(t); p.setValueAtTime(at === undefined ? p.value : 0, t); p.linearRampToValueAtTime(to, t + dur);
  }

  async play() {
    this.ensure();
    const c = this.ctx;
    await c.resume();
    if (this.time >= DUR - 0.05) { this.T0 = 0; this.scheduled = false; this.sat = 0; }
    if (!this.scheduled) {
      const when = c.currentTime + 0.08;
      this.eng.schedule(this.T0, when); this.C0 = when; this.scheduled = true;
      this._ramp(1, 0.4, when);
    } else this._ramp(1, 0.3);
    this.playing = true; this._satStop(); this.satAt = c.currentTime;
    if (this.bio !== 'samadhi') this.eng.setBio(this.bio);
  }

  pause() {
    if (!this.ctx || !this.playing) return;
    this.playing = false; this._satStop();
    if (this._seeking) { clearTimeout(this._st); this._seeking = false; this.scheduled = false; }
    this._ramp(0, 0.12);
    setTimeout(() => { if (!this.playing) this.ctx.suspend(); }, 200);
  }

  seek(T) {
    T = Math.max(0, Math.min(DUR - 0.1, T));
    if (!this.ctx) { this.T0 = T; return; }
    const c = this.ctx;
    if (this.playing) {
      this._ramp(0, 0.06);
      this.T0 = T; this._seeking = true;
      clearTimeout(this._st);
      this._st = setTimeout(() => {
        this._seeking = false;
        if (!this.playing) { this.scheduled = false; return; }
        const when = c.currentTime + 0.05;
        this.eng.schedule(T, when); this.T0 = T; this.C0 = when; this.scheduled = true;
        this._ramp(1, 0.35, when);
      }, 95);
    } else {
      const when = c.currentTime + 0.05;
      this.eng.schedule(T, when); this.T0 = T; this.C0 = when; this.scheduled = true;
      this.eng.master.gain.cancelScheduledValues(0); this.eng.master.gain.setValueAtTime(0, c.currentTime);
    }
  }

  _end() {
    this.playing = false; this.T0 = DUR; this.scheduled = false; this._satStop(); this.lastSat = this.sat; this.sat = 0;
    this._ramp(0, 0.1);
    setTimeout(() => { if (!this.playing) this.ctx.suspend(); }, 200);
    if (this.onend) this.onend();
  }

  setVolume(v) { this.volume = v; if (this.eng) this.eng.vol.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  setBinaural(on) { this.bin = on; if (this.eng) this.eng.binGain.gain.setTargetAtTime(on ? 0.03 : 0, this.ctx.currentTime, 0.2); }
  setBio(mode) { this.bio = BIO.mode = mode; BIO.at = performance.now(); if (this.eng && this.playing) this.eng.setBio(mode); }
  scope(arr) { if (this.eng) this.eng.analyser.getFloatTimeDomainData(arr); return !!this.eng; }
}

// Kiểm tra ngoại tuyến: render một đoạn rồi đo đỉnh, RMS và gián đoạn (tiếng tạch).
export async function offlineProbe(fromT, secs, sr = 44100) {
  const o = new OfflineAudioContext(2, Math.floor(secs * sr), sr);
  const e = new Engine(o);
  e.master.gain.setValueAtTime(0, 0); e.master.gain.linearRampToValueAtTime(1, 0.3);
  e.schedule(fromT, 0);
  const buf = await o.startRendering();
  const out = { fromT, secs, peak: 0, maxD2: 0, clicks: 0, rms: [] };
  for (let chn = 0; chn < 2; chn++) {
    const x = buf.getChannelData(chn);
    for (let i = 1; i < x.length - 1; i++) {
      const a = Math.abs(x[i]); if (a > out.peak) out.peak = a;
      const d2 = Math.abs(x[i + 1] - 2 * x[i] + x[i - 1]);
      if (d2 > out.maxD2) out.maxD2 = d2;
      if (d2 > 0.03) out.clicks++;
    }
  }
  const L = buf.getChannelData(0), R = buf.getChannelData(1), blk = sr * 10;
  for (let b = 0; b + blk <= L.length; b += blk) {
    let s = 0; for (let i = b; i < b + blk; i++) s += L[i] * L[i] + R[i] * R[i];
    out.rms.push(+(10 * Math.log10(s / (2 * blk) + 1e-12)).toFixed(1));
  }
  out.peak = +out.peak.toFixed(4); out.maxD2 = +out.maxD2.toFixed(5);
  return out;
}

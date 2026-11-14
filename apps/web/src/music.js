// Vân Nhạc — nhạc nền tĩnh tâm cho toàn bộ Vân Đảo.
// Cùng hệ âm với thời thiền (PAD_FREQS, gốc 136,1 Hz), sinh trực tiếp bằng Web Audio nên phát mãi không lặp lại y nguyên.
// Quy tắc chung với audio.js: bộ dao động nền chạy liên tục; mọi nốt có đường bao về đúng 0; đổi khúc bằng hòa tan, không cắt.
import { PAD_FREQS } from './data.js';

const R0 = PAD_FREQS[1];                       // 136,1 Hz
const PENTA = [0, 2, 4, 7, 9], MINOR = [0, 3, 5, 7, 10];

export const SONGS = [
  { id: 'van-thuy', group: 'inst', gain: 2.0, name: 'Vân Thủy', sub: 'Mây nước', desc: 'Tiếng đàn tranh thưa trôi đều trên nền mây', root: R0 * 2, scale: PENTA, beat: 1.25,
    pad: { level: 0.05, chords: [[0, 2, 4], [1, 3, 5], [0, 3, 4], [-1, 2, 4]], every: 20 },
    parts: [{ type: 'pluck', lo: 2, hi: 11, level: 0.15, rest: 0.3, decay: 1.5 }, { type: 'bowl', deg: [0, 4], oct: -1, gap: [22, 34], level: 0.11 }] },
  { id: 'som-mai', group: 'inst', gain: 2.6, name: 'Sớm Mai', sub: 'Ban mai', desc: 'Sáo trúc trong và chuông gió nhẹ, tươi tỉnh', root: PAD_FREQS[3] * 2, scale: PENTA, beat: 1.1,
    pad: { level: 0.042, chords: [[0, 2, 4], [0, 3, 5], [1, 2, 4]], every: 24 },
    parts: [{ type: 'flute', lo: 3, hi: 11, level: 0.085, gap: [5, 10] }, { type: 'chime', lo: 10, hi: 17, level: 0.035, gap: [3, 8] }, { type: 'pluck', lo: 0, hi: 6, level: 0.07, rest: 0.6, decay: 1.8, slow: 2 }] },
  { id: 'tra-chieu', group: 'inst', gain: 1.75, name: 'Trà Chiều', sub: 'Xế trưa', desc: 'Tiếng đàn trầm, chậm rãi như rót trà', root: R0, scale: PENTA, beat: 1.7,
    pad: { level: 0.06, chords: [[0, 2, 4], [0, 3, 4], [1, 3, 5]], every: 26 },
    parts: [{ type: 'pluck', lo: 4, hi: 12, level: 0.17, rest: 0.42, decay: 2.2, warm: 1 }, { type: 'chime', lo: 14, hi: 19, level: 0.02, gap: [9, 18] }] },
  { id: 'hoang-hon', group: 'inst', gain: 1.7, name: 'Hoàng Hôn', sub: 'Chiều tà', desc: 'Sáo trầm ngân dài, lắng dần cùng nắng', root: PAD_FREQS[2], scale: MINOR, beat: 1.8,
    pad: { level: 0.06, chords: [[0, 2, 4], [0, 1, 3], [-1, 2, 4]], every: 28 },
    parts: [{ type: 'flute', lo: 4, hi: 11, level: 0.085, gap: [6, 12], long: 1.5 }, { type: 'bowl', deg: [0], oct: 0, gap: [26, 40], level: 0.1 }], wind: 0.012 },
  { id: 'dem-tinh', group: 'bell', gain: 1.45, name: 'Đêm Tịnh', sub: 'Đêm sâu', desc: 'Nền trầm rất thưa, tiếng chuông bát ngân xa', root: PAD_FREQS[0], scale: PENTA, beat: 2.4,
    pad: { level: 0.075, chords: [[0, 4, 5], [0, 3, 5], [0, 4, 7]], every: 34 },
    parts: [{ type: 'bowl', deg: [5, 7, 9], oct: 0, gap: [13, 22], level: 0.12 }, { type: 'pluck', lo: 10, hi: 17, level: 0.045, rest: 0.72, decay: 2.6, slow: 2 }], wind: 0.016 },
  { id: 'phong-linh', group: 'nature', gain: 2.3, name: 'Phong Linh', sub: 'Chuông gió', desc: 'Gió nhẹ qua hiên và chuông gió lanh canh', root: PAD_FREQS[4], scale: PENTA, beat: 0.9,
    pad: { level: 0.034, chords: [[0, 2, 4], [0, 2, 5]], every: 30 },
    parts: [{ type: 'chime', lo: 9, hi: 16, level: 0.06, gap: [0.5, 5], burst: 1 }, { type: 'bowl', deg: [0, 2], oct: 0, gap: [28, 44], level: 0.08 }], wind: 0.034 },
  { id: 'tu-tam', group: 'inst', gain: 1.45, name: 'Từ Tâm', sub: 'Tâm từ', desc: 'Hòa âm ấm dâng lên rồi lắng xuống như hơi thở', root: PAD_FREQS[5] / 2, scale: PENTA, beat: 1.6,
    pad: { level: 0.085, chords: [[0, 2, 4, 7], [1, 3, 5, 7], [0, 3, 4, 8], [0, 2, 5, 7]], every: 16, swell: 1 },
    parts: [{ type: 'pluck', lo: 7, hi: 15, level: 0.08, rest: 0.5, decay: 2.4, slow: 2 }, { type: 'flute', lo: 5, hi: 10, level: 0.05, gap: [12, 22], long: 1.6 }] },
  // ── Thiên nhiên: nền là tiếng ồn lọc (mưa, suối, sóng), nhạc cụ chỉ điểm rất thưa ──
  { id: 'mua-hien', group: 'nature', gain: 0.95, name: 'Mưa Hiên', sub: 'Mưa rơi', desc: 'Mưa đều ngoài hiên, giọt gianh thưa, chuông bát xa', root: R0, scale: PENTA, beat: 2,
    pad: { level: 0.03, chords: [[0, 2, 4], [0, 3, 4]], every: 40 },
    air: [{ f: 3400, q: 0.45, lv: 1.5, mg: [0.05, 0.22] }, { f: 800, q: 0.6, lv: 0.3, mg: [0.083, 0.4] }],
    parts: [{ type: 'drop', lo: 14, hi: 24, level: 0.05, gap: [0.3, 2.6] }, { type: 'bowl', deg: [0, 2], oct: 0, gap: [40, 70], level: 0.07 }] },
  { id: 'suoi-nguon', group: 'nature', gain: 1.6, name: 'Suối Nguồn', sub: 'Suối chảy', desc: 'Suối róc rách qua đá, sáo trúc thưa vọng lại', root: PAD_FREQS[3], scale: PENTA, beat: 1.8,
    pad: { level: 0.03, chords: [[0, 2, 4], [1, 3, 5]], every: 36 },
    air: [{ f: 1500, q: 0.9, lv: 0.75, mf: [0.37, 520], mg: [0.53, 0.35] }, { f: 2900, q: 1.2, lv: 0.6, mf: [0.71, 900], mg: [0.9, 0.5] }],
    parts: [{ type: 'drop', lo: 8, hi: 18, level: 0.04, gap: [0.15, 1.3], burst: 1 }, { type: 'flute', lo: 4, hi: 9, level: 0.05, gap: [18, 34], long: 1.6 }] },
  { id: 'song-bien', group: 'nature', gain: 0.62, name: 'Sóng Biển', sub: 'Sóng vỗ', desc: 'Sóng dâng rồi rút chậm như một hơi thở dài', root: PAD_FREQS[0], scale: PENTA, beat: 2.4,
    pad: { level: 0.05, chords: [[0, 4, 7], [0, 3, 7]], every: 44, swell: 1 },
    air: [{ type: 'lowpass', f: 560, q: 0.4, lv: 1.1, mf: [0.085, 300], mg: [0.085, 0.9] }, { f: 2500, q: 0.5, lv: 0.7, mg: [0.085, 0.95] }],
    parts: [{ type: 'bowl', deg: [0, 4], oct: 0, gap: [50, 80], level: 0.07 }] },
  // ── Chuông và âm trầm ──
  { id: 'chuong-bat', group: 'bell', gain: 4, name: 'Chuông Bát', sub: 'Chuông xoay', desc: 'Chỉ có chuông bát, ngân dài và chồng lên nhau', root: R0, scale: PENTA, beat: 2,
    pad: { level: 0.02, chords: [[0, 4]], every: 60 },
    parts: [{ type: 'bowl', deg: [0, 2, 4], oct: 0, gap: [9, 16], level: 0.13 }, { type: 'bowl', deg: [5, 7, 9], oct: 0, gap: [14, 26], level: 0.09 }, { type: 'bowl', deg: [0], oct: -1, gap: [34, 50], level: 0.12 }] },
  { id: 'tram-an', group: 'bell', gain: 0.87, name: 'Trầm An', sub: 'Âm trầm', desc: 'Một nền âm trầm gần như bất động, cho những thời ngồi lâu', root: PAD_FREQS[0] * 2, scale: PENTA, beat: 3,
    pad: { level: 0.11, chords: [[0, 4, 5], [0, 4, 7]], every: 90, swell: 1 },
    parts: [{ type: 'bowl', deg: [0], oct: -1, gap: [70, 120], level: 0.08 }] },
  { id: 'chuong-mo', group: 'bell', gain: 2.5, name: 'Chuông Mõ', sub: 'Công phu', desc: 'Nhịp mõ chậm đều và tiếng đại hồng chung, như một thời công phu', root: R0, scale: PENTA, beat: 1.5,
    pad: { level: 0.035, chords: [[0, 4, 5]], every: 60 },
    parts: [{ type: 'pulse', every: 1.5, f: 640, level: 0.085 }, { type: 'bowl', as: 'bell', deg: [0], oct: -1, gap: [36, 60], level: 0.15 }] },
];
export const SONG = Object.fromEntries(SONGS.map((s) => [s.id, s]));
export const GROUPS = [['all', 'Tất cả'], ['inst', 'Nhạc cụ'], ['nature', 'Thiên nhiên'], ['bell', 'Chuông, trầm']];
export const songsOf = (group) => (group && group !== 'all' ? SONGS.filter((x) => x.group === group) : SONGS);

export const MOODS = [
  { id: 'an', label: 'An vui', song: 'van-thuy' }, { id: 'met', label: 'Mỏi mệt', song: 'som-mai' }, { id: 'xao', label: 'Xao động', song: 'dem-tinh' },
  { id: 'nang', label: 'Nặng lòng', song: 'tu-tam' }, { id: 'ngu', label: 'Buồn ngủ', song: 'phong-linh' }, { id: 'tap', label: 'Cần tập trung', song: 'tra-chieu' },
];
// 7 tuần của chuỗi 49 ngày → khúc hợp chủ đề tuần
const WEEK_SONG = ['van-thuy', 'som-mai', 'tra-chieu', 'tu-tam', 'tu-tam', 'dem-tinh', 'hoang-hon'];
export function songByHour(h) { return h >= 4 && h < 8 ? 'som-mai' : h < 11 && h >= 8 ? 'van-thuy' : h >= 11 && h < 14 ? 'phong-linh' : h >= 14 && h < 17 ? 'tra-chieu' : h >= 17 && h < 19 ? 'hoang-hon' : h >= 19 && h < 22 ? 'tu-tam' : 'dem-tinh'; }
export function songByDay(day) { return WEEK_SONG[Math.max(0, Math.min(6, Math.floor((day - 1) / 7)))]; }
export function pickSong(cfg, day, hour) {
  if (cfg.source === 'time') return songByHour(hour);
  if (cfg.source === 'plan') return songByDay(day);
  if (cfg.source === 'mood') return (MOODS.find((m) => m.id === cfg.mood) || MOODS[0]).song;
  return SONG[cfg.song] ? cfg.song : 'van-thuy';
}

// giữ nguyên giá trị đang chạy của tham số tại thời điểm t rồi mới xếp đoạn dốc mới (tránh bước nhảy)
const hold = (g, t) => { if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); } };
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const CURVES = {};
// Đường bao chuẩn hóa: vào kiểu cos nâng, tắt dần theo hàm mũ, cửa sổ đuôi ép về đúng 0
function decayCurve(att, k) {
  const key = att + '|' + k; if (CURVES[key]) return CURVES[key];
  const N = 384, c = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = i / (N - 1); const a = x < att ? 0.5 - 0.5 * Math.cos(Math.PI * x / att) : 1; const d = Math.exp(-k * Math.max(0, x - att)); const w = x > 0.8 ? 0.5 + 0.5 * Math.cos(Math.PI * (x - 0.8) / 0.2) : 1; c[i] = a * d * w; }
  c[0] = 0; c[N - 1] = 0; return (CURVES[key] = c);
}
function swellCurve(aFrac, rFrac) {
  const key = 's' + aFrac.toFixed(2) + '|' + rFrac.toFixed(2); if (CURVES[key]) return CURVES[key];
  const N = 256, c = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = i / (N - 1); c[i] = x < aFrac ? 0.5 - 0.5 * Math.cos(Math.PI * x / aFrac) : x > 1 - rFrac ? 0.5 + 0.5 * Math.cos(Math.PI * (x - 1 + rFrac) / rFrac) : 1; }
  c[0] = 0; c[N - 1] = 0; return (CURVES[key] = c);
}
function impulse(ctx, secs, seed) {
  const sr = ctx.sampleRate, n = Math.floor(sr * secs), b = ctx.createBuffer(2, n, sr), r = rngOf(seed);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const t = i / n, w = (r() * 2 - 1) * Math.pow(1 - t, 2.4) * Math.min(1, i / (sr * 0.012)); lp += (w - lp) * (0.55 - 0.4 * t); d[i] = lp; } }
  return b;
}
function noiseBuf(ctx, seed) {
  const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = rngOf(seed); let lp = 0;
  for (let i = 0; i < n; i++) { lp += ((r() * 2 - 1) - lp) * 0.12; d[i] = lp; }
  const f = Math.floor(ctx.sampleRate * 0.25); for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[n - f + i] * (1 - k); }   // nối vòng êm
  return b;
}

// Bus chung: khô + vang
export function makeBus(ctx, seed = 7) {
  const master = ctx.createGain(); master.gain.value = 0;
  const dry = ctx.createGain(), send = ctx.createGain(), conv = ctx.createConvolver(), wet = ctx.createGain(), tone = ctx.createBiquadFilter();
  conv.buffer = impulse(ctx, 3.6, seed); wet.gain.value = 0.9; send.gain.value = 0.55; tone.type = 'lowpass'; tone.frequency.value = 6500;
  dry.connect(tone); send.connect(conv); conv.connect(wet); wet.connect(tone); tone.connect(master); master.connect(ctx.destination);
  return { ctx, master, dry, send, noise: noiseBuf(ctx, seed + 3) };
}

// Một khúc đang phát. scheduleUntil(t) xếp nốt tới thời điểm t (giây của ctx).
export class Voice {
  constructor(bus, song, seed = 1) {
    const ctx = bus.ctx; this.bus = bus; this.ctx = ctx; this.song = song; this.r = rngOf(seed * 7919 + 13); this.nodes = [];
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(bus.dry); this.out.connect(bus.send);
    this.t0 = 0; this.parts = []; this.live = true; this.len = 0;   // len (giây): khúc có thời lượng thì thưa dần về giữa rồi dày lại
  }
  f(deg) { const sc = this.song.scale, n = sc.length, o = Math.floor(deg / n), i = ((deg % n) + n) % n; return this.song.root * Math.pow(2, (sc[i] + 12 * o) / 12); }
  start(at, fade) {
    const ctx = this.ctx, s = this.song, g = this.out.gain; this.t0 = at;
    g.setValueAtTime(0, at); g.linearRampToValueAtTime(s.gain || 1, at + fade);
    // nền: mỗi nốt của mọi hợp âm có sẵn một cặp dao động; đổi hợp âm = đổi âm lượng từng nốt
    const degs = [...new Set(s.pad.chords.flat())]; this.pad = {};
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.3; lp.connect(this.out); this.nodes.push(lp);
    degs.forEach((d, i) => {
      const fq = this.f(d - s.scale.length), ng = ctx.createGain(); ng.gain.value = 0; ng.connect(lp);
      [['sine', -3, 1], ['triangle', 4, 0.35], ['sine', 1200, 0.16]].forEach(([type, cents, lv]) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; o.frequency.value = fq; o.detune.value = cents; og.gain.value = lv; o.connect(og); og.connect(ng); o.start(at); this.nodes.push(o); });
      const lfo = ctx.createOscillator(), lg = ctx.createGain(), trem = ctx.createGain(); lfo.frequency.value = 0.045 + 0.02 * ((i * 37) % 5) / 5; lg.gain.value = s.pad.swell ? 0.45 : 0.25; trem.gain.value = 1;
      ng.disconnect(); ng.connect(trem); trem.connect(lp); lfo.connect(lg); lg.connect(trem.gain); lfo.start(at); this.nodes.push(lfo);
      this.pad[d] = ng;
    });
    this.chordAt = at; this.chordI = 0; this._chord(at, 3);
    if (s.wind) { const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), wg = ctx.createGain(), l1 = ctx.createOscillator(), l1g = ctx.createGain(), l2 = ctx.createOscillator(), l2g = ctx.createGain();
      src.buffer = this.bus.noise; src.loop = true; bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.7; wg.gain.value = s.wind * 6;
      l1.frequency.value = 0.07; l1g.gain.value = 260; l1.connect(l1g); l1g.connect(bp.frequency); l2.frequency.value = 0.11; l2g.gain.value = s.wind * 3.2; l2.connect(l2g); l2g.connect(wg.gain);
      src.connect(bp); bp.connect(wg); wg.connect(this.out); src.start(at); l1.start(at); l2.start(at); this.nodes.push(src, l1, l2); }
    // Mưa, suối, sóng: các lớp tiếng ồn lọc; mf = [tần số LFO, độ lệch Hz] rung tần số lọc, mg = [tần số LFO, tỉ lệ 0..1] rung âm lượng (không bao giờ về âm)
    (s.air || []).forEach((a, i) => { const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain(); src.buffer = this.bus.noise; src.loop = true; fl.type = a.type || 'bandpass'; fl.frequency.value = a.f; fl.Q.value = a.q; g.gain.value = a.lv;
      [[a.mf, fl.frequency, 1], [a.mg, g.gain, a.lv]].forEach(([m, prm, k]) => { if (!m) return; const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = m[0]; lg.gain.value = m[1] * k; l.connect(lg); lg.connect(prm); l.start(at); this.nodes.push(l); });
      src.connect(fl); fl.connect(g); g.connect(this.out); src.start(at, i * 1.37); this.nodes.push(src); });
    this.parts = s.parts.map((p, i) => ({ p, next: at + 2.5 + i * 1.7 + this.r() * 2, deg: Math.round((p.lo + p.hi) / 2) || 0 }));
  }
  _chord(t, tc) { const s = this.song, ch = s.pad.chords[this.chordI % s.pad.chords.length], lv = s.pad.level / Math.sqrt(ch.length / 3);
    Object.entries(this.pad).forEach(([d, ng]) => ng.gain.setTargetAtTime(ch.includes(+d) ? lv : 0, t, tc)); this.chord = ch; }
  scheduleUntil(T) {
    if (!this.live) return; const s = this.song, r = this.r;
    while (this.chordAt + s.pad.every < T) { this.chordAt += s.pad.every; this.chordI++; this._chord(this.chordAt, 2.4); }
    for (const P of this.parts) { const p = P.p; let guard = 0;
      while (P.next < T && guard++ < 400) { const t = P.next; if (t < this.ctx.currentTime + 0.03) { P.next = this.ctx.currentTime + 0.25 + r(); continue; }
        // khúc có thời lượng: khoảng lặng dài dần tới giữa khúc (×1,7) rồi ngắn lại, để thời ngồi lắng xuống rồi trở về
        const thin = this.len ? 1 + 0.7 * Math.sin(Math.PI * Math.min(1, (t - this.t0) / this.len)) ** 2 : 1;
        if (p.type === 'pluck') { const step = s.beat * (p.slow || 1) * [1, 1, 1, 2, 0.5, 1.5][Math.floor(r() * 6)];
          if (r() > 1 - (1 - p.rest) / thin) { P.deg = this._walk(P.deg, p); this.pluck(t, this.f(P.deg), p.level * (0.6 + r() * 0.4), (r() - 0.5) * 1.3, p);
            if (r() < 0.16) this.pluck(t + s.beat * 0.5, this.f(P.deg + (r() < 0.5 ? 2 : 4)), p.level * 0.45, (r() - 0.5) * 1.3, p); }
          P.next = t + step;
        } else if (p.type === 'bowl') { const d = p.deg[Math.floor(r() * p.deg.length)] + (p.oct || 0) * s.scale.length; this[p.as || 'bowl'](t, this.f(d), p.level * (0.75 + r() * 0.25), (r() - 0.5) * 0.8); P.next = t + (p.gap[0] + r() * (p.gap[1] - p.gap[0])) * thin;
        } else if (p.type === 'chime' || p.type === 'drop') { const n = p.burst ? 1 + Math.floor(r() * 4) : 1; let tt = t; for (let i = 0; i < n; i++) { P.deg = this._walk(P.deg, p, 3); this[p.type](tt, this.f(P.deg), p.level * (0.5 + r() * 0.5), (r() - 0.5) * 1.6); tt += 0.12 + r() * 0.5; } P.next = tt + (p.gap[0] + r() * (p.gap[1] - p.gap[0])) * thin;
        } else if (p.type === 'pulse') { this.mo(t, p.f * (0.985 + r() * 0.03), p.level * (0.8 + r() * 0.2), 0.15); P.next = t + p.every * (0.99 + r() * 0.02);   // nhịp mõ giữ đều, không thưa dần
        } else if (p.type === 'flute') { const n = 2 + Math.floor(r() * 4); let tt = t; for (let i = 0; i < n; i++) { P.deg = this._walk(P.deg, p, 2); const d = s.beat * (p.long || 1) * (i === n - 1 ? 2.6 : [1, 1.5, 2][Math.floor(r() * 3)]); this.flute(tt, this.f(P.deg), d * 1.08, p.level * (0.8 + r() * 0.2), (r() - 0.5) * 0.5); tt += d; } P.next = tt + (p.gap[0] + r() * (p.gap[1] - p.gap[0])) * thin; }
      } }
  }
  _walk(deg, p, span = 2) { const r = this.r; let d = deg + Math.round((r() * 2 - 1) * span) + (r() < 0.12 ? (r() < 0.5 ? -3 : 3) : 0); if (d === deg) d += r() < 0.5 ? -1 : 1; if (d < p.lo) d = p.lo + (p.lo - d); if (d > p.hi) d = p.hi - (d - p.hi); return Math.max(p.lo, Math.min(p.hi, d)); }
  _env(t, dur, curve, level, pan) { const ctx = this.ctx, e = ctx.createGain(), v = ctx.createGain(); e.gain.value = 0; e.gain.setValueCurveAtTime(curve, t, dur); v.gain.value = level; e.connect(v);
    if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = Math.max(-1, Math.min(1, pan)); v.connect(pn); pn.connect(this.out); } else v.connect(this.out); return e; }
  _osc(type, fq, t, end, dest, gain = 1) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = fq; if (gain === 1) o.connect(dest); else { const g = this.ctx.createGain(); g.gain.value = gain; o.connect(g); g.connect(dest); } o.start(t); o.stop(end + 0.05); return o; }
  pluck(t, fq, level, pan, p) { const dur = (p.decay || 1.5) * 2.6, e = this._env(t, dur, decayCurve(0.004, 7.5), level, pan), lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
    const top = p.warm ? 1500 : 2600; lp.frequency.setValueAtTime(Math.min(9000, fq * 5 + top), t); lp.frequency.exponentialRampToValueAtTime(Math.max(300, fq * 1.6), t + dur * 0.5); lp.connect(e);
    const o = this._osc('triangle', fq, t, t + dur, lp); o.frequency.setValueAtTime(fq * 1.011, t); o.frequency.exponentialRampToValueAtTime(fq, t + 0.09); this._osc('sine', fq * 2, t, t + dur, lp, 0.28); if (!p.warm) this._osc('sine', fq * 3.01, t, t + dur, lp, 0.08); }
  bowl(t, fq, level, pan) { const dur = 11, e = this._env(t, dur, decayCurve(0.006, 5.2), level, pan);
    this._osc('sine', fq, t, t + dur, e, 0.6); this._osc('sine', fq + 0.7, t, t + dur, e, 0.4); this._osc('sine', fq * 2.71, t, t + dur, e, 0.2); this._osc('sine', fq * 5.18, t, t + dur, e, 0.05); }
  // giọt nước: tiếng sin rất ngắn, cao độ vọt lên rồi tắt
  drop(t, fq, level, pan) { const dur = 0.24, e = this._env(t, dur, decayCurve(0.03, 7), level, pan), o = this._osc('sine', fq, t, t + dur, e); o.frequency.setValueAtTime(fq, t); o.frequency.exponentialRampToValueAtTime(fq * 1.7, t + 0.08); }
  // đại hồng chung: âm nền thấp một quãng tám, quãng ba thứ và các bồi âm không điều hòa, ngân 20 giây
  bell(t, fq, level, pan) { const dur = 20, e = this._env(t, dur, decayCurve(0.004, 4.2), level, pan); [[0.5, 0.25], [1, 0.5], [2, 0.3], [2.4, 0.2], [3, 0.12], [4.5, 0.06]].forEach(([m, g], i) => this._osc('sine', fq * m + i * 0.31, t, t + dur, e, g)); }
  // mõ: tiếng gõ gỗ ngắn qua bộ lọc thông dải
  mo(t, fq, level, pan) { const dur = 0.18, e = this._env(t, dur, decayCurve(0.02, 9), level, pan), bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fq; bp.Q.value = 5; bp.connect(e); this._osc('triangle', fq, t, t + dur, bp); this._osc('sine', fq * 2.42, t, t + dur, bp, 0.3); }
  chime(t, fq, level, pan) { const dur = 3.4, e = this._env(t, dur, decayCurve(0.003, 8), level, pan); this._osc('sine', fq, t, t + dur, e, 0.8); this._osc('sine', fq * 2.76, t, t + dur, e, 0.16); }
  flute(t, fq, dur, level, pan) { const ctx = this.ctx, a = Math.min(0.4, 0.22 / dur), e = this._env(t, dur, swellCurve(a, Math.min(0.45, 0.4 / dur)), level, pan);
    const o = this._osc('sine', fq, t, t + dur, e, 0.82), o2 = this._osc('sine', fq * 2, t, t + dur, e, 0.15), o3 = this._osc('sine', fq * 3, t, t + dur, e, 0.045);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 4.7; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(fq * 0.0045, t + Math.min(dur, 0.9)); lfo.connect(lg); lg.connect(o.frequency); void o2; void o3; lfo.start(t); lfo.stop(t + dur + 0.05); }
  stop(at, fade) { this.live = false; const g = this.out.gain; hold(g, at); g.linearRampToValueAtTime(0, at + fade);
    const end = at + fade + 12; this.nodes.forEach((n) => { if (n.stop) { try { n.stop(end); } catch (e) { /* đã dừng */ } } });
    if (this.ctx.constructor.name !== 'OfflineAudioContext') setTimeout(() => { try { this.out.disconnect(); } catch (e) { /* bỏ qua */ } }, (fade + 13) * 1000); }
}

// Trình phát nhạc nền: bật/tắt, đổi khúc hòa tan, phát liên tục / lần lượt / ngẫu nhiên, nhường thời thiền
export class Ambient {
  constructor() { this.ctx = null; this.bus = null; this.voice = null; this.on = false; this.ducked = false; this.volume = 0.6; this.cur = null; this.since = 0; this.onchange = null; this._timer = null; }
  ensure() { if (this.ctx) return; const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC({ latencyHint: 'playback' }); this.bus = makeBus(this.ctx, 7);
    this._timer = setInterval(() => { if (this.voice && this.on && !this.ducked) this.voice.scheduleUntil(this.ctx.currentTime + 2.5); }, 400); }
  _level(v, dur) { const g = this.bus.master.gain, t = this.ctx.currentTime; hold(g, t); g.linearRampToValueAtTime(v, t + dur); }
  // opt.len: thời lượng khúc (phút, 0 = không giới hạn); opt.again: phát lại từ đầu dù đang là khúc này
  async play(id, opt = {}) { this.ensure(); await this.ctx.resume(); clearTimeout(this._sus);
    const t = this.ctx.currentTime + 0.1, same = this.voice && this.cur === id && this.voice.live && !opt.again;
    if (!same) { if (this.voice) this.voice.stop(t, 5); this.voice = new Voice(this.bus, SONG[id], Math.floor(Math.random() * 1e6) + 1); this.voice.len = (opt.len || 0) * 60; this.voice.start(t, this.on ? 5 : 0.5); this.voice.scheduleUntil(t + 2.5); this.cur = id; this.since = performance.now(); }
    else if (opt.len !== undefined) this.voice.len = opt.len * 60;
    this.on = true; if (!this.ducked) this._level(this.volume, 3); if (this.onchange) this.onchange(id); }
  stop() { if (!this.ctx || !this.on) return; this.on = false; this._level(0, 1.6); this._sus = setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 2000); if (this.onchange) this.onchange(null); }
  // Kết một khúc "phát 1 lần": ba tiếng chuông bát cách nhau 4,5 giây, nền lắng dần trong 10 giây rồi im
  end() { if (!this.ctx || !this.on || !this.voice) return this.stop(); const v = this.voice, t = this.ctx.currentTime + 0.3, f = v.f(0) > 250 ? v.f(0) / 2 : v.f(0);
    [0, 4.5, 9].forEach((d) => v.bowl(t + d, f, 0.16, 0)); v.stop(t + 10, 10); this.on = false; clearTimeout(this._sus); this._sus = setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 23000); if (this.onchange) this.onchange(null); }
  // nhường thời thiền: hạ dần rồi tạm ngưng; hết thời thiền thì dâng trở lại
  duck(yes) { if (this.ducked === yes) return; this.ducked = yes; if (!this.ctx || !this.on) return;
    if (yes) { this._level(0, 2.5); this._sus = setTimeout(() => { if (this.ducked) this.ctx.suspend(); }, 2800); }
    else { clearTimeout(this._sus); this.ctx.resume().then(() => { if (this.voice) this.voice.scheduleUntil(this.ctx.currentTime + 2.5); this._level(this.volume, 4); }); } }
  // tiếng chim: vài tiếng huýt ngắn quét tần số, đi thẳng ra loa (không phụ thuộc nhạc đang bật hay tắt)
  chirp(pan = 0, n = 3, seed = 1, vol = 0.6) { if (vol <= 0.001) return; try { this.ensure(); const ctx = this.ctx; if (ctx.state !== 'running') { ctx.resume(); if (!this.on) { clearTimeout(this._sus); this._sus = setTimeout(() => { if (!this.on) ctx.suspend(); }, 2600); } }
      if (!this.fx) { this.fx = ctx.createGain(); this.fx.connect(ctx.destination); } this.fx.gain.value = 0.085 * vol;
      let t = ctx.currentTime + 0.06; const base = 2600 + (Math.abs(Math.sin(seed)) * 1700), cv = swellCurve(0.3, 0.45);
      for (let i = 0; i < n; i++) { const d = 0.06 + Math.random() * 0.07, f0 = base * (0.9 + Math.random() * 0.4), f1 = f0 * (Math.random() < 0.5 ? 1.35 : 0.72), o = ctx.createOscillator(), e = ctx.createGain(); e.gain.value = 0; e.gain.setValueCurveAtTime(cv, t, d);
        o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d); o.connect(e); if (ctx.createStereoPanner) { const pn = ctx.createStereoPanner(); pn.pan.value = pan; e.connect(pn); pn.connect(this.fx); } else e.connect(this.fx); o.start(t); o.stop(t + d + 0.02); t += d + 0.05 + Math.random() * 0.09; } } catch (e) { /* chưa có tương tác: trình duyệt chưa cho phát */ } }
  setVolume(v) { this.volume = v; if (this.ctx && this.on && !this.ducked) this.bus.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.08); }
  get minutes() { return this.on ? (performance.now() - this.since) / 60000 : 0; }
  /** Số phút còn lại của khúc có thời lượng; null nếu phát liên tục */
  get left() { return this.on && this.voice && this.voice.len ? Math.max(0, this.voice.len / 60 - this.minutes) : null; }
}

// Đo ngoại tuyến một khúc: đỉnh, RMS, số gián đoạn (tiếng tạch)
export async function probeSong(id, secs = 60, sr = 44100) {
  const ctx = new OfflineAudioContext(2, sr * secs, sr), bus = makeBus(ctx, 7); bus.master.gain.value = 0.6;
  const v = new Voice(bus, SONG[id], 42); v.start(0.05, 0.5); v.scheduleUntil(secs - 6); v.out.gain.setValueAtTime(SONG[id].gain || 1, secs - 5); v.out.gain.linearRampToValueAtTime(0, secs - 1);   // tắt dần ở cuối (không gọi stop(): ngoại tuyến không đọc được giá trị tức thời)
  const buf = await ctx.startRendering(); let peak = 0, sum = 0, clicks = 0, maxd2 = 0;
  // tiếng tạch = bước nhảy cô lập: sai phân bậc hai vọt lên gấp nhiều lần mức trung bình ngay trước đó (âm cao liên tục không bị tính nhầm)
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let run = 0; for (let i = 2; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += d[i] * d[i]; const d2 = Math.abs(d[i] - 2 * d[i - 1] + d[i - 2]); if (d2 > maxd2) maxd2 = d2; if (d2 > 0.012 && d2 > 8 * run) clicks++; run += (d2 - run) / 64; } }
  const tail = buf.getChannelData(0).slice(-2000).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
  return { id, peak: +peak.toFixed(3), rms: +Math.sqrt(sum / (2 * buf.length)).toFixed(4), clicks, maxd2: +maxd2.toFixed(4), tail: +tail.toFixed(5) };
}

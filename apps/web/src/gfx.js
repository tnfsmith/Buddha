import * as THREE from 'three';

// ───────── GLSL dùng chung ─────────
export const NOISE = `
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*noise(p); p=p*2.03+17.; a*=.5; } return s; }`;
// Màu trong shader viết theo sRGB hiển thị; đổi sang tuyến tính rồi để three.js lo tone mapping và không gian màu.
export const OUT = `gl_FragColor = vec4(pow(max(col, 0.), vec3(2.2)), a);
#include <tonemapping_fragment>
#include <colorspace_fragment>`;

export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function makeNoise(seed = 1) {
  const h = (x, y, z) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 13.37) * 43758.5453; return n - Math.floor(n); };
  const sm = (t) => t * t * (3 - 2 * t), lerp = (a, b, t) => a + (b - a) * t;
  const n3 = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), u = sm(x - xi), v = sm(y - yi), w = sm(z - zi);
    return lerp(lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v), w);
  };
  const fbm = (x, y, z, o = 4) => { let a = 0.5, s = 0; for (let i = 0; i < o; i++) { s += a * n3(x, y, z); x = x * 2.03 + 11; y = y * 2.03 + 7; z = z * 2.03 + 3; a *= 0.5; } return s; };
  return { n3, fbm };
}

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Bốn dáng mây tích: đáy phẳng, đỉnh cuộn, mặt dưới ngả lam xám
export function puffAtlas() {
  // 4 ô mây 512²: thân mây là nhiều cụm nhỏ alpha thấp chồng lên nhau, rìa có tơ mây, mép tan dần về 0
  return canvasTex(1024, 1024, (g) => {
    const r = rng(11), C = 512;
    for (let c = 0; c < 4; c++) {
      const ox = (c % 2) * C, oy = Math.floor(c / 2) * C, mx = ox + C / 2;
      g.save(); g.beginPath(); g.rect(ox, oy, C, C); g.clip();
      const blob = (x, y, rad, a) => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(0.3, `rgba(255,255,255,${a * 0.66})`); gr.addColorStop(0.65, `rgba(255,255,255,${a * 0.2})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(ox, oy, C, C); };
      const lobes = 5 + c;
      for (let l = 0; l < lobes; l++) {
        const dx = (r() - 0.5) * 220, lx = mx + dx, ly = oy + 322 - r() * 96 - (1 - Math.abs(dx) / 110) * 44, lr = 42 + r() * 40;
        for (let i = 0; i < 30; i++) { const a = r() * 6.28, d = Math.pow(r(), 0.7) * lr; blob(lx + Math.cos(a) * d, ly + Math.sin(a) * d * 0.72, 22 + r() * 34, 0.17); }
      }
      for (let i = 0; i < 90; i++) { const a = r() * 6.28, d = 100 + r() * 78; blob(mx + Math.cos(a) * d * 1.1, oy + 296 + Math.sin(a) * d * 0.52, 14 + r() * 26, 0.05); }
      g.globalCompositeOperation = 'source-atop';
      const sh = g.createLinearGradient(0, oy + 200, 0, oy + 430); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(150,158,196,0.5)');
      g.fillStyle = sh; g.fillRect(ox, oy, C, C);
      g.globalCompositeOperation = 'destination-in';
      const mk = g.createRadialGradient(mx, oy + 280, 120, mx, oy + 280, 252); mk.addColorStop(0, 'rgba(0,0,0,1)'); mk.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = mk; g.fillRect(ox, oy, C, C);
      g.globalCompositeOperation = 'destination-out';
      const cut = g.createLinearGradient(0, oy + 340, 0, oy + 452); cut.addColorStop(0, 'rgba(0,0,0,0)'); cut.addColorStop(1, 'rgba(0,0,0,1)');
      g.fillStyle = cut; g.fillRect(ox, oy, C, C);
      g.restore(); g.globalCompositeOperation = 'source-over';
    }
  });
}

// Tôn tượng: tranh vẽ nhiều lớp, đặt rất xa nên chỉ cần khối sáng và nét chính
// st: { open: mắt mở nhìn xuống, mouth: 0..1 độ mở miệng, hand: tay phải giơ ấn thuyết pháp }
export function buddhaTex(st = {}) {
  return canvasTex(1024, 1280, (g) => {
    const cx = 512, E = (x, y, rx, ry, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); };
    const body = g.createLinearGradient(0, 200, 0, 1240); body.addColorStop(0, '#fff6dc'); body.addColorStop(0.45, '#f4d9a0'); body.addColorStop(1, '#dcb06a');
    g.fillStyle = body; g.shadowColor = 'rgba(150,98,30,0.85)'; g.shadowBlur = 7;
    // đài sen hai lớp cánh
    for (let row = 0; row < 2; row++) for (let i = -5; i <= 5; i++) {
      const x = cx + i * (82 - row * 6) + (row ? 40 : 0), y = 1150 - row * 46;
      g.beginPath(); g.moveTo(x - 50, y + 60); g.quadraticCurveTo(x - 62, y - 10, x, y - 62); g.quadraticCurveTo(x + 62, y - 10, x + 50, y + 60); g.closePath(); g.fill();
    }
    E(cx, 1196, 440, 52); g.fill();
    // chân kiết già
    E(cx, 1020, 372, 112); g.fill();
    E(cx - 190, 1040, 190, 78, 0.08); g.fill(); E(cx + 190, 1040, 190, 78, -0.08); g.fill();
    // thân
    g.beginPath(); g.moveTo(cx - 236, 640); g.bezierCurveTo(cx - 300, 800, cx - 250, 940, cx - 196, 1000); g.lineTo(cx + 196, 1000);
    g.bezierCurveTo(cx + 250, 940, cx + 300, 800, cx + 236, 640); g.bezierCurveTo(cx + 150, 560, cx - 150, 560, cx - 236, 640); g.fill();
    // tay
    E(cx - 262, 810, 66, 196, 0.06); g.fill(); E(cx + 262, 810, 66, 196, -0.06); g.fill();
    E(cx - 150, 968, 150, 44, -0.18); g.fill(); E(cx + 150, 968, 150, 44, 0.18); g.fill(); E(cx, 978, 96, 34); g.fill();
    if (st.hand) { g.save(); g.strokeStyle = 'rgba(120,84,36,0.55)'; g.lineWidth = 4; const hx = cx - 176, hy = 742;
      E(hx - 26, hy + 118, 44, 104, -0.2); g.fill(); g.stroke();
      [[-36, -62, 11, 34, -0.1], [-12, -74, 12, 40, -0.03], [13, -70, 12, 38, 0.05], [36, -52, 11, 30, 0.14]].forEach(([dx, dy, rx, ry, ro]) => { E(hx + dx, hy + dy, rx, ry, ro); g.fill(); g.stroke(); });
      E(hx, hy, 52, 58); g.fill(); g.stroke(); E(hx + 46, hy - 6, 13, 30, 0.75); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(120,84,36,0.35)'; g.lineWidth = 3; g.beginPath(); g.arc(hx, hy + 6, 24, 0, Math.PI * 2); g.stroke(); g.restore(); }
    // cổ, tai, đầu, nhục kế
    g.fillRect(cx - 54, 500, 108, 96);
    E(cx - 124, 440, 20, 70); g.fill(); E(cx + 124, 440, 20, 70); g.fill();
    E(cx, 416, 116, 140); g.fill(); E(cx, 330, 122, 84); g.fill(); E(cx, 262, 62, 50); g.fill(); E(cx, 222, 20, 18); g.fill();
    g.shadowBlur = 0; g.globalCompositeOperation = 'source-atop';
    // khối sáng tối: sáng từ trên trước, tối dần hai bên
    const side = g.createLinearGradient(160, 0, 864, 0); side.addColorStop(0, 'rgba(160,104,36,0.60)'); side.addColorStop(0.3, 'rgba(255,255,255,0)'); side.addColorStop(0.7, 'rgba(255,255,255,0)'); side.addColorStop(1, 'rgba(160,104,36,0.60)');
    g.fillStyle = side; g.fillRect(0, 0, 1024, 1280);
    const hi = g.createRadialGradient(cx, 520, 20, cx, 620, 520); hi.addColorStop(0, 'rgba(255,255,255,0.42)'); hi.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = hi; g.fillRect(0, 0, 1024, 1280);
    // tóc xoắn ốc
    g.fillStyle = 'rgba(150,108,48,0.34)';
    for (let y = 232; y < 408; y += 17) for (let x = cx - 124; x <= cx + 124; x += 17) {
      const inHair = ((x - cx) / 122) ** 2 + ((y - 330) / 86) ** 2 < 1 || ((x - cx) / 62) ** 2 + ((y - 262) / 50) ** 2 < 1;
      const inFace = ((x - cx) / 100) ** 2 + ((y - 440) / 112) ** 2 < 1;
      if (inHair && !inFace) { E(x + ((y / 17) % 2) * 8, y, 6.5, 6.5); g.fill(); }
    }
    // nét y: đường vắt chéo vai trái và các nếp gấp
    g.strokeStyle = 'rgba(150,104,40,0.42)'; g.lineWidth = 5; g.lineCap = 'round';
    const L = (pts) => { g.beginPath(); g.moveTo(pts[0], pts[1]); g.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]); g.stroke(); };
    L([cx - 150, 596, cx - 40, 700, cx + 120, 820, cx + 214, 900]);
    L([cx - 210, 660, cx - 120, 780, cx + 40, 880, cx + 150, 950]); L([cx - 236, 740, cx - 150, 850, cx - 20, 930, cx + 80, 968]);
    L([cx - 250, 830, cx - 190, 900, cx - 110, 950, cx - 40, 972]); L([cx + 236, 660, cx + 250, 760, cx + 232, 860, cx + 196, 940]);
    L([cx - 330, 1030, cx - 180, 1080, cx + 180, 1080, cx + 330, 1030]); L([cx - 290, 1064, cx - 140, 1110, cx + 140, 1110, cx + 290, 1064]);
    // gương mặt: mày, mắt khép, mũi, môi, bạch hào
    g.strokeStyle = 'rgba(120,84,36,0.60)'; g.lineWidth = 4.5;
    g.beginPath(); g.arc(cx - 46, 430, 34, 1.18 * Math.PI, 1.82 * Math.PI); g.stroke(); g.beginPath(); g.arc(cx + 46, 430, 34, 1.18 * Math.PI, 1.82 * Math.PI); g.stroke();
    if (st.open) { [cx - 46, cx + 46].forEach((ex) => { g.save(); g.beginPath(); g.moveTo(ex - 27, 450); g.quadraticCurveTo(ex, 434, ex + 27, 450); g.quadraticCurveTo(ex, 461, ex - 27, 450); g.closePath(); g.fillStyle = 'rgba(255,250,236,0.95)'; g.fill(); g.clip();
        g.fillStyle = 'rgba(64,40,20,0.95)'; E(ex, 453, 10.5, 10.5); g.fill(); g.fillStyle = 'rgba(255,255,255,0.9)'; E(ex + 3, 449, 2.6, 2.6); g.fill(); g.restore();
        g.beginPath(); g.moveTo(ex - 28, 450); g.quadraticCurveTo(ex, 433, ex + 28, 450); g.stroke(); }); }
    else { g.beginPath(); g.arc(cx - 46, 430, 26, 0.16 * Math.PI, 0.84 * Math.PI); g.stroke(); g.beginPath(); g.arc(cx + 46, 430, 26, 0.16 * Math.PI, 0.84 * Math.PI); g.stroke(); }
    g.lineWidth = 3.5; g.beginPath(); g.moveTo(cx - 4, 452); g.quadraticCurveTo(cx - 12, 486, cx, 492); g.quadraticCurveTo(cx + 12, 486, cx + 6, 478); g.stroke();
    if (st.mouth > 0) { g.save(); g.fillStyle = 'rgba(112,48,30,0.82)'; E(cx, 519, 17 + 3 * st.mouth, 2.5 + 9 * st.mouth); g.fill(); g.stroke(); g.restore(); }
    else { g.beginPath(); g.arc(cx, 500, 26, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.9)'; E(cx, 398, 6, 6); g.fill();
    g.globalCompositeOperation = 'source-over';
  });
}

// Chùm lá: kind 'bodhi' (lá hình tim có đuôi), 'pine' (kim), 'blossom' (hoa nhạt)
export function leafTex(kind = 'bodhi') {
  return canvasTex(128, 128, (g) => {
    const r = rng(kind.length * 7 + 3);
    if (kind === 'pine') {
      for (let i = 0; i < 90; i++) { const x = 64 + (r() - 0.5) * 100, y = 64 + (r() - 0.5) * 70, a = r() * Math.PI; g.strokeStyle = `rgba(${40 + r() * 30},${80 + r() * 50},${50 + r() * 20},0.95)`; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 16, y + Math.sin(a) * 10); g.stroke(); }
      return;
    }
    for (let i = 0; i < 7; i++) {
      const x = 28 + r() * 72, y = 28 + r() * 72, s = 15 + r() * 9, rot = r() * 6.28;
      g.save(); g.translate(x, y); g.rotate(rot);
      const c = kind === 'blossom' ? [250, 226 + r() * 20, 232] : kind === 'gold' ? [226 + r() * 20, 184 + r() * 30, 70] : [70 + r() * 50, 130 + r() * 60, 52 + r() * 30];
      const gr = g.createLinearGradient(0, -s, 0, s * 1.5); gr.addColorStop(0, `rgb(${c[0] * 0.78},${c[1] * 0.78},${c[2] * 0.78})`); gr.addColorStop(1, `rgb(${c[0]},${c[1]},${c[2]})`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, -s * 0.5); g.bezierCurveTo(s, -s * 1.2, s * 1.2, s * 0.3, 0, s * 0.9); g.bezierCurveTo(0, s * 1.1, 0, s * 1.3, 0, s * 1.6); g.bezierCurveTo(0, s * 1.3, 0, s * 1.1, 0, s * 0.9); g.bezierCurveTo(-s * 1.2, s * 0.3, -s, -s * 1.2, 0, -s * 0.5); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -s * 0.4); g.lineTo(0, s * 1.3); g.stroke();
      g.restore();
    }
  });
}

export function grassTex() {
  return canvasTex(64, 64, (g) => {
    const r = rng(5);
    for (let i = 0; i < 9; i++) { const x = 8 + r() * 48, lean = (r() - 0.5) * 16, h = 34 + r() * 26; const gr = g.createLinearGradient(0, 64, 0, 64 - h); gr.addColorStop(0, 'rgb(150,150,150)'); gr.addColorStop(1, 'rgb(255,255,255)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 2.6, 64); g.quadraticCurveTo(x + lean * 0.3, 64 - h * 0.6, x + lean, 64 - h); g.quadraticCurveTo(x + lean * 0.5, 64 - h * 0.5, x + 2.6, 64); g.fill(); }
  });
}

export function tileTex() {
  const t = canvasTex(256, 64, (g) => {
    g.fillStyle = '#d9dbe0'; g.fillRect(0, 0, 256, 64);
    for (let x = 0; x < 256; x += 16) { const gr = g.createLinearGradient(x, 0, x + 16, 0); gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.20)'); gr.addColorStop(1, 'rgba(0,0,0,0.30)'); g.fillStyle = gr; g.fillRect(x, 0, 16, 64); }
    g.fillStyle = 'rgba(0,0,0,0.16)'; for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 256, 2);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function steleTex() {
  return canvasTex(128, 256, (g) => { g.fillStyle = '#000'; g.fillRect(0, 0, 128, 256); g.fillStyle = '#ffd98a'; for (let i = 0; i < 9; i++) g.fillRect(22, 30 + i * 22, 28 + ((i * 37) % 56), 5); g.beginPath(); g.arc(64, 236, 6, 0, 6.3); g.fill(); });
}

// Gương mặt: nền trắng để nhân với màu da; nét vẽ là sắc tối nên hợp mọi tông da
export function faceTex({ closed = false, mood = 'tuoi', age = 'tre', shaved = false } = {}) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
    const cx = 64, ey = 121, ink = 'rgba(58,38,30,0.92)';
    if (shaved) {
      const gr = g.createLinearGradient(0, 0, 0, 106); gr.addColorStop(0, 'rgba(70,74,92,0.34)'); gr.addColorStop(0.75, 'rgba(70,74,92,0.24)'); gr.addColorStop(1, 'rgba(70,74,92,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 106);
      const fh = g.createRadialGradient(cx, 106, 6, cx, 106, 30); fh.addColorStop(0, 'rgba(255,255,255,1)'); fh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fh; g.fillRect(cx - 32, 74, 64, 44);
    }
    // má hồng
    [[-17, 139], [17, 139]].forEach(([dx, y]) => { const gr = g.createRadialGradient(cx + dx, y, 0, cx + dx, y, 10); gr.addColorStop(0, 'rgba(232,120,110,0.34)'); gr.addColorStop(1, 'rgba(232,120,110,0)'); g.fillStyle = gr; g.fillRect(cx + dx - 12, y - 12, 24, 24); });
    g.lineCap = 'round'; g.strokeStyle = age === 'cao' ? 'rgba(120,112,108,0.9)' : 'rgba(52,34,26,0.85)'; g.lineWidth = 2.2;
    const tilt = mood === 'hoa' ? 0.12 : mood === 'nghiem' ? -0.04 : 0.05;
    [[-1, cx - 12], [1, cx + 12]].forEach(([s, x]) => { g.beginPath(); g.moveTo(x - 6 * s - 0, 110 - tilt * 8 * 1); g.quadraticCurveTo(x, 106, x + 6 * s, 109 + tilt * 14); g.stroke(); });
    g.strokeStyle = ink; g.lineWidth = 2;
    [cx - 12, cx + 12].forEach((x) => {
      if (closed) { g.beginPath(); g.arc(x, ey - 3, 5.2, 0.14 * Math.PI, 0.86 * Math.PI); g.stroke(); }
      else { g.fillStyle = '#fbfbfb'; g.beginPath(); g.ellipse(x, ey, 5.2, mood === 'tuoi' ? 3.1 : 2.7, 0, 0, 6.3); g.fill(); g.fillStyle = 'rgba(44,28,22,1)'; g.beginPath(); g.arc(x, ey, 2.6, 0, 6.3); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 0.9, ey - 1, 0.8, 0, 6.3); g.fill(); g.beginPath(); g.arc(x, ey + 0.6, 5.4, 1.12 * Math.PI, 1.88 * Math.PI); g.stroke(); }
    });
    g.strokeStyle = 'rgba(120,70,56,0.45)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 1, 126); g.quadraticCurveTo(cx - 3.5, 137, cx, 139); g.quadraticCurveTo(cx + 3, 138.5, cx + 3, 136.5); g.stroke();
    g.strokeStyle = 'rgba(168,74,66,0.9)'; g.lineWidth = 2.2; g.beginPath();
    if (mood === 'nghiem') { g.moveTo(cx - 5.5, 149); g.quadraticCurveTo(cx, 150.2, cx + 5.5, 149); } else g.arc(cx, mood === 'tuoi' ? 143.5 : 145, mood === 'tuoi' ? 7.5 : 6.2, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
    if (age !== 'tre') { g.strokeStyle = `rgba(120,80,64,${age === 'cao' ? 0.32 : 0.16})`; g.lineWidth = 1.1; [[-1], [1]].forEach(([s]) => { g.beginPath(); g.moveTo(cx + s * 19, ey - 2); g.lineTo(cx + s * 23, ey - 4); g.moveTo(cx + s * 19, ey + 1); g.lineTo(cx + s * 23.5, ey + 2); g.moveTo(cx + s * 9.5, 141); g.quadraticCurveTo(cx + s * 11.5, 146, cx + s * 10, 151); g.stroke(); });
      if (age === 'cao') { g.beginPath(); g.moveTo(cx - 12, 99); g.quadraticCurveTo(cx, 97, cx + 12, 99); g.stroke(); } }
  });
}

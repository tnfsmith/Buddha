import * as THREE from 'three';

// ───────── GLSL dùng chung ─────────
// Băm không dùng sin: kiểu fract(sin(x)·43758) nhân sai số lên hàng vạn lần, trình biên dịch D3D (ANGLE trên Windows) tính
// hash(i + (1,0)) khác hash của ô kề nên nhiễu đứt thành mảng tam giác trên biển mây. Bản fract đa thức này giữ giá trị nhỏ.
export const NOISE = `
float hash(vec2 p){vec3 q=fract(p.xyx*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+17.;a*=.5;}return s;}`;
// Màu trong shader viết theo sRGB hiển thị; đổi sang tuyến tính rồi để three.js lo tone mapping và không gian màu.
export const OUT = `gl_FragColor = vec4(pow(max(col, 0.), vec3(2.2)), a);
#include <tonemapping_fragment>
#include <colorspace_fragment>`;

// ───────── Trình vẽ và bậc chất lượng (§12.2–12.5) ─────────
// GĐ7 (§12.4): cờ thử ?r=webgpu (hoặc #r=webgpu khi mở bằng file://). Shader hiện còn là GLSL/onBeforeCompile và bản HTML đơn
// không đóng gói three/webgpu (vượt trần kích thước), nên cờ chỉ được ghi nhận và trình vẽ vẫn là WebGL2 — không có nhánh mã thứ hai.
// Khi port TSL xong (T7.1), đây là chỗ duy nhất quyết định dùng trình vẽ nào.
export function gfxBackend() {
  let ask = false;
  try { const f = (s) => new URLSearchParams(s).get('r') === 'webgpu'; ask = f(location.search) || f(location.hash.slice(1)); } catch (e) { void e; }
  return { ask, gpu: ask && !!navigator.gpu, use: 'webgl2' };
}
// Bậc 0/1/2: trần DPR (điện thoại không quá 1,5; máy tính 2), có hậu kỳ + bóng đổ hay không, tỉ lệ độ phân giải bloom.
// Điện thoại mức 0 vẽ ở DPR 1,25 (màn 2–3× mà vẽ ở 1 thì nhòe); máy yếu thật để bộ điều tốc hạ `res` (tối thiểu 0,6 → DPR 0,75).
export const tierOf = (q, mobile) => ({ dpr: q >= 2 ? (mobile ? 1.5 : 2) : q === 1 || mobile ? 1.25 : 1, post: q >= 1, bloom: mobile ? 0.5 : 1 });
// Bộ điều tốc: gom thời gian khung theo cửa sổ 2 giây (kẹp 250 ms: một lần khựng không kéo cả trung bình).
// Trả −1 khi chậm hơn ~30 fps, +1 khi dư sức, 0 khi giữ nguyên; 5 giây đầu còn biên dịch shader nên chưa đo.
export function governor() {
  let t0 = 0, last = 0, n = 0, sum = 0, born = 0, changed = 0;
  const g = (now, busy) => {
    if (!born) born = t0 = last = changed = now;
    sum += Math.min(now - last, 250); last = now; n++;
    if (now - t0 < 2000) return 0;
    const avg = sum / n; t0 = now; n = sum = 0;
    if (now - born < 5000 || now - changed < 2500 || busy) return 0;
    return avg > 34 ? -1 : avg < 22 ? 1 : 0;
  };
  g.mark = (now) => { changed = now; };
  g.reset = (now) => { t0 = last = now; n = sum = 0; };
  return g;
}

// ───────── Bốn tâm trạng ánh sáng: Sương Sớm · Ngày Vàng · Hoàng Hôn Tím · Trăng Thiền ─────────
// Mỗi dòng: thiên đỉnh, chân trời, mặt trời/trăng, mây sáng, mây tối (màu hiển thị sRGB), cường độ nắng, ánh nền, độ phơi sáng.
export const MOOD = [
  [0.46, 0.64, 0.92, 0.97, 0.92, 0.88, 1.0, 0.86, 0.74, 1.0, 0.975, 0.96, 0.66, 0.71, 0.90, 2.3, 0.6, 0.94],
  [0.15, 0.40, 0.90, 1.0, 0.93, 0.80, 1.0, 0.80, 0.50, 1.0, 0.985, 0.955, 0.58, 0.68, 0.92, 2.9, 0.5, 0.95],
  [0.34, 0.28, 0.66, 1.0, 0.70, 0.46, 1.0, 0.60, 0.32, 1.0, 0.85, 0.70, 0.56, 0.48, 0.78, 2.5, 0.46, 0.92],
  [0.03, 0.05, 0.14, 0.18, 0.22, 0.38, 0.72, 0.82, 1.0, 0.42, 0.48, 0.68, 0.16, 0.19, 0.34, 1.0, 0.22, 0.95],
];
// Uniform dùng chung cho mọi shader tự viết (trời, biển mây, nước, tia sáng…): một nguồn màu duy nhất nên chuyển tâm trạng luôn mượt
const v3 = () => ({ value: new THREE.Vector3() });
export const UNI = { uTime: { value: 0 }, uNight: { value: 0 }, uZen: v3(), uHz: v3(), uSunC: v3(), uCl: v3(), uSh: v3(), uSun: { value: new THREE.Vector3(-60, 108, -190).normalize() }, uPx: { value: 400 } };   // uPx: nửa chiều cao bộ đệm vẽ (điểm ảnh) cho kích thước hạt theo đơn vị thế giới
const moodNow = new Float32Array(18);
/** Trộn bốn tâm trạng theo trọng số w (tổng = 1), ghi màu vào UNI và trả mảng 18 số (3 số cuối: nắng, ánh nền, phơi sáng). */
export function moodMix(w) {
  for (let i = 0; i < 18; i++) moodNow[i] = MOOD[0][i] * w[0] + MOOD[1][i] * w[1] + MOOD[2][i] * w[2] + MOOD[3][i] * w[3];
  [UNI.uZen, UNI.uHz, UNI.uSunC, UNI.uCl, UNI.uSh].forEach((u, i) => u.value.fromArray(moodNow, i * 3));
  return moodNow;
}

// Sương theo độ cao (hàm mũ) cộng sương xa (mũ bình phương) cho mọi vật liệu dựng sẵn của three: chân đảo tan dần vào biển mây
// (đỉnh mây y ≈ −6). Thay chunk `fog_*` một lần lúc nạp mô-đun; GĐ7 sẽ viết lại bằng fogNode của TSL.
// Cùng chỗ đó chỉnh bước tone mapping: ACES Filmic làm nhạt sắc vàng, lục, lam ở vùng sáng nên bù trước 22 % độ bão hòa.
// Bước này chạy một lần cho mỗi điểm ảnh: trong vật liệu khi vẽ thẳng ra màn hình (mức 0), hoặc ở lượt hậu kỳ cuối (mức ≥ 1).
{ const SC = THREE.ShaderChunk;
  SC.tonemapping_fragment = '#if defined( TONE_MAPPING )\ngl_FragColor.rgb = toneMapping(max(mix(vec3(dot(gl_FragColor.rgb, vec3(.2126,.7152,.0722))), gl_FragColor.rgb, 1.22), 0.));\n#endif';
  SC.fog_pars_vertex = '#ifdef USE_FOG\nvarying float vFogDepth; varying float vFogY;\n#endif';
  SC.fog_vertex = '#ifdef USE_FOG\nvFogDepth = -mvPosition.z; vFogY = cameraPosition.y + dot(viewMatrix[1].xyz, mvPosition.xyz);\n#endif';
  SC.fog_pars_fragment = '#ifdef USE_FOG\nuniform vec3 fogColor; uniform float fogNear; uniform float fogFar; varying float vFogDepth; varying float vFogY;\n#endif';
  SC.fog_fragment = '#ifdef USE_FOG\nfloat fogD = vFogDepth/fogFar; gl_FragColor.rgb = mix(fogColor, gl_FragColor.rgb, exp(-fogD*fogD*3.)*(1. - .9*exp(-max(vFogY + 6., 0.)*.3)));\n#endif'; }

// LOD hai mức cho một tập instance tĩnh: `hi` (gần) và `lo` (xa) dùng chung ma trận `mats`; điểm `pts[i]` cách máy quay
// dưới ngưỡng T[mức chất lượng] (trừ bán kính `pad[i]` nếu có) thì vào `hi`. Độ trễ 8% để không nhấp nháy ở sát ngưỡng.
// Trả về hàm gọi mỗi khung: lod(cam, q); chỉ ghi lại ma trận khi có instance đổi mức.
export function lodPair(hi, lo, mats, pts, T, pad = null) {
  const near = new Uint8Array(mats.length).fill(2), last = new THREE.Vector3(1e9, 0, 0); let lastQ = -1;
  [hi, lo].forEach((m) => { m.count = 0; m.visible = false; });
  const lod = (cam, q = 2, force = false) => {
    if (!force && q === lastQ && cam.distanceToSquared(last) < 4) return false;
    last.copy(cam); lastQ = q; const t = T[q] ?? T[T.length - 1]; let ch = force;
    for (let i = 0; i < pts.length; i++) { const d = pts[i].distanceTo(cam) - (pad ? pad[i] : 0), nv = d < (near[i] === 1 ? t * 1.08 : t / 1.08) ? 1 : 0; if (nv !== near[i]) { near[i] = nv; ch = true; } }
    if (!ch) return false; let a = 0, b = 0;
    for (let i = 0; i < pts.length; i++) { if (near[i]) hi.setMatrixAt(a++, mats[i]); else lo.setMatrixAt(b++, mats[i]); }
    [[hi, a], [lo, b]].forEach(([m, c]) => { m.count = c; m.visible = c > 0; if (c) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.boundingSphere.radius *= 1.1; } });
    return true;
  };
  lod.stats = () => ({ near: hi.count, far: lo.count });
  return lod;
}

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

// ───────── Chất liệu sờ thấy được (PBR thủ tục) ─────────
// Một tấm vân xám 128² lặp liền mép, dùng chung cho đá, gỗ, bia: vừa là độ gồ (bump) vừa là độ nhám (roughness).
let _dt = null;
export function detailTex() {
  if (_dt) return _dt;
  const S = 128, N = makeNoise(5), f = (x, y) => N.fbm(x * 0.06, y * 0.06, 1.5, 3), L = (a, b, t) => a + (b - a) * t;
  _dt = canvasTex(S, S, (g) => {
    const im = g.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {   // trộn bốn bản lệch một chu kỳ để hai mép khớp nhau
      const v = L(L(f(x, y), f(x - S, y), x / S), L(f(x, y - S), f(x - S, y - S), x / S), y / S), i = (y * S + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.max(0, Math.min(255, (v - 0.12) * 330)); im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0);
  }, false);
  _dt.wrapS = _dt.wrapT = THREE.RepeatWrapping; return _dt;
}
// Gắn vân vào một MeshStandardMaterial theo tọa độ thế giới (không cần UV nên hình đã gộp vẫn dùng được).
// k = [mật độ vân, độ gồ, rêu phủ mặt ngửa 0..1, thớ kéo dọc 0..1 (gỗ)]. Mọi vật liệu gọi hàm này dùng chung một chương trình shader.
export function tactile(m, k) {
  const U = { uDt: { value: detailTex() }, uTk: { value: new THREE.Vector4(...k) } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vTp;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vTp = mvPosition.xyz * mat3(viewMatrix) + cameraPosition;');
    sh.fragmentShader = 'varying vec3 vTp; uniform sampler2D uDt; uniform vec4 uTk;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
 vec3 tq = vTp*uTk.x; tq.y *= 1. - .85*uTk.w;
 float td = texture2D(uDt, tq.xz + tq.y*vec2(.37,.61)).r*.6 + texture2D(uDt, tq.xy*2.3 + tq.z*.53).r*.4;
 diffuseColor.rgb *= .7 + .6*td;
 diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.19,.3,.1)*(.5 + td), uTk.z*smoothstep(.35, .75, dot(normalize(vNormal), viewMatrix[1].xyz) + td*.5 - .25));`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = clamp(roughnessFactor*(.72 + .56*td), .05, 1.);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
 { vec2 dH = vec2(dFdx(td), dFdy(td))*uTk.y; vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx); float det = dot(sx, r1);
   normal = normalize(abs(det)*normal - sign(det)*(dH.x*r1 + dH.y*r2)); }`);
  };
  return m;
}
// Tô một màu lên mọi đỉnh (cho vật liệu vertexColors dùng chung). Hình đã có màu thì nhân bản để không đổi màu nơi khác đang dùng.
export function hue(g, c) {
  if (g.attributes.color) g = g.clone();
  const n = g.attributes.position.count, a = new Float32Array(n * 3), k = new THREE.Color(c);
  for (let i = 0; i < n; i++) k.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}

// Bốn dáng mây tích (ô 512²), dựng từng điểm ảnh. Thân mây là hợp mềm của các khối cầu: hàng chân rộng, tầng giữa, chỏm cuộn
// kiểu súp lơ. Mép bị nhiễu gặm thành tơ, đáy phẳng tan dần. Ghi thẳng vào DataTexture (qua canvas thì mép mờ mất màu):
// r, g = pháp tuyến x, y của mặt mây trong hệ tấm (0,5 là 0); b = độ dày (0 ở mép → 1 ở lõi); a = mật độ.
// world.js chiếu sáng theo hướng mặt trời trong hệ máy quay: đỉnh sáng, đáy ngả lam, mép rực viền bạc khi nhìn ngược nắng.
export function puffAtlas() {
  const S = 1024, C = 512, D = new Uint8Array(S * S * 4), r = rng(11), lat = Float32Array.from({ length: 4096 }, r);
  const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v), A = (i, j) => lat[((j & 63) << 6) | (i & 63)];
    const a = A(xi, yi), b = A(xi + 1, yi), c = A(xi, yi + 1), d = A(xi + 1, yi + 1); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };
  const fb = (x, y) => vn(x, y) * 0.5 + vn(x * 2.1 + 5, y * 2.1 + 9) * 0.3 + vn(x * 4.3 + 17, y * 4.3 + 3) * 0.2;
  for (let c = 0; c < 4; c++) {
    const ox = (c % 2) * C, oy = (c >> 1) * C, B = [], base = 138 + r() * 22, nb = 5 + c, nm = 3 + (c & 1);
    for (let i = 0; i < nb; i++) { const t = (i / (nb - 1)) * 2 - 1, rad = (62 + r() * 26) * (1 - 0.3 * t * t); B.push([256 + t * (150 + c * 12) + (r() - 0.5) * 24, base + rad * 0.45, rad]); }
    for (let i = 0; i < nm; i++) { const t = (i / (nm - 1)) * 2 - 1; B.push([256 + t * (88 + c * 10) + (r() - 0.5) * 30, base + 70 + r() * 46 + (1 - Math.abs(t)) * 40, 58 + r() * 30]); }
    const big = B.length;
    for (let i = 0; i < 16; i++) { const o = B[Math.floor(r() * big)], a = 0.3 + r() * 2.54; B.push([o[0] + Math.cos(a) * o[2] * 0.78, o[1] + Math.sin(a) * o[2] * 0.78, 22 + r() * 22]); }
    for (let py = 0; py < C; py++) { const row = B.filter((b) => Math.abs(py - b[1]) < b[2] + 40); for (let px = 0; px < C; px++) {
      let m = -1e9, nx = 0, ny = 0, nz = 0, th = 0;
      for (let j = 0; j < row.length; j++) { const bx = row[j][0], br = row[j][2], dx = px - bx, dy = py - row[j][1]; if (dx > br + 40 || dx < -br - 40) continue;
        const d = Math.sqrt(dx * dx + dy * dy), s = br - d; if (s < -40) continue;
        const h = Math.max(0, Math.min(1, 0.5 + (s - m) / 28)), k = Math.min(1, d / br);   // cực đại mềm đa thức (độ mềm 14 px), pháp tuyến trộn theo cùng tỉ lệ
        m += (s - m) * h + 14 * h * (1 - h); nx += (dx / br - nx) * h; ny += (dy / br - ny) * h; nz += (Math.sqrt(1 - k * k) - nz) * h; if (s > 0) th = Math.max(th, Math.sqrt(br * br - d * d)); }
      const i = ((oy + py) * S + ox + px) * 4;
      if (m < -40) { const L = Math.sqrt((px - 256) ** 2 + (py - 290) ** 2) || 1; D[i] = 128 + (127 * (px - 256)) / L; D[i + 1] = 128 + (127 * (py - 290)) / L; continue; }
      const q = fb(px / 38 + c * 7, py / 38), gx = fb(px / 38 + c * 7 + 0.06, py / 38) - q, gy = fb(px / 38 + c * 7, py / 38 + 0.06) - q;
      let a = Math.min(1, Math.max(0, (m + (q - 0.55) * 36) / 22)); a = a * a * (3 - 2 * a);
      const fl = Math.min(1, Math.max(0, (py - base + 14 + (vn(px / 24, 3 + c) - 0.5) * 18) / 36)), edge = Math.min(1, Math.min(px, C - 1 - px, py, C - 1 - py) / 24);
      a *= fl * fl * (3 - 2 * fl) * edge;
      let Nx = nx - gx * 4, Ny = ny - gy * 4; const Nz = nz + 0.15, L = Math.sqrt(Nx * Nx + Ny * Ny + Nz * Nz); Nx /= L; Ny /= L;
      D[i] = 128 + 127 * Nx; D[i + 1] = 128 + 127 * Ny; D[i + 2] = 255 * Math.min(1, th / 105) * (0.75 + 0.25 * q); D[i + 3] = 255 * a;
    } }
  }
  const t = new THREE.DataTexture(D, S, S); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true; return t;
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

// Chùm lá (128², nền trong suốt): 'bodhi' lá hình tim đuôi nhọn có gân, 'gold' cùng dáng màu vàng, 'blossom' hoa anh đào
// năm cánh khía, 'pine' các quạt kim thông. Màu viết theo sRGB; instance color của tán lá nhân thêm độ sáng.
export function leafTex(kind = 'bodhi') {
  return canvasTex(128, 128, (g) => {
    const r = rng(kind.length * 7 + 3), P = (a) => g.beginPath() || a();
    if (kind === 'pine') {
      for (let f = 0; f < 7; f++) { const x = 24 + r() * 80, y = 30 + r() * 70, a0 = -2.4 + r() * 0.6;
        for (let i = 0; i < 16; i++) { const a = a0 + i * 0.11, L = 16 + r() * 10, k = 0.7 + r() * 0.5;
          g.strokeStyle = `rgb(${34 * k},${74 * k + 20 * r()},${42 * k})`; g.lineWidth = 2; P(() => { g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * L * 0.5, y + Math.sin(a) * L * 0.5 - 3, x + Math.cos(a) * L, y + Math.sin(a) * L); }); g.stroke(); } }
      return;
    }
    if (kind === 'blossom') {
      for (let i = 0; i < 8; i++) { const x = 20 + r() * 88, y = 20 + r() * 88, s = 9 + r() * 6, rot = r() * 6.28, gb = 186 + r() * 40;
        for (let k = 0; k < 5; k++) { g.save(); g.translate(x, y); g.rotate(rot + k * 1.2566);
          const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, `rgb(232,${gb - 84},${gb - 70})`); gr.addColorStop(0.45, `rgb(255,${gb - 10},${gb - 4})`); gr.addColorStop(1, 'rgb(255,238,236)');
          g.fillStyle = gr; P(() => { g.moveTo(0, 0); g.bezierCurveTo(-s * 0.75, s * 0.3, -s * 0.55, s * 1.05, -s * 0.14, s * 1.02); g.lineTo(0, s * 0.86); g.lineTo(s * 0.14, s * 1.02); g.bezierCurveTo(s * 0.55, s * 1.05, s * 0.75, s * 0.3, 0, 0); }); g.fill(); g.restore(); }
        g.fillStyle = '#c94a6a'; P(() => g.arc(x, y, s * 0.2, 0, 6.3)); g.fill(); g.fillStyle = '#ffd66b'; for (let k = 0; k < 6; k++) { P(() => g.arc(x + Math.cos(k + rot) * s * 0.3, y + Math.sin(k + rot) * s * 0.3, 1.1, 0, 6.3)); g.fill(); } }
      return;
    }
    for (let i = 0; i < 10; i++) {
      const x = 24 + r() * 80, y = 24 + r() * 80, s = 13 + r() * 8, rot = r() * 6.28;
      g.save(); g.translate(x, y); g.rotate(rot);
      const c = kind === 'gold' ? [226 + r() * 22, 176 + r() * 36, 64] : [64 + r() * 46, 118 + r() * 58, 44 + r() * 26];
      const gr = g.createLinearGradient(-s, 0, s, 0); gr.addColorStop(0, `rgb(${c[0] * 0.7},${c[1] * 0.72},${c[2] * 0.7})`); gr.addColorStop(0.5, `rgb(${c})`); gr.addColorStop(1, `rgb(${Math.min(255, c[0] * 1.18)},${Math.min(255, c[1] * 1.15)},${c[2] * 1.05})`);
      g.fillStyle = gr; P(() => { g.moveTo(0, -s * 0.5); g.bezierCurveTo(s, -s * 1.25, s * 1.15, s * 0.35, 0, s * 0.95); g.quadraticCurveTo(0, s * 1.3, 0, s * 1.75); g.quadraticCurveTo(0, s * 1.3, 0, s * 0.95); g.bezierCurveTo(-s * 1.15, s * 0.35, -s, -s * 1.25, 0, -s * 0.5); }); g.fill();
      g.strokeStyle = 'rgba(30,50,20,0.35)'; g.lineWidth = 0.8; g.stroke();
      g.strokeStyle = 'rgba(255,255,220,0.32)'; g.lineWidth = 1; P(() => { g.moveTo(0, -s * 0.45); g.lineTo(0, s * 1.4); for (let k = 0; k < 4; k++) { const v = -s * 0.2 + k * s * 0.3; g.moveTo(0, v); g.quadraticCurveTo(s * 0.35, v - s * 0.08, s * 0.6, v - s * 0.3); g.moveTo(0, v); g.quadraticCurveTo(-s * 0.35, v - s * 0.08, -s * 0.6, v - s * 0.3); } }); g.stroke();
      g.restore();
    }
  });
}

// Ống quét theo đường cong (thân cây, cành, tay áo, dải lụa, đuôi tóc). pts: mảng [x,y,z]; n đoạn dọc, s cạnh quanh ống.
// r(t, d, P) cho bán kính tại vị trí t ∈ [0,1] theo hướng d (vector đơn vị từ tâm P): đổi theo t thì thuôn, theo d thì ép dẹt
// hoặc phình (túi tay áo). k(t) → [gió, thở] ghi vào thuộc tính `aK` cho vertex shader. Hai đầu hở.
export function sweep(pts, n, s, r, k = null) {
  const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), g = new THREE.TubeGeometry(c, n, 1, s), p = g.attributes.position, P = new THREE.Vector3(), d = new THREE.Vector3(), K = new Float32Array(p.count * 2);
  for (let i = 0; i <= n; i++) { c.getPointAt(i / n, P); const kk = k ? k(i / n) : [0, 0];
    for (let j = 0; j <= s; j++) { const v = i * (s + 1) + j; d.fromBufferAttribute(p, v).sub(P); d.multiplyScalar(r(i / n, d, P)).add(P); p.setXYZ(v, d.x, d.y, d.z); K.set(kk, v * 2); } }
  g.computeVertexNormals(); g.setAttribute('aK', new THREE.BufferAttribute(K, 2)); return g;
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

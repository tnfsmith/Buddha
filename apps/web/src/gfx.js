import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
export const UNI = { uTime: { value: 0 }, uNight: { value: 0 }, uZen: v3(), uHz: v3(), uSunC: v3(), uCl: v3(), uSh: v3(), uSun: { value: new THREE.Vector3(-60, 108, -190).normalize() }, uPx: { value: 400 }, uJoy: { value: 0 } };   // uPx: nửa chiều cao bộ đệm vẽ (điểm ảnh) cho kích thước hạt theo đơn vị thế giới
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

// ───────── Tôn tượng: tượng tạc khối ─────────
// Ngồi kiết già trên tòa sen hai lớp cánh, tay ấn thiền định, tăng y vắt vai trái (vai phải để trần), cổ ba ngấn, tai dài,
// tóc xoắn ốc, nhục kế, bạch hào. Đơn vị cục bộ (world.js phóng BS = 1,5): mặt tòa sen ≈ 25, vai ≈ 150, mắt ≈ 195, đỉnh ≈ 257.
// Một hình gộp, một lệnh vẽ. Màu ở đỉnh; aK = [độ bóng, khớp: 0 tĩnh · 1 cẳng tay phải · 2 bàn tay phải]; aB, aNB = vị trí và
// pháp tuyến của bàn tay phải ở dáng ấn thuyết pháp (cùng số đỉnh, hệ tọa độ của dáng thiền định). Nét mặt vẽ trên tấm `buddhaFace`.
const S3 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const HC = [0, 199, 2], HR = [27, 30, 27], ELBOW = [-62, 100, 6], WRIST = [-22, 70, 30];
// Dáng đầu theo hướng (x, y, z) trên mặt cầu đơn vị: mặt tròn đầy, má bầu, cằm tròn; f = 1 thì nặn mũi nhỏ, gờ mày, mí mắt, môi
function headAt(x, y, z, f) {
  const lo = Math.max(0, -y) ** 2, F = S3(0.2, 0.8, z) * f, au = Math.abs(x), e = (a) => Math.exp(-a);
  let d = 0;
  if (F > 0) { const tn = Math.min(1, Math.max(0, (0.02 - y) / 0.44));
    d = 0.13 * tn ** 1.3 * e((x * x) / (0.005 + 0.009 * tn)) * (y > -0.42 ? 1 : e((y + 0.42) ** 2 / 0.0015))
      + 0.022 * e((au - 0.08) ** 2 / 0.0025 + (y + 0.4) ** 2 / 0.002)
      + 0.018 * e((y - 0.02 + 0.5 * (au - 0.3) ** 2) ** 2 / 0.004) * S3(0.7, 0.15, au)
      - 0.022 * e((au - 0.36) ** 2 / 0.03 + (y + 0.13) ** 2 / 0.012) + 0.018 * e((au - 0.36) ** 2 / 0.012 + (y + 0.16) ** 2 / 0.0025)
      + 0.05 * e((au - 0.44) ** 2 / 0.03 + (y + 0.38) ** 2 / 0.03)
      + 0.03 * e((x * x) / 0.03 + (y + 0.52) ** 2 / 0.0014) + 0.035 * e((x * x) / 0.022 + (y + 0.6) ** 2 / 0.0018)
      + 0.03 * e((x * x) / 0.05 + (y + 0.8) ** 2 / 0.008); }
  return [HC[0] + x * HR[0] * (1 - 0.16 * lo), HC[1] + y * HR[1], HC[2] + z * HR[2] * (1 - 0.12 * lo) + d * HR[2] * F];
}
export function buddhaGeo() {
  const V3 = THREE.Vector3, P = [], SKIN = [0.95, 0.6, 0.2, 1], ROBE = [0.76, 0.43, 0.11, 0], HAIR = [0.26, 0.15, 0.06, 0.4], GOLD = [1.5, 1.05, 0.45, 1];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  // gắn màu + độ bóng (hằng hoặc hàm theo vị trí), khớp, uv (mặc định góc trắng của tấm mặt), dáng thứ hai B (cùng số đỉnh)
  const put = (g, c, arm = 0, uvf = null, B = g) => {
    Object.keys(g.attributes).forEach((k) => { if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); });
    const p = g.attributes.position, n = p.count, C = new Float32Array(n * 3), K = new Float32Array(n * 2), U = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = typeof c === 'function' ? c(x, y, z, i) : c; C.set(q.slice(0, 3), i * 3); K[i * 2] = q[3]; K[i * 2 + 1] = arm; if (uvf) uvf(i, U); }
    g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('aK', new THREE.BufferAttribute(K, 2)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.setAttribute('aB', B.attributes.position.clone()); g.setAttribute('aNB', B.attributes.normal.clone()); P.push(g);
  };
  const ell = (rx, ry, rz, x, y, z, w = 16, h = 12, ry2 = 0) => { const g = new THREE.SphereGeometry(1, w, h); g.rotateY(-Math.PI / 2); g.scale(rx, ry, rz); g.rotateY(ry2); g.translate(x, y, z); return g; };
  const tube = (pts, r, n = 12, s = 10) => sweep(pts, n, s, typeof r === 'function' ? r : () => r);
  // mặt tròn xoay theo từng hàng (đi ngược chiều kim đồng hồ trên mặt cắt thì mặt ngoài quay ra ngoài); đường nối nằm sau lưng
  const loft = (rows, seg, f) => { const V = [], I = [];
    rows.forEach((r) => { for (let j = 0; j < seg; j++) V.push(...f(r, Math.PI + (j / seg) * 2 * Math.PI)); });
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = a + seg, d = b + seg; I.push(a, b, c, b, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.setIndex(I); g.computeVertexNormals(); return g; };
  const rows = (pts, n) => { const c = new THREE.CatmullRomCurve3(pts.map(([y, rx, rz]) => new V3(rx, y, rz))); return Array.from({ length: n + 1 }, (_, i) => c.getPoint(i / n)); };
  const round = (pts) => loft(pts, 64, ([y, r], a) => [r * Math.sin(a), y, r * Math.cos(a)]);

  // ── tòa sen: đế tròn có gờ, đệm ngồi, hai lớp 18 cánh khum (mặt trong riêng để nhìn từ trên không thủng)
  put(round([[-8, 0.1], [-8, 104], [-3, 106], [1, 101], [5, 97], [10, 99], [14, 95], [20, 90], [24, 72], [25.5, 0.1]]), [0.88, 0.58, 0.28, 0.5]);
  // mỗi cánh: gốc hẹp, giữa rộng, chóp nhọn hơi cong ra; hồng đậm ở gốc nhạt dần lên chóp, gân giữa sáng, mép viền vàng
  const petals = (R, y0, H, W, tilt, off, back) => { const V = [], I = [], C = [], S = back ? 4 : 8, T = back ? 6 : 9;
    for (let k = 0; k < 18; k++) { const a0 = ((k + off) / 18) * Math.PI * 2, ca = Math.cos(a0), sa = Math.sin(a0), o0 = V.length / 3;
      for (let i = 0; i <= T; i++) { const t = i / T, hw = W * Math.sin(Math.PI * (0.1 + 0.9 * t)) ** 0.7, rho = R + H * (Math.sin(tilt) * t + 0.15 * t * t), y = y0 + H * Math.cos(tilt) * t;
        for (let j = 0; j <= S; j++) { const s = (j / S) * 2 - 1, o = rho + 0.28 * hw * (1 - s * s) - (back ? 0.9 : 0), w = s * hw; V.push(o * sa + w * ca, y, o * ca - w * sa);
          C.push(mix(mix([0.7, 0.3, 0.2, 0.6], [1, 0.64, 0.48, 0.8], S3(0, 0.9, t)), [1.1, 0.74, 0.3, 1], Math.max(S3(0.7, 1, Math.abs(s)), 0.45 * t * S3(0.15, 0, Math.abs(s))))); } }
      for (let i = 0; i < T; i++) for (let j = 0; j < S; j++) { const a = o0 + i * (S + 1) + j, b = a + 1, c = a + S + 1, d = c + 1; I.push(...(back ? [a, c, b, b, c, d] : [a, b, c, b, d, c])); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.setIndex(I); g.computeVertexNormals(); put(g, (x, y, z, i) => C[i]); };
  [[96, -2, 30, 17, 0.75, 0], [84, 8, 34, 16, 0.45, 0.5]].forEach((p) => [0, 1].forEach((b) => petals(...p, b)));

  // ── chân kiết già: khối đùi phủ y, hai gối, hai cẳng chân bắt chéo, lòng bàn chân ngửa, gấu y quanh lòng
  put(loft(rows([[16, 70, 36], [24, 92, 45], [36, 96, 48], [48, 90, 45], [57, 74, 37], [63, 46, 26], [66, 4, 4]], 16), 48, (p, a) => [p.x * Math.sin(a), p.y, 12 + p.z * Math.cos(a)]), ROBE);
  [-1, 1].forEach((s) => put(ell(26, 12.5, 21, 77 * s, 33, 30), ROBE));
  const shin = (t, d) => 10 * (1 - 0.3 * Math.abs(d.y));
  put(tube([[-80, 42, 34], [-40, 50, 50], [8, 55, 47], [36, 57, 33]], shin, 14), ROBE);
  put(tube([[80, 34, 36], [40, 40, 52], [-8, 44, 50], [-36, 46, 38]], (t, d) => 0.95 * shin(t, d), 14), ROBE);
  put(ell(10, 7, 9.5, 36, 57, 33, 12, 8), ROBE); put(ell(9.5, 6.6, 9, -36, 46, 38, 12, 8), ROBE);   // bịt đầu ống cẳng chân
  put(ell(15, 4.4, 8, 46, 60.5, 28), SKIN); put(ell(13, 4, 7, -46, 55, 34), SKIN);
  put(tube(Array.from({ length: 11 }, (_, i) => { const t = -1.3 + (i / 10) * 2.6; return [94.5 * Math.sin(t), 26.5, 12 + 47 * Math.cos(t)]; }), 2, 30, 6), ROBE);

  // ── thân: tiết diện elip, ngực và bụng nhô trước, vai xuôi vào cổ. Y phủ trái, vai và ngực phải để trần (mép y vắt chéo)
  const TS = rows([[50, 50, 31], [70, 52, 30], [92, 53, 29], [112, 54, 29], [130, 55, 28], [143, 54, 26], [151, 49, 23], [158, 38, 19], [163, 24, 15], [167, 14, 12.5]], 30);
  const bulge = (y) => 5 * Math.exp(-(((y - 128) / 18) ** 2)) + 3 * Math.exp(-(((y - 75) / 14) ** 2));
  const surf = (a, y, out = 0) => { let i = 0; while (i < TS.length - 2 && TS[i + 1].y < y) i++; const A = TS[i], B = TS[i + 1], t = Math.min(1, Math.max(0, (y - A.y) / (B.y - A.y))), rx = A.x + (B.x - A.x) * t + out, rz = A.z + (B.z - A.z) * t + out;
    return [rx * Math.sin(a), y, rz * Math.cos(a) + bulge(y) * Math.max(0, Math.cos(a)) ** 2 - 2]; };
  const hem = (A) => 118 + 47 * Math.abs((A + Math.PI / 2) / 1.92) ** 2.4;
  const bare = (x, y, z) => { let A = Math.atan2(x, z); if (A > 1.6) A -= 2 * Math.PI; return y > 165 || (A < 0.35 && A > -Math.PI - 0.35 && y > hem(A)); };
  put(loft(TS, 48, (p, a) => surf(a, p.y)), (x, y, z) => (bare(x, y, z) ? SKIN : ROBE));
  put(tube(Array.from({ length: 29 }, (_, i) => { const A = 0.35 - (i / 28) * (Math.PI + 0.7); return surf(A, hem(A), 0.8); }), 2.2, 56, 6), ROBE);
  [16, 31, 46].forEach((k) => put(tube(Array.from({ length: 9 }, (_, i) => { const A = 0.35 - (i / 8) * 1.6; return surf(A, hem(A) - k, 0.4); }), 1.4, 20, 5), ROBE));

  // ── tay: vai phải trần, tay trái trong ống y; hai bàn tay ngửa chồng trong lòng (phải trên trái), hai đầu ngón cái chạm nhau.
  // Khi giảng: cẳng tay phải (khớp 1) xoay quanh khuỷu, bàn tay phải (khớp 2) xoay quanh cổ tay và chuyển sang dáng B: bốn ngón
  // duỗi thẳng, ngón trỏ cong chạm đầu ngón cái thành vòng tròn (ấn thuyết pháp). Dáng B dựng trong hệ của dáng thiền định
  // (ngón tay theo +x, lòng bàn tay +y, phía ngón cái +z); buildBuddha xoay cả bàn tay cho ngón hướng lên, lòng bàn tay hướng về chúng sanh.
  put(ell(13, 10, 13, -45, 146, -1), SKIN); put(ell(15, 11, 15, 45, 146, -1), ROBE);
  put(tube([[-48, 148, -2], [-58, 124, 0], ELBOW], (t) => 11.5 - 2.9 * t), SKIN); put(ell(8.6, 8.6, 8.6, ...ELBOW), SKIN);
  put(tube([[48, 150, -2], [60, 124, 0], [64, 100, 6]], (t) => 13.5 - 2 * t), ROBE); put(ell(11, 11, 11, 64, 100, 6), ROBE);
  put(tube([[64, 100, 6], [52, 80, 22], [24, 67, 30]], (t) => 11 - 3 * t), ROBE);
  put(tube([[26, 67.5, 30], [18, 66.5, 30]], 6, 3, 10), SKIN); put(ell(12, 3.2, 7.5, 6, 66.5, 30.5), SKIN);
  put(tube([[12, 68, 37], [5, 73, 38], [0, 74, 36]], 1.8, 8, 6), SKIN);
  put(tube([ELBOW, [-50, 82, 20], WRIST], (t) => 8.4 - 1.9 * t), SKIN, 1); put(ell(6.6, 6.6, 6.6, ...WRIST, 10, 8), SKIN, 1);
  put(ell(12, 3.6, 7.5, -10, 70.5, 31), SKIN, 2);
  [-4.6, -1.5, 1.6, 4.6].forEach((dz, i) => { const z = 31 + dz, a = Math.abs(dz), L = [11, 13.5, 15, 0][i];
    put(tube([[-6, 72.6, z], [0, 72.8, z], [5 - a * 0.5, 72.9, 31 + dz * 1.05]], 1.35, 6, 6), SKIN, 2, null,
      tube(i < 3 ? [[-6, 72.6, z], [5, 73.2, 31 + dz * 1.15], [L, 74.4, 31 + dz * 1.35]] : [[-6, 72.6, z], [3, 73.8, 36.2], [6.4, 78.4, 36.8]], 1.35, 6, 6));
    put(tube([[10, 68.6, 30.5 + dz], [-1 + a * 0.5, 68.8, 30.5 + dz * 1.05]], 1.3, 4, 6), SKIN); });
  put(tube([[-12, 71.5, 37], [-5, 74.5, 38], [0, 74, 36]], 1.8, 8, 6), SKIN, 2, null, tube([[-12, 71.5, 37], [-3.5, 76.8, 39], [4.6, 80.4, 37.6]], 1.8, 8, 6));

  // ── cổ ba ngấn, tai dài, đầu, tóc xoắn ốc, nhục kế, bạch hào
  put(round([[158, 14.5], [168, 12.8], [186, 12]]), SKIN);
  [170, 175].forEach((y) => { const g = new THREE.TorusGeometry(1, 0.045, 4, 40); g.rotateX(Math.PI / 2); g.scale(12.9, 12.9, 12.5); g.translate(0, y, 0.3); put(g, SKIN); });
  [-1, 1].forEach((s) => { put(ell(2.8, 17, 7, 28 * s, 192, -2, 10, 12, 0.5 * s), SKIN); put(ell(3.8, 7, 5.6, 28.5 * s, 179, -0.5, 10, 8, 0.5 * s), SKIN); });
  const hl = (z) => 0.36 - 0.38 * (1 - z), hd = new THREE.SphereGeometry(1, 64, 52), hp = hd.attributes.position, huv = [], hcol = [];
  hd.rotateY(-Math.PI / 2);
  for (let i = 0; i < hp.count; i++) { const r = Math.hypot(hp.getX(i), hp.getZ(i)), y = hp.getY(i), f = Math.atan2(hp.getX(i), hp.getZ(i)), f2 = f - 0.5 * Math.sin(f), x = r * Math.sin(f2), z = r * Math.cos(f2);
    const w = S3(hl(z) - 0.04, hl(z) + 0.04, y), q = headAt(x, y, z, 1 - w), k = 1 + 0.035 * w;
    hp.setXYZ(i, HC[0] + (q[0] - HC[0]) * k, HC[1] + (q[1] - HC[1]) * k, HC[2] + (q[2] - HC[2]) * k); huv.push(z > 0 ? [0.5 + 0.5 * x, 0.5 + 0.5 * y] : [0, 0]); hcol.push(mix(SKIN, HAIR, w)); }
  hd.computeVertexNormals(); put(hd, (x, y, z, i) => hcol[i], 0, (i, U) => U.set(huv[i], i * 2));
  const cb = new THREE.SphereGeometry(1, 8, 2, 0, Math.PI * 2, 0, Math.PI / 2), curls = [], qq = new THREE.Quaternion(), up = new V3(0, 1, 0), nn = new V3();
  cb.scale(2.4, 1.7, 2.4);
  const fib = (N, keep, at) => { for (let i = 0; i < N; i++) { const y = 1 - (2 * (i + 0.5)) / N, r = Math.sqrt(1 - y * y), t = i * 2.39996, x = r * Math.cos(t), z = r * Math.sin(t);
    if (!keep(x, y, z)) continue; const [p, n] = at(x, y, z), g = cb.clone(); g.applyQuaternion(qq.setFromUnitVectors(up, n)); g.translate(...p); curls.push(g); } };
  fib(330, (x, y, z) => y > hl(z) + 0.04, (x, y, z) => { const q = headAt(x, y, z, 0); return [q.map((v, i) => HC[i] + (v - HC[i]) * 1.03), nn.set(x / HR[0], y / HR[1], z / HR[2]).normalize()]; });
  put(ell(13, 12.5, 13, 0, 236.5, -1, 20, 14), HAIR);
  fib(120, (x, y) => y > -0.35, (x, y, z) => [[x * 13.4, 236.5 + y * 12.9, -1 + z * 13.4], nn.set(x, y, z)]);
  put(mergeGeometries(curls), HAIR);
  put(ell(3.6, 3.6, 3.6, 0, 251.5, -1, 12, 8), GOLD); put(ell(1.7, 1.7, 1.1, 0, 201.5, 29.3, 8, 6), [2.6, 2, 1.2, 1]);
  return mergeGeometries(P);
}

// Nét mặt Tôn tượng (512², nền trắng = giữ màu vàng), theo dáng dễ thương của tranh vẽ cũ: mày cong cao, mắt khép cong như đang
// mỉm cười, mũi nhỏ, môi cong, má ửng nhẹ. Khi giảng: mắt mở hờ, tròng đen lớn có điểm sáng, nhìn xuống hội chúng; miệng mở nhỏ, giữ nét cười.
// Tọa độ ảnh = (0,5 + x/2, 0,5 − y/2) trên mặt cầu đơn vị của đầu, khớp khối nặn trong headAt. st: { open: mở mắt, mouth: 0..1 }
export function buddhaFace(st = {}) {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 512, 512); g.scale(2, 2); g.lineCap = 'round';
    const L = (w, a, f) => { g.lineWidth = w; g.strokeStyle = `rgba(88,48,18,${a})`; g.beginPath(); f(); g.stroke(); }, PI = Math.PI;
    [-1, 1].forEach((s) => { const cx = 128 + 46 * s, b = g.createRadialGradient(cx + 13 * s, 177, 0, cx + 13 * s, 177, 18);
      b.addColorStop(0, 'rgba(236,124,92,.22)'); b.addColorStop(1, 'rgba(236,124,92,0)'); g.fillStyle = b; g.fillRect(0, 0, 256, 256);
      L(1.7, 0.45, () => g.arc(cx, 147, 24, 1.23 * PI, 1.77 * PI));
      if (st.open) { const eye = () => { g.moveTo(cx - 18, 145.5); g.quadraticCurveTo(cx, 135, cx + 18, 143.5); };
        g.save(); g.beginPath(); eye(); g.quadraticCurveTo(cx, 155, cx - 18, 145.5); g.clip();
        g.fillStyle = 'rgba(64,34,12,.9)'; g.beginPath(); g.arc(cx, 148.5, 7, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + 2.2, 146.4, 1.8, 0, 7); g.fill(); g.restore();
        L(2.4, 0.85, eye); L(1, 0.3, () => { g.moveTo(cx - 14, 148); g.quadraticCurveTo(cx, 155, cx + 15, 146); }); }
      else L(2.3, 0.8, () => g.arc(cx, 137, 16, 0.2 * PI, 0.8 * PI)); });
    L(1.3, 0.35, () => { g.moveTo(126, 170); g.quadraticCurveTo(122, 181, 128, 183); g.quadraticCurveTo(134, 181, 131, 178); });
    if (st.mouth > 0) { g.fillStyle = 'rgba(96,40,24,.6)'; g.beginPath(); g.ellipse(128, 201, 5 + 2 * st.mouth, 1 + 2.2 * st.mouth, 0, 0, 7); g.fill(); }
    L(1.9, 0.62, () => g.arc(128, 189, 14, 0.24 * PI, 0.76 * PI));
  });
}

// Tượng hoàn chỉnh: vàng PBR (ánh môi trường lấy từ bầu trời), da bóng hơn y; tự sáng nhẹ và viền sáng Fresnel vượt 1 trong HDR nên
// bloom tỏa quầng theo dáng tượng. arm(k): k = 0 ấn thiền định → 1 ấn thuyết pháp: cẳng tay phải xoay quanh khuỷu cho đứng gần thẳng
// trước vai, bàn tay xoay quanh cổ tay cho ngón hướng lên, lòng bàn tay hướng về chúng sanh, rồi các ngón chuyển sang dáng B (trên GPU).
// cheap (trình vẽ phần mềm): dùng vật liệu không chiếu sáng của three, tự tô khối bằng một đèn theo máy quay cộng viền sáng.
export function buildBuddha(cheap = false) {
  const V = (...a) => new THREE.Vector3(...a), E = V(...ELBOW), W = V(...WRIST), m3 = () => ({ value: new THREE.Matrix3() });
  const U = { uArm: m3(), uHand: m3(), uE: { value: E }, uW: { value: W }, uW2: { value: W.clone() }, uM: { value: 0 } }, o = { vertexColors: true, map: buddhaFace(), fog: false };
  const m = cheap ? new THREE.MeshBasicMaterial(o) : new THREE.MeshStandardMaterial({ ...o, metalness: 0.55, roughness: 0.4 });
  m.onBeforeCompile = (sh) => { Object.assign(sh.uniforms, U);
    sh.vertexShader = `attribute vec2 aK;attribute vec3 aB,aNB;uniform mat3 uArm,uHand;uniform vec3 uE,uW,uW2;uniform float uM;varying float vPol;varying vec3 vN;
vec3 nrm(vec3 n){return aK.y>1.5?uHand*normalize(mix(n,aNB,uM)):aK.y>.5?uArm*n:n;}\n` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal=nrm(objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPol=aK.x;vN=normalMatrix*nrm(normal);if(aK.y>1.5)transformed=uHand*(mix(transformed,aB,uM)-uW)+uW2;else if(aK.y>.5)transformed=uArm*(transformed-uE)+uE;');
    sh.fragmentShader = 'varying float vPol;varying vec3 vN;\n' + sh.fragmentShader
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=mix(.52,.3,vPol);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{float f=1.-abs(dot(normalize(vViewPosition),normal));totalEmissiveRadiance+=diffuseColor.rgb*(.15+1.2*f*f*f);}');
    if (cheap) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n{vec3 n=normalize(vN);diffuseColor.rgb*=.45+.75*max(dot(n,vec3(.3,.55,.78)),0.)+.9*pow(1.-abs(n.z),3.);}'); };
  const mesh = new THREE.Mesh(buddhaGeo(), m);
  // khung [hướng ngón tay, pháp tuyến lòng bàn tay, phía ngón cái]: từ dáng thiền định (ngón +x, lòng bàn tay ngửa +y)
  // sang dáng giảng (ngón hướng lên, hơi ngả ra ngoài; lòng bàn tay hướng ra trước, về phía hội chúng)
  const frame = (d, n) => { n.sub(d.clone().multiplyScalar(n.dot(d))).normalize(); return new THREE.Matrix4().makeBasis(d, n, d.clone().cross(n)); };
  const Q1 = new THREE.Quaternion().setFromUnitVectors(W.clone().sub(E).normalize(), V(0.2, 1, 0.48).normalize());
  const Q2 = new THREE.Quaternion().setFromRotationMatrix(frame(V(-0.12, 1, -0.06).normalize(), V(0.12, 0.1, 1)).multiply(frame(V(1, 0, 0), V(0, 1, 0)).transpose()));
  const q = new THREE.Quaternion(), I = new THREE.Quaternion(), M = new THREE.Matrix4(), set = (u, Q, k) => u.setFromMatrix4(M.makeRotationFromQuaternion(q.slerpQuaternions(I, Q, k)));
  return { mesh, arm: (k) => { set(U.uArm.value, Q1, k); set(U.uHand.value, Q2, k); U.uW2.value.copy(W).sub(E).applyMatrix3(U.uArm.value).add(E); U.uM.value = S3(0.3, 1, k); } };
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
export function faceTex({ closed = false, mood = 'tuoi', age = 'tre', shaved = false, fem = false, joy = false } = {}) {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
    const cx = 64, ey = 121, ink = 'rgba(58,38,30,0.92)';
    if (shaved) {
      const gr = g.createLinearGradient(0, 0, 0, 106); gr.addColorStop(0, 'rgba(70,74,92,0.34)'); gr.addColorStop(0.75, 'rgba(70,74,92,0.24)'); gr.addColorStop(1, 'rgba(70,74,92,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 106);
      const fh = g.createRadialGradient(cx, 106, 6, cx, 106, 30); fh.addColorStop(0, 'rgba(255,255,255,1)'); fh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = fh; g.fillRect(cx - 32, 74, 64, 44);
    }
    // má hồng
    [[-17, 139], [17, 139]].forEach(([dx, y]) => { const gr = g.createRadialGradient(cx + dx, y, 0, cx + dx, y, 10); gr.addColorStop(0, 'rgba(232,120,110,0.34)'); gr.addColorStop(1, 'rgba(232,120,110,0)'); g.fillStyle = gr; g.fillRect(cx + dx - 12, y - 12, 24, 24); });
    g.lineCap = 'round'; g.strokeStyle = age === 'cao' ? 'rgba(120,112,108,0.9)' : 'rgba(52,34,26,0.85)'; g.lineWidth = fem ? 1.5 : 2.2;
    const tilt = mood === 'hoa' ? 0.12 : mood === 'nghiem' ? -0.04 : 0.05;
    [[-1, cx - 12], [1, cx + 12]].forEach(([s, x]) => { g.beginPath(); g.moveTo(x - 6 * s - 0, 110 - tilt * 8 * 1); g.quadraticCurveTo(x, fem ? 104 : 106, x + 6 * s, 109 + tilt * 14); g.stroke(); });
    g.strokeStyle = ink; g.lineWidth = 2;
    [cx - 12, cx + 12].forEach((x) => {
      if (joy) { g.beginPath(); g.arc(x, ey + 2.5, 5.4, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }   // mắt cười cong lên
      else if (closed) { g.beginPath(); g.arc(x, ey - 3, 5.2, 0.14 * Math.PI, 0.86 * Math.PI); g.stroke(); }
      else { g.fillStyle = '#fbfbfb'; g.beginPath(); g.ellipse(x, ey, 5.2, mood === 'tuoi' ? 3.1 : 2.7, 0, 0, 6.3); g.fill(); g.fillStyle = 'rgba(44,28,22,1)'; g.beginPath(); g.arc(x, ey, 2.6, 0, 6.3); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 0.9, ey - 1, 0.8, 0, 6.3); g.fill(); g.beginPath(); g.arc(x, ey + 0.6, 5.4, 1.12 * Math.PI, 1.88 * Math.PI); g.stroke(); }
    });
    // nữ: mi mắt cong ở đuôi mắt (mở hay khép), môi hồng tô đầy
    if (fem) { g.strokeStyle = ink; g.lineWidth = 1.2; [-1, 1].forEach((s) => { const x = cx + 12 * s; [[3.2, 1], [5, 0.6]].forEach(([dx, k]) => { g.beginPath(); g.moveTo(x + dx * s, closed ? ey - 1.2 : ey - 2.6); g.lineTo(x + (dx + 2.2) * s, (closed ? ey + 1.6 : ey - 5) - k); g.stroke(); }); });
      g.fillStyle = 'rgba(214,96,98,0.72)'; g.beginPath(); g.ellipse(cx, mood === 'nghiem' ? 149.5 : 147, 5.6, 2.5, 0, 0, 6.3); g.fill(); }
    g.strokeStyle = 'rgba(120,70,56,0.45)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(cx - 1, 126); g.quadraticCurveTo(cx - 3.5, 137, cx, 139); g.quadraticCurveTo(cx + 3, 138.5, cx + 3, 136.5); g.stroke();
    g.strokeStyle = 'rgba(168,74,66,0.9)'; g.lineWidth = 2.2; g.beginPath();
    if (joy) { g.arc(cx, 142.5, 8.5, 0.15 * Math.PI, 0.85 * Math.PI); g.closePath(); g.fillStyle = 'rgba(176,72,66,0.55)'; g.fill(); }
    else if (mood === 'nghiem') { g.moveTo(cx - 5.5, 149); g.quadraticCurveTo(cx, 150.2, cx + 5.5, 149); } else g.arc(cx, mood === 'tuoi' ? 143.5 : 145, mood === 'tuoi' ? 7.5 : 6.2, 0.2 * Math.PI, 0.8 * Math.PI);
    g.stroke();
    if (age !== 'tre') { g.strokeStyle = `rgba(120,80,64,${age === 'cao' ? 0.32 : 0.16})`; g.lineWidth = 1.1; [[-1], [1]].forEach(([s]) => { g.beginPath(); g.moveTo(cx + s * 19, ey - 2); g.lineTo(cx + s * 23, ey - 4); g.moveTo(cx + s * 19, ey + 1); g.lineTo(cx + s * 23.5, ey + 2); g.moveTo(cx + s * 9.5, 141); g.quadraticCurveTo(cx + s * 11.5, 146, cx + s * 10, 151); g.stroke(); });
      if (age === 'cao') { g.beginPath(); g.moveTo(cx - 12, 99); g.quadraticCurveTo(cx, 97, cx + 12, 99); g.stroke(); } }
  });
}

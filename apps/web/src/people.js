import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { faceTex, rng, sweep, UNI } from './gfx.js';

export const S = 1.9; // mét → đơn vị cảnh

export const OPTIONS = {
  skin: [['Sáng', '#f3d3b6'], ['Ngà', '#e8c19c'], ['Mật', '#d4a67c'], ['Nâu', '#b07f58'], ['Sẫm', '#80573a']],
  robe: [['Lam', '#8a94a8'], ['Khói', '#b9bcc4'], ['Nâu', '#8d6548'], ['Ngà', '#e9e2d0'], ['Chàm', '#4f5d86'], ['Rêu', '#75805a']],
  trim: [['Tự phối', null], ['Trầm', '#4a4038'], ['Vàng đất', '#b08a4a'], ['Trắng', '#f1ece0']],
  hairColor: [['Đen', '#1d1a1c'], ['Nâu', '#4a3426'], ['Muối tiêu', '#8b8a8c'], ['Bạc', '#dcdcde']],
  hair: [['cao', 'Cạo'], ['ngan', 'Ngắn'], ['buicao', 'Búi cao'], ['buithap', 'Búi thấp'], ['dai', 'Dài buộc']],
  build: [['thanh', 'Thanh mảnh'], ['vua', 'Cân đối'], ['day', 'Vững chãi']],
  age: [['tre', 'Thanh xuân'], ['trung', 'Trung niên'], ['cao', 'Cao niên']],
  mood: [['tuoi', 'Tươi tắn'], ['nghiem', 'Trang nghiêm'], ['hoa', 'Từ hòa']],
  acc: [['khong', 'Không'], ['hat', 'Tràng hạt'], ['khan', 'Khăn vai']],
};
export const PRESETS = [
  { name: 'Thanh đạm', note: 'áo lam, tóc gọn', look: { robe: 0, trim: 0, hair: 'ngan', acc: 'khong', mood: 'tuoi' } },
  { name: 'Mộc mạc', note: 'áo nâu, tràng hạt', look: { robe: 2, trim: 1, hair: 'buithap', acc: 'hat', mood: 'hoa' } },
  { name: 'Thanh khiết', note: 'áo ngà, khăn vai', look: { robe: 3, trim: 2, hair: 'buicao', acc: 'khan', mood: 'tuoi' } },
  { name: 'Trầm tĩnh', note: 'áo chàm, đầu cạo', look: { robe: 4, trim: 3, hair: 'cao', acc: 'hat', mood: 'nghiem' } },
  { name: 'An hòa', note: 'áo rêu, tóc dài buộc', look: { robe: 5, trim: 2, hair: 'dai', acc: 'khong', mood: 'hoa' } },
];
export const defaultLook = () => ({ skin: 1, robe: 0, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong' });

const Y = new THREE.Vector3(0, 1, 0);
let AJ = false;   // true: dựng tư thế ngồi chắp tay (dùng cho hội chúng khi nghe Pháp)
let DET = 1; const dn = (n, min) => Math.max(min, Math.round(n * DET));
const sph = (rx, ry, rz, x, y, z, ws = 14, hs = 10) => { const g = new THREE.SphereGeometry(1, dn(ws, 6), dn(hs, 4)); g.scale(rx, ry, rz); g.translate(x, y, z); return g; };
const blankUV = (g) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.9, 0.08); return g; };
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Chuẩn hóa để gộp: không chỉ số, luôn có uv và aK = (gió, thở) — vertex shader dùng aK để lay gấu áo, phồng ngực khi thở
const norm = (g) => { g = g.index ? g.toNonIndexed() : g; const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g.attributes.aK) g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); return g; };
const merge = (list) => mergeGeometries(list.filter(Boolean).map(norm));
// Ghi trọng số gió w và thở b (hằng số hoặc hàm theo vị trí) cho mọi đỉnh
const K = (g, w, b) => { g = norm(g); const p = g.attributes.position, a = g.attributes.aK, f = (v, i) => (typeof v === 'function' ? v(p.getX(i), p.getY(i), p.getZ(i)) : v); for (let i = 0; i < p.count; i++) a.setXY(i, f(w, i), f(b, i)); return g; };
// Thân áo tiện tròn (đường nối ở sau lưng) rồi ép dẹt; fold(y) là biên độ nếp vải dọc theo chiều cao
const lathe = (pts, seg, sx, sz, fold) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), dn(seg, 8), Math.PI), p = g.attributes.position;
  if (fold) for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = 1 + fold(y) * Math.sin(Math.atan2(x, z) * 9 + y * 3); p.setXYZ(i, x * f, y, z * f); }
  g.scale(sx, 1, sz); g.computeVertexNormals(); return g; };
const prof = (P, y) => { for (let i = 1; i < P.length; i++) if (y <= P[i][1]) { const [r0, y0] = P[i - 1], [r1, y1] = P[i]; return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); } return P[P.length - 1][0]; };
// Dải vải (cổ áo giao lĩnh, dải đai, khăn vai): ống quét ép dẹt theo hướng pháp tuyến thân người, bản rộng 2w
const ribbon = (pts, w, k) => sweep(pts, dn(pts.length * 5, 6), dn(6, 4), (t, d, P) => { const h = Math.hypot(P.x, P.z) || 1; return w * (1 - 0.86 * Math.abs((d.x * P.x + d.z * P.z) / h)); }, k);
// Mặt: hình cầu nặn lại — cằm thon, sống mũi, gờ mày, hốc mắt nông — khớp vị trí nét vẽ trên faceTex (u = 0,25 nhìn về +z)
function head(hc) {
  const g = sph(0.108, 0.123, 0.114, 0, 0, 0, 32, 24), p = g.attributes.position, G = (u, v) => Math.exp(-u * u - v * v);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = x / 0.108, ny = y / 0.123, f = z > 0 ? 1 : 0;
    const kx = 1 - 0.14 * sm(-0.05, -0.95, ny), kz = 1 + f * (0.075 * G(nx / 0.13, (ny + 0.02) / 0.1) + 0.035 * G(nx / 0.45, (ny - 0.2) / 0.08) - 0.025 * G((Math.abs(nx) - 0.29) / 0.12, (ny - 0.085) / 0.07) + 0.02 * G(nx / 0.2, (ny + 0.62) / 0.12)) - (1 - f) * 0.04 * sm(-0.2, -0.9, ny);
    p.setXYZ(i, x * kx, y, z * kz); }
  g.computeVertexNormals(); g.translate(...hc); return g;
}

// Các khối của một người theo tư thế: 'sit' (tọa thiền), 'stand' (đứng, tay chắp trước bụng), 'anjali' (đứng chắp tay).
// Đơn vị mét; đỉnh đầu ≈ 1,73 khi đứng. Mọi khối quét/tiện liền mạch nên không còn khớp cầu lộ ra ở vai, khuỷu.
const TP = [[0.17, 0.98], [0.18, 1.06], [0.205, 1.18], [0.228, 1.29], [0.232, 1.35], [0.215, 1.395], [0.16, 1.432], [0.09, 1.457], [0.054, 1.472]];
function parts(pose, bw) {
  const cloth = [], trim = [], skin = [], sit = pose === 'sit', dy = sit ? -0.81 : 0, zs = 0.66, P = (sit ? [[0.205, 0.95]] : []).concat(TP).map(([r, y]) => [r, y + dy]);
  const hc = [0, 1.61 + dy, 0], neckY = 1.47 + dy, waistY = 1.03 + dy, shY = 1.4 + dy;
  const surf = (a, y, off = 0) => { const R = prof(P, y) + off; return [Math.sin(a) * R * bw, y, Math.cos(a) * R * zs]; };
  cloth.push(K(lathe(P, 24, bw, zs), 0, (x, y) => sm(waistY, waistY + 0.12, y) * (1 - sm(shY - 0.04, shY + 0.04, y))));
  if (sit) {   // vạt áo phủ lòng và hai gối khi ngồi kiết già
    const lap = lathe([[0.02, 0.22], [0.17, 0.215], [0.3, 0.18], [0.385, 0.115], [0.402, 0.055], [0.375, 0.012], [0.29, 0]], 30, bw, 0.8, (y) => 0.05 * sm(0.18, 0.02, y)); lap.translate(0, 0, 0.06);
    cloth.push(K(lap, (x, y) => 0.35 * sm(0.1, 0, y), 0));
    [-1, 1].forEach((s) => cloth.push(sph(0.15, 0.095, 0.17, s * 0.25 * bw, 0.105, 0.11)));
  } else {     // vạt áo dài tới mắt cá, loe dần, nếp dọc rõ dần về phía gấu; gấu áo lay theo gió và theo bước chân
    cloth.push(K(lathe([[0.172, 1.03], [0.19, 0.9], [0.222, 0.7], [0.258, 0.45], [0.29, 0.22], [0.308, 0.07], [0.312, 0.026], [0.29, 0.012]], 28, bw, 0.86, (y) => 0.05 * sm(0.95, 0.25, y)), (x, y) => sm(0.8, 0.05, y), 0));
    [-1, 1].forEach((s) => trim.push(sph(0.045, 0.026, 0.085, s * 0.085, 0.022, 0.15)));
  }
  [-1, 1].forEach((s) => {   // tay áo rộng: thuôn ở vai, loe ở cổ tay, phần dưới cẳng tay rủ thành túi vải
    const A = [s * 0.19 * bw, shY - 0.02, 0], [E, C, H] = sit ? [[s * 0.25 * bw, 0.36, 0.05], AJ ? [s * 0.06, 0.46, 0.18] : [s * 0.09, 0.235, 0.205], AJ ? sph(0.022, 0.065, 0.04, s * 0.017, 0.535, 0.215) : sph(0.055, 0.026, 0.045, s * 0.022, 0.205, 0.245)]
      : pose === 'anjali' ? [[s * 0.225 * bw, 1.17, 0.07], [s * 0.06, 1.27, 0.18], sph(0.022, 0.07, 0.042, s * 0.017, 1.345, 0.215)] : [[s * 0.24 * bw, 1.14, 0.045], [s * 0.085, 1.015, 0.19], sph(0.055, 0.03, 0.05, s * 0.024, 1.0, 0.215)];
    cloth.push(sweep([A, E, C], dn(16, 6), dn(12, 6), (t, d) => (0.05 + 0.014 * sm(0, 0.5, t) + 0.045 * sm(0.45, 1, t)) * (d.y < 0 ? 1 + 1.1 * sm(0.35, 1, t) * -d.y : 1), (t) => [0.9 * sm(0.4, 1, t), 0]), sph(0.056, 0.05, 0.058, A[0] * 0.96, A[1] + 0.004, 0));
    skin.push(blankUV(H), blankUV(sph(0.02, 0.036, 0.013, s * 0.106, hc[1] - 0.005, -0.005, 8, 6)));
  });
  // cổ áo giao lĩnh: vạt phải phủ chéo qua vạt trái tới hông, viền cổ ôm sau gáy
  trim.push(ribbon([surf(1.25, neckY - 0.004, 0.004), surf(0.8, neckY - 0.035, 0.007), surf(0.3, neckY - 0.15, 0.009), surf(-0.22, neckY - 0.3, 0.009), surf(-0.45, waistY + 0.04, 0.009)], 0.021),
    ribbon([surf(-1.25, neckY - 0.004, 0.004), surf(-0.8, neckY - 0.035, 0.006), surf(-0.3, neckY - 0.14, 0.006)], 0.021),
    ribbon([surf(1.25, neckY - 0.004, 0.004), surf(2.2, neckY - 0.01, 0.004), surf(Math.PI, neckY - 0.012, 0.004), surf(-2.2, neckY - 0.01, 0.004), surf(-1.25, neckY - 0.004, 0.004)], 0.018));
  // đai lưng bản rộng; khi đứng có hai dải buông trước hông, lay theo gió
  const R = prof(P, waistY), sash = new THREE.TorusGeometry(1, 0.1, dn(8, 4), dn(32, 10)); sash.rotateX(Math.PI / 2); sash.scale(R * bw * 1.05, 0.3, R * zs * 1.1); sash.translate(0, waistY, 0); trim.push(sash);
  if (!sit) [0, 0.05].forEach((o, i) => { const q = surf(-0.42 + o * 2, waistY - 0.02, 0.03); trim.push(ribbon([q, [q[0] + o, q[1] - 0.15, q[2] + 0.025], [q[0] + o * 2, q[1] - 0.34 + i * 0.06, q[2] + 0.03]], 0.022, (t) => [sm(0, 1, t), 0])); });
  skin.push(blankUV(sweep([[0, neckY - 0.05, 0], [0, neckY + 0.08, 0.004]], 3, dn(12, 6), () => 0.047)), head(hc));
  return { cloth, trim, skin, hc, neckY, waistY, shY, surf };
}

// Tóc: chỏm cầu ôm đầu, đỉnh có vệt chải; dưới chân tóc (cao ở trán, thấp dần về sau gáy) thì thu vào trong đầu nên viền tóc tự nhiên
function hairGeo(style, hc) {
  if (style === 'cao') return null;
  const cap = sph(0.117, 0.132, 0.122, 0, 0, 0, 28, 18), p = cap.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ny = y / 0.132, a = Math.abs(Math.atan2(x, z)), h = 0.32 - 0.6 * sm(0, 1.6, a) - 0.3 * sm(1.6, 3.14, a);
    const k = ny < h - 0.05 ? 0.9 : (0.92 + 0.08 * sm(h - 0.05, h + 0.06, ny)) * (1 + 0.018 * Math.sin(Math.atan2(x, z) * 16 + ny * 4) * sm(h, h + 0.4, ny)); p.setXYZ(i, x * k, y * k, z * k); }
  cap.computeVertexNormals(); const list = [cap], ring = (x, y, z, r) => { const t = new THREE.TorusGeometry(r, 0.008, 5, 16); t.rotateX(Math.PI / 2 - 0.5); t.translate(x, y, z); return t; };
  if (style === 'buicao') list.push(sph(0.055, 0.05, 0.055, 0, 0.13, -0.04), ring(0, 0.1, -0.035, 0.035));
  if (style === 'buithap') list.push(sph(0.055, 0.048, 0.05, 0, -0.04, -0.13), ring(0, -0.035, -0.105, 0.034));
  if (style === 'dai') list.push(K(sweep([[0, -0.02, -0.112], [0, -0.16, -0.14], [0, -0.33, -0.13]], dn(10, 5), dn(8, 5), (t) => 0.045 - 0.025 * t, (t) => [0.8 * t, 0]), (x, y) => 0.8 * sm(-0.05, -0.33, y), 0), ring(0, -0.035, -0.115, 0.03));
  const g = merge(list); g.translate(hc[0], hc[1], hc[2]); return g;
}

// Phụ kiện: tràng hạt 26 hạt rủ trước ngực (hạt mẫu lớn ở giữa), khăn vai vắt chéo trước và sau
function accGeo(kind, p) {
  if (kind === 'hat') { const L = []; for (let i = 0; i < 26; i++) { const a = (i / 26) * 2 * Math.PI - Math.PI, f = (Math.cos(a) + 1) / 2, r = i === 13 ? 0.02 : 0.012; L.push(sph(r, r, r, ...p.surf(a, p.neckY - 0.012 - 0.2 * f * f, 0.016 + 0.01 * f), 6, 4)); } return merge(L); }
  if (kind === 'khan') { const s = p.surf, w = (t) => [0.3 * t, 0]; return merge([ribbon([s(-1.15, p.shY + 0.03, 0.02), s(-0.55, p.shY - 0.08, 0.02), s(0.05, p.waistY + 0.2, 0.02), s(0.55, p.waistY + 0.06, 0.02)], 0.04, w),
    ribbon([s(-1.15, p.shY + 0.03, 0.02), s(-2, p.shY - 0.08, 0.02), s(3, p.waistY + 0.2, 0.02), s(2.4, p.waistY + 0.06, 0.02)], 0.04, w)]); }
  return null;
}

const BW = { thanh: 0.92, vua: 1, day: 1.1 };
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
const paint = (list, c) => list.filter(Boolean).map((g) => { g = norm(g); const n = g.attributes.position.count, a = new Float32Array(n * 3), k = new THREE.Color(c); for (let i = 0; i < n; i++) k.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });

// Vật liệu nhân vật (dùng cho cả hội chúng). kind 1 vải · 2 da · 3 tóc. Trên GPU, không tốn CPU:
// thở 4 giây (ngực phồng theo aK.y, mỗi người lệch pha), gió lay gấu áo/tay áo/dải đai (aK.x), gấu áo đưa theo bước kinh hành
// (uWalk pha bước, uWalkA biên độ), cúi lạy quanh hông (uBow, uHinge); viền sáng Fresnel ấm để nổi trên mây sáng lẫn trời đêm;
// vải có vân dệt mịn (mờ dần ở xa để không gợn), da có ánh ấm như tán xạ dưới da.
function figMat(m, U, kind) {
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U, { uT: UNI.uTime });
    sh.vertexShader = 'attribute vec2 aK; uniform float uT, uWalk, uWalkA, uBow, uHinge; varying vec3 vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
 vOp = position; float ph = 0.;
#ifdef USE_INSTANCING
 ph = instanceMatrix[3].x*.37 + instanceMatrix[3].z*.21;
#endif
 float br = sin(uT*1.5708 + ph), wd = aK.x*(.55 + .45*sin(uT*.6 + ph + position.y*2.));
 transformed.xz *= 1. + .022*aK.y*br; transformed.y += .005*aK.y*br;
 transformed.x += sin(uT*1.9 + position.y*7. + ph)*.012*wd + aK.x*uWalkA*.022*sin(uWalk);
 transformed.z += cos(uT*1.3 + position.x*6. + ph)*.009*wd + aK.x*uWalkA*.05*max(0., sin(uWalk + step(0., position.x)*3.1416));
 if (transformed.y > uHinge) { float cb = cos(uBow), sb = sin(uBow); vec3 q = transformed - vec3(0., uHinge, .04); transformed = vec3(q.x, q.y*cb - q.z*sb, q.y*sb + q.z*cb) + vec3(0., uHinge, .04); }`);
    sh.fragmentShader = 'varying vec3 vOp;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + (kind === 1 ? ' float wv = sin(vOp.x*700. + vOp.z*700.)*sin(vOp.y*700.); diffuseColor.rgb *= 1. + .06*wv*clamp(1. - fwidth(vOp.y)*900., 0., 1.);' : ''))
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 float rimF = 1. - abs(dot(normalize(vViewPosition), normal)); totalEmissiveRadiance += vec3(1., .85, .62)*${kind === 2 ? '.16' : '.22'}*rimF*rimF*rimF;` + (kind === 2 ? ' totalEmissiveRadiance += diffuseColor.rgb*vec3(.13,.045,.03);' : ''));
  };
  m.customProgramCacheKey = () => 'fig' + kind;
  return m;
}

// Nhân vật của người dùng: ba tư thế dựng sẵn; áo, viền, tóc, phụ kiện gộp một lần vẽ (màu ở đỉnh), da một lần vẽ (gương mặt vẽ)
export function buildFigure(look) {
  const L = { ...defaultLook(), ...look }, bw = BW[L.build] || 1, robeHex = OPTIONS.robe[L.robe][1], trimHex = OPTIONS.trim[L.trim][1], trimC = trimHex ? new THREE.Color(trimHex) : shade(robeHex, 0.62);
  const U = { uBow: { value: 0 }, uHinge: { value: 1 }, uWalk: { value: 0 }, uWalkA: { value: 0 } };
  const mats = { cloth: figMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide }), U, 1), skin: figMat(new THREE.MeshStandardMaterial({ color: OPTIONS.skin[L.skin][1], roughness: 0.62 }), U, 2) };
  const fOpt = { mood: L.mood, age: L.age, shaved: L.hair === 'cao' }, faces = { open: faceTex({ ...fOpt, closed: false }), closed: faceTex({ ...fOpt, closed: true }) };
  mats.skin.map = faces.open;
  const group = new THREE.Group(), poses = {};
  ['stand', 'anjali', 'sit'].forEach((pose) => {
    const p = parts(pose, bw), g = new THREE.Group();
    const add = (geo, m) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; g.add(mesh); };
    add(merge([...paint(p.cloth, robeHex), ...paint(p.trim, trimC), ...paint([hairGeo(L.hair, p.hc)], OPTIONS.hairColor[L.hairColor][1]), ...paint([accGeo(L.acc, p)], L.acc === 'hat' ? '#5a3b28' : trimC)]), mats.cloth);
    add(merge(p.skin), mats.skin);
    g.visible = pose === 'stand'; poses[pose] = g; group.add(g);
  });
  group.scale.setScalar(S * (L.height || 1));
  return {
    group, poses, mats, pose: 'stand',
    setPose(p) { this.pose = p; U.uHinge.value = p === 'sit' ? 0.2 : 1; Object.keys(poses).forEach((k) => (poses[k].visible = k === p)); this.eyes(p === 'sit'); },
    eyes(closed) { mats.skin.map = closed ? faces.closed : faces.open; },
    // kinh hành: pha bước (theo nhịp nhún của world.js) và biên độ 0..1 → gấu áo đưa trước theo từng chân
    walk(phase, amt) { U.uWalk.value = phase; U.uWalkA.value = amt; },
    // cúi lạy (radian) quanh hông, như hội chúng
    bow(v) { U.uBow.value = v; },
    dispose() { group.traverse((o) => o.geometry && o.geometry.dispose()); Object.values(mats).forEach((m) => m.dispose()); faces.open.dispose(); faces.closed.dispose(); },
  };
}

// Đám đông: vài InstancedMesh dùng chung hình tọa thiền; màu áo, da, tóc theo từng người
let crowdCache = null;
function crowdGeos() {
  if (crowdCache) return crowdCache;
  DET = 0.38; const p = parts('sit', 1);
  const col = (g, v) => { const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(v); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const cloth = mergeGeometries([col(merge(p.cloth), 1), col(merge(p.trim), 0.62)]);
  AJ = true; const pa = parts('sit', 1); AJ = false;
  const out = { cloth, skin: merge(p.skin), clothA: mergeGeometries([col(merge(pa.cloth), 1), col(merge(pa.trim), 0.62)]), skinA: merge(pa.skin), cap: hairGeo('ngan', p.hc), bun: hairGeo('buicao', p.hc) }; DET = 1; return (crowdCache = out);
}
// Hình rút gọn cho người ở xa (LOD): áo, da, tóc gộp một khối, màu lấy theo thuộc tính aPart
// (0 áo · 2 da · 3 tóc) và màu riêng từng người (aRobe, aSkin, aHair) → mỗi mức chỉ một lần vẽ, không texture.
// Mức 1 (vừa) ≈ 216 tam giác, giữ dáng tay theo tư thế; mức 2 (xa) ≈ 48 tam giác, chỉ còn bóng dáng.
function lodBody(level, aj) {
  const L = [];
  const add = (g, k) => { const o = g.index ? g.toNonIndexed() : g; o.deleteAttribute('uv'); o.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(o.attributes.position.count).fill(k), 1)); L.push(o); };
  const ball = (rx, ry, rz, x, y, z, ws, hs, k) => { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); g.translate(x, y, z); add(g, k); };
  const tube = (a, b, ra, rb, k) => { const va = new THREE.Vector3(...a), dv = new THREE.Vector3(...b).sub(va), len = dv.length(), g = new THREE.CylinderGeometry(rb, ra, len, 4, 1, true); g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dv.normalize())); g.translate(va.x, va.y, va.z); add(g, k); };
  const lathe = (pts, seg, sz) => { const g = new THREE.LatheGeometry(pts.map(([rr, y]) => new THREE.Vector2(rr, y)), seg); g.scale(1, 1, sz); add(g, 0); };
  if (level === 1) {
    ball(0.40, 0.12, 0.32, 0, 0.115, 0.06, 7, 4, 0);
    lathe([[0.21, 0.16], [0.226, 0.45], [0.2, 0.58], [0.1, 0.645], [0.04, 0.665]], 7, 0.68);
    [-1, 1].forEach((s) => { const el = [s * 0.25, 0.36, 0.05]; tube([s * 0.215, 0.59, 0], el, 0.062, 0.056, 0); tube(el, aj ? [s * 0.04, 0.5, 0.2] : [s * 0.075, 0.215, 0.22], 0.06, aj ? 0.07 : 0.086, 0); });
    ball(0.108, 0.123, 0.114, 0, 0.80, 0, 7, 5, 2);
    const cap = new THREE.SphereGeometry(1, 6, 3, 0, Math.PI * 2, 0, 1.62); cap.scale(0.1135, 0.129, 0.1195); cap.rotateX(-0.42); cap.translate(0, 0.80, 0); add(cap, 3);
  } else {
    lathe([[0.4, 0.0], [0.4, 0.13], [0.23, 0.28], [0.2, 0.55], [0.05, 0.665]], 4, 0.8);
    ball(0.11, 0.125, 0.115, 0, 0.8, 0, 4, 3, 2);
  }
  return mergeGeometries(L);
}
const BEND = '#include <begin_vertex>\n if (transformed.y > 0.2) { float a = uBow*1.0; float cb = cos(a), sb = sin(a); vec3 q = transformed - vec3(0.,0.2,0.04); transformed = vec3(q.x, q.y*cb - q.z*sb, q.y*sb + q.z*cb) + vec3(0.,0.2,0.04); }';
let lodCache = null;
const lodGeos = () => lodCache || (lodCache = { mid: lodBody(1, false), midA: lodBody(1, true), far: lodBody(2, false) });
// Ngưỡng khoảng cách theo mức chất lượng 0/1/2: dưới `near` vẽ đầy đủ, dưới `mid` vẽ mức vừa, xa hơn vẽ mức xa
export const CROWD_LOD = [{ near: 30, mid: 130 }, { near: 45, mid: 170 }, { near: 60, mid: 220 }];

const ROBES = ['#8a94a8', '#8a94a8', '#b9bcc4', '#8d6548', '#e9e2d0', '#4f5d86', '#75805a', '#9aa3b5'];
export function makeCrowd(list, seed = 3) {
  const G = crowdGeos(), LG = lodGeos(), r = rng(seed), n = list.length, d = new THREE.Object3D(), c = new THREE.Color(), group = new THREE.Group();
  const cloth = new THREE.InstancedMesh(G.cloth, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), n);
  const skin = new THREE.InstancedMesh(G.skin, new THREE.MeshStandardMaterial({ map: faceTex({ closed: true, mood: 'hoa' }), roughness: 0.75 }), n);
  const hairOf = new Int8Array(n), mats = [], robe = new Float32Array(n * 3), skinC = new Float32Array(n * 3), hairC = new Float32Array(n * 3), pos = [];
  list.forEach((p, i) => {
    d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.rot || 0, 0); d.scale.setScalar(S * (p.sc || 1) * (0.95 + r() * 0.1)); d.updateMatrix(); mats.push(d.matrix.clone()); pos.push(new THREE.Vector3(p.x, p.y + 0.8 * S, p.z));
    c.set(p.robe || ROBES[Math.floor(r() * ROBES.length)]).toArray(robe, i * 3); c.set(OPTIONS.skin[Math.floor(r() * 5)][1]).toArray(skinC, i * 3);
    const h = r(); hairOf[i] = h > 0.34 ? (h > 0.74 ? 2 : 1) : 0;
  });
  // màu tóc rút theo đúng thứ tự cũ (hết tóc ngắn rồi tới búi) để giữ nguyên diện mạo hội chúng
  for (let i = 0; i < n * 3; i++) hairC[i] = skinC[i];
  [1, 2].forEach((kind) => { for (let i = 0; i < n; i++) if (hairOf[i] === kind) c.set(OPTIONS.hairColor[r() < 0.6 ? 0 : Math.floor(r() * 4)][1]).toArray(hairC, i * 3); });
  const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const caps = new THREE.InstancedMesh(G.cap, hairMat, n), buns = new THREE.InstancedMesh(G.bun, hairMat, n);
  // cúi lạy: phần thân trên gập về trước quanh hông; chắp tay: đổi sang bộ hình ngồi chắp tay
  const bow = { value: 0 }, CU = { uBow: bow, uHinge: { value: 0.2 }, uWalk: { value: 0 }, uWalkA: { value: 0 } };   // cả hội chúng thở lệch nhịp, gấu áo lay, viền sáng như nhân vật chính
  [cloth.material, skin.material, hairMat].forEach((m, i) => figMat(m, CU, i + 1));
  const lodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  lodMat.onBeforeCompile = (sh) => {
    sh.uniforms.uBow = bow;
    sh.vertexShader = 'uniform float uBow;\nattribute float aPart;\nattribute vec3 aRobe;\nattribute vec3 aSkin;\nattribute vec3 aHair;\n' + sh.vertexShader.replace('#include <begin_vertex>', BEND)
      .replace('#include <color_vertex>', '#include <color_vertex>\n vColor.rgb = aPart < 0.5 ? aRobe : aPart < 2.5 ? aSkin : aHair;');
  };
  // mỗi mức có hình riêng (bản sao để gắn thuộc tính màu theo từng người), dùng chung thuộc tính màu cho cả hình ngồi thường lẫn chắp tay
  const lodMesh = (geos) => {
    const attrs = ['aRobe', 'aSkin', 'aHair'].map((k) => [k, new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3)]);
    const gs = geos.map((g) => { const o = g.clone(); attrs.forEach(([k, a]) => o.setAttribute(k, a)); return o; });
    const m = new THREE.InstancedMesh(gs[0], lodMat, n); m.userData.geos = gs; m.userData.attrs = attrs.map((a) => a[1]); return m;
  };
  const mid = lodMesh([LG.mid, LG.midA]), far = lodMesh([LG.far, LG.far]);
  const nearSet = [cloth, skin, caps, buns], all = [...nearSet, mid, far];
  nearSet.forEach((m) => m.setColorAt(0, c.set('#ffffff')));   // tạo sẵn màu từng người để shader không phải dựng lại khi có người lại gần
  all.forEach((m) => { m.count = 0; m.visible = false; group.add(m); });
  group.userData.bow = bow;
  group.userData.setAnjali = (on) => { if (group.userData.aj === on) return; group.userData.aj = on; cloth.geometry = on ? G.clothA : G.cloth; skin.geometry = on ? G.skinA : G.skin; [mid, far].forEach((m) => { m.geometry = m.userData.geos[on ? 1 : 0]; }); };
  // Chia hội chúng theo khoảng cách tới máy quay; có độ trễ 8% để người đứng sát ngưỡng không nhấp nháy giữa hai mức
  const lv = new Int8Array(n).fill(-1), wp = new THREE.Vector3(), last = new THREE.Vector3(1e9, 0, 0);
  let lastQ = -1;
  group.userData.lod = (cam, q = 2, force = false) => {
    if (!force && q === lastQ && cam.distanceToSquared(last) < 4) return false;
    last.copy(cam); lastQ = q; group.updateWorldMatrix(true, false);
    const T = CROWD_LOD[q] ?? CROWD_LOD[2]; let changed = force;
    for (let i = 0; i < n; i++) {
      const dd = wp.copy(pos[i]).applyMatrix4(group.matrixWorld).distanceTo(cam), cur = lv[i];
      const edge = (t, inside) => (inside ? t * 1.08 : t / 1.08);   // đang ở phía gần ngưỡng thì phải ra xa hơn 8% mới đổi
      const nv = dd < edge(T.near, cur === 0) ? 0 : dd < edge(T.mid, cur === 0 || cur === 1) ? 1 : 2;
      if (nv !== cur) { lv[i] = nv; changed = true; }
    }
    if (!changed) return false;
    const k = [0, 0, 0, 0, 0, 0];   // cloth, skin, caps, buns, mid, far
    for (let i = 0; i < n; i++) {
      if (lv[i] === 0) {
        cloth.setMatrixAt(k[0], mats[i]); cloth.setColorAt(k[0]++, c.fromArray(robe, i * 3));
        skin.setMatrixAt(k[1], mats[i]); skin.setColorAt(k[1]++, c.fromArray(skinC, i * 3));
        if (hairOf[i]) { const hm = hairOf[i] === 1 ? caps : buns, j = hairOf[i] === 1 ? k[2]++ : k[3]++; hm.setMatrixAt(j, mats[i]); hm.setColorAt(j, c.fromArray(hairC, i * 3)); }
      } else {
        const m = lv[i] === 1 ? mid : far, j = lv[i] === 1 ? k[4]++ : k[5]++, [aR, aS, aH] = m.userData.attrs;
        m.setMatrixAt(j, mats[i]); aR.array.set(robe.subarray(i * 3, i * 3 + 3), j * 3); aS.array.set(skinC.subarray(i * 3, i * 3 + 3), j * 3); aH.array.set(hairC.subarray(i * 3, i * 3 + 3), j * 3);
      }
    }
    all.forEach((m, idx) => {
      m.count = k[idx]; m.visible = m.count > 0; if (!m.visible) return;
      m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; (m.userData.attrs || []).forEach((a) => (a.needsUpdate = true));
      m.computeBoundingSphere(); m.boundingSphere.radius += 3;   // chừa chỗ cho động tác cúi lạy
    });
    return true;
  };
  group.userData.lodStats = () => ({ near: k0(lv, 0), mid: k0(lv, 1), far: k0(lv, 2) });
  group.userData.lod(new THREE.Vector3(0, 0, 0), 2, true);
  return group;
}
const k0 = (a, v) => { let s = 0; for (let i = 0; i < a.length; i++) if (a[i] === v) s++; return s; };

// ───────── Tịnh danh: luật nằm ở packages/shared (dùng chung client và máy chủ) ─────────
export { VOCAB, tidyName, checkName, suggestNames } from '@vandao/shared/tinh-danh.js';

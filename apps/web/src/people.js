import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { faceTex, rng, sweep, UNI, makeNoise } from './gfx.js';

export const S = 1.9; // mét → đơn vị cảnh

export const OPTIONS = {
  skin: [['Sáng', '#f3d3b6'], ['Ngà', '#e8c19c'], ['Mật', '#d4a67c'], ['Nâu', '#b07f58'], ['Sẫm', '#80573a']],
  robe: [['Lam', '#8a94a8'], ['Khói', '#b9bcc4'], ['Nâu', '#8d6548'], ['Ngà', '#e9e2d0'], ['Chàm', '#4f5d86'], ['Rêu', '#75805a']],
  trim: [['Tự phối', null], ['Trầm', '#4a4038'], ['Vàng đất', '#b08a4a'], ['Trắng', '#f1ece0']],
  hairColor: [['Đen', '#1d1a1c'], ['Nâu', '#4a3426'], ['Muối tiêu', '#8b8a8c'], ['Bạc', '#dcdcde']],
  hair: [['cao', 'Cạo'], ['ngan', 'Ngắn'], ['buicao', 'Búi cao'], ['buithap', 'Búi thấp'], ['dai', 'Dài buộc'], ['xoa', 'Xõa dài']],
  gender: [['nam', 'Nam'], ['nu', 'Nữ']],
  build: [['thanh', 'Thanh mảnh'], ['vua', 'Cân đối'], ['day', 'Vững chãi']],
  age: [['tre', 'Thanh xuân'], ['trung', 'Trung niên'], ['cao', 'Cao niên']],
  mood: [['tuoi', 'Tươi tắn'], ['nghiem', 'Trang nghiêm'], ['hoa', 'Từ hòa']],
  acc: [['khong', 'Không'], ['hat', 'Tràng hạt'], ['khan', 'Khăn vai']],
  pet: [['khong', 'Không'], ['meo', 'Mèo'], ['cho', 'Chó'], ['tho', 'Thỏ']],
  petv: { meo: [['0', 'Mướp'], ['1', 'Mun'], ['2', 'Tam thể']], cho: [['0', 'Vàng'], ['1', 'Shiba'], ['2', 'Bông']], tho: [['0', 'Trắng'], ['1', 'Nâu'], ['2', 'Tai cụp']] },
};
export const PRESETS = [
  { name: 'Thanh đạm', note: 'áo lam, tóc gọn', look: { robe: 0, trim: 0, hair: 'ngan', acc: 'khong', mood: 'tuoi' } },
  { name: 'Mộc mạc', note: 'áo nâu, tràng hạt', look: { robe: 2, trim: 1, hair: 'buithap', acc: 'hat', mood: 'hoa' } },
  { name: 'Thanh khiết', note: 'áo ngà, khăn vai', look: { robe: 3, trim: 2, hair: 'buicao', acc: 'khan', mood: 'tuoi' } },
  { name: 'Trầm tĩnh', note: 'áo chàm, đầu cạo', look: { robe: 4, trim: 3, hair: 'cao', acc: 'hat', mood: 'nghiem' } },
  { name: 'An hòa', note: 'áo rêu, tóc dài buộc', look: { robe: 5, trim: 2, hair: 'dai', acc: 'khong', mood: 'hoa' } },
];
export const defaultLook = () => ({ skin: 1, robe: 0, trim: 0, hairColor: 0, hair: 'ngan', build: 'vua', height: 1, age: 'tre', mood: 'tuoi', acc: 'khong', gender: 'nam', pet: 'khong', petv: '0' });

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
function head(hc, fem) {
  const g = sph(0.108, 0.123, 0.114, 0, 0, 0, 32, 24), p = g.attributes.position, G = (u, v) => Math.exp(-u * u - v * v);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = x / 0.108, ny = y / 0.123, f = z > 0 ? 1 : 0;
    const kx = 1 - (fem ? 0.2 : 0.14) * sm(-0.05, -0.95, ny), kz = 1 + f * ((fem ? 0.05 : 0.075) * G(nx / 0.13, (ny + 0.02) / 0.1) + 0.035 * G(nx / 0.45, (ny - 0.2) / 0.08) - 0.025 * G((Math.abs(nx) - 0.29) / 0.12, (ny - 0.085) / 0.07) + 0.02 * G(nx / 0.2, (ny + 0.62) / 0.12)) - (1 - f) * 0.04 * sm(-0.2, -0.9, ny);
    p.setXYZ(i, x * kx, y, z * kz); }
  g.computeVertexNormals(); g.translate(...hc); return g;
}

// Các khối của một người theo tư thế: 'sit' (tọa thiền), 'stand' (đứng, tay chắp trước bụng), 'anjali' (đứng chắp tay).
// Đơn vị mét; đỉnh đầu ≈ 1,73 khi đứng. Mọi khối quét/tiện liền mạch nên không còn khớp cầu lộ ra ở vai, khuỷu.
// Dáng nữ: eo thon, ngực, vai hẹp hơn, hông nở (TPF và vạt áo dưới); dáng nam giữ vai rộng (TP)
const TP = [[0.17, 0.98], [0.18, 1.06], [0.205, 1.18], [0.228, 1.29], [0.232, 1.35], [0.215, 1.395], [0.16, 1.432], [0.09, 1.457], [0.054, 1.472]],
  TPF = [[0.17, 0.98], [0.158, 1.07], [0.178, 1.16], [0.205, 1.25], [0.203, 1.32], [0.19, 1.375], [0.145, 1.425], [0.085, 1.452], [0.052, 1.468]];
function parts(pose, bw, fem = false) {
  const cloth = [], trim = [], skin = [], sit = pose === 'sit', dy = sit ? -0.81 : 0, zs = 0.66, P = (sit ? [[0.205, 0.95]] : []).concat(fem ? TPF : TP).map(([r, y]) => [r, y + dy]);
  const hc = [0, 1.61 + dy, 0], neckY = 1.47 + dy, waistY = 1.03 + dy, shY = 1.4 + dy;
  const surf = (a, y, off = 0) => { const R = prof(P, y) + off; return [Math.sin(a) * R * bw, y, Math.cos(a) * R * zs]; };
  const torso = lathe(P, 24, bw, zs);
  if (fem) { const tp = torso.attributes.position; for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i), nz = z / (Math.hypot(x, z) || 1); if (nz > 0) tp.setZ(i, z * (1 + 0.46 * nz * nz * Math.exp(-(((y - 1.255 - dy) / 0.05) ** 2)))); } torso.computeVertexNormals(); }
  cloth.push(K(torso, 0, (x, y) => sm(waistY, waistY + 0.12, y) * (1 - sm(shY - 0.04, shY + 0.04, y))));
  if (sit) {   // vạt áo phủ lòng và hai gối khi ngồi kiết già
    const lap = lathe([[0.02, 0.22], [0.17, 0.215], [0.3, 0.18], [0.385, 0.115], [0.402, 0.055], [0.375, 0.012], [0.29, 0]], 30, bw, 0.8, (y) => 0.05 * sm(0.18, 0.02, y)); lap.translate(0, 0, 0.06);
    cloth.push(K(lap, (x, y) => 0.35 * sm(0.1, 0, y), 0));
    [-1, 1].forEach((s) => cloth.push(sph(0.15, 0.095, 0.17, s * 0.25 * bw, 0.105, 0.11)));
  } else {     // vạt áo dài tới mắt cá, loe dần, nếp dọc rõ dần về phía gấu; gấu áo lay theo gió và theo bước chân
    cloth.push(K(lathe(fem ? [[0.16, 1.03], [0.214, 0.9], [0.232, 0.72], [0.255, 0.45], [0.282, 0.22], [0.298, 0.07], [0.302, 0.026], [0.282, 0.012]] : [[0.172, 1.03], [0.19, 0.9], [0.222, 0.7], [0.258, 0.45], [0.29, 0.22], [0.308, 0.07], [0.312, 0.026], [0.29, 0.012]], 28, bw, 0.86, (y) => 0.05 * sm(0.95, 0.25, y)), (x, y) => sm(0.8, 0.05, y), 0));
    [-1, 1].forEach((s) => trim.push(sph(fem ? 0.038 : 0.045, 0.026, 0.08, s * 0.085, 0.022, 0.215)));   // mũi giày lộ dưới gấu áo
  }
  [-1, 1].forEach((s) => {   // tay áo rộng: thuôn ở vai, loe ở cổ tay, phần dưới cẳng tay rủ thành túi vải
    const A = [s * (fem ? 0.172 : 0.19) * bw, shY - 0.02, 0], [E, C, H] = sit ? [[s * 0.25 * bw, 0.36, 0.05], AJ ? [s * 0.06, 0.46, 0.18] : [s * 0.09, 0.235, 0.205], AJ ? sph(0.022, 0.065, 0.04, s * 0.017, 0.535, 0.215) : sph(0.055, 0.026, 0.045, s * 0.022, 0.205, 0.245)]
      : pose === 'anjali' ? [[s * 0.225 * bw, 1.17, 0.07], [s * 0.06, 1.27, 0.18], sph(0.022, 0.07, 0.042, s * 0.017, 1.345, 0.215)] : [[s * 0.24 * bw, 1.14, 0.045], [s * 0.085, 1.015, 0.19], sph(0.055, 0.03, 0.05, s * 0.024, 1.0, 0.215)];
    cloth.push(sweep([A, E, C], dn(16, 6), dn(12, 6), (t, d) => (0.05 + 0.014 * sm(0, 0.5, t) + 0.045 * sm(0.45, 1, t)) * (d.y < 0 ? 1 + 1.1 * sm(0.35, 1, t) * -d.y : 1), (t) => [0.9 * sm(0.4, 1, t), 0]), sph(0.056, 0.05, 0.058, A[0] * 0.96, A[1] + 0.004, 0));
    skin.push(blankUV(H), blankUV(sph(0.02, 0.036, 0.013, s * 0.106, hc[1] - 0.005, -0.005, 8, 6)));
    // ngón tay: đứng thì bốn ngón mỗi bàn khum xuống trước bụng, chắp tay thì ngón thẳng lên
    if (!sit) for (let j = 0; j < 4; j++) { const o = (j - 1.5) * 0.013, aj = pose === 'anjali';
      skin.push(blankUV(sweep(aj ? [[s * 0.012, 1.375, 0.208 + o], [s * 0.01, 1.41 - Math.abs(o), 0.208 + o]] : [[s * 0.03 + o, 1.012, 0.24], [s * 0.03 + o, 0.99, 0.268], [s * 0.028 + o, 0.972, 0.262]], 4, 5, () => 0.0062))); }
  });
  // cổ áo giao lĩnh: vạt phải phủ chéo qua vạt trái tới hông, viền cổ ôm sau gáy
  trim.push(ribbon([surf(1.25, neckY - 0.004, 0.004), surf(0.8, neckY - 0.035, 0.007), surf(0.3, neckY - 0.15, 0.009), surf(-0.22, neckY - 0.3, 0.009), surf(-0.45, waistY + 0.04, 0.009)], 0.021),
    ribbon([surf(-1.25, neckY - 0.004, 0.004), surf(-0.8, neckY - 0.035, 0.006), surf(-0.3, neckY - 0.14, 0.006)], 0.021),
    ribbon([surf(1.25, neckY - 0.004, 0.004), surf(2.2, neckY - 0.01, 0.004), surf(Math.PI, neckY - 0.012, 0.004), surf(-2.2, neckY - 0.01, 0.004), surf(-1.25, neckY - 0.004, 0.004)], 0.018));
  // đai lưng bản rộng; khi đứng có hai dải buông trước hông, lay theo gió
  const R = prof(P, waistY), sash = new THREE.TorusGeometry(1, 0.1, dn(8, 4), dn(32, 10)); sash.rotateX(Math.PI / 2); sash.scale(R * bw * 1.05, 0.3, R * zs * 1.1); sash.translate(0, waistY, 0); trim.push(sash);
  if (!sit) [0, 0.05].forEach((o, i) => { const q = surf(-0.42 + o * 2, waistY - 0.02, 0.03); trim.push(ribbon([q, [q[0] + o, q[1] - 0.15, q[2] + 0.025], [q[0] + o * 2, q[1] - 0.34 + i * 0.06, q[2] + 0.03]], 0.022, (t) => [sm(0, 1, t), 0])); });
  skin.push(blankUV(sweep([[0, neckY - 0.05, 0], [0, neckY + 0.08, 0.004]], 3, dn(12, 6), () => 0.047)), head(hc, fem));
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
  if (style === 'xoa') list.push(K(sweep([[0, 0.03, -0.1], [0, -0.14, -0.135], [0, -0.36, -0.12], [0, -0.5, -0.1]], dn(12, 5), dn(10, 6), (t, d) => (0.12 - 0.04 * t) * (0.3 + 0.7 * Math.abs(d.x))), (x, y) => 0.6 * sm(-0.1, -0.5, y), 0), ...[-1, 1].map((s) => sweep([[s * 0.1, 0.02, 0.02], [s * 0.115, -0.1, 0.03], [s * 0.11, -0.22, 0.04]], dn(8, 4), dn(6, 4), (t) => 0.026 - 0.01 * t)));
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
  const L = { ...defaultLook(), ...look }, fem = L.gender === 'nu', bw = (BW[L.build] || 1) * (fem ? 1 : 1.04), robeHex = OPTIONS.robe[L.robe][1], trimHex = OPTIONS.trim[L.trim][1], trimC = trimHex ? new THREE.Color(trimHex) : shade(robeHex, 0.62);
  const U = { uBow: { value: 0 }, uHinge: { value: 1 }, uWalk: { value: 0 }, uWalkA: { value: 0 } };
  const mats = { cloth: figMat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, side: THREE.DoubleSide }), U, 1), skin: figMat(new THREE.MeshStandardMaterial({ color: OPTIONS.skin[L.skin][1], roughness: 0.62 }), U, 2) };
  const fOpt = { mood: L.mood, age: L.age, shaved: L.hair === 'cao', fem }, faces = { open: faceTex({ ...fOpt, closed: false }), closed: faceTex({ ...fOpt, closed: true }) };
  mats.skin.map = faces.open;
  const group = new THREE.Group(), poses = {};
  ['stand', 'anjali', 'sit'].forEach((pose) => {
    const p = parts(pose, bw, fem), g = new THREE.Group();
    const add = (geo, m) => { const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; g.add(mesh); };
    add(merge([...paint(p.cloth, robeHex), ...paint(p.trim, trimC), ...paint([hairGeo(L.hair, p.hc)], OPTIONS.hairColor[L.hairColor][1]), ...paint([accGeo(L.acc, p)], L.acc === 'hat' ? '#5a3b28' : trimC)]), mats.cloth);
    add(merge(p.skin), mats.skin);
    g.visible = pose === 'stand'; poses[pose] = g; group.add(g);
  });
  group.scale.setScalar(S * (L.height || 1) * (fem ? 0.96 : 1));
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

const C3 = new THREE.Color();

// ───────── Thú cưng đồng hành: mèo, chó, thỏ; mỗi loài ba bộ lông ─────────
// Dựng thủ tục từ khối mềm: thân, ngực, đầu có má, mõm, tai, mắt có ánh, mũi, bốn chân có bàn, đuôi. Lông tô theo đỉnh:
// mèo mướp vằn, mun ngực trắng, tam thể; chó vàng, shiba (má, ngực, bụng, chân trắng), chó bông xù tai cụp; thỏ trắng, nâu, tai cụp.
// Mỗi phần là một khối riêng quay quanh khớp (cổ, vai, hông, gốc đuôi), nên đi, nhảy, ngồi, vẫy đuôi, nghiêng đầu chỉ là vài phép quay.
// Lớn dần theo hành trình của chủ: grow 0..1 → 75 % … 100 % cỡ trưởng thành (phóng 1,3 lần cỡ thật cho dễ thấy giữa cỏ, dễ thương).
const PET = {   // h: chiều cao hông · b: bán kính thân (x, y, z) · n: gốc cổ · r: bán kính đầu · m: mõm · l: bán kính chân · w: nhịp bước
  meo: { h: 0.17, b: [0.068, 0.07, 0.16], n: [0, 0.25, 0.13], r: 0.062, m: [0.03, 0.022, 0.026], l: 0.021, w: 9 },
  cho: { h: 0.25, b: [0.095, 0.1, 0.2], n: [0, 0.36, 0.17], r: 0.078, m: [0.042, 0.036, 0.062], l: 0.029, w: 7 },
  tho: { h: 0.07, b: [0.088, 0.086, 0.115], n: [0, 0.17, 0.075], r: 0.058, m: [0.03, 0.024, 0.02], l: 0.02, w: 5 },
};
const FUR = {
  meo: [['#d98a3c', '#9c5428', '#f2d6ad'], ['#232126', '#232126', '#f4f0e8'], ['#f3efe7', '#d7863a', '#2b2727']],
  cho: [['#c99650', '#a87838', '#ecd6a8'], ['#c8692c', '#a8541f', '#f5ede1'], ['#f4f0e8', '#e6dccb', '#fbf8f2']],
  tho: [['#f4f2ee', '#e7e2dc', '#ffffff'], ['#8a6446', '#6d4c33', '#ecdfca'], ['#cac5c0', '#7b7572', '#f3f0ec']],
};
export function buildPet(kind, v = 0) {
  v = +v || 0;
  const Q = PET[kind], [c0, c1, c2] = FUR[kind][v].map((h) => new THREE.Color(h)), N = makeNoise(7 + v), cat = kind === 'meo', dog = kind === 'cho', rab = kind === 'tho';
  const flop = (dog && v === 2) || (rab && v === 2), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
  mat.onBeforeCompile = (sh) => {   // lông: hạt mịn theo vị trí, viền sáng mềm như lông tơ hứng sáng
    sh.vertexShader = 'varying vec3 vOp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOp=position;');
    sh.fragmentShader = 'varying vec3 vOp;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=.95+.1*fract(sin(dot(floor(vOp*700.),vec3(12.9,78.2,37.7)))*43758.5);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n{float f=1.-abs(dot(normalize(vViewPosition),normal));totalEmissiveRadiance+=diffuseColor.rgb*.5*f*f;}');
  };
  const E = (rx, ry, rz, x, y, z, w = 11, h = 8) => { const g = new THREE.SphereGeometry(1, w, h); g.scale(rx, ry, rz); g.translate(x, y, z); return g; };
  // tô lông theo vị trí trong hệ của thân (k = mã phần: 0 thân, 1 đầu, 2 tai, 3 chân, 4 đuôi, 5 mắt, 6 mũi, 7 lòng tai)
  const fur = (x, y, z, k) => {
    if (k === 5) return C3.set('#1b1411'); if (k === 6) return C3.set(dog ? '#2a2220' : '#e39aa0'); if (k === 7) return C3.set('#efb2b2'); if (k === 8) return C3.set('#ffffff');
    const n = N.fbm(x * 14 + 3, y * 14, z * 14, 2), belly = y < Q.h + Q.b[1] * (k === 1 ? -9 : 0.15) && k !== 4, c = C3.copy(c0);
    if (cat && v === 0 && k !== 3 && Math.sin(z * 70 + x * 40 * Math.sign(x) + n * 6) > 0.3 && !belly) c.copy(c1);
    if (cat && v === 2 && k !== 5) c.copy(n > 0.6 ? c1 : n < 0.37 ? c2 : c0);
    if ((cat && v < 2) || (dog && v === 1) || (rab && v === 1)) { if (belly || (k === 1 && y < Q.n[1] + Q.r * 0.6 && z > Q.n[2] + Q.r * 0.6) || (k === 3 && y < 0.04) || (k === 4 && dog && y > 0.1)) c.copy(c2); }
    if (dog && v === 0 && (belly || (k === 1 && z > Q.n[2] + Q.r))) c.copy(c2);
    if (rab && v === 2 && n > 0.58 && k < 3) c.copy(c1);
    return c.multiplyScalar(0.94 + 0.12 * n);
  };
  const tag = (list) => { // gộp các nhóm có mã phần khác nhau thành một khối (màu theo từng nhóm)
    const geos = [], col = []; list.forEach(([g, k]) => { g = norm(g); const p = g.attributes.position; for (let i = 0; i < p.count; i++) col.push(...fur(p.getX(i), p.getY(i), p.getZ(i), k).toArray()); geos.push(g); });
    const g = mergeGeometries(geos); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g; };
  const piv = (geo, px, py, pz) => { geo.translate(-px, -py, -pz); const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; return m; };
  const [bx, by, bz] = Q.b, h = Q.h, fz = bz * 0.62, root = new THREE.Group(), tor = new THREE.Group(), hy = h + by * 0.15;
  // thân (khối chính + ngực + mông), xoay quanh hông sau khi ngồi
  tor.position.set(0, hy, -fz); root.add(tor);
  const body = piv(tag([[E(bx, by, bz, 0, hy + by * 0.35, 0, 16, 10), 0], [E(bx * 0.95, by * 0.95, bz * 0.5, 0, hy + by * 0.45, bz * 0.55), 0], [E(bx * 1.02, by, bz * 0.48, 0, hy + by * 0.3, -bz * 0.55), 0]].concat(dog && v === 2 ? [[E(bx * 1.12, by * 1.1, bz * 0.8, 0, hy + by * 0.5, 0.02), 0]] : [])), 0, hy, -fz);
  tor.add(body); body.position.set(0, 0, 0);
  // đầu: hộp sọ, má, mõm, mũi, mắt có ánh, tai (lòng tai hồng); xoay quanh gốc cổ
  const [nx, ny, nz] = Q.n, r = Q.r, hc = [0, ny + r * 0.75, nz + r * 0.55], [mx, my, mz] = Q.m, ears = [];
  [-1, 1].forEach((s) => {
    if (rab) { const ear = E(0.02, 0.085, 0.009, 0, 0, 0, 10, 8); ear.translate(0, 0.075, 0); if (flop) { ear.rotateZ(s * 1.9); ear.translate(s * r * 0.75, hc[1] + r * 0.5, hc[2] - r * 0.1); } else { ear.rotateZ(-s * 0.12); ear.rotateX(-0.15); ear.translate(s * r * 0.4, hc[1] + r * 0.7, hc[2] - r * 0.2); } ears.push([ear, 0]); const inner = E(0.011, 0.065, 0.004, 0, 0, 0, 8, 6); inner.translate(0, 0.075, 0.006); if (flop) { inner.rotateZ(s * 1.9); inner.translate(s * r * 0.75, hc[1] + r * 0.5, hc[2] - r * 0.1); } else { inner.rotateZ(-s * 0.12); inner.rotateX(-0.15); inner.translate(s * r * 0.4, hc[1] + r * 0.7, hc[2] - r * 0.2); } ears.push([inner, 7]); }
    else if (flop) { const ear = E(0.03, 0.065, 0.018, s * r * 0.95, hc[1] - r * 0.15, hc[2] - r * 0.15); ears.push([ear, 2]); }
    else { const ear = new THREE.ConeGeometry(r * 0.48, r * (cat ? 0.85 : 0.95), 4); ear.scale(1, 1, 0.45); ear.rotateZ(-s * 0.32); ear.translate(s * r * 0.55, hc[1] + r * 0.92, hc[2] - r * 0.15); ears.push([ear, 2]);
      const inner = new THREE.ConeGeometry(r * 0.3, r * 0.6, 4); inner.scale(1, 1, 0.3); inner.rotateZ(-s * 0.32); inner.translate(s * r * 0.55, hc[1] + r * 0.86, hc[2] - r * 0.11); ears.push([inner, cat ? 7 : 2]); }
    ears.push([E(r * 0.2, r * 0.22, r * 0.12, s * r * 0.38, hc[1] + r * 0.12, hc[2] + r * 0.8, 10, 8), 5], [E(r * 0.06, r * 0.06, r * 0.04, s * r * 0.33, hc[1] + r * 0.2, hc[2] + r * 0.9, 6, 4), 8],
      [E(r * 0.42, r * 0.36, r * 0.4, s * r * 0.38, hc[1] - r * 0.22, hc[2] + r * 0.28), 1]);
  });
  const head = piv(tag([[E(r, r * 0.92, r * 0.95, ...hc, 16, 12), 1], [E(mx, my, mz, 0, hc[1] - r * 0.3, hc[2] + r * 0.72 + mz * 0.4), 1], [E(mx * 0.42, my * 0.36, mz * 0.3, 0, hc[1] - r * 0.12, hc[2] + r * 0.82 + mz * 1.1, 8, 6), 6],
    [E(r * 0.5, r * 0.75, r * 0.5, 0, ny + r * 0.1, nz - r * 0.1), 1]].concat(ears, dog && v === 2 ? [[E(r * 0.62, r * 0.5, r * 0.6, 0, hc[1] + r * 0.75, hc[2] - r * 0.1), 1]] : [])), nx, ny, nz);
  tor.add(head); head.position.sub(tor.position);
  // chân: ống thuôn xuống bàn; thỏ có bàn chân sau dài và đùi tròn
  const legs = [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([s, f]) => {
    const lx = s * bx * 0.62, lz = f * fz, top = f > 0 ? hy : h, len = rab && f < 0 ? h + 0.02 : top, l = Q.l, back = f < 0 && !rab;
    // vai/đùi liền thân, cẳng chân thuôn có khuỷu (chân trước) hoặc gót cong ra sau (chân sau), bàn chân tròn hướng trước
    const list = [[E(l * 1.8, len * (back ? 0.42 : 0.34), l * (back ? 2.6 : 1.9), 0, -len * 0.16, back ? -l * 0.4 : 0, 12, 8), 0],
      [sweep(back ? [[0, -len * 0.22, 0], [0, -len * 0.6, -l * 1.6], [0, -len + l, -l * 0.3]] : [[0, -len * 0.1, 0], [0, -len * 0.55, l * 0.3], [0, -len + l, l * 0.5]], 6, 8, (t) => l * (1.2 - 0.38 * t)), 3],
      [E(l * 1.25, l * 0.72, l * (rab && f < 0 ? 3.2 : 1.6), 0, -len + l * 0.6, l * (rab && f < 0 ? 1.6 : 1.1), 10, 6), 3]];
    if (rab && f < 0) list.push([E(bx * 0.45, by * 0.62, bz * 0.5, s * -0.01, -0.01, 0), 0]);
    if (dog && v === 2) list.push([E(Q.l * 1.7, len * 0.32, Q.l * 1.7, 0, -len * 0.35, 0), 3]);
    const m = piv(tag(list.map(([g, k]) => { g.translate(lx, top, lz); return [g, k]; })), lx, top, lz); if (f > 0) { tor.add(m); m.position.sub(tor.position); } else root.add(m); m.userData.f = f; m.userData.s = s; return m; });
  // đuôi: mèo dài cong dấu hỏi, chó vàng cong lưỡi liềm, shiba cuộn tròn trên lưng, chó bông và thỏ là cục bông
  const tb = [0, hy + by * 0.55, -bz * 0.95 - fz], tail = piv(tag(rab || (dog && v === 2) ? [[E(0.034, 0.032, 0.03, tb[0], tb[1], tb[2] - 0.02), 4]]
    : [[sweep((cat ? [[0, 0, 0], [0, 0.03, -0.12], [0, 0.16, -0.2], [0, 0.25, -0.15]] : v === 1 ? [[0, 0, 0], [0, 0.07, -0.03], [0, 0.12, 0.04], [0.02, 0.09, 0.1]] : [[0, 0, 0], [0, 0.07, -0.06], [0, 0.14, -0.06]]).map(([x, y, z]) => [tb[0] + x, tb[1] + y, tb[2] + z]), 10, 8, (t) => (cat ? 0.017 : 0.026) * (1.1 - 0.5 * t)), 4]]), ...tb);
  tor.add(tail); tail.position.sub(tor.position);
  const o = { pos: new THREE.Vector3(), yaw: 0, ph: 0, wa: 0, sit: 0, idle: 0, look: 0 };
  return {
    group: root, kind,
    // Mỗi khung: đi theo cạnh chủ (hơi lùi sau, bên phải), chạy khi bị bỏ xa, nhảy cóc nếu là thỏ; chủ ngồi thì ngồi cạnh; đứng lâu thì ngồi chờ,
    // nhìn chủ, vẫy đuôi (chó), đong đưa đuôi (mèo), giật tai (thỏ). P: vị trí chân chủ; rot: hướng chủ; sitting: chủ đang ngồi;
    // gy(x, z): độ cao mặt đất; grow: 0..1 tiến trình
    step(dt, t, P, rot, sitting, gy, grow) {
      const sc = S * 1.3 * (0.75 + 0.25 * Math.min(1, Math.max(0, grow))), fw = [Math.sin(rot), Math.cos(rot)], side = sitting ? 1.15 : 1.25, back = sitting ? -0.55 : 0.75;
      const tx = P.x + fw[1] * side - fw[0] * back, tz = P.z - fw[0] * side - fw[1] * back, dx = tx - o.pos.x, dz = tz - o.pos.z, d = Math.hypot(dx, dz);
      if (d > 30 || !o.init) { o.pos.set(tx, 0, tz); o.init = 1; }
      let sp = 0; if (d > 0.35) { sp = Math.min(5, 0.8 + d * 1.6); o.pos.x += (dx / d) * Math.min(d, sp * dt); o.pos.z += (dz / d) * Math.min(d, sp * dt); }
      const want = d > 0.35 ? Math.atan2(dx, dz) : rot, dy = Math.atan2(Math.sin(want - o.yaw), Math.cos(want - o.yaw)); o.yaw += dy * Math.min(1, dt * 6);
      o.wa += ((sp > 0 ? 1 : 0) - o.wa) * Math.min(1, dt * 6); o.ph += dt * Q.w * (0.4 + sp * 0.35); o.idle = sp > 0 ? 0 : o.idle + dt;
      o.sit += ((sitting || o.idle > 2.5 ? 1 : 0) * (1 - o.wa) - o.sit) * Math.min(1, dt * 3);
      const hop = rab ? Math.max(0, Math.sin(o.ph)) * 0.05 * o.wa : Math.abs(Math.sin(o.ph * 2)) * 0.008 * o.wa;
      root.position.set(o.pos.x, gy(o.pos.x, o.pos.z) + hop * sc, o.pos.z); root.rotation.y = o.yaw; root.scale.setScalar(sc);
      const st = rab ? 0 : o.sit; tor.rotation.x = -0.5 * st + (rab ? -0.25 * Math.sin(o.ph) * o.wa : 0); tor.position.y = hy - h * 0.38 * st; tor.scale.y = 1 + 0.015 * Math.sin(t * 3.2);
      legs.forEach((m) => { const { f, s } = m.userData, sw = rab ? Math.sin(o.ph + (f > 0 ? Math.PI : 0)) * (f > 0 ? 0.5 : 0.8) : Math.sin(o.ph + (f * s > 0 ? 0 : Math.PI)) * 0.6;
        m.rotation.x = sw * o.wa + (f > 0 ? 0.5 * st : -1.1 * st); m.scale.y = f > 0 ? 1 + 0.5 * st : 1; });   // ngồi: chân trước duỗi chạm đất
      const la = Math.atan2(P.x - o.pos.x, P.z - o.pos.z) - o.yaw; o.look += ((sp > 0 ? 0 : Math.max(-0.8, Math.min(0.8, Math.atan2(Math.sin(la), Math.cos(la))))) - o.look) * Math.min(1, dt * 2);
      head.rotation.set(0.12 * st + 0.04 * Math.sin(t * 0.9), o.look + 0.15 * Math.sin(t * 0.37) * (1 - o.wa), (cat ? 0.12 : 0.06) * Math.sin(t * 0.53));
      tail.rotation.set(cat ? 0.12 * Math.sin(t * 0.8) : 0, dog ? Math.sin(t * (sp > 0 || d < 2 ? 12 : 4)) * (v === 1 ? 0.25 : 0.5) : cat ? 0.4 * Math.sin(t * 1.3) : 0.2 * Math.sin(t * 7) * Math.max(0, Math.sin(t * 0.7)), 0);
    },
    dispose() { root.traverse((m) => m.geometry && m.geometry.dispose()); mat.dispose(); },
  };
}

// ───────── Tịnh danh: luật nằm ở packages/shared (dùng chung client và máy chủ) ─────────
export { VOCAB, tidyName, checkName, suggestNames } from '@vandao/shared/tinh-danh.js';

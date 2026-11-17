import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NOISE, OUT, UNI, rng, makeNoise, leafTex, tileTex, steleTex, tactile, hue, sweep } from './gfx.js';

export const SX = 34, SZ = 24, HILL = { x: -13, z: -7, h: 8, r: 8.5 }, POND = { x: -3, z: 9.3, rx: 7.4, rz: 5.2 };
export function groundH(x, z) {
  const dx = x - HILL.x, dz = z - HILL.z, px = (x - POND.x) / (POND.rx + 1.5), pz = (z - POND.z) / (POND.rz + 1.5), pd = px * px + pz * pz;
  return 12 + HILL.h * Math.exp(-(dx * dx + dz * dz) / (2 * HILL.r * HILL.r)) + 0.45 * Math.sin(x * 0.35) * Math.cos(z * 0.3) + 0.25 * Math.sin(x * 0.9 + z * 0.7) - (pd < 1 ? 0.9 * (1 - pd) * (1 - pd) : 0);
}
// Mặt nhân vật bước lên: nền đất, sàn Tịnh Thất, thềm đá, các đài đá hai bậc
export const pvFloor = () => groundH(HILL.x, HILL.z) - 0.35 + 0.96;
export const STAIR = { x: HILL.x, hw: 1.15, z0: HILL.z + 5.76, rise: 0.34, run: 0.36 };
export const DECKS = [{ id: 'pad', x: 26.5, z: 2, r: 2.9, base: 11.95 }, { id: 'tea', x: 7, z: -8.5, r: 3.9 }];
export const deckBase = (D) => (D.base !== undefined ? D.base : groundH(D.x, D.z) + 0.1);
export function floorH(x, z) {
  let y = groundH(x, z); const fy = pvFloor();
  if (Math.abs(x - HILL.x) <= 7.68 && Math.abs(z - HILL.z) <= 5.76) return fy;
  if (Math.abs(x - STAIR.x) <= STAIR.hw && z > STAIR.z0 && z < STAIR.z0 + 9) y = Math.max(y, fy - Math.ceil((z - STAIR.z0) / STAIR.run) * STAIR.rise);
  for (const D of DECKS) { if (D.on === false) continue; const lv = D.lv === undefined ? 2 : D.lv; if (!lv) continue; const d = Math.hypot(x - D.x, z - D.z), b = deckBase(D); if (d < D.r && lv >= 2) y = Math.max(y, b + 0.6); else if (d < D.r + 0.7) y = Math.max(y, b + 0.3); }
  return y;
}
export const P = (x, z, dy = 0) => new THREE.Vector3(x, groundH(x, z) + dy, z);
const PATH = [[[14, 14], [9, 6]], [[9, 6], [2, -1]], [[-7.5, 3], [-13, 5.2]], [[-13, 8], [-18.6, 6]], [[9, 6], [18, 3]], [[18, 3], [24, 2]], [[2, -1], [6, -6]], [[2, -1], [-7.5, 3]], [[-7.5, 3], [-13, 8]], [[14, 14], [10, 12]]];
const segD = (x, z, a, b) => { const vx = b[0] - a[0], vz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * vx + (z - a[1]) * vz) / (vx * vx + vz * vz))); return Math.hypot(x - a[0] - t * vx, z - a[1] - t * vz); };
export const pathDist = (x, z) => Math.min(...PATH.map((s) => segD(x, z, s[0], s[1])));

const U = UNI;   // uniform dùng chung với world.js (thời gian, màu tâm trạng)
export const islandUniforms = U;
const C = (h) => new THREE.Color(h);

// Địa hình một hòn đảo nổi: mặt trên theo hàm cao độ, vách đá lởm chởm thu nhỏ dần xuống dưới
export function terrain({ sx, sz, M = 96, NT = 20, NS = 14, depth = 46, seed = 1, height, paint, phases }) {
  const N = makeNoise(seed), r = rng(seed * 97 + 1), ph = phases || [r() * 6.28, r() * 6.28, r() * 6.28];
  const outline = (th) => 1 + 0.16 * Math.sin(2 * th + ph[0]) + 0.09 * Math.sin(3 * th + ph[1]) + 0.05 * Math.sin(5 * th + ph[2]);
  const pos = [], col = [], idx = [], tmp = new THREE.Color(), g1 = C('#507f36'), g2 = C('#7ea246'), g3 = C('#9aa55a'), rk1 = C('#8d8479'), rk2 = C('#5a534b'), rk3 = C('#a39582'), moss = C('#5f7a38');
  const push = (x, y, z, c) => { pos.push(x, y, z); col.push(c.r, c.g, c.b); };
  push(0, height(0, 0), 0, g1);
  const edgeY = [];
  for (let j = 1; j <= NT; j++) for (let i = 0; i < M; i++) {
    const f = j / NT, th = (i / M) * Math.PI * 2, rr = f * outline(th), x = sx * rr * Math.cos(th), z = sz * rr * Math.sin(th);
    const e = Math.max(0, (f - 0.84) / 0.16), y = height(x, z) - 1.5 * e * e * (3 - 2 * e);
    const n = N.fbm(x * 0.16, 3, z * 0.16), n2 = N.fbm(x * 0.6, 8, z * 0.6, 2);
    tmp.copy(g1).lerp(g2, n * 1.3).lerp(g3, Math.max(0, n2 - 0.55) * 1.6);
    const pc = paint && paint(x, z, f); if (pc) tmp.lerp(pc.c, pc.k);
    if (f > 0.93) tmp.lerp(moss, 0.5).lerp(rk1, (f - 0.93) / 0.07 * 0.6);
    if (j === NT) edgeY[i] = y;
    push(x, y, z, tmp);
  }
  for (let k = 1; k <= NS; k++) for (let i = 0; i < M; i++) {
    const u = k / NS, th = (i / M) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
    const crag = 1 + 0.2 * (N.fbm(c * 2.2 + 5, u * 5, s * 2.2 + 5) - 0.5) * Math.min(1, u * 3), rr = outline(th) * (1 - 0.72 * Math.pow(u, 1.3)) * crag;
    const y = edgeY[i] - depth * Math.pow(u, 0.85) - depth * 0.28 * N.fbm(c * 3.1, 9, s * 3.1, 3) * u * u;
    const n = N.fbm(c * 4 + 9, y * 0.12, s * 4 + 9, 3), band = 0.5 + 0.5 * Math.sin(y * 0.55 + n * 6);
    tmp.copy(rk1).lerp(rk2, n).lerp(rk3, band * 0.35);
    if (u < 0.3 && N.fbm(c * 6, u * 9, s * 6, 2) > 0.52) tmp.lerp(moss, 0.7 * (1 - u / 0.3));
    push(sx * rr * c, y, sz * rr * s, tmp);
  }
  for (let i = 0; i < M; i++) idx.push(0, 1 + ((i + 1) % M), 1 + i);
  for (let j = 0; j < NT + NS - 1; j++) for (let i = 0; i < M; i++) { const a = 1 + j * M + i, b = 1 + j * M + ((i + 1) % M), c2 = a + M, d = b + M; idx.push(a, b, c2, b, d, c2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  const frac = (x, z) => Math.hypot(x / sx, z / sz) / outline(Math.atan2(z / sz, x / sx));
  return { geo, outline, frac };
}

// ───────── Chất liệu dùng chung ─────────
// Màu nằm ở đỉnh (gfx.hue) nên mọi khối tĩnh cùng chất liệu gộp được thành một lệnh vẽ; vân bề mặt lấy từ gfx.tactile.
const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
const VC = (o, k) => { const m = std('#fff', { vertexColors: true, ...o }); return k ? tactile(m, k) : m; };
const MOSS = VC({ roughness: 1 }, [0.3, 0.24, 0.65, 0]),          // đá phong hóa, rêu phủ mặt ngửa: vách, tảng đá, Bia Tích Lũy
  STONE = VC({ roughness: 0.95 }, [0.34, 0.18, 0, 0]),            // đá xây: đài, bậc, tường, chân đèn
  WOOD = VC({ roughness: 0.62 }, [0.5, 0.12, 0, 1]),              // gỗ cũ ấm, thớ chạy dọc
  MATTE = VC({ roughness: 0.95, side: THREE.DoubleSide }),        // vải, gốm, bụi lá, mái các đảo xa
  LAMP = new THREE.MeshStandardMaterial({ color: '#ffe6b0', emissive: '#ffb04a', emissiveIntensity: 2, roughness: 0.6 });   // lõi đèn đá
let _terrMat = null;
export const terrainMat = () => _terrMat || (_terrMat = VC({ roughness: 1 }, [0.16, 0.2, 0, 0]));
// Mesh gọn: hình (tô màu `c` nếu có), vật liệu, vị trí; sh: 1 đổ bóng · 2 nhận bóng · 3 cả hai
const M = (g, m, c, x = 0, y = 0, z = 0, sh = 3) => { const o = new THREE.Mesh(c ? hue(g, c) : g, m); o.position.set(x, y, z); o.castShadow = !!(sh & 1); o.receiveShadow = sh > 1; return o; };

function mergeVerts(g) { // gộp đỉnh trùng để pháp tuyến mịn
  const p = g.attributes.position, map = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(4) + ',' + p.getY(i).toFixed(4) + ',' + p.getZ(i).toFixed(4); if (!map.has(k)) { map.set(k, pos.length / 3); pos.push(p.getX(i), p.getY(i), p.getZ(i)); } idx.push(map.get(k)); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setIndex(idx); return o;
}
function rockGeo(seed, detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, detail), N = makeNoise(seed), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.72 + 0.56 * N.fbm(v.x * 1.4 + 3, v.y * 1.4 + 3, v.z * 1.4 + 3, 3); p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
  const m = mergeVerts(g); m.computeVertexNormals(); return hue(m, '#8a8279');
}
// Đá ba mức chi tiết: 180 tam giác (khối lớn ở gần), 80 (đá rải trên đảo), 20 (đảo tầng ở xa)
const ROCK = [3, 8, 15].map((s) => rockGeo(s)), ROCK1 = [3, 8, 15].map((s) => rockGeo(s, 1)), ROCK0 = [3, 8, 15].map((s) => rockGeo(s, 0)), BLOB = [rockGeo(21), rockGeo(27)];

function roofGeo(profile, sz) { const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), 4, Math.PI / 4, Math.PI * 2).toNonIndexed(); g.computeVertexNormals(); g.scale(1, 1, sz); return g; }
function hips(profile, sz, rad) { const list = []; for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; list.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(profile.map((p) => new THREE.Vector3(p[0] * Math.sin(a), p[1] + 0.06, p[0] * Math.cos(a) * sz))), 14, rad, 6)); } return mergeGeometries(list); }

// Tịnh thất hai tầng mái cong, không gian mở. Gỗ và mái là vật liệu riêng (world.js đổi màu ở Tầng 3); phần còn lại dùng chất liệu chung.
export function pavilion() {
  const K = new THREE.Group(), tiles = tileTex(); tiles.repeat.set(3, 3);
  const m = { wood: tactile(std('#7a3b28', { roughness: 0.6 }), [0.5, 0.12, 0, 1]), roof: std('#55606b', { roughness: 0.55, map: tiles, side: THREE.DoubleSide }) };
  const add = (geo, mat, c, x = 0, y = 0, z = 0, sh = 3) => K.add(M(geo, mat, c, x, y, z, sh)), box = (w, h, d, mat, c, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mat, c, x, y, z);
  const wood = (w, h, d, x, y, z) => box(w, h, d, m.wood, 0, x, y, z), ST = '#c2bbad', DK = '#3b424b';
  box(12.8, 0.7, 9.6, STONE, ST, 0, 0.35, 0); box(12.0, 0.1, 8.8, WOOD, '#a57c52', 0, 0.75, 0);
  const colG = new THREE.CylinderGeometry(0.23, 0.25, 4.25, 12), baseG = new THREE.CylinderGeometry(0.36, 0.42, 0.22, 12);
  [[-5.2, -3.7], [-1.75, -3.7], [1.75, -3.7], [5.2, -3.7], [-5.2, 3.7], [-1.75, 3.7], [1.75, 3.7], [5.2, 3.7], [-5.2, 0], [5.2, 0]].forEach(([x, z]) => { add(colG, m.wood, 0, x, 2.92, z); add(baseG, STONE, ST, x, 0.86, z); });
  wood(11.0, 0.34, 0.3, 0, 4.9, -3.7); wood(11.0, 0.34, 0.3, 0, 4.9, 3.7); wood(0.3, 0.34, 7.8, -5.2, 4.9, 0); wood(0.3, 0.34, 7.8, 5.2, 4.9, 0);
  [-3.5, 3.5, 0].forEach((x) => { wood(3.2, 0.09, 0.09, x, 1.75, -3.7); wood(3.2, 0.09, 0.09, x, 1.2, -3.7); });
  [-5.2, 5.2].forEach((x) => [-1.85, 1.85].forEach((z) => { wood(0.09, 0.09, 3.4, x, 1.75, z); wood(0.09, 0.09, 3.4, x, 1.2, z); }));
  const lower = [[10.9, 0.46], [10.5, 0.24], [9.2, 0.18], [7.4, 0.5], [5.6, 1.06], [4.4, 1.8]];
  add(roofGeo(lower, 0.76), m.roof, 0, 0, 5.05); add(hips(lower, 0.76, 0.17), MATTE, DK, 0, 5.05);
  box(8.8, 0.25, 6.4, WOOD, '#a57c52', 0, 6.45, 0);
  const colG2 = new THREE.CylinderGeometry(0.19, 0.2, 2.6, 10);
  [[-3.5, -2.3], [0, -2.3], [3.5, -2.3], [-3.5, 2.3], [0, 2.3], [3.5, 2.3], [-3.5, 0], [3.5, 0]].forEach(([x, z]) => add(colG2, m.wood, 0, x, 7.85, z));
  [-2.75, 2.75].forEach((z) => wood(7.6, 0.08, 0.08, 0, 7.25, z)); [-3.95, 3.95].forEach((x) => wood(0.08, 0.08, 5.5, x, 7.25, 0));
  wood(7.4, 0.3, 0.26, 0, 9.05, -2.3); wood(7.4, 0.3, 0.26, 0, 9.05, 2.3);
  const upper = [[8.3, 0.4], [7.9, 0.22], [6.6, 0.2], [5.0, 0.56], [3.2, 1.22], [1.6, 2.02], [0.5, 2.7]];
  add(roofGeo(upper, 0.74), m.roof, 0, 0, 9.15); add(hips(upper, 0.74, 0.15), MATTE, DK, 0, 9.15);
  const gold = std('#d9b25a', { roughness: 0.35, metalness: 0.6 });
  add(new THREE.SphereGeometry(0.34, 12, 10), gold, 0, 0, 12.15); add(new THREE.ConeGeometry(0.16, 0.7, 8), gold, 0, 0, 12.75);
  const lanG = new THREE.CylinderGeometry(0.2, 0.2, 0.46, 10);
  [[-5.7, 4.1], [5.7, 4.1], [-5.7, -4.1], [5.7, -4.1]].forEach(([x, z]) => { add(lanG, LAMP, 0, x, 4.2, z, 2); box(0.03, 0.5, 0.03, MATTE, DK, x, 4.66, z); });
  wood(1.5, 0.9, 0.9, 0, 1.25, -1.9);
  const altar = M(new THREE.BoxGeometry(1.0, 1.3, 0.16), new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffcf70', emissiveIntensity: 1.8, roughness: 0.4 }), 0, 0, 2.35, -1.9, 2); K.add(altar);
  const pl = new THREE.PointLight(0xffd08a, 26, 20, 1.7); pl.position.set(0, 3.0, -0.6); K.add(pl);
  return { group: K, mats: m, altar, light: pl };
}

// ───────── Gộp hình khối tĩnh theo vật liệu (T1.2, PROJECT_ROADMAP.md §12.3) ─────────
const uniIds = new WeakMap(); let uniN = 0;
const uniId = (u) => { if (!uniIds.has(u)) uniIds.set(u, ++uniN); return uniIds.get(u); };
const MKEYS = ['type', 'color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'opacity', 'transparent', 'side', 'blending', 'depthWrite', 'depthTest', 'vertexColors', 'alphaTest', 'flatShading', 'fog', 'toneMapped'];
function matKey(m) {
  if (m.isShaderMaterial) return `S|${uniId(m.uniforms)}|${m.transparent}|${m.side}|${m.depthWrite}|${m.blending}|${m.vertexShader}|${m.fragmentShader}`;
  if (Object.hasOwn(m, 'onBeforeCompile')) return 'O|' + m.uuid;   // shader tùy biến: chỉ gộp khi cùng một vật liệu
  return 'M|' + MKEYS.map((k) => { const v = m[k]; return v && v.isColor ? v.getHexString() : String(v); }).join('|') + '|' + (m.map ? m.map.uuid : '');
}
/**
 * Gộp mọi Mesh tĩnh dưới `root` thành một Mesh cho mỗi vật liệu, và mọi tán lá (InstancedMesh có userData.leaf) thành một
 * InstancedMesh cho mỗi loại lá. Gộp trong hệ tọa độ của chính `root` nên nhóm vẫn di chuyển, co giãn, raycast được.
 * Bỏ qua: nhánh trong `live` (bật/tắt, co giãn, đổi vật liệu lúc chạy), vật đang ẩn, InstancedMesh khác, Points, Line.
 * Vật liệu trong `hot` (đổi màu lúc chạy) chỉ gộp khi đúng cùng một vật liệu. Mặc định không gộp vật liệu trong suốt và
 * ShaderMaterial (giữ thứ tự sắp xếp): { transparent: true } cho khối gần như đục, { all: true } gộp tất — dùng cho đảo xa.
 */
export function bakeLocal(root, live = [], hot = [], { transparent = false, all = false } = {}) {
  const skip = new Set(live), hotS = new Set(hot), inv = new THREE.Matrix4(), T = new THREE.Matrix4(), by = new Map(), lv = new Map(), rm = [];
  root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert();
  const walk = (o) => {
    if (skip.has(o) || !o.visible) return;
    const mat = o.material; T.multiplyMatrices(inv, o.matrixWorld);
    if (o.userData.leaf) { const k = o.userData.leaf.kind; if (!lv.has(k)) lv.set(k, []); lv.get(k).push([o, T.clone()]); rm.push(o); }
    else if (o.isMesh && !o.isInstancedMesh && !Array.isArray(mat) && (all || transparent || !mat.transparent) && (all || !mat.isShaderMaterial)) {
      const key = `${hotS.has(mat) ? 'L|' + mat.uuid : matKey(mat)}#${o.renderOrder}#${o.castShadow}${o.receiveShadow}`;
      let g = o.geometry.clone().applyMatrix4(T);
      if (T.determinant() < 0) { g = g.index ? g.toNonIndexed() : g; Object.values(g.attributes).forEach((a) => { for (let i = 0; i < a.count; i += 3) for (let k = 0; k < a.itemSize; k++) { const t = a.array[(i + 1) * a.itemSize + k]; a.array[(i + 1) * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k]; a.array[(i + 2) * a.itemSize + k] = t; } }); }
      Object.keys(g.attributes).forEach((k) => { if (k !== 'position' && k !== 'normal' && k !== 'uv' && !(k === 'color' && mat.vertexColors)) g.deleteAttribute(k); });
      if (!mat.map && !mat.isShaderMaterial) g.deleteAttribute('uv'); else if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (mat.vertexColors && !g.attributes.color) g = hue(g, '#fff');
      if (!by.has(key)) by.set(key, { o, list: [] });
      by.get(key).list.push(g); rm.push(o);
    }
    o.children.slice().forEach(walk);
  };
  root.children.slice().forEach(walk);
  rm.forEach((o) => o.parent.remove(o));
  by.forEach(({ o, list }) => {
    const mixed = list.some((g) => g.index) && list.some((g) => !g.index), geo = list.length === 1 ? list[0] : mergeGeometries(mixed ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list); if (!geo) return;
    const m = new THREE.Mesh(geo, o.material); m.name = 'baked'; m.renderOrder = o.renderOrder; m.castShadow = o.castShadow; m.receiveShadow = o.receiveShadow; root.add(m);
  });
  const c = new THREE.Color(), ctr = new THREE.Vector3();
  lv.forEach((list, kind) => {
    const n = list.reduce((a, x) => a + x[0].count, 0), geo = QUAD.clone(), aC = new Float32Array(n * 3), im = new THREE.InstancedMesh(geo, leafMat(kind), n); let k = 0;
    list.forEach(([o, To]) => { ctr.copy(o.userData.leaf.center).applyMatrix4(To); for (let i = 0; i < o.count; i++, k++) { o.getMatrixAt(i, T); im.setMatrixAt(k, T.premultiply(To)); o.getColorAt(i, c); im.setColorAt(k, c); ctr.toArray(aC, k * 3); } });
    geo.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 3));
    if (list[0][0].castShadow) { im.castShadow = true; im.customDepthMaterial = leafMat(kind).userData.depth; }
    im.computeBoundingSphere(); root.add(im);
  });
  return rm.length;
}
// Tên cũ, giữ để tương thích: gộp nhiều nhóm (đảo láng giềng) trong hệ tọa độ thế giới
export function bakeWorld(groups) { const out = new THREE.Group(); groups.forEach((g) => out.add(g)); bakeLocal(out, [], [], { all: true }); return out; }

// ───────── Cây có tán lá thật: thân, cành và hàng trăm chùm lá phẳng, pháp tuyến hướng ra khỏi tâm tán ─────────
// Mỗi loại lá một vật liệu chung; tâm tán là thuộc tính instance `aC` nên nhiều cây gộp được vào một lệnh vẽ.
// Gió trong vertex shader: từng chùm lá rung, biên độ dồn theo đợt gió chạy ngang đảo.
const QUAD = new THREE.PlaneGeometry(1.5, 1.5), LEAF = {};
function leafMat(kind) {
  if (LEAF[kind]) return LEAF[kind];
  const tex = leafTex(kind), m = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  m.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'attribute vec3 aC; uniform float uTime;\n' + sh.vertexShader
      .replace('#include <defaultnormal_vertex>', 'vec3 ic = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz; vec3 transformedNormal = normalMatrix * normalize(ic - aC + vec3(0.,1.2,0.));')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n float gust = .5 + .5*sin(uTime*.4 + ic.x*.12 + ic.z*.08); transformed.x += sin(uTime*1.3 + ic.x*.6 + ic.y*.4)*(.05 + .11*gust); transformed.y += cos(uTime*.95 + ic.z*.7)*(.03 + .05*gust);'); };
  m.userData.depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 });
  return (LEAF[kind] = m);
}
export function leafTree({ count = 700, kind = 'bodhi', radius = 5, trunkH = 6.5, seed = 2, far = false }) {
  const G = new THREE.Group(), r = rng(seed), sh = far ? 0 : 1, BARK = '#6b4b34';
  // thân cong nhẹ, gốc loe thành rễ bám đất, vỏ có gờ dọc; cành cong vồng lên tới từng chùm tán, cây gần có thêm cành con
  const lx = (r() - 0.5) * radius * 0.16, lz = (r() - 0.5) * radius * 0.16, ang = (d) => Math.atan2(d.x, d.z);
  G.add(M(sweep([[0, -0.4, 0], [lx, trunkH * 0.4, lz], [-lx * 0.5, trunkH * 0.75, -lz * 0.5], [0, trunkH * 1.02, 0]], far ? 5 : 16, far ? 5 : 11,
    (t, d) => radius * (0.09 + 0.1 * (1 - t) ** 3 + (far ? 0 : 0.14 * (1 - t) ** 8 * Math.max(0, Math.sin(ang(d) * 5)))) * (far ? 1 : 1 + 0.07 * Math.sin(ang(d) * 7 + t * 5))), WOOD, BARK, 0, 0, 0, sh));
  const blobs = [[0, trunkH + radius * 0.5, 0, radius * 0.8]], limb = (A, B, r0, r1, n) => G.add(M(sweep([A, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + radius * 0.12, (A[2] + B[2]) / 2], B], n, far ? 4 : 6, (t) => radius * (r0 - (r0 - r1) * t)), WOOD, BARK, 0, 0, 0, sh));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + r(), d = radius * (0.55 + r() * 0.25), y = trunkH + radius * (0.05 + r() * 0.35); blobs.push([Math.cos(a) * d, y, Math.sin(a) * d, radius * (0.5 + r() * 0.2)]);
    if (far && i % 2) continue;   // cây ở xa: ba cành là đủ
    const o = [0, trunkH * (0.62 + r() * 0.22), 0], e = [Math.cos(a) * d * 0.85, y - radius * 0.12, Math.sin(a) * d * 0.85]; limb(o, e, 0.055, 0.018, far ? 3 : 8);
    if (!far) { const m = [e[0] * 0.55, (o[1] + e[1]) / 2 + radius * 0.1, e[2] * 0.55], b2 = a + (r() - 0.5) * 1.6; limb(m, [m[0] + Math.cos(b2) * radius * 0.45, m[1] + radius * 0.3, m[2] + Math.sin(b2) * radius * 0.45], 0.026, 0.01, 4); } }
  const center = new THREE.Vector3(0, trunkH + radius * 0.25, 0), geo = QUAD.clone(), aC = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) center.toArray(aC, i * 3);
  geo.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 3));
  const leaves = new THREE.InstancedMesh(geo, leafMat(kind), count), d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const b = blobs[Math.floor(r() * blobs.length)], u = r() * 2 - 1, a = r() * 6.28, s = Math.sqrt(1 - u * u), rr = b[3] * (0.55 + 0.45 * Math.cbrt(r()));
    d.position.set(b[0] + rr * s * Math.cos(a), b[1] + rr * u * 0.72, b[2] + rr * s * Math.sin(a)); d.rotation.set(r() * 3, r() * 6, r() * 3); d.scale.setScalar((0.75 + r() * 0.6) * radius * 0.2); d.updateMatrix();
    leaves.setMatrixAt(i, d.matrix); const k = 0.72 + r() * 0.5; leaves.setColorAt(i, c.setRGB(k * (0.9 + r() * 0.2), k, k * (0.85 + r() * 0.2)));   // lệch sắc nhẹ từng chùm
  }
  leaves.userData.leaf = { kind, center };
  if (!far) { leaves.castShadow = true; leaves.customDepthMaterial = leafMat(kind).userData.depth; leaves.frustumCulled = false; }
  G.add(leaves);
  return { group: G, leaves, count, top: center };
}

// Cây gọn cho các đảo ở xa
export function blobTree(color, s = 1, seed = 1) {
  const G = new THREE.Group(), r = rng(seed);
  G.add(M(new THREE.CylinderGeometry(0.16 * s, 0.34 * s, 3.2 * s, 7), WOOD, '#6b4b34', 0, 1.6 * s, 0));
  [[0, 4.3, 0, 1.9], [-1.3, 3.6, 0.5, 1.3], [1.2, 3.7, -0.4, 1.35], [0.2, 3.4, 1.2, 1.1]].forEach(([x, y, z, k], i) => { const m = M(BLOB[i % 2], MATTE, color, x * s, y * s, z * s); m.scale.set(k * s, k * s * 0.8, k * s); m.rotation.y = r() * 6; G.add(m); });
  return G;
}

function lotusGeo() {
  const list = [], pink = C('#f29bbd'), white = C('#fff3f6'), yel = C('#f6cf4a'), tmp = new THREE.Color();
  const tint = (g, f) => { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { f(p, i, tmp); c.set([tmp.r, tmp.g, tmp.b], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  [[9, 0.95, 0.30], [7, 0.5, 0.25], [5, 0.15, 0.2]].forEach(([n, tilt, len], ring) => { for (let k = 0; k < n; k++) {
    const g = new THREE.SphereGeometry(1, 5, 3); g.scale(0.11, 0.022, len); g.translate(0, 0, len * 0.9);
    tint(g, (p, i, o) => o.copy(pink).lerp(white, Math.min(1, p.getZ(i) / (len * 1.7)) * 0.9));
    g.rotateX(-(Math.PI / 2 - tilt)); g.rotateY((k / n) * 6.283 + ring * 0.4); list.push(g); } });
  const c = new THREE.SphereGeometry(0.09, 6, 4); c.translate(0, 0.1, 0); list.push(tint(c, (p, i, o) => o.copy(yel)));
  return mergeGeometries(list.map((g) => g.toNonIndexed()));
}

let FALL = null;
export function waterfall(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 4, 18), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = 0.5 - p.getY(i) / h; p.setZ(i, t * t * w * 0.9); p.setX(i, p.getX(i) * (1 + t * 0.5)); }
  g.translate(0, -h / 2, 0);
  FALL = FALL || new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; ${NOISE}
void main(){ float s = fbm(vec2(vUv.x*13., vUv.y*3.2 + uTime*1.7)); float k = smoothstep(0.34,0.74,s);
 vec3 col = mix(vec3(0.74,0.90,0.96), vec3(1.08), k);
 float a = (0.30+0.62*k)*smoothstep(0.,0.14,vUv.x)*smoothstep(1.,0.86,vUv.x)*smoothstep(0.0,0.28,vUv.y); ${OUT} }` });
  const mesh = new THREE.Mesh(g, FALL); mesh.renderOrder = 4; return mesh;
}

// ───────── Vân Đảo của người dùng: 6 phân khu ─────────
export function buildHome() {
  const G = new THREE.Group(), r = rng(42), H = { group: G }, add = (o, p = G) => { p.add(o); return o; };
  const dirt = C('#b3a58c'), bed = C('#5d6a52');
  const T = terrain({ sx: SX, sz: SZ, M: 128, NT: 30, NS: 16, depth: 48, seed: 7, height: groundH, phases: [0.8, 2.1, 0.3],
    paint: (x, z) => { const d = pathDist(x, z); if (d < 1.5) return { c: dirt, k: Math.min(1, (1.5 - d) / 0.6) * 0.85 }; const px = (x - POND.x) / POND.rx, pz = (z - POND.z) / POND.rz; if (px * px + pz * pz < 1.1) return { c: bed, k: 0.8 }; return null; } });
  const land = (H.land = add(M(T.geo, terrainMat()))); H.frac = T.frac;
  const free = (x, z, pad = 0) => { const f = T.frac(x, z); if (f > 0.9) return false; if (pathDist(x, z) < 1.3 + pad) return false; const px = (x - POND.x) / (POND.rx + 0.6), pz = (z - POND.z) / (POND.rz + 0.6); if (px * px + pz * pz < 1) return false; if (Math.abs(x - HILL.x) < 8.6 && Math.abs(z - HILL.z) < 6.8) return false; return true; };
  const scatter = (n, pad, fn) => { let k = 0, guard = 0; while (k < n && guard++ < n * 30) { const a = r() * 6.28, d = Math.sqrt(r()), x = SX * d * Math.cos(a) * 1.05, z = SZ * d * Math.sin(a) * 1.05; if (free(x, z, pad)) fn(x, z, k++); } };
  const d = new THREE.Object3D(), c = new THREE.Color();
  // Đèn đá: trụ và mái đá, lõi phát sáng ấm
  const lamp = (p, x, y, z, k = 1) => { add(M(new THREE.CylinderGeometry(0.15 * k, 0.24 * k, 0.9 * k, 6), STONE, '#bdb6a8', x, y + 0.45 * k, z, 1), p); add(M(new THREE.BoxGeometry(0.4 * k, 0.34 * k, 0.4 * k), LAMP, 0, x, y + 1.07 * k, z, 0), p); const cap = new THREE.ConeGeometry(0.44 * k, 0.3 * k, 4); cap.rotateY(Math.PI / 4); add(M(cap, STONE, '#bdb6a8', x, y + 1.39 * k, z, 1), p); };

  // Cỏ, hoa, đá, lối đá
  // Cỏ: mỗi bụi 6 lá cong thuôn nhọn (36 tam giác, không texture, không alpha test), gốc sẫm ngọn sáng. Hoa nhỏ 5 cánh trên cuống.
  // Gió thổi thành đợt cùng một hướng khắp đảo (dời trong hệ thế giới rồi xoay ngược về hệ từng bụi): ngọn lay nhiều, gốc đứng yên.
  const blades = (() => { const pos = [], col = [], idx = [], q = rng(9);
    for (let b = 0; b < 6; b++) { const a = q() * 6.28, lean = 0.2 + q() * 0.45, h = 0.42 + q() * 0.48, w = 0.04 + q() * 0.025, ox = (q() - 0.5) * 0.32, oz = (q() - 0.5) * 0.32, ca = Math.cos(a), sa = Math.sin(a), o = pos.length / 3;
      for (let k = 0; k <= 3; k++) { const t = k / 3, ww = w * (1 - t * 0.92), x = ox + ca * lean * h * t * t, z = oz + sa * lean * h * t * t, v = 0.42 + 0.7 * t;
        pos.push(x - sa * ww, h * t, z + ca * ww, x + sa * ww, h * t, z - ca * ww); col.push(v * 0.9, v, v * 0.72, v * 0.9, v, v * 0.72);
        if (k < 3) idx.push(o + k * 2, o + k * 2 + 1, o + k * 2 + 2, o + k * 2 + 1, o + k * 2 + 3, o + k * 2 + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx); return g; })();
  const sway = (m, k) => { m.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
 vec2 wp = instanceMatrix[3].xz; float hh = min(position.y*${k}, 1.), gust = .5 + .5*sin(uTime*1.1 - wp.x*.22 - wp.y*.13); hh *= hh;
 mat3 R = mat3(normalize(instanceMatrix[0].xyz), normalize(instanceMatrix[1].xyz), normalize(instanceMatrix[2].xyz));
 transformed += transpose(R)*vec3((.03 + .1*gust)*sin(uTime*1.7 + wp.x*.8 + wp.y*.6) + .14*gust, 0., .05*cos(uTime*1.3 + wp.y*.7))*hh;`); }; m.customProgramCacheKey = () => k; return m; };
  const grass = (H.grass = add(new THREE.InstancedMesh(blades, sway(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), '1.1'), 3000)));   // world.js giảm số bụi cỏ ở mức chất lượng 0
  scatter(3000, -0.3, (x, z, i) => { d.position.set(x, groundH(x, z) - 0.05, z); d.rotation.set(0, r() * 6.28, 0); d.scale.set(0.8 + r() * 0.9, 0.55 + r() * 0.7, 0.8 + r() * 0.9); d.updateMatrix(); grass.setMatrixAt(i, d.matrix); grass.setColorAt(i, c.setHSL(0.22 + r() * 0.08, 0.45 + r() * 0.18, 0.32 + r() * 0.14)); });
  grass.receiveShadow = true;
  const fg = (() => { const h = hue(new THREE.CircleGeometry(0.1, 15), '#fff'), p = h.attributes.position; h.attributes.color.setXYZ(0, 1, 0.78, 0.3);
    for (let i = 1; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), k = 0.45 + 0.55 * Math.abs(Math.cos(Math.atan2(y, x) * 2.5)); p.setXY(i, x * k, y * k); }
    h.rotateX(-Math.PI / 2); h.translate(0, 0.42, 0); const st = new THREE.CylinderGeometry(0.006, 0.009, 0.42, 3, 1, true); st.translate(0, 0.21, 0); return mergeGeometries([h, hue(st, '#6f9a4a')].map((g) => g.toNonIndexed())); })();
  const flowers = add(new THREE.InstancedMesh(fg, sway(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 }), '2.2'), 190));
  const fc = ['#fff6d8', '#ffd9e6', '#ffe58a', '#e6dcff', '#ffffff'];
  scatter(190, 0, (x, z, i) => { d.position.set(x, groundH(x, z) - 0.02, z); d.rotation.set(0, r() * 6.28, 0); d.scale.setScalar(0.8 + r() * 0.8); d.updateMatrix(); flowers.setMatrixAt(i, d.matrix); flowers.setColorAt(i, c.set(fc[Math.floor(r() * fc.length)])); });
  // lối đá lớn dần theo tiến trình (uGrow), cùng vân đá với phần còn lại
  H.grow = { value: 1 }; const stoneMat = tactile(std('#bdb6a8', { roughness: 1 }), [0.34, 0.18, 0, 0]), vein = stoneMat.onBeforeCompile;
  stoneMat.onBeforeCompile = (sh) => { vein(sh); sh.uniforms.uGrow = H.grow; sh.vertexShader = 'uniform float uGrow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float gI = float(gl_InstanceID); float keep = step(0.5, uGrow*3.0 - mod(gI, 3.0)*0.9 + 0.4); float gs = mix(0.5, 1.12, smoothstep(0.0, 0.95, uGrow))*keep; transformed.xz *= gs*(1.0 + (1.0-uGrow)*0.25*sin(gI*7.3)); transformed.y *= keep*mix(1.6, 1.0, uGrow);'); };
  const stones = add(new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.72, 0.16, 9), stoneMat, 80)); let sn = 0;
  PATH.forEach(([a, b]) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(L / 1.55); for (let i = 0; i <= n && sn < 80; i++) { const t = i / Math.max(1, n), x = a[0] + (b[0] - a[0]) * t + (r() - 0.5) * 0.4, z = a[1] + (b[1] - a[1]) * t + (r() - 0.5) * 0.4; d.position.set(x, groundH(x, z) + 0.04, z); d.rotation.set(0, r() * 6, 0); d.scale.set(0.8 + r() * 0.5, 1, 0.8 + r() * 0.5); d.updateMatrix(); stones.setMatrixAt(sn++, d.matrix); } });
  stones.count = sn; stones.receiveShadow = true;
  // đá rải: hình tĩnh, gộp chung một lệnh vẽ với mọi khối đá rêu khác
  const rock = (geo, x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0, p = G) => { const m = add(M(geo, MOSS, 0, x, y, z), p); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz); return m; };
  ROCK1.forEach((geo) => scatter(18, 0.6, (x, z) => { const f = T.frac(x, z), s = 0.35 + r() * (f > 0.6 ? 1.3 : 0.6); rock(geo, x, groundH(x, z) + s * 0.2, z, s, s * 0.7, s, r() * 6, r(), r()); }));

  // Đài Thiền: phiến đá phủ rêu vươn ra biển mây
  rock(ROCK[0], 26.5, 10.5, 2, 7.4, 1.5, 5.2);
  add(M(new THREE.CylinderGeometry(4.6, 5.6, 0.5, 14), MATTE, '#648a3c', 26.5, 11.7, 2, 2)).scale.set(1.25, 1, 0.82);
  const flat = (geo, y, rz = 0) => { geo.rotateZ(rz); geo.rotateX(-Math.PI / 2); geo.translate(0, y, 0); return geo; };
  // đài đá hai bậc: bậc dưới, bậc trên, vòng khảm, hoa văn sen phát quang (giai đoạn cuối), đá ngồi thô (giai đoạn đầu) — bật/tắt theo tiến trình
  const deck = (D) => { const g = add(new THREE.Group()), ud = g.userData; g.position.set(D.x, deckBase(D), D.z);
    ud.lo = add(M(new THREE.CylinderGeometry(D.r + 0.7, D.r + 0.82, 1.5, 44), STONE, '#cbc4b6', 0, -0.45), g);
    ud.hi = add(M(new THREE.CylinderGeometry(D.r, D.r + 0.03, 0.3, 44), STONE, '#cbc4b6', 0, 0.45), g);
    ud.rings = add(M(mergeGeometries([0.55, 0.86].map((k) => flat(new THREE.RingGeometry(D.r * k - 0.07, D.r * k + 0.07, 48), 0.606))), STONE, '#8f8a80', 0, 0, 0, 0), g);
    ud.glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.05, 0.4), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const lit = [flat(new THREE.RingGeometry(D.r * 0.94, D.r * 0.99, 64), 0.612)];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283, pt = new THREE.CircleGeometry(D.r * 0.2, 14); pt.scale(0.5, 1, 1); flat(pt, 0.612, a).translate(-Math.sin(a) * D.r * 0.7, 0, -Math.cos(a) * D.r * 0.7); lit.push(pt); }
    ud.glow = add(new THREE.Mesh(mergeGeometries(lit), ud.glowMat), g);
    ud.seat = rock(ROCK[0], 0, 0.12, 0, 1.1, 0.34, 0.95, 0, 0, 0, g);
    return g; };
  const padDeck = (H.padDeck = deck(DECKS[0])), pu = padDeck.userData;
  pu.zafu = add(M(new THREE.SphereGeometry(0.62, 16, 10), MATTE, '#8a5a3a', 0, 0.66, 0, 1), padDeck); pu.zafu.scale.y = 0.2;
  pu.lamps = add(new THREE.Group(), padDeck); lamp(pu.lamps, -2.2, 0.6, 1.6, 0.8); lamp(pu.lamps, 2.2, 0.6, 1.6, 0.8);
  pu.flowers = add(new THREE.Group(), padDeck);
  for (let i = 0; i < 9; i++) { const a = 0.5 + i * 0.62, rr = DECKS[0].r + 1.25 + (i % 2) * 0.35, bx = Math.cos(a) * rr, bz = Math.sin(a) * rr; if (Math.cos(a) < -0.75) continue;
    add(M(BLOB[i % 2], MATTE, '#4f8a45', bx, 0.12, bz, 0), pu.flowers).scale.set(0.42, 0.3, 0.42);
    for (let k = 0; k < 3; k++) add(M(new THREE.SphereGeometry(0.1, 5, 4), MATTE, '#f3a9c2', bx + (k - 1) * 0.17, 0.4 + (k % 2) * 0.06, bz + (k % 2) * 0.14, 0), pu.flowers); }
  H.padPos = new THREE.Vector3(26.5, deckBase(DECKS[0]) + 0.62, 2);

  // Tịnh Thất
  const pv = (H.pv = pavilion()); pv.group.position.set(HILL.x, groundH(HILL.x, HILL.z) - 0.35, HILL.z); pv.group.scale.setScalar(1.2); add(pv.group);
  { const fy = pvFloor(), list = [], posts = [], rough = [];
    for (let k = 0; k < 26; k++) { const z = STAIR.z0 + (k + 0.5) * STAIR.run, top = fy - (k + 1) * STAIR.rise, gy = groundH(STAIR.x, z); if (top < gy + 0.05) break;
      const hgt = top - gy + 0.9, bx = new THREE.BoxGeometry(STAIR.hw * 2, hgt, STAIR.run + 0.02); bx.translate(STAIR.x, top - hgt / 2, z); list.push(bx);
      if (k % 4 === 0) [-1, 1].forEach((sd) => { const post = new THREE.BoxGeometry(0.26, 0.8, 0.26); post.translate(STAIR.x + sd * (STAIR.hw + 0.17), top + 0.18, z); posts.push(post); });
      [-0.55, 0.5].forEach((ox, q) => { const rk = new THREE.IcosahedronGeometry(0.62, 1), rr = rng(k * 7 + q); rk.scale(1.05 + rr() * 0.3, hgt * 0.5 + 0.2, 0.42 + rr() * 0.12); rk.rotateY((rr() - 0.5) * 0.5); rk.translate(STAIR.x + ox + (rr() - 0.5) * 0.2, top - hgt * 0.31 - 0.14, z); rough.push(rk); }); }
    H.stairs = add(M(mergeGeometries(list), STONE, '#c2bbad')); H.stairPosts = add(M(mergeGeometries(posts), STONE, '#c2bbad')); H.stairRough = add(M(mergeGeometries(rough), MOSS, '#8a8279')); }
  { // chỗ tọa thiền trong Tịnh Thất: bục gỗ thấp, chiếu và bồ đoàn, nhìn ra cửa chính
    const y = pvFloor(), z = HILL.z + 1.4;
    add(M(new THREE.BoxGeometry(2.6, 0.2, 2.6), WOOD, '#5e3a26', HILL.x, y + 0.1, z)); add(M(new THREE.BoxGeometry(2.1, 0.04, 2.1), MATTE, '#c9b98a', HILL.x, y + 0.22, z));
    add(M(new THREE.SphereGeometry(0.6, 16, 10), MATTE, '#7d4a2e', HILL.x, y + 0.33, z)).scale.y = 0.22; }

  // Vườn Tâm Thức: cây Bồ-đề và Hồ Sen
  const tree = (H.tree = leafTree({ count: 900, kind: 'bodhi', radius: 5.4, trunkH: 6.6, seed: 5 })); tree.group.position.copy(P(-22, 5, -0.15)); add(tree.group);
  { const GM = '#bdb6a8', mg = add(new THREE.Group()); mg.position.copy(P(-15.6, 7.0)); mg.rotation.y = Math.atan2(-6.4, -2.0);
    add(M(new THREE.TorusGeometry(2.05, 0.3, 10, 40), STONE, GM, 0, 2.0, 0, 1), mg);
    [-2.8, 2.8].forEach((x) => { add(M(new THREE.BoxGeometry(1.5, 2.6, 0.5), STONE, GM, x, 1.2, 0), mg); add(M(new THREE.BoxGeometry(1.9, 0.18, 0.8), MATTE, '#55606b', x, 2.58, 0, 1), mg); });
    const T0 = P(-22, 5);
    [[3.3, 11], [5.1, 17]].forEach(([rad, n]) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + rad, x = T0.x + Math.cos(a) * rad, z = T0.z + Math.sin(a) * rad; if (T.frac(x, z) > 0.86) continue; const s = add(M(new THREE.CylinderGeometry(0.5, 0.56, 0.16, 9), STONE, GM, x, groundH(x, z) + 0.05, z, 2)); s.rotation.y = a; s.scale.z = 0.8; } });
    const mir = add(new THREE.Group()); mir.position.copy(P(-18.4, 9.6)); mir.rotation.y = 2.5;
    add(M(new THREE.BoxGeometry(1.5, 0.5, 0.7), STONE, GM, 0, 0.25, 0, 1), mir);
    add(M(new THREE.TorusGeometry(0.95, 0.09, 8, 36), MATTE, '#6e5a3a', 0, 1.5, 0, 0), mir);
    add(M(new THREE.CircleGeometry(0.93, 36), new THREE.MeshStandardMaterial({ color: '#dfe9f2', metalness: 1, roughness: 0.06, side: THREE.DoubleSide }), 0, 0, 1.5, 0, 0), mir);
    [[-25.6, 1.2], [-17.6, 2.6], [-24.6, 9.6]].forEach(([x, z]) => lamp(G, x, groundH(x, z), z));
    [[-27.2, 2.4, 'blossom', 2.6, 3.6], [-25.2, 11.2, 'pine', 2.2, 4.6], [-18.2, 13.2, 'blossom', 2.4, 3.2], [-20.4, -0.6, 'pine', 2.0, 4.2], [-28.4, 7.4, 'blossom', 2.0, 3.0]].forEach(([x, z, kind, rad, th], i) => { if (T.frac(x, z) > 0.9) return; const t2 = leafTree({ count: 300, kind, radius: rad, trunkH: th, seed: 40 + i }); t2.group.position.copy(P(x, z, -0.15)); add(t2.group); }); }
  // Mặt nước (Hồ Sen và chum nước khu trà): bốn lớp sóng sin lệch hướng cho pháp tuyến giải tích, phản chiếu màu trời theo Fresnel,
  // vệt nắng/trăng lóa theo hướng mặt trời, đáy trong dần theo tiến trình (uClar)
  const wy = groundH(POND.x, POND.z) + 0.72;
  H.water = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { ...U, uClar: { value: 0 }, uWater: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uTime,uClar,uWater; uniform vec3 uZen,uHz,uSunC,uSun; varying vec2 vUv; varying vec3 vW;
void main(){ vec2 p = vW.xz, n = vec2(0.); float hh = 0.;
 for (int i = 0; i < 4; i++) { float fi = float(i), an = fi*2.4 + .6, f = 1.1 + fi*fi*.47 + fi*.5, ph; vec2 d = vec2(cos(an), sin(an)); ph = dot(p,d)*f + uTime*(.8 + fi*.4) + sin(p.x*.6 + p.y*.4 + fi)*.8; n += d*cos(ph)*f*.045/(1.+fi); hh += sin(ph)/(1.+fi); }
 vec3 N = normalize(vec3(-n.x, 1., -n.y)), V = normalize(cameraPosition - vW), R = reflect(-V, N);
 float fr = .1 + .8*pow(1. - max(dot(N,V),0.), 3.);
 vec3 col = mix(mix(vec3(.2,.32,.3), vec3(.08,.42,.4), uClar)*(.88+.12*hh), mix(uHz, uZen, clamp(R.y*1.4, 0., 1.)), fr*(.6+.4*uClar));
 col += uSunC*pow(max(dot(R, uSun),0.), 60.)*1.6*(.4+.6*uClar) + vec3(.9,.97,1.)*smoothstep(.6,1.,hh*.5+.5)*.07;
 float a = (.66+.3*uClar)*smoothstep(1.,.9,length(vUv*2.-1.))*uWater; ${OUT} }` });
  const disc = (rad, seg) => { const g = new THREE.CircleGeometry(rad, seg); g.rotateX(-Math.PI / 2); return g; };
  const pond = add(new THREE.Mesh(disc(1, 48), H.water)); pond.scale.set(POND.rx, 1, POND.rz); pond.position.set(POND.x, wy, POND.z); pond.renderOrder = 3;
  for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.28 + r() * 0.2, s = 0.45 + r() * 0.5, x = POND.x + Math.cos(a) * (POND.rx + 0.5), z = POND.z + Math.sin(a) * (POND.rz + 0.5); rock(ROCK1[1], x, groundH(x, z) + 0.15, z, s, s * 0.65, s, r() * 6, r(), r()); }
  // Sen: lá và hoa là hai InstancedMesh; hoa đung đưa theo gió, `uGold` hoa đầu tiên hóa vàng phát sáng
  { const uGold = { value: 0 }, lm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), padG = new THREE.CircleGeometry(0.78, 16, 0.35, 5.6); padG.rotateX(-Math.PI / 2);
    lm.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.uniforms.uGold = uGold;
      sh.vertexShader = 'uniform float uTime, uGold; varying float vG;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float li = float(gl_InstanceID); vG = step(li + .5, uGold); transformed.xz += vec2(sin(uTime*1.1 + li*2.1), cos(uTime*.9 + li*1.3))*(.012 + .09*transformed.y);');
      sh.fragmentShader = 'varying float vG;\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb *= mix(vec3(1.), vec3(1.,.81,.38), vG);').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance = mix(vec3(.095,.014,.035), vec3(.8,.46,.08), vG);'); };
    const pads = add(new THREE.InstancedMesh(hue(padG, '#3f7d45'), MATTE, 12)), flw = add(new THREE.InstancedMesh(lotusGeo(), lm, 12));
    for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = 0.22 + (i % 4) * 0.2, x = POND.x + Math.cos(a) * rr * POND.rx, z = POND.z + Math.sin(a) * rr * POND.rz;
      d.scale.setScalar(1); d.position.set(x + 0.5, wy + 0.03, z); d.rotation.set(0, r() * 6, 0); d.updateMatrix(); pads.setMatrixAt(i, d.matrix);
      d.scale.setScalar(1.25); d.position.set(x, wy + 0.19, z); d.rotation.set(0, r() * 6, 0); d.updateMatrix(); flw.setMatrixAt(i, d.matrix); }
    pads.computeBoundingSphere(); flw.computeBoundingSphere();
    H.setLotus = (n, gold) => { pads.count = flw.count = n; pads.visible = flw.visible = n > 0; uGold.value = gold; }; H.setLotus(0, 0); }
  // Một hệ Points chạy hoàn toàn trên GPU: hạt công đức vàng bay lên khắp đảo (loại 0), lấp lánh quanh tán Bồ-đề (1) và trên mặt hồ (2).
  // uK = (công đức, ánh Bồ-đề, ánh hồ, độ lớn cây Bồ-đề) do world.js đặt mỗi khung.
  { const NS = [110, 80, 70], n = 260, pos = new Float32Array(n * 3), sd = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const k = i < NS[0] ? 0 : i < NS[0] + NS[1] ? 1 : 2, a = r() * 6.28, q = Math.sqrt(r()); let x, y, z;
      if (!k) { x = SX * q * 0.8 * Math.cos(a); z = SZ * q * 0.8 * Math.sin(a); y = groundH(x, z) + 0.3; }
      else if (k === 1) { const rr = 1.5 + r() * 4.2; x = Math.cos(a) * rr; y = 6.5 + r() * 6.5; z = Math.sin(a) * rr; }
      else { x = POND.x + Math.cos(a) * q * 0.86 * POND.rx; y = wy + 0.12 + r() * 0.5; z = POND.z + Math.sin(a) * q * 0.86 * POND.rz; }
      pos.set([x, y, z], i * 3); sd.set([r(), k, 0.5 + r()], i * 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aS', new THREE.BufferAttribute(sd, 3));
    H.motes = add(new THREE.Points(pg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: U.uTime, uK: { value: new THREE.Vector4(1, 0, 0, 1) }, uT0: { value: tree.group.position } },
      vertexShader: `attribute vec3 aS; uniform float uTime; uniform vec4 uK; uniform vec3 uT0; varying float vA;
void main(){ vec3 p = position; float ph = aS.x*6.283, a, sz;
 if (aS.y < .5) { float f = fract(uTime*.045*aS.z + aS.x); p.y += f*f*11.; p.xz += vec2(sin(uTime*.4+ph), cos(uTime*.33+ph))*(.3+f*1.2); a = sin(f*3.1416)*uK.x*.85; sz = 3.+4.*aS.z; }
 else if (aS.y < 1.5) { p = uT0 + p*uK.w; a = uK.y*(.45+.55*sin(uTime*2.+ph)); sz = 8.; }
 else { p.y += sin(uTime*.6+ph)*.08; a = pow(.5+.5*sin(uTime*(1.4+aS.z)+ph), 4.)*uK.z; sz = 4.+9.*a; }
 vec4 mv = modelViewMatrix*vec4(p,1.); gl_PointSize = clamp(sz*60./-mv.z, 2.2, 14.); gl_Position = projectionMatrix*mv; vA = a; }`,
      fragmentShader: `varying float vA; void main(){ vec2 q = gl_PointCoord*2.-1.; vec3 col = vec3(1.75,1.45,.85); float a = exp(-dot(q,q)*4.5)*vA; ${OUT} }` }))); H.motes.frustumCulled = false; }
  H.fall = add(waterfall(2.0, 30)); H.fall.position.set(-8, groundH(-8, 17) - 0.9, 20.2); H.fall.rotation.y = 0.15;

  // Trà Đạo Tỉnh Thức
  const Tea = (H.tea = add(new THREE.Group())); Tea.position.set(7, deckBase(DECKS[1]) + 0.6, -8.5);
  { const dk = (H.teaDeck = deck(DECKS[1])); dk.position.set(0, -0.6, 0); Tea.add(dk); dk.userData.seat.visible = false; }
  add(M(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 28), STONE, '#b9b2a4', 0, 0.52), Tea); add(M(new THREE.CylinderGeometry(0.42, 0.6, 0.46, 14), STONE, '#a39c8e', 0, 0.23), Tea);
  add(M(new THREE.SphereGeometry(0.19, 12, 8), MATTE, '#7a4a34', 0, 0.74, 0, 0), Tea).scale.y = 0.85;
  add(M(new THREE.CylinderGeometry(0.02, 0.035, 0.2, 6), MATTE, '#7a4a34', 0.2, 0.78, 0, 0), Tea).rotation.z = -1.0;
  [0.6, 2.2, 3.8, 5.4].forEach((a) => { add(M(new THREE.CylinderGeometry(0.075, 0.05, 0.08, 10), MATTE, '#f2ede2', Math.cos(a) * 0.72, 0.63, Math.sin(a) * 0.72, 0), Tea);
    add(M(new THREE.CylinderGeometry(0.56, 0.5, 0.2, 16), STONE, '#b3ac9e', Math.cos(a) * 1.95, 0.1, Math.sin(a) * 1.95), Tea); });
  // chum nước rửa tay bên bàn trà: cùng mặt nước với Hồ Sen
  add(M(new THREE.CylinderGeometry(0.62, 0.44, 0.52, 14), STONE, '#a39c8e', -2.5, 0.26, -2.5), Tea); add(new THREE.Mesh(disc(0.52, 20), H.water), Tea).position.set(-2.5, 0.54, -2.5);
  { const ptg = new THREE.CylinderGeometry(0.13, 0.3, 4.2, 7, 5), ptp = ptg.attributes.position; for (let i = 0; i < ptp.count; i++) { const y = ptp.getY(i) / 4.2 + 0.5; ptp.setX(i, ptp.getX(i) + Math.sin(y * 3) * 0.55); } ptg.translate(0, 2.1, 0); ptg.computeVertexNormals();
    add(M(ptg, WOOD, '#5a4330', 5.2, -0.7, -2.4, 1), Tea);
    [[0.5, 4.3, 0, 1.7], [-0.9, 3.3, 0.5, 1.2], [1.4, 3.0, -0.3, 1.1], [0.1, 5.0, -0.5, 1.0]].forEach(([x, y, z, k], i) => add(M(BLOB[i % 2], MATTE, '#3d6b45', 5.2 + x, y - 0.7, z - 2.4, 1), Tea).scale.set(k, k * 0.32, k)); }

  // Cổng Vân Môn
  const Gt = (H.gate = add(new THREE.Group())); Gt.position.copy(P(15.5, 15.5)); Gt.rotation.y = -Math.PI / 4;
  [-2.3, 2.3].forEach((x, i) => rock(ROCK[i + 1], x, 1.6, 0, 0.75, 2.5, 0.75, 0, 0, 0, Gt));
  H.cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.94, emissive: '#fff4e0', emissiveIntensity: 0.55 });
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI; add(M(BLOB[i % 2], H.cloudMat, 0, Math.cos(a) * 2.3, 2.5 + Math.sin(a) * 2.2, 0, 0), Gt).scale.setScalar(0.62 + 0.2 * Math.sin(i * 2)); }
  H.veil = add(new THREE.Group(), Gt);
  [[0, 1.2, 1.5], [-1.1, 2.1, 1.2], [1.1, 2.0, 1.25], [0, 3.0, 1.2], [-0.9, 0.8, 1.0], [0.9, 0.8, 1.0]].forEach(([x, y, s], i) => add(M(BLOB[i % 2], H.cloudMat, 0, x, y, 0, 0), H.veil).scale.setScalar(s * 0.9));
  for (let i = 0; i < 5; i++) { const t = (i + 1) / 5.5; rock(ROCK[i % 3], 17.5 + t * 17, groundH(17, 17) - 1.5 - t * 6, 17.5 + t * 17, 1.5, 0.3, 1.25, i); }

  // Bia Tích Lũy: thân bia đá sẫm phủ rêu, mặt chữ phát sáng
  const St = (H.stele = add(new THREE.Group())); St.position.copy(P(10.5, 10)); St.rotation.y = 0.5;
  const sh = new THREE.Shape(); sh.moveTo(-0.9, 0); sh.lineTo(0.9, 0); sh.lineTo(0.9, 2.5); sh.absarc(0, 2.5, 0.9, 0, Math.PI, false); sh.lineTo(-0.9, 0);
  add(M(new THREE.ExtrudeGeometry(sh, { depth: 0.42, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), MOSS, '#4b474d', 0, 0, -0.21, 1), St);
  H.steleMat = new THREE.MeshBasicMaterial({ map: steleTex(), color: new THREE.Color(2.0, 1.7, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  add(new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.9), H.steleMat), St).position.set(0, 1.62, 0.3);
  rock(ROCK[2], 0, 0.05, 0, 1.4, 0.35, 0.8, 0, 0, 0, St);

  // Suối chảy từ Hồ Sen ra thác (rộng dần theo lượng nước)
  { const pts = [[-5.3, 13.7], [-6.5, 15.6], [-7.5, 17.6], [-8.0, 19.4], [-8.1, 20.6]].map(([x, z]) => new THREE.Vector3(x, 0, z)), cv = new THREE.CatmullRomCurve3(pts), N = 40, pos = [], uv = [], side = [], idx = [];
    for (let i = 0; i <= N; i++) { const t = i / N, c = cv.getPoint(t), tg = cv.getTangent(t), nx = tg.z, nz = -tg.x, y = Math.max(groundH(c.x, c.z), groundH(c.x + nx * 0.7, c.z + nz * 0.7), groundH(c.x - nx * 0.7, c.z - nz * 0.7)) + 0.07 - t * t * 0.5;
      [-1, 1].forEach((sd) => { pos.push(c.x, y, c.z); side.push(nx * sd, 0, nz * sd); uv.push(sd * 0.5 + 0.5, t); }); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx);
    H.brook = add(new THREE.Mesh(sg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { ...U, uFlow: { value: 0 } },
      vertexShader: 'attribute vec3 aSide; uniform float uFlow; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position + aSide*(0.22 + 0.62*uFlow)*(0.8 + 0.35*sin(uv.y*9.0)); gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }',
      fragmentShader: `uniform float uTime,uFlow,uNight; varying vec2 vUv; ${NOISE}
void main(){ float sp = 0.5 + 1.1*uFlow; float n = fbm(vec2(vUv.x*3.0, vUv.y*9.0 - uTime*sp)); float n2 = noise(vec2(vUv.x*8.0 + 3.0, vUv.y*26.0 - uTime*sp*2.2));
 vec3 col = mix(vec3(0.30,0.62,0.66), vec3(0.92,0.98,1.0), smoothstep(0.45,0.85,n*0.6+n2*0.5)); col += vec3(1.6,1.6,1.5)*smoothstep(0.78,0.95,n2)*(0.25+0.6*uFlow);
 col = mix(col, col*vec3(0.45,0.5,0.8), uNight*0.7); float e = smoothstep(0.0,0.3,vUv.x)*smoothstep(1.0,0.7,vUv.x);
 float a = e*(0.35 + 0.5*uFlow)*smoothstep(0.0,0.06,vUv.y)*smoothstep(0.0,0.04,uFlow); ${OUT} }` })));
    H.brook.renderOrder = 2; H.brook.frustumCulled = false; }
  // Tiến hóa theo 49 ngày. L: 0..1 tiến trình; water: 0..1 lượng nước hồ; tea: khu trà đã mở
  H.evolve = (L, isl, time) => {
    const st = L < 0.14 ? 0 : L < 0.43 ? 1 : L < 0.71 ? 2 : L < 0.9 ? 3 : 4;
    DECKS[0].lv = st === 0 ? 0 : st === 1 ? 1 : 2; DECKS[0].seat = st === 0 ? 0.17 : st === 1 ? 0.22 : 0.16;
    pu.lo.visible = st >= 1; pu.hi.visible = st >= 2; pu.seat.visible = st < 2; pu.seat.position.y = st === 0 ? 0.12 : 0.36; pu.zafu.visible = st >= 2; pu.rings.visible = pu.lamps.visible = st >= 3; pu.flowers.visible = st >= 2; pu.flowers.scale.setScalar(st >= 3 ? 1 : 0.6);
    pu.glow.visible = st >= 4; pu.glowMat.opacity = 0.45 + 0.3 * Math.sin(time * 1.3);
    const tu = H.teaDeck.userData, ts = L < 0.5 ? 1 : L < 0.75 ? 2 : L < 0.9 ? 3 : 4; DECKS[1].lv = ts >= 2 ? 2 : 1; tu.hi.visible = ts >= 2; tu.rings.visible = ts >= 3; tu.glow.visible = ts >= 4; H.tea.position.y = deckBase(DECKS[1]) + (ts >= 2 ? 0.6 : 0.3); H.teaDeck.position.y = ts >= 2 ? -0.6 : -0.3;
    H.grow.value = L; H.stairRough.visible = L < 0.3; H.stairs.visible = L >= 0.3; H.stairPosts.visible = L >= 0.6;
    LAMP.emissiveIntensity = 2 + 0.35 * Math.sin(time * 2.3) * Math.sin(time * 0.71);   // lõi đèn đá thở nhẹ
    const flow = Math.min(1, isl.water) * (0.25 + 0.75 * L); H.brook.material.uniforms.uFlow.value = flow; H.brook.visible = flow > 0.03; H.fall.visible = flow > 0.1; H.fall.scale.x = 0.25 + 0.75 * flow;
    return st;
  };
  // T1.2: gộp phần tĩnh theo vật liệu. Phần đổi theo tiến trình hay bị world.js bật/tắt, co giãn, đổi màu thì giữ riêng:
  // đất (raycast), Tịnh Thất, Đài Thiền, khu trà, bậc thang, cây Bồ-đề, màn mây cổng. Lá của năm cây nhỏ gộp theo loại lá.
  bakeLocal(tree.group, [tree.leaves]);
  bakeLocal(H.veil, [], [], { transparent: true }); bakeLocal(Gt, [H.veil], [], { transparent: true });
  bakeLocal(pv.group, [], [pv.mats.roof, pv.mats.wood, pv.altar.material]);
  bakeLocal(pu.lamps); bakeLocal(pu.flowers); bakeLocal(Tea, [H.teaDeck]);
  bakeLocal(G, [land, pv.group, padDeck, Tea, H.stairs, H.stairPosts, H.stairRough, tree.group, H.veil]);
  return H;
}

// ───────── Đảo láng giềng và đảo ở các tầng trên (world.js gộp tất cả bằng bakeLocal) ─────────
const GLOW = (r, g, b, o) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity: o, blending: o < 0.7 ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: o > 0.7 });
const NB_RING = GLOW(0.45, 1.5, 1.35, 0.5), NB_JADE = GLOW(0.35, 1.05, 0.85, 0.75), NB_LUX = new THREE.MeshStandardMaterial({ color: '#eef5ff', emissive: '#9fc8f0', emissiveIntensity: 0.9, roughness: 0.15, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
export function buildNeighbor(tier, seed, size) {
  // ba đảo đầu (seed ≤ 3) là đảo bạn đồng tu, có thể tới thăm nên giữ chi tiết; các đảo còn lại chỉ nhìn từ xa
  const near = seed <= 3, G = new THREE.Group(), r = rng(seed * 31 + tier), N = makeNoise(seed + 50), hf = (x, z) => 0.9 * N.fbm(x * 0.12, 1, z * 0.12, 2) * size * 0.18 + size * 0.06 * Math.exp(-(x * x + z * z) / (size * size * 0.25));
  const T = terrain({ sx: size, sz: size * (0.72 + r() * 0.2), M: near ? 36 : 28, NT: near ? 7 : 6, NS: near ? 6 : 5, depth: size * (1.3 + r() * 0.5), seed: seed + 3, height: hf });
  G.add(M(T.geo, terrainMat(), 0, 0, 0, 0, 0));
  const spot = (fmax) => { for (let k = 0; k < 40; k++) { const a = r() * 6.28, dd = Math.sqrt(r()) * fmax, x = size * dd * Math.cos(a), z = size * 0.8 * dd * Math.sin(a); if (T.frac(x, z) < fmax) return [x, hf(x, z), z]; } return [0, hf(0, 0), 0]; };
  const nT = 2 + (seed % 2), kinds = tier === 2 ? ['gold'] : tier === 3 ? ['blossom'] : tier === 1 ? ['blossom', 'bodhi', 'pine'] : ['bodhi', 'pine', 'bodhi'];
  for (let i = 0; i < nT; i++) { const [x, y, z] = spot(0.5), k = (0.75 + r() * 0.5) * size / 13, kind = kinds[(seed + i) % kinds.length];
    const t = leafTree({ count: near ? 170 : 120, kind, radius: (kind === 'pine' ? 2.3 : 3.3) * k, trunkH: (kind === 'pine' ? 4.6 : 3.4) * k, seed: seed * 7 + i, far: true }); t.group.position.set(x, y - 0.2, z); G.add(t.group); }
  for (let i = 0; i < 9; i++) { const [x, y, z] = spot(0.85), s = (0.35 + r() * 0.9) * size / 13, m = M((near ? ROCK1 : ROCK0)[i % 3], MOSS, 0, x, y + s * 0.2, z, 0); m.scale.set(s, s * 0.7, s); m.rotation.y = r() * 6; G.add(m); }
  if (tier >= 1) {
    const ring = M(new THREE.TorusGeometry(size * 0.46, size * 0.02, 4, 32), NB_RING, 0, 0, hf(size * 0.46, 0) + 0.25, 0, 0); ring.rotation.x = Math.PI / 2; G.add(ring);
    const wf = waterfall(size * 0.14, size * 2.0), a = r() * 6.28; wf.position.set(size * 0.93 * Math.cos(a), hf(0, 0) - 1.2, size * 0.7 * Math.sin(a)); wf.rotation.y = -a + Math.PI / 2; G.add(wf);
  }
  if (tier === 2) { const [x, y, z] = spot(0.4), jade = M(new THREE.CircleGeometry(size * 0.2, 20), NB_JADE, 0, x, y + 0.2, z, 0); jade.rotation.x = -Math.PI / 2; G.add(jade); }
  if (tier === 3 || seed % 3 !== 1) {
    // am nhỏ: Tầng 3 bằng pha lê phát sáng, các tầng dưới bằng gỗ/ngói theo màu của tầng
    const lux = tier === 3, k = size / 13 * (lux ? 1 : 0.8), kiosk = new THREE.Group(), body = lux ? 0 : tier === 2 ? '#c9a45a' : tier === 1 ? '#8d5a3c' : '#7a4a33', bm = lux ? NB_LUX : MATTE;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => kiosk.add(M(new THREE.CylinderGeometry(0.16 * k, 0.16 * k, 3.4 * k, 6), bm, body, x * 1.8 * k, 1.7 * k, z * 1.5 * k, 0)));
    const rf = M(roofGeo([[4.2, 0.3], [3.9, 0.14], [3.0, 0.2], [1.9, 0.7], [0.9, 1.4], [0.25, 2.0]], 0.8), bm, lux ? 0 : tier === 2 ? '#d8b25c' : tier === 1 ? '#3f6f77' : '#4d5f68', 0, 3.4 * k, 0, 0); rf.scale.setScalar(k); kiosk.add(rf);
    kiosk.add(M(new THREE.CylinderGeometry(3 * k, 3.2 * k, 0.3 * k, 8), bm, body, 0, 0.1, 0, 0));
    const [x, y, z] = spot(0.3); kiosk.position.set(x, y, z); G.add(kiosk);
  }
  const seats = []; const ns = 4 + Math.floor(r() * 4), [cx, , cz] = spot(0.3), a0 = r() * 6.28;
  for (let i = 0; i < ns; i++) { const ring = i < 5 ? 0 : 1, a = a0 + i * 2.4, d = (2.6 + ring * 2.4 + r() * 0.8) * size / 13, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * 0.9;
    if (T.frac(x, z) < 0.78) seats.push({ x, y: hf(x, z) + 0.02, z }); else { const [sx, sy, sz] = spot(0.6); seats.push({ x: sx, y: sy + 0.02, z: sz }); } }
  return { group: G, seats, size, outline: T.outline, top: hf(0, 0) };
}

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { NOISE, OUT, rng, makeNoise, leafTex, grassTex, tileTex, steleTex } from './gfx.js';

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

const U = { uTime: { value: 0 } };
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

let _terrMat = null;
export function terrainMat() {
  if (_terrMat) return _terrMat;
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vWp;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec3 vWp;\n' + NOISE + '\n' + sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n float dn = fbm(vWp.xz*1.7)*0.6 + fbm(vWp.xy*0.9 + vWp.z)*0.4; diffuseColor.rgb *= 0.70 + 0.62*dn;');
  };
  return (_terrMat = m);
}

const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
function rockGeo(seed, detail = 2) {
  const g = new THREE.IcosahedronGeometry(1, detail), N = makeNoise(seed), p = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.72 + 0.56 * N.fbm(v.x * 1.4 + 3, v.y * 1.4 + 3, v.z * 1.4 + 3, 3); p.setXYZ(i, v.x * k, v.y * k, v.z * k); }
  const m = mergeVerts(g); m.computeVertexNormals(); return m;
}
function mergeVerts(g) { // gộp đỉnh trùng để pháp tuyến mịn
  const p = g.attributes.position, map = new Map(), pos = [], idx = [];
  for (let i = 0; i < p.count; i++) { const k = p.getX(i).toFixed(4) + ',' + p.getY(i).toFixed(4) + ',' + p.getZ(i).toFixed(4); if (!map.has(k)) { map.set(k, pos.length / 3); pos.push(p.getX(i), p.getY(i), p.getZ(i)); } idx.push(map.get(k)); }
  const o = new THREE.BufferGeometry(); o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setIndex(idx); return o;
}
const ROCK = [rockGeo(3), rockGeo(8), rockGeo(15)];
const ROCK_FAR = [rockGeo(3, 1), rockGeo(8, 1), rockGeo(15, 1)];   // đá trên các đảo tầng ở xa: 80 thay vì 320 tam giác
const rockMat = std('#8a8279', { roughness: 1 });

function roofGeo(profile, sz) { const g = new THREE.LatheGeometry(profile.map((p) => new THREE.Vector2(p[0], p[1])), 4, Math.PI / 4, Math.PI * 2).toNonIndexed(); g.computeVertexNormals(); g.scale(1, 1, sz); return g; }
function hips(profile, sz, rad) { const list = []; for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; list.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(profile.map((p) => new THREE.Vector3(p[0] * Math.sin(a), p[1] + 0.06, p[0] * Math.cos(a) * sz))), 14, rad, 6)); } return mergeGeometries(list); }

// Tịnh thất hai tầng mái cong, không gian mở
export function pavilion() {
  const K = new THREE.Group(), tiles = tileTex(); tiles.repeat.set(3, 3);
  const m = { wood: std('#7a3b28', { roughness: 0.6 }), roof: std('#55606b', { roughness: 0.55, map: tiles, side: THREE.DoubleSide }), ridge: std('#3b424b', { roughness: 0.5 }), stone: std('#c2bbad', { roughness: 0.95 }), floor: std('#a57c52', { roughness: 0.7 }),
    lantern: new THREE.MeshStandardMaterial({ color: '#ffe6b0', emissive: '#ffb04a', emissiveIntensity: 2.4, roughness: 0.6 }), gold: std('#d9b25a', { roughness: 0.35, metalness: 0.6 }) };
  const add = (geo, mat, x = 0, y = 0, z = 0, cast = true) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = cast; o.receiveShadow = true; K.add(o); return o; };
  const box = (w, h, d, mat, x, y, z) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  box(12.8, 0.7, 9.6, m.stone, 0, 0.35, 0); box(12.0, 0.1, 8.8, m.floor, 0, 0.75, 0);
  const colG = new THREE.CylinderGeometry(0.23, 0.25, 4.25, 12), baseG = new THREE.CylinderGeometry(0.36, 0.42, 0.22, 12);
  [[-5.2, -3.7], [-1.75, -3.7], [1.75, -3.7], [5.2, -3.7], [-5.2, 3.7], [-1.75, 3.7], [1.75, 3.7], [5.2, 3.7], [-5.2, 0], [5.2, 0]].forEach(([x, z]) => { add(colG, m.wood, x, 2.92, z); add(baseG, m.stone, x, 0.86, z); });
  box(11.0, 0.34, 0.3, m.wood, 0, 4.9, -3.7); box(11.0, 0.34, 0.3, m.wood, 0, 4.9, 3.7); box(0.3, 0.34, 7.8, m.wood, -5.2, 4.9, 0); box(0.3, 0.34, 7.8, m.wood, 5.2, 4.9, 0);
  [[-3.5, -3.7, 3.2, 0.09], [3.5, -3.7, 3.2, 0.09], [0, -3.7, 3.2, 0.09]].forEach(([x, z, w]) => { box(w, 0.09, 0.09, m.wood, x, 1.75, z); box(w, 0.09, 0.09, m.wood, x, 1.2, z); });
  [-5.2, 5.2].forEach((x) => [-1.85, 1.85].forEach((z) => { box(0.09, 0.09, 3.4, m.wood, x, 1.75, z); box(0.09, 0.09, 3.4, m.wood, x, 1.2, z); }));
  const lower = [[10.9, 0.46], [10.5, 0.24], [9.2, 0.18], [7.4, 0.5], [5.6, 1.06], [4.4, 1.8]];
  add(roofGeo(lower, 0.76), m.roof, 0, 5.05, 0); add(hips(lower, 0.76, 0.17), m.ridge, 0, 5.05, 0);
  box(8.8, 0.25, 6.4, m.floor, 0, 6.45, 0);
  const colG2 = new THREE.CylinderGeometry(0.19, 0.2, 2.6, 10);
  [[-3.5, -2.3], [0, -2.3], [3.5, -2.3], [-3.5, 2.3], [0, 2.3], [3.5, 2.3], [-3.5, 0], [3.5, 0]].forEach(([x, z]) => add(colG2, m.wood, x, 7.85, z));
  [[0, -2.75, 7.6, 0.08], [0, 2.75, 7.6, 0.08]].forEach(([x, z, w]) => box(w, 0.08, 0.08, m.wood, x, 7.25, z)); [-3.95, 3.95].forEach((x) => box(0.08, 0.08, 5.5, m.wood, x, 7.25, 0));
  box(7.4, 0.3, 0.26, m.wood, 0, 9.05, -2.3); box(7.4, 0.3, 0.26, m.wood, 0, 9.05, 2.3);
  const upper = [[8.3, 0.4], [7.9, 0.22], [6.6, 0.2], [5.0, 0.56], [3.2, 1.22], [1.6, 2.02], [0.5, 2.7]];
  add(roofGeo(upper, 0.74), m.roof, 0, 9.15, 0); add(hips(upper, 0.74, 0.15), m.ridge, 0, 9.15, 0);
  add(new THREE.SphereGeometry(0.34, 12, 10), m.gold, 0, 12.15, 0); add(new THREE.ConeGeometry(0.16, 0.7, 8), m.gold, 0, 12.75, 0);
  const lanG = new THREE.CylinderGeometry(0.2, 0.2, 0.46, 10);
  [[-5.7, 4.1], [5.7, 4.1], [-5.7, -4.1], [5.7, -4.1]].forEach(([x, z]) => { add(lanG, m.lantern, x, 4.2, z, false); box(0.03, 0.5, 0.03, m.ridge, x, 4.66, z); });
  box(1.5, 0.9, 0.9, m.wood, 0, 1.25, -1.9);
  const altar = add(new THREE.BoxGeometry(1.0, 1.3, 0.16), new THREE.MeshStandardMaterial({ color: '#fff0c8', emissive: '#ffcf70', emissiveIntensity: 1.8, roughness: 0.4 }), 0, 2.35, -1.9, false);
  const pl = new THREE.PointLight(0xffd08a, 26, 20, 1.7); pl.position.set(0, 3.0, -0.6); K.add(pl);
  return { group: K, mats: m, altar, light: pl };
}

// Cây có tán lá thật: thân, cành và hàng trăm chùm lá phẳng, pháp tuyến hướng ra khỏi tâm tán
const BARK = std('#6b4b34', { roughness: 1 });
// Gộp các mesh tĩnh cùng vật liệu của một đảo thành một lần vẽ
function bake(G) {
  G.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(G.matrixWorld).invert(), by = new Map(), rm = [];
  G.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || !o.material.isMeshStandardMaterial || o.material.transparent || o.material.map) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    Object.keys(g.attributes).forEach((k) => { if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); });
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!by.has(o.material)) by.set(o.material, []); by.get(o.material).push(g); rm.push(o);
  });
  rm.forEach((o) => o.parent.remove(o));
  by.forEach((list, m) => { const mesh = new THREE.Mesh(mergeGeometries(list), m); G.add(mesh); });
}
const LEAF = {}; const leafOf = (k) => LEAF[k] || (LEAF[k] = leafTex(k));

// ───────── Gộp hình khối tĩnh của nhiều nhóm (đảo láng giềng) theo vật liệu, trong hệ tọa độ thế giới ─────────
// T1.2 (PROJECT_ROADMAP.md §12.3): mỗi đảo láng giềng vốn tốn ~9 lệnh vẽ; gộp xuyên đảo còn ~1 lệnh vẽ cho mỗi loại vật liệu.
// Chỉ dùng cho nhóm không bị code khác đụng tới sau khi dựng (không raycast, không bật/tắt từng phần).
const uniIds = new WeakMap(); let uniN = 0;
const uniId = (u) => { if (!uniIds.has(u)) uniIds.set(u, ++uniN); return uniIds.get(u); };
const MKEYS = ['type', 'color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', 'opacity', 'transparent', 'side', 'blending', 'depthWrite', 'depthTest', 'vertexColors', 'alphaTest', 'flatShading', 'fog', 'toneMapped'];
function matKey(m) {
  if (m.isShaderMaterial) return `S|${uniId(m.uniforms)}|${m.transparent}|${m.side}|${m.depthWrite}|${m.blending}|${m.vertexShader}|${m.fragmentShader}`;
  if (Object.hasOwn(m, 'onBeforeCompile')) return 'O|' + m.uuid;   // shader tùy biến: chỉ gộp khi cùng một vật liệu
  return 'M|' + MKEYS.map((k) => { const v = m[k]; return v && v.isColor ? v.getHexString() : String(v); }).join('|') + '|' + (m.map ? m.map.uuid : '');
}
const attrSig = (g) => Object.keys(g.attributes).sort().map((k) => k + g.attributes[k].itemSize).join(',') + (g.index ? '|i' : '');
const FARLEAF = {};
function farLeafMat(kind) {
  if (FARLEAF[kind]) return FARLEAF[kind];
  const m = new THREE.MeshStandardMaterial({ map: leafOf(kind), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  m.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'attribute vec3 aC; uniform float uTime;\n' + sh.vertexShader
      .replace('#include <defaultnormal_vertex>', 'vec3 ic = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz; vec3 transformedNormal = normalMatrix * normalize(ic - aC + vec3(0.,1.2,0.));')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uTime*1.2 + ic.x*0.6 + ic.y*0.4)*0.09; transformed.y += cos(uTime*0.9 + ic.z*0.7)*0.05;'); };
  return (FARLEAF[kind] = m);
}
// Gộp hình khối tĩnh trong hệ tọa độ của chính `root` (nhóm vẫn di chuyển, raycast vẫn trúng).
// Bỏ qua: nhánh trong `live` (bật/tắt, co giãn, đổi vật liệu lúc chạy), vật liệu trong suốt (giữ thứ tự sắp xếp; trừ khi
// gọi với { transparent: true } cho các khối gần như đục),
// InstancedMesh, Points. Vật liệu trong `liveMats` (đổi màu lúc chạy) chỉ gộp khi đúng cùng một vật liệu.
export function bakeLocal(root, live = [], liveMats = [], { transparent = false } = {}) {
  const skip = new Set(live), hot = new Set(liveMats), inv = new THREE.Matrix4(), M = new THREE.Matrix4(), by = new Map(), rm = [];
  root.updateMatrixWorld(true); inv.copy(root.matrixWorld).invert();
  const walk = (o) => {
    if (skip.has(o) || !o.visible) return;
    if (o.isMesh && !o.isInstancedMesh && !o.isSkinnedMesh && !Array.isArray(o.material) && (transparent || !o.material.transparent) && !o.material.isShaderMaterial && !o.morphTargetInfluences) {
      const mat = o.material, key = `${hot.has(mat) ? 'L|' + mat.uuid : matKey(mat)}#${o.renderOrder}#${o.castShadow}${o.receiveShadow}`;
      M.multiplyMatrices(inv, o.matrixWorld); let g = o.geometry.clone().applyMatrix4(M);
      if (M.determinant() < 0) { g = g.index ? g.toNonIndexed() : g; const p = g.attributes; Object.values(p).forEach((a) => { for (let i = 0; i < a.count; i += 3) for (let k = 0; k < a.itemSize; k++) { const t = a.array[(i + 1) * a.itemSize + k]; a.array[(i + 1) * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k]; a.array[(i + 2) * a.itemSize + k] = t; } }); }
      Object.keys(g.attributes).forEach((k) => { if (k !== 'position' && k !== 'normal' && k !== 'uv' && !(k === 'color' && mat.vertexColors)) g.deleteAttribute(k); });
      if (!mat.map) g.deleteAttribute('uv'); else if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!by.has(key)) by.set(key, { mat, ro: o.renderOrder, cs: o.castShadow, rs: o.receiveShadow, list: [] });
      by.get(key).list.push(g); rm.push(o);
    }
    o.children.slice().forEach(walk);
  };
  root.children.slice().forEach(walk);
  rm.forEach((o) => o.parent.remove(o));
  let n = 0;
  by.forEach(({ mat, ro, cs, rs, list }) => {
    const mixed = list.some((g) => g.index) && list.some((g) => !g.index), gs = mixed ? list.map((g) => (g.index ? g.toNonIndexed() : g)) : list;
    const geo = gs.length === 1 ? gs[0] : mergeGeometries(gs); if (!geo) return;
    const m = new THREE.Mesh(geo, mat); m.name = 'baked'; m.renderOrder = ro; m.castShadow = cs; m.receiveShadow = rs; root.add(m); n++;
  });
  return { removed: rm.length, added: n };
}

export function bakeWorld(groups) {
  const out = new THREE.Group(); out.name = 'baked-isles';
  const meshes = new Map(), leaves = new Map(), rm = [];
  groups.forEach((G) => G.updateMatrixWorld(true));
  groups.forEach((G) => G.traverseVisible((o) => {
    if (!o.isMesh || o.userData.noBake) return;
    if (o.isInstancedMesh) {
      const fl = o.userData.farLeaf; if (!fl) return;
      if (!leaves.has(fl.kind)) leaves.set(fl.kind, { quad: fl.quad, list: [] });
      leaves.get(fl.kind).list.push({ o, center: fl.center.clone().applyMatrix4(o.matrixWorld) }); rm.push(o); return;
    }
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const key = `${matKey(o.material)}#${attrSig(g)}#${o.renderOrder}#${o.castShadow}${o.receiveShadow}`;
    if (!meshes.has(key)) meshes.set(key, { mat: o.material, list: [], ro: o.renderOrder, cs: o.castShadow, rs: o.receiveShadow });
    meshes.get(key).list.push(g); rm.push(o);
  }));
  rm.forEach((o) => o.parent.remove(o));
  meshes.forEach(({ mat, list, ro, cs, rs }) => {
    const geo = list.length === 1 ? list[0] : mergeGeometries(list); if (!geo) return;
    const m = new THREE.Mesh(geo, mat); m.renderOrder = ro; m.castShadow = cs; m.receiveShadow = rs; out.add(m);
  });
  const M = new THREE.Matrix4(), c = new THREE.Color();
  leaves.forEach(({ quad, list }, kind) => {
    const n = list.reduce((a, x) => a + x.o.count, 0), geo = quad.clone(), aC = new Float32Array(n * 3);
    const im = new THREE.InstancedMesh(geo, farLeafMat(kind), n); let k = 0;
    list.forEach(({ o, center }) => { for (let i = 0; i < o.count; i++, k++) { o.getMatrixAt(i, M); im.setMatrixAt(k, M.premultiply(o.matrixWorld)); if (o.instanceColor) { o.getColorAt(i, c); im.setColorAt(k, c); } center.toArray(aC, k * 3); } });
    geo.setAttribute('aC', new THREE.InstancedBufferAttribute(aC, 3)); im.computeBoundingSphere(); out.add(im);
  });
  return out;
}

export function leafTree({ count = 700, kind = 'bodhi', radius = 5, trunkH = 6.5, seed = 2, far = false }) {
  const G = new THREE.Group(), r = rng(seed), bark = BARK;
  const tg = new THREE.CylinderGeometry(radius * 0.085, radius * 0.19, trunkH, far ? 6 : 10, far ? 3 : 6), tp = tg.attributes.position;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) / trunkH + 0.5; tp.setX(i, tp.getX(i) + Math.sin(y * 2.6) * radius * 0.07); tp.setZ(i, tp.getZ(i) + Math.cos(y * 2.1) * radius * 0.04); }
  tg.translate(0, trunkH / 2, 0); tg.computeVertexNormals();
  const trunk = new THREE.Mesh(tg, bark); trunk.castShadow = true; G.add(trunk);
  const blobs = [[0, trunkH + radius * 0.5, 0, radius * 0.8]];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28 + r(), d = radius * (0.55 + r() * 0.25), y = trunkH + radius * (0.05 + r() * 0.35); blobs.push([Math.cos(a) * d, y, Math.sin(a) * d, radius * (0.5 + r() * 0.2)]);
    const bl = new THREE.CylinderGeometry(radius * 0.025, radius * 0.06, d * 1.25, far ? 4 : 6, 1, far); bl.translate(0, d * 0.62, 0); const b = new THREE.Mesh(bl, bark); b.position.set(0, trunkH * 0.82, 0); b.rotation.set(0, -a + Math.PI / 2, 0); b.rotateZ(-1.05); b.castShadow = true; G.add(b); }
  const center = new THREE.Vector3(0, trunkH + radius * 0.25, 0), quad = new THREE.PlaneGeometry(1.5, 1.5), tex = leafOf(kind);
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
  const uC = { value: center };
  mat.onBeforeCompile = (sh) => { sh.uniforms.uC = uC; sh.uniforms.uTime = U.uTime;
    sh.vertexShader = 'uniform vec3 uC; uniform float uTime;\n' + sh.vertexShader
      .replace('#include <defaultnormal_vertex>', 'vec3 ic = (instanceMatrix * vec4(0.,0.,0.,1.)).xyz; vec3 transformedNormal = normalMatrix * normalize(ic - uC + vec3(0.,1.2,0.));')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uTime*1.2 + ic.x*0.6 + ic.y*0.4)*0.09; transformed.y += cos(uTime*0.9 + ic.z*0.7)*0.05;'); };
  const leaves = new THREE.InstancedMesh(quad, mat, count), d = new THREE.Object3D(), c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const b = blobs[Math.floor(r() * blobs.length)], u = r() * 2 - 1, a = r() * 6.28, s = Math.sqrt(1 - u * u), rr = b[3] * (0.55 + 0.45 * Math.cbrt(r()));
    d.position.set(b[0] + rr * s * Math.cos(a), b[1] + rr * u * 0.72, b[2] + rr * s * Math.sin(a)); d.rotation.set(r() * 3, r() * 6, r() * 3); d.scale.setScalar((0.75 + r() * 0.6) * radius * 0.2); d.updateMatrix();
    leaves.setMatrixAt(i, d.matrix); leaves.setColorAt(i, c.setScalar(0.72 + r() * 0.5));
  }
  if (far) { G.traverse((o) => { o.castShadow = false; }); leaves.computeBoundingSphere(); leaves.userData.farLeaf = { kind, center: center.clone(), quad }; } else { leaves.castShadow = true; leaves.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 }); leaves.frustumCulled = false; }
  G.add(leaves);
  return { group: G, leaves, count, top: center };
}

// Cây gọn cho các đảo ở xa
const BLOB = [rockGeo(21, 2), rockGeo(27, 2)];
export function blobTree(color, s = 1, seed = 1, emissive = 0) {
  const G = new THREE.Group(), r = rng(seed), mat = std(color, { roughness: 0.95, emissive: color, emissiveIntensity: emissive });
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.34 * s, 3.2 * s, 7), std('#6b4b34')); t.position.y = 1.6 * s; G.add(t);
  [[0, 4.3, 0, 1.9], [-1.3, 3.6, 0.5, 1.3], [1.2, 3.7, -0.4, 1.35], [0.2, 3.4, 1.2, 1.1]].forEach(([x, y, z, k], i) => { const m = new THREE.Mesh(BLOB[i % 2], mat); m.position.set(x * s, y * s, z * s); m.scale.set(k * s, k * s * 0.8, k * s); m.rotation.y = r() * 6; G.add(m); });
  return G;
}

function lotusGeo() {
  const list = [], pink = C('#f29bbd'), white = C('#fff3f6'), yel = C('#f6cf4a'), tmp = new THREE.Color();
  const tint = (g, f) => { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { f(p, i, tmp); c.set([tmp.r, tmp.g, tmp.b], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  [[9, 0.95, 0.30], [7, 0.5, 0.25], [5, 0.15, 0.2]].forEach(([n, tilt, len], ring) => { for (let k = 0; k < n; k++) {
    const g = new THREE.SphereGeometry(1, 8, 6); g.scale(0.11, 0.022, len); g.translate(0, 0, len * 0.9);
    tint(g, (p, i, o) => o.copy(pink).lerp(white, Math.min(1, p.getZ(i) / (len * 1.7)) * 0.9));
    g.rotateX(-(Math.PI / 2 - tilt)); g.rotateY((k / n) * 6.283 + ring * 0.4); list.push(g); } });
  const c = new THREE.SphereGeometry(0.09, 8, 6); c.translate(0, 0.1, 0); list.push(tint(c, (p, i, o) => o.copy(yel)));
  return mergeGeometries(list.map((g) => g.toNonIndexed()));
}

export function waterfall(w, h) {
  const g = new THREE.PlaneGeometry(w, h, 4, 18), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const t = 0.5 - p.getY(i) / h; p.setZ(i, t * t * w * 0.9); p.setX(i, p.getX(i) * (1 + t * 0.5)); }
  g.translate(0, -h / 2, 0);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: U,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv; ${NOISE}
    void main(){ float s = fbm(vec2(vUv.x*13., vUv.y*3.2 + uTime*1.7)); float k = smoothstep(0.34,0.74,s);
      vec3 col = mix(vec3(0.74,0.90,0.96), vec3(1.08), k);
      float a = (0.30+0.62*k)*smoothstep(0.,0.14,vUv.x)*smoothstep(1.,0.86,vUv.x)*smoothstep(0.0,0.28,vUv.y);
      ${OUT} }` });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 4; return mesh;
}

// ───────── Vân Đảo của người dùng: 6 phân khu ─────────
export function buildHome() {
  const G = new THREE.Group(), r = rng(42), H = { group: G };
  const dirt = C('#b3a58c'), bed = C('#5d6a52');
  const T = terrain({ sx: SX, sz: SZ, M: 128, NT: 30, NS: 16, depth: 48, seed: 7, height: groundH, phases: [0.8, 2.1, 0.3],
    paint: (x, z) => { const d = pathDist(x, z); if (d < 1.5) return { c: dirt, k: Math.min(1, (1.5 - d) / 0.6) * 0.85 }; const px = (x - POND.x) / POND.rx, pz = (z - POND.z) / POND.rz; if (px * px + pz * pz < 1.1) return { c: bed, k: 0.8 }; return null; } });
  const land = new THREE.Mesh(T.geo, terrainMat()); land.receiveShadow = true; land.castShadow = true; G.add(land); H.land = land; H.frac = T.frac;
  const free = (x, z, pad = 0) => { const f = T.frac(x, z); if (f > 0.9) return false; if (pathDist(x, z) < 1.3 + pad) return false; const px = (x - POND.x) / (POND.rx + 0.6), pz = (z - POND.z) / (POND.rz + 0.6); if (px * px + pz * pz < 1) return false; if (Math.abs(x - HILL.x) < 8.6 && Math.abs(z - HILL.z) < 6.8) return false; return true; };
  const scatter = (n, pad, fn) => { let k = 0, guard = 0; while (k < n && guard++ < n * 30) { const a = r() * 6.28, d = Math.sqrt(r()), x = SX * d * Math.cos(a) * 1.05, z = SZ * d * Math.sin(a) * 1.05; if (free(x, z, pad)) fn(x, z, k++); } };
  const d = new THREE.Object3D(), c = new THREE.Color();

  // Cỏ, hoa, đá, lối đá
  const q1 = new THREE.PlaneGeometry(0.95, 0.8); q1.translate(0, 0.4, 0); const q2 = q1.clone(); q2.rotateY(Math.PI / 2);
  const gq = mergeGeometries([q1, q2]); const nn = gq.attributes.normal; for (let i = 0; i < nn.count; i++) nn.setXYZ(i, 0, 1, 0);
  const gm = new THREE.MeshStandardMaterial({ map: grassTex(), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 1 });
  gm.onBeforeCompile = (sh) => { sh.uniforms.uTime = U.uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.x += sin(uTime*1.7 + instanceMatrix[3].x*0.7 + instanceMatrix[3].z*0.5)*0.1*uv.y;'); };
  const grass = new THREE.InstancedMesh(gq, gm, 3000);
  scatter(3000, -0.3, (x, z, i) => { d.position.set(x, groundH(x, z) - 0.05, z); d.rotation.set(0, r() * 6.28, 0); d.scale.set(0.8 + r() * 0.9, 0.6 + r() * 0.9, 0.8 + r() * 0.9); d.updateMatrix(); grass.setMatrixAt(i, d.matrix); grass.setColorAt(i, c.setHSL(0.24 + r() * 0.07, 0.42 + r() * 0.2, 0.3 + r() * 0.16)); });
  grass.receiveShadow = true; G.add(grass);
  const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 6, 5), new THREE.MeshStandardMaterial({ roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.25 }), 190);
  const fc = ['#fff6d8', '#ffd9e6', '#ffe58a', '#e6dcff', '#ffffff'];
  scatter(190, 0, (x, z, i) => { d.position.set(x, groundH(x, z) + 0.42 + r() * 0.2, z); d.rotation.set(0, 0, 0); d.scale.setScalar(0.7 + r() * 0.8); d.updateMatrix(); flowers.setMatrixAt(i, d.matrix); flowers.setColorAt(i, c.set(fc[Math.floor(r() * fc.length)])); });
  G.add(flowers);
  H.grow = { value: 1 }; const stoneMat = std('#bdb6a8', { roughness: 1 });
  stoneMat.onBeforeCompile = (sh) => { sh.uniforms.uGrow = H.grow; sh.vertexShader = 'uniform float uGrow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float gI = float(gl_InstanceID); float keep = step(0.5, uGrow*3.0 - mod(gI, 3.0)*0.9 + 0.4); float gs = mix(0.5, 1.12, smoothstep(0.0, 0.95, uGrow))*keep; transformed.xz *= gs*(1.0 + (1.0-uGrow)*0.25*sin(gI*7.3)); transformed.y *= keep*mix(1.6, 1.0, uGrow);'); };
  const stones = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.62, 0.72, 0.16, 9), stoneMat, 80); let sn = 0;
  PATH.forEach(([a, b]) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.floor(L / 1.55); for (let i = 0; i <= n && sn < 80; i++) { const t = i / Math.max(1, n), x = a[0] + (b[0] - a[0]) * t + (r() - 0.5) * 0.4, z = a[1] + (b[1] - a[1]) * t + (r() - 0.5) * 0.4; d.position.set(x, groundH(x, z) + 0.04, z); d.rotation.set(0, r() * 6, 0); d.scale.set(0.8 + r() * 0.5, 1, 0.8 + r() * 0.5); d.updateMatrix(); stones.setMatrixAt(sn++, d.matrix); } });
  stones.count = sn; stones.receiveShadow = true; G.add(stones);
  ROCK.forEach((geo, gi) => { const m = new THREE.InstancedMesh(geo, rockMat, 18); let k = 0;
    scatter(18, 0.6, (x, z) => { const f = T.frac(x, z), s = 0.35 + r() * (f > 0.6 ? 1.3 : 0.6); d.position.set(x, groundH(x, z) + s * 0.2, z); d.rotation.set(r(), r() * 6, r()); d.scale.set(s, s * 0.7, s); d.updateMatrix(); m.setMatrixAt(k++, d.matrix); });
    m.castShadow = true; m.receiveShadow = true; G.add(m); });

  // Đài Thiền: phiến đá phủ rêu vươn ra biển mây
  const slab = new THREE.Mesh(ROCK[0], rockMat); slab.scale.set(7.4, 1.5, 5.2); slab.position.set(26.5, 10.5, 2); slab.castShadow = slab.receiveShadow = true; G.add(slab);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.6, 0.5, 14), std('#648a3c', { roughness: 1 })); top.scale.set(1.25, 1, 0.82); top.position.set(26.5, 11.7, 2); top.receiveShadow = true; G.add(top);
  const stoneM = std('#cbc4b6', { roughness: 0.95 }), inlayM = std('#8f8a80', { roughness: 0.9 });
  const deck = (D) => { const g = new THREE.Group(), b = deckBase(D); g.position.set(D.x, b, D.z);
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(D.r + 0.7, D.r + 0.82, 1.5, 44), stoneM); lo.position.y = 0.3 - 0.75; const hi = new THREE.Mesh(new THREE.CylinderGeometry(D.r, D.r + 0.03, 0.3, 44), stoneM); hi.position.y = 0.45;
    [lo, hi].forEach((o) => { o.castShadow = o.receiveShadow = true; g.add(o); });
    const rings = new THREE.Group(); g.add(rings); [0.55, 0.86].forEach((k) => { const ring = new THREE.Mesh(new THREE.RingGeometry(D.r * k - 0.07, D.r * k + 0.07, 48), inlayM); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.606; rings.add(ring); });
    // hoa văn sáng (giai đoạn cuối): tám cánh sen phát quang
    const glow = new THREE.Group(); g.add(glow); const gm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.5, 0.75), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) { const pt = new THREE.Mesh(new THREE.CircleGeometry(D.r * 0.2, 14), gm); pt.scale.set(0.5, 1, 1); pt.rotation.x = -Math.PI / 2; pt.rotation.z = (i / 8) * 6.283; pt.position.set(Math.sin((i / 8) * 6.283) * D.r * 0.7 * -1, 0.612, Math.cos((i / 8) * 6.283) * D.r * 0.7 * -1); glow.add(pt); }
    const gr = new THREE.Mesh(new THREE.RingGeometry(D.r * 0.94, D.r * 0.99, 64), gm); gr.rotation.x = -Math.PI / 2; gr.position.y = 0.612; glow.add(gr);
    // đá ngồi thô (giai đoạn đầu)
    const seat = new THREE.Mesh(ROCK[0], rockMat); seat.scale.set(1.1, 0.34, 0.95); seat.position.y = 0.12; seat.castShadow = seat.receiveShadow = true; g.add(seat);
    g.userData = { lo, hi, rings, glow, glowMat: gm, seat };
    G.add(g); return g; };
  const padDeck = (H.padDeck = deck(DECKS[0]));
  const zafu = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 10), std('#8a5a3a', { roughness: 1 })); zafu.scale.y = 0.2; zafu.position.y = 0.66; zafu.castShadow = true; padDeck.add(zafu); padDeck.userData.zafu = zafu; padDeck.userData.lamps = [];
  [[-2.2, 1.6], [2.2, 1.6]].forEach(([x, z]) => { const lt = new THREE.Group(); lt.position.set(x, 0.6, z); padDeck.add(lt);
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.2, 0.7, 6), stoneM); a.position.y = 0.35; const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, 0.34), new THREE.MeshStandardMaterial({ color: '#ffe6b0', emissive: '#ffb04a', emissiveIntensity: 1.6 })); b2.position.y = 0.85; const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.24, 4), stoneM); c2.position.y = 1.12; c2.rotation.y = Math.PI / 4; [a, b2, c2].forEach((o) => { o.castShadow = true; lt.add(o); }); padDeck.userData.lamps.push(lt); });
  { const fl = new THREE.Group(); padDeck.add(fl); padDeck.userData.flowers = fl; const pm = std('#f3a9c2', { roughness: 0.8, emissive: '#7a2a48', emissiveIntensity: 0.25 }), lm = std('#4f8a45', { roughness: 1 });
    for (let i = 0; i < 9; i++) { const a = 0.5 + i * 0.62, rr = DECKS[0].r + 1.25 + (i % 2) * 0.35; if (Math.cos(a) < -0.75) continue; const b = new THREE.Mesh(BLOB[i % 2], lm); b.scale.set(0.42, 0.3, 0.42); b.position.set(Math.cos(a) * rr, 0.12, Math.sin(a) * rr); fl.add(b); for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), pm); f.position.set(b.position.x + (k - 1) * 0.17, 0.4 + (k % 2) * 0.06, b.position.z + (k % 2) * 0.14); fl.add(f); } } }
  H.padPos = new THREE.Vector3(26.5, deckBase(DECKS[0]) + 0.62, 2);

  // Tịnh Thất
  const pv = pavilion(); pv.group.position.set(HILL.x, groundH(HILL.x, HILL.z) - 0.35, HILL.z); pv.group.scale.setScalar(1.2); G.add(pv.group); H.pv = pv;
  { const fy = pvFloor(), stM = std('#c2bbad', { roughness: 0.95 }), list = [], posts = [], rough = [];
    for (let k = 0; k < 26; k++) { const z = STAIR.z0 + (k + 0.5) * STAIR.run, top = fy - (k + 1) * STAIR.rise, gy = groundH(STAIR.x, z); if (top < gy + 0.05) break;
      const hgt = top - gy + 0.9, bx = new THREE.BoxGeometry(STAIR.hw * 2, hgt, STAIR.run + 0.02); bx.translate(STAIR.x, top - hgt / 2, z); list.push(bx);
      if (k % 4 === 0) [-1, 1].forEach((sd) => { const post = new THREE.BoxGeometry(0.26, 0.8, 0.26); post.translate(STAIR.x + sd * (STAIR.hw + 0.17), top + 0.18, z); posts.push(post); });
      [-0.55, 0.5].forEach((ox, q) => { const rk = new THREE.IcosahedronGeometry(0.62, 1), rr = rng(k * 7 + q); rk.scale(1.05 + rr() * 0.3, hgt * 0.5 + 0.2, 0.42 + rr() * 0.12); rk.rotateY((rr() - 0.5) * 0.5); rk.translate(STAIR.x + ox + (rr() - 0.5) * 0.2, top - hgt * 0.31 - 0.14, z); rough.push(rk); }); }
    H.stairs = new THREE.Mesh(mergeGeometries(list), stM); H.stairPosts = new THREE.Mesh(mergeGeometries(posts), stM); H.stairRough = new THREE.Mesh(mergeGeometries(rough), rockMat);
    [H.stairs, H.stairPosts, H.stairRough].forEach((o) => { o.castShadow = o.receiveShadow = true; G.add(o); }); }
  { // chỗ tọa thiền trong Tịnh Thất: bục gỗ thấp, chiếu và bồ đoàn, nhìn ra cửa chính
    const kg = new THREE.Group(); kg.position.set(HILL.x, pvFloor(), HILL.z + 1.4); G.add(kg);
    const dais = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 2.6), std('#5e3a26', { roughness: 0.7 })); dais.position.y = 0.1; const mat2 = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 2.1), std('#c9b98a', { roughness: 1 })); mat2.position.y = 0.22;
    const zf = new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 10), std('#7d4a2e', { roughness: 1 })); zf.scale.y = 0.22; zf.position.y = 0.33;
    [dais, mat2, zf].forEach((o) => { o.castShadow = o.receiveShadow = true; kg.add(o); }); }

  // Vườn Tâm Thức: cây Bồ-đề và Hồ Sen
  const tree = leafTree({ count: 900, kind: 'bodhi', radius: 5.4, trunkH: 6.6, seed: 5 }); tree.group.position.copy(P(-22, 5, -0.15)); G.add(tree.group); H.tree = tree;
  const gl = new Float32Array(80 * 3); for (let i = 0; i < 80; i++) { const a = r() * 6.28, rr = 1.5 + r() * 4.2; gl.set([Math.cos(a) * rr, 6.5 + r() * 6.5, Math.sin(a) * rr], i * 3); }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gl, 3));
  H.glints = new THREE.Points(gg, new THREE.PointsMaterial({ color: new THREE.Color(2.2, 1.7, 0.7), size: 0.42, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); tree.group.add(H.glints);
  { const gm = std('#bdb6a8', { roughness: 0.95 });
    const mg = new THREE.Group(); mg.position.copy(P(-15.6, 7.0)); mg.rotation.y = Math.atan2(-6.4, -2.0); G.add(mg);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.3, 10, 40), gm); ring.position.y = 2.0; ring.castShadow = true; mg.add(ring);
    [-2.5, 2.5].forEach((x) => { const w = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.5), gm); w.position.set(x * 1.12, 1.2, 0); w.castShadow = w.receiveShadow = true; mg.add(w); const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.8), std('#55606b', { roughness: 0.6 })); cap.position.set(x * 1.12, 2.58, 0); cap.castShadow = true; mg.add(cap); });
    const T0 = P(-22, 5), flat = new THREE.CylinderGeometry(0.5, 0.56, 0.16, 9), ringSt = new THREE.InstancedMesh(flat, gm, 30); let k = 0;
    [[3.3, 11], [5.1, 17]].forEach(([rad, n]) => { for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + rad, x = T0.x + Math.cos(a) * rad, z = T0.z + Math.sin(a) * rad; if (T.frac(x, z) > 0.86) continue; d.position.set(x, groundH(x, z) + 0.05, z); d.rotation.set(0, a, 0); d.scale.set(1, 1, 0.8); d.updateMatrix(); ringSt.setMatrixAt(k++, d.matrix); } });
    ringSt.count = k; ringSt.receiveShadow = true; G.add(ringSt);
    const mir = new THREE.Group(); mir.position.copy(P(-18.4, 9.6)); mir.rotation.y = 2.5; G.add(mir);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.7), gm); base.position.y = 0.25; base.castShadow = true; mir.add(base);
    const fr = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.09, 8, 36), std('#6e5a3a', { roughness: 0.5, metalness: 0.6 })); fr.position.y = 1.5; mir.add(fr);
    const gl2 = new THREE.Mesh(new THREE.CircleGeometry(0.93, 36), new THREE.MeshStandardMaterial({ color: '#dfe9f2', metalness: 1, roughness: 0.06, side: THREE.DoubleSide })); gl2.position.y = 1.5; mir.add(gl2);
    [[-25.6, 1.2], [-17.6, 2.6], [-24.6, 9.6]].forEach(([x, z]) => { const lt = new THREE.Group(); lt.position.copy(P(x, z)); G.add(lt);
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.9, 6), gm); a.position.y = 0.45; const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.4), new THREE.MeshStandardMaterial({ color: '#ffe6b0', emissive: '#ffb04a', emissiveIntensity: 1.8 })); b2.position.y = 1.07; const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.44, 0.3, 4), gm); c2.position.y = 1.39; c2.rotation.y = Math.PI / 4; [a, b2, c2].forEach((o) => { o.castShadow = true; lt.add(o); }); });
    [[-27.2, 2.4, 'blossom', 2.6, 3.6], [-25.2, 11.2, 'pine', 2.2, 4.6], [-18.2, 13.2, 'blossom', 2.4, 3.2], [-20.4, -0.6, 'pine', 2.0, 4.2], [-28.4, 7.4, 'blossom', 2.0, 3.0]].forEach(([x, z, kind, rad, th], i) => { if (T.frac(x, z) > 0.9) return; const t2 = leafTree({ count: 300, kind, radius: rad, trunkH: th, seed: 40 + i }); t2.group.position.copy(P(x, z, -0.15)); G.add(t2.group); }); }
  const wy = groundH(POND.x, POND.z) + 0.72;
  H.water = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { ...U, uClar: { value: 0 }, uWater: { value: 0 }, uNight: { value: 0 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform float uTime,uClar,uWater,uNight; varying vec2 vUv; varying vec3 vW; ${NOISE}
    void main(){ vec2 p = vW.xz; float n = fbm(p*0.8 + vec2(uTime*0.10, uTime*0.07)); float n2 = fbm(p*2.4 - uTime*0.09);
      vec3 deep = mix(vec3(0.22,0.34,0.33), vec3(0.14,0.52,0.50), uClar); vec3 sky = mix(vec3(1.0,0.90,0.70), vec3(0.62,0.80,0.96), n);
      vec3 col = mix(deep, sky, (0.30+0.42*n2)*(0.55+0.45*uClar));
      float rp = 0.; for (int i = 0; i < 4; i++) { float fi = float(i); vec2 c = vec2(${(-3).toFixed(1)} + sin(fi*2.4)*4.2, ${(9.3).toFixed(1)} + cos(fi*1.7)*2.8); float dd = length(p - c); rp += sin(dd*6.5 - uTime*(1.6+fi*0.3) + fi)*exp(-dd*0.45); }
      col += vec3(0.9,0.97,1.0)*rp*0.05*(0.5+0.5*uClar);
      float sp = noise(p*8.5 + vec2(uTime*0.7, -uTime*0.4))*noise(p*6.3 - vec2(uTime*0.5, uTime*0.6) + 3.7); sp = pow(sp, 3.0)*9.0;
      col += vec3(1.9,1.75,1.3)*smoothstep(0.55,1.0,sp)*(0.35+0.65*uClar)*(1.0-0.5*uNight);
      col += vec3(1.0,0.95,0.8)*smoothstep(0.70,0.76,n*0.6+n2*0.5)*(0.2+0.3*uClar) + vec3(0.1,0.35,0.28)*0.22*uClar;
      col = mix(col, col*vec3(0.45,0.5,0.8), uNight*0.7);
      float a = (0.62+0.33*uClar)*smoothstep(1.0,0.90,length(vUv*2.-1.))*uWater; ${OUT} }` });
  const pond = new THREE.Mesh(new THREE.CircleGeometry(1, 48), H.water); pond.rotation.x = -Math.PI / 2; pond.scale.set(POND.rx, POND.rz, 1); pond.position.set(POND.x, wy, POND.z); pond.renderOrder = 3; G.add(pond);
  const rim = new THREE.InstancedMesh(ROCK[1], rockMat, 22); for (let i = 0; i < 22; i++) { const a = (i / 22) * 6.28 + r() * 0.2, s = 0.45 + r() * 0.5, x = POND.x + Math.cos(a) * (POND.rx + 0.5), z = POND.z + Math.sin(a) * (POND.rz + 0.5); d.position.set(x, groundH(x, z) + 0.15, z); d.rotation.set(r(), r() * 6, r()); d.scale.set(s, s * 0.65, s); d.updateMatrix(); rim.setMatrixAt(i, d.matrix); }
  rim.castShadow = rim.receiveShadow = true; G.add(rim);
  const lg = lotusGeo(), padG = new THREE.CircleGeometry(0.78, 16, 0.35, 5.6); padG.rotateX(-Math.PI / 2);
  const pinkM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: '#c0507a', emissiveIntensity: 0.18, side: THREE.DoubleSide }), goldM = new THREE.MeshStandardMaterial({ vertexColors: true, color: '#ffe9a6', roughness: 0.5, emissive: '#ffc85a', emissiveIntensity: 0.8, side: THREE.DoubleSide }), padM = std('#3f7d45', { side: THREE.DoubleSide });
  H.lotus = [];
  for (let i = 0; i < 12; i++) { const a = i * 2.4, rr = 0.22 + (i % 4) * 0.2, g = new THREE.Group(); g.position.set(POND.x + Math.cos(a) * rr * POND.rx, wy + 0.03, POND.z + Math.sin(a) * rr * POND.rz);
    const pd = new THREE.Mesh(padG, padM); pd.rotation.y = r() * 6; pd.position.x = 0.5; g.add(pd); const fl = new THREE.Mesh(lg, pinkM); fl.position.y = 0.16; fl.scale.setScalar(1.25); fl.rotation.y = r() * 6; g.add(fl); g.visible = false; G.add(g); H.lotus.push({ g, fl, pinkM, goldM }); }
  { // ánh lấp lánh trên mặt hồ và quanh hoa sen
    const n = 70, pos = new Float32Array(n * 3), ph = new Float32Array(n); for (let i = 0; i < n; i++) { const a = r() * 6.28, q = Math.sqrt(r()) * 0.86; pos.set([POND.x + Math.cos(a) * q * POND.rx, wy + 0.12 + r() * 0.5, POND.z + Math.sin(a) * q * POND.rz], i * 3); ph[i] = r() * 6.28; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('aPh', new THREE.BufferAttribute(ph, 1));
    H.pglints = new THREE.Points(pg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...U, uOn: { value: 0 } },
      vertexShader: 'attribute float aPh; uniform float uTime,uOn; varying float vK; void main(){ vK = pow(0.5+0.5*sin(uTime*(1.4+fract(aPh)*1.8)+aPh), 4.0)*uOn; vec4 mv = modelViewMatrix*vec4(position + vec3(0., sin(uTime*0.6+aPh)*0.08, 0.),1.); gl_PointSize = (4.0+10.0*vK)*(60.0/-mv.z); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'varying float vK; void main(){ vec2 q = gl_PointCoord*2.-1.; float d = dot(q,q); float a = exp(-d*5.0)*vK; gl_FragColor = vec4(vec3(2.2,1.9,1.2)*a, a); }' })); H.pglints.frustumCulled = false; G.add(H.pglints); }
  H.fall = waterfall(2.0, 30); H.fall.position.set(-8, groundH(-8, 17) - 0.9, 20.2); H.fall.rotation.y = 0.15; G.add(H.fall);

  // Trà Đạo Tỉnh Thức
  const Tea = (H.tea = new THREE.Group()); Tea.position.set(7, deckBase(DECKS[1]) + 0.6, -8.5); G.add(Tea);
  { const dk = (H.teaDeck = deck(DECKS[1])); G.remove(dk); dk.position.set(0, -0.6, 0); Tea.add(dk); dk.userData.seat.visible = false; }
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.14, 28), std('#b9b2a4', { roughness: 0.8 })); tb.position.y = 0.52; const tleg = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.6, 0.46, 14), std('#a39c8e', { roughness: 1 })); tleg.position.y = 0.23; [tb, tleg].forEach((o) => { o.castShadow = o.receiveShadow = true; Tea.add(o); });
  const pot = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), std('#7a4a34', { roughness: 0.4 })); pot.scale.y = 0.85; pot.position.set(0, 0.74, 0); Tea.add(pot);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.2, 6), std('#7a4a34', { roughness: 0.4 })); spout.rotation.z = -1.0; spout.position.set(0.2, 0.78, 0); Tea.add(spout);
  [0.6, 2.2, 3.8, 5.4].forEach((a) => { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.08, 10), std('#f2ede2', { roughness: 0.3 })); cup.position.set(Math.cos(a) * 0.72, 0.63, Math.sin(a) * 0.72); Tea.add(cup);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.5, 0.2, 16), std('#b3ac9e', { roughness: 1 })); sl.position.set(Math.cos(a) * 1.95, 0.1, Math.sin(a) * 1.95); sl.castShadow = sl.receiveShadow = true; Tea.add(sl); });
  const pine = new THREE.Group(); pine.position.set(5.2, -0.7, -2.4); Tea.add(pine);
  const ptg = new THREE.CylinderGeometry(0.13, 0.3, 4.2, 7, 5), ptp = ptg.attributes.position; for (let i = 0; i < ptp.count; i++) { const y = ptp.getY(i) / 4.2 + 0.5; ptp.setX(i, ptp.getX(i) + Math.sin(y * 3) * 0.55); } ptg.translate(0, 2.1, 0); ptg.computeVertexNormals();
  const pt = new THREE.Mesh(ptg, std('#5a4330', { roughness: 1 })); pt.castShadow = true; pine.add(pt);
  const pineM = std('#3d6b45', { roughness: 1 });
  [[0.5, 4.3, 0, 1.7], [-0.9, 3.3, 0.5, 1.2], [1.4, 3.0, -0.3, 1.1], [0.1, 5.0, -0.5, 1.0]].forEach(([x, y, z, k], i) => { const m = new THREE.Mesh(BLOB[i % 2], pineM); m.position.set(x, y, z); m.scale.set(k, k * 0.32, k); m.castShadow = true; pine.add(m); });

  // Cổng Vân Môn
  const Gt = (H.gate = new THREE.Group()); Gt.position.copy(P(15.5, 15.5)); Gt.rotation.y = -Math.PI / 4; G.add(Gt);
  [-2.3, 2.3].forEach((x, i) => { const s = new THREE.Mesh(ROCK[i + 1], rockMat); s.scale.set(0.75, 2.5, 0.75); s.position.set(x, 1.6, 0); s.castShadow = true; Gt.add(s); });
  H.cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.94, emissive: '#fff4e0', emissiveIntensity: 0.55 });
  for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI, m = new THREE.Mesh(BLOB[i % 2], H.cloudMat); m.position.set(Math.cos(a) * 2.3, 2.5 + Math.sin(a) * 2.2, 0); m.scale.setScalar(0.62 + 0.2 * Math.sin(i * 2)); Gt.add(m); }
  H.veil = new THREE.Group(); Gt.add(H.veil);
  [[0, 1.2, 1.5], [-1.1, 2.1, 1.2], [1.1, 2.0, 1.25], [0, 3.0, 1.2], [-0.9, 0.8, 1.0], [0.9, 0.8, 1.0]].forEach(([x, y, s], i) => { const m = new THREE.Mesh(BLOB[i % 2], H.cloudMat); m.position.set(x, y, 0); m.scale.setScalar(s * 0.9); H.veil.add(m); });
  for (let i = 0; i < 5; i++) { const t = (i + 1) / 5.5, s = new THREE.Mesh(ROCK[i % 3], rockMat); s.scale.set(1.5, 0.3, 1.25); s.position.set(17.5 + t * 17, groundH(17, 17) - 1.5 - t * 6, 17.5 + t * 17); s.rotation.y = i; s.castShadow = true; G.add(s); }

  // Bia Tích Lũy
  const St = (H.stele = new THREE.Group()); St.position.copy(P(10.5, 10)); St.rotation.y = 0.5; G.add(St);
  const sh = new THREE.Shape(); sh.moveTo(-0.9, 0); sh.lineTo(0.9, 0); sh.lineTo(0.9, 2.5); sh.absarc(0, 2.5, 0.9, 0, Math.PI, false); sh.lineTo(-0.9, 0);
  const sb = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.42, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }), std('#4b474d', { roughness: 0.85 })); sb.position.z = -0.21; sb.castShadow = true; St.add(sb);
  H.steleMat = new THREE.MeshBasicMaterial({ map: steleTex(), color: new THREE.Color(2.0, 1.7, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const sf = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.9), H.steleMat); sf.position.set(0, 1.62, 0.3); St.add(sf);
  const sbase = new THREE.Mesh(ROCK[2], rockMat); sbase.scale.set(1.4, 0.35, 0.8); sbase.position.y = 0.05; St.add(sbase);

  // Suối Pháp lưu (mở từ Tầng 1)
  const sp = [[-17, -1], [-26, 6], [-17, 14], [-4, 16], [6, 11.5], [4.5, 2.5], [-6, 0]].map(([x, z]) => P(x, z, 0.16));
  H.streamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.1, 1.9, 1.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  const stg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp, true), 180, 0.42, 6, true); stg.scale(1, 0.25, 1); stg.translate(0, groundH(0, 5) * 0.75, 0);
  { const pts = [[-5.3, 13.7], [-6.5, 15.6], [-7.5, 17.6], [-8.0, 19.4], [-8.1, 20.6]].map(([x, z]) => new THREE.Vector3(x, 0, z)), cv = new THREE.CatmullRomCurve3(pts), N = 40, pos = [], uv = [], side = [], idx = [];
    for (let i = 0; i <= N; i++) { const t = i / N, c = cv.getPoint(t), tg = cv.getTangent(t), nx = tg.z, nz = -tg.x, y = Math.max(groundH(c.x, c.z), groundH(c.x + nx * 0.7, c.z + nz * 0.7), groundH(c.x - nx * 0.7, c.z - nz * 0.7)) + 0.07 - t * t * 0.5;
      [-1, 1].forEach((sd) => { pos.push(c.x, y, c.z); side.push(nx * sd, 0, nz * sd); uv.push(sd * 0.5 + 0.5, t); }); if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); sg.setIndex(idx);
    H.brook = new THREE.Mesh(sg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { ...U, uFlow: { value: 0 }, uNight: { value: 0 } },
      vertexShader: 'attribute vec3 aSide; uniform float uFlow; varying vec2 vUv; void main(){ vUv = uv; vec3 p = position + aSide*(0.22 + 0.62*uFlow)*(0.8 + 0.35*sin(uv.y*9.0)); gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.); }',
      fragmentShader: `uniform float uTime,uFlow,uNight; varying vec2 vUv; ${NOISE}
      void main(){ float sp = 0.5 + 1.1*uFlow; float n = fbm(vec2(vUv.x*3.0, vUv.y*9.0 - uTime*sp)); float n2 = noise(vec2(vUv.x*8.0 + 3.0, vUv.y*26.0 - uTime*sp*2.2));
        vec3 col = mix(vec3(0.30,0.62,0.66), vec3(0.92,0.98,1.0), smoothstep(0.45,0.85,n*0.6+n2*0.5)); col += vec3(1.6,1.6,1.5)*smoothstep(0.78,0.95,n2)*(0.25+0.6*uFlow);
        col = mix(col, col*vec3(0.45,0.5,0.8), uNight*0.7); float e = smoothstep(0.0,0.3,vUv.x)*smoothstep(1.0,0.7,vUv.x);
        float a = e*(0.35 + 0.5*uFlow)*smoothstep(0.0,0.06,vUv.y)*smoothstep(0.0,0.04,uFlow); ${OUT} }` }));
    H.brook.renderOrder = 2; H.brook.frustumCulled = false; G.add(H.brook); H.stream = new THREE.Object3D(); }
  // Tiến hóa theo 49 ngày. L: 0..1 tiến trình; water: 0..1 lượng nước hồ; tea: khu trà đã mở
  H.evolve = (L, isl, time) => {
    const st = L < 0.14 ? 0 : L < 0.43 ? 1 : L < 0.71 ? 2 : L < 0.9 ? 3 : 4, pu = H.padDeck.userData;
    DECKS[0].lv = st === 0 ? 0 : st === 1 ? 1 : 2; DECKS[0].seat = st === 0 ? 0.17 : st === 1 ? 0.22 : 0.16;
    pu.lo.visible = st >= 1; pu.hi.visible = st >= 2; pu.seat.visible = st < 2; pu.seat.position.y = st === 0 ? 0.12 : 0.36; pu.zafu.visible = st >= 2; pu.rings.visible = st >= 3; pu.lamps.forEach((l) => { l.visible = st >= 3; }); pu.flowers.visible = st >= 2; pu.flowers.scale.setScalar(st >= 3 ? 1 : 0.6);
    pu.glow.visible = st >= 4; pu.glowMat.opacity = 0.45 + 0.3 * Math.sin(time * 1.3);
    const tu = H.teaDeck.userData, ts = L < 0.5 ? 1 : L < 0.75 ? 2 : L < 0.9 ? 3 : 4; DECKS[1].lv = ts >= 2 ? 2 : 1; tu.hi.visible = ts >= 2; tu.rings.visible = ts >= 3; tu.glow.visible = ts >= 4; H.tea.position.y = deckBase(DECKS[1]) + (ts >= 2 ? 0.6 : 0.3); H.teaDeck.position.y = ts >= 2 ? -0.6 : -0.3;
    H.grow.value = L; H.stairRough.visible = L < 0.3; H.stairs.visible = L >= 0.3; H.stairPosts.visible = L >= 0.6;
    const flow = Math.min(1, isl.water) * (0.25 + 0.75 * L); H.brook.material.uniforms.uFlow.value = flow; H.brook.visible = flow > 0.03; H.fall.visible = flow > 0.1; H.fall.scale.x = 0.25 + 0.75 * flow;
    return st;
  };
  // T1.2: gộp phần tĩnh (Tịnh Thất, lối đi, vườn, cổng, bia…) theo vật liệu. Phần đổi theo tiến trình hay bị world.js
  // bật/tắt, co giãn, đổi màu thì giữ nguyên: đất (raycast), Đài Thiền, khu trà, sen, bậc thang, suối, thác, cây Bồ-đề, màn mây cổng.
  H.bake = [
    bakeLocal(H.tree.group, [H.tree.leaves, H.glints]),                       // thân và cành cây Bồ-đề (cả cây co giãn theo tiến trình)
    bakeLocal(H.veil, [], [], { transparent: true }), bakeLocal(H.gate, [H.veil], [], { transparent: true }),   // mây cổng Vân Môn, độ mờ 0,94
    bakeLocal(H.pv.group, [], [H.pv.mats.roof, H.pv.mats.wood, H.pv.altar.material]),
    bakeLocal(H.tea, [H.teaDeck]),
    bakeLocal(G, [land, H.pv.group, H.padDeck, H.tea, ...H.lotus.map((l) => l.g), H.stairs, H.stairPosts, H.stairRough, H.brook, H.fall, H.tree.group, H.veil]),
  ];
  return H;
}

// ───────── Đảo láng giềng và đảo ở các tầng trên ─────────
let NB_MAT = null;
export function buildNeighbor(tier, seed, size) {
  const G = new THREE.Group(), r = rng(seed * 31 + tier), N = makeNoise(seed + 50), hf = (x, z) => 0.9 * N.fbm(x * 0.12, 1, z * 0.12, 2) * size * 0.18 + size * 0.06 * Math.exp(-(x * x + z * z) / (size * size * 0.25));
  const T = terrain({ sx: size, sz: size * (0.72 + r() * 0.2), M: 36, NT: 7, NS: 6, depth: size * (1.3 + r() * 0.5), seed: seed + 3, height: hf });
  const land = new THREE.Mesh(T.geo, NB_MAT || (NB_MAT = terrainMat())); land.userData.keep = true; G.add(land);
  const spot = (fmax) => { for (let k = 0; k < 40; k++) { const a = r() * 6.28, dd = Math.sqrt(r()) * fmax, x = size * dd * Math.cos(a), z = size * 0.8 * dd * Math.sin(a); if (T.frac(x, z) < fmax) return [x, hf(x, z), z]; } return [0, hf(0, 0), 0]; };
  const treeCol = tier === 2 ? '#d9ab3e' : tier === 3 ? '#f2e6ef' : ['#5f9a3a', '#6fa24a', '#4f8a44'][seed % 3];
  const nT = 2 + (seed % 2);
  const kinds = tier === 2 ? ['gold'] : tier === 3 ? ['blossom'] : tier === 1 ? ['blossom', 'bodhi', 'pine'] : ['bodhi', 'pine', 'bodhi'];
  for (let i = 0; i < nT; i++) { const [x, y, z] = spot(0.5), k = (0.75 + r() * 0.5) * size / 13, kind = kinds[(seed + i) % kinds.length];
    const t = leafTree({ count: 170, kind, radius: (kind === 'pine' ? 2.3 : 3.3) * k, trunkH: (kind === 'pine' ? 4.6 : 3.4) * k, seed: seed * 7 + i, far: true }); t.group.position.set(x, y - 0.2, z); G.add(t.group); }
  for (let i = 0; i < 9; i++) { const [x, y, z] = spot(0.85), s = (0.35 + r() * 0.9) * size / 13, m = new THREE.Mesh(ROCK_FAR[i % 3], rockMat); m.position.set(x, y + s * 0.2, z); m.scale.set(s, s * 0.7, s); m.rotation.y = r() * 6; G.add(m); }
  if (tier >= 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(size * 0.46, size * 0.02, 5, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 1.8, 1.7), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); ring.rotation.x = Math.PI / 2; ring.scale.z = 1; ring.position.y = hf(size * 0.46, 0) + 0.25; G.add(ring);
    const wf = waterfall(size * 0.14, size * 2.0); const a = r() * 6.28; wf.position.set(size * 0.93 * Math.cos(a), hf(0, 0) - 1.2, size * 0.7 * Math.sin(a)); wf.rotation.y = -a + Math.PI / 2; G.add(wf);
  }
  if (tier === 2) { const jade = new THREE.Mesh(new THREE.CircleGeometry(size * 0.2, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.7, 1.4), transparent: true, opacity: 0.75 })); jade.rotation.x = -Math.PI / 2; const [x, y, z] = spot(0.4); jade.position.set(x, y + 0.2, z); G.add(jade); }
  if (tier === 3 || seed % 3 !== 1) {
    const lux = tier === 3 ? new THREE.MeshStandardMaterial({ color: '#eef5ff', emissive: '#9fc8f0', emissiveIntensity: 1.5, roughness: 0.15, transparent: true, opacity: 0.9 })
      : new THREE.MeshStandardMaterial({ color: tier === 2 ? '#c9a45a' : tier === 1 ? '#8d5a3c' : '#7a4a33', roughness: 0.75, emissive: tier === 2 ? '#6b4a12' : '#000000', emissiveIntensity: tier === 2 ? 0.5 : 0 });
    const k = size / 13 * (tier === 3 ? 1 : 0.8), kiosk = new THREE.Group();
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * k, 0.16 * k, 3.4 * k, 8), lux); c.position.set(x * 1.8 * k, 1.7 * k, z * 1.5 * k); kiosk.add(c); });
    const rfM = tier === 3 ? lux : new THREE.MeshStandardMaterial({ color: tier === 2 ? '#d8b25c' : tier === 1 ? '#3f6f77' : '#4d5f68', roughness: 0.6, side: THREE.DoubleSide }); const rf = new THREE.Mesh(roofGeo([[4.2, 0.3], [3.9, 0.14], [3.0, 0.2], [1.9, 0.7], [0.9, 1.4], [0.25, 2.0]], 0.8), rfM); rf.material.side = THREE.DoubleSide; rf.castShadow = true; rf.scale.setScalar(k); rf.position.y = 3.4 * k; kiosk.add(rf);
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(3 * k, 3.2 * k, 0.3 * k, 8), lux); fl.position.y = 0.1; kiosk.add(fl);
    const [x, y, z] = spot(0.3); kiosk.position.set(x, y, z); G.add(kiosk);
  }
  const seats = []; const ns = 4 + Math.floor(r() * 4), [cx, , cz] = spot(0.3), a0 = r() * 6.28;
  for (let i = 0; i < ns; i++) { const ring = i < 5 ? 0 : 1, a = a0 + i * 2.4, d = (2.6 + ring * 2.4 + r() * 0.8) * size / 13, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d * 0.9;
    if (T.frac(x, z) < 0.78) seats.push({ x, y: hf(x, z) + 0.02, z }); else { const [sx, sy, sz] = spot(0.6); seats.push({ x: sx, y: sy + 0.02, z: sz }); } }
  bake(G);
  return { group: G, seats, size, outline: T.outline, top: hf(0, 0) };
}

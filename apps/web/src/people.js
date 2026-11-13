import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { faceTex, rng } from './gfx.js';

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
const limb = (a, b, ra, rb, seg = 10) => {
  const va = new THREE.Vector3(...a), d = new THREE.Vector3(...b).sub(va), len = d.length(), g = new THREE.CylinderGeometry(rb, ra, len, dn(seg, 5), 1);
  g.translate(0, len / 2, 0); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, d.normalize())); g.translate(va.x, va.y, va.z); return g;
};
const blankUV = (g) => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.9, 0.08); return g; };
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)));

// Các khối của một người theo tư thế: 'sit' (tọa thiền), 'stand' (đứng, tay chắp trước bụng), 'anjali' (chắp tay)
const torso = (pts, bw) => { const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), dn(22, 8)); g.scale(bw, 1, 0.68); return g; };
function parts(pose, bw) {
  const cloth = [], trim = [], skin = [];
  let hc, neckY, waistY, shY;
  if (pose === 'sit') {
    hc = [0, 0.80, 0]; neckY = 0.66; waistY = 0.27; shY = 0.60;
    cloth.push(sph(0.37 * bw, 0.115, 0.31, 0, 0.115, 0.05, 18, 12), torso([[0.21, 0.16], [0.2, 0.3], [0.228, 0.47], [0.222, 0.565], [0.13, 0.632], [0.058, 0.662]], bw));
    [-1, 1].forEach((s) => {
      cloth.push(sph(0.15, 0.10, 0.17, s * 0.29 * bw, 0.105, 0.10), limb([s * 0.215 * bw, 0.59, 0], [s * 0.25 * bw, 0.36, 0.05], 0.062, 0.056), sph(0.058, 0.058, 0.058, s * 0.25 * bw, 0.36, 0.05, 8, 6),
        limb([s * 0.25 * bw, 0.36, 0.05], AJ ? [s * 0.04, 0.5, 0.2] : [s * 0.075, 0.215, 0.22], 0.06, AJ ? 0.07 : 0.086));
      trim.push(limb([s * 0.085, 0.635, 0.105], [0, 0.43, 0.168], 0.017, 0.017, 6));
      skin.push(blankUV(AJ ? sph(0.02, 0.062, 0.04, s * 0.017, 0.535, 0.215, 8, 6) : sph(0.055, 0.026, 0.042, s * 0.022, 0.20, 0.245, 8, 6)));
    });
  } else {
    hc = [0, 1.61, 0]; neckY = 1.47; waistY = 1.03; shY = 1.41;
    const sk = new THREE.LatheGeometry([[0.27, 0.02], [0.285, 0.06], [0.265, 0.25], [0.23, 0.55], [0.195, 0.82], [0.175, 1.03]].map(([r, y]) => new THREE.Vector2(r, y)), 22); sk.scale(bw, 1, 0.9);
    cloth.push(sk, torso([[0.178, 1.0], [0.19, 1.12], [0.226, 1.28], [0.222, 1.375], [0.13, 1.442], [0.058, 1.472]], bw));
    [-1, 1].forEach((s) => {
      const el = pose === 'anjali' ? [s * 0.225 * bw, 1.17, 0.07] : [s * 0.235 * bw, 1.14, 0.04], wr = pose === 'anjali' ? [s * 0.04, 1.30, 0.2] : [s * 0.06, 1.0, 0.2];
      cloth.push(limb([s * 0.205 * bw, 1.385, 0], el, 0.066, 0.06), sph(0.062, 0.062, 0.062, el[0], el[1], el[2], 8, 6), limb(el, wr, 0.06, 0.088));
      trim.push(limb([s * 0.085, 1.445, 0.10], [0, 1.24, 0.158], 0.017, 0.017, 6), sph(0.045, 0.022, 0.08, s * 0.085, 0.025, 0.13, 8, 6));
      skin.push(blankUV(pose === 'anjali' ? sph(0.02, 0.062, 0.036, s * 0.014, 1.34, 0.215, 8, 6) : sph(0.05, 0.03, 0.045, s * 0.022, 0.995, 0.225, 8, 6)));
    });
  }
  const sash = new THREE.TorusGeometry(0.172, 0.02, dn(8, 4), dn(24, 10)); sash.rotateX(Math.PI / 2); sash.scale(bw * 1.06, 1, 0.84); sash.translate(0, waistY, 0); trim.push(sash);
  skin.push(blankUV(limb([0, neckY - 0.03, 0], [0, neckY + 0.07, 0], 0.05, 0.046)), sph(0.108, 0.123, 0.114, hc[0], hc[1], hc[2], 28, 20));
  [-1, 1].forEach((s) => skin.push(blankUV(sph(0.02, 0.034, 0.014, s * 0.107, hc[1], 0, 8, 6))));
  return { cloth, trim, skin, hc, neckY, waistY, shY };
}

function hairGeo(style, hc) {
  if (style === 'cao') return null;
  const cap = new THREE.SphereGeometry(1, dn(22, 9), dn(12, 5), 0, Math.PI * 2, 0, 1.62); cap.scale(0.1135, 0.129, 0.1195); cap.rotateX(-0.42);
  const list = [cap];
  if (style === 'buicao') list.push(sph(0.05, 0.05, 0.05, 0, 0.135, -0.03));
  if (style === 'buithap') list.push(sph(0.05, 0.045, 0.045, 0, -0.035, -0.125));
  if (style === 'dai') list.push(limb([0, -0.02, -0.11], [0, -0.31, -0.135], 0.046, 0.028), sph(0.03, 0.02, 0.03, 0, -0.06, -0.118, 8, 6));
  const g = merge(list); g.translate(hc[0], hc[1], hc[2]); return g;
}

function accGeo(kind, p, bw) {
  if (kind === 'hat') { const g = new THREE.TorusGeometry(0.118, 0.0105, 6, 30); g.rotateX(Math.PI / 2 + 0.95); g.scale(1, 1, 1.2); g.translate(0, p.neckY - 0.075, 0.062); return g; }
  if (kind === 'khan') return merge([limb([-0.17 * bw, p.shY + 0.03, 0.085], [0.15 * bw, p.waistY + 0.04, 0.135], 0.036, 0.03, 8), limb([-0.17 * bw, p.shY + 0.03, -0.085], [0.15 * bw, p.waistY + 0.04, -0.12], 0.036, 0.03, 8), sph(0.04, 0.03, 0.09, -0.17 * bw, p.shY + 0.045, 0, 8, 6)]);
  return null;
}

const BW = { thanh: 0.92, vua: 1, day: 1.1 };
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

// Nhân vật của người dùng: ba tư thế dựng sẵn, vật liệu dùng chung, mặt mở mắt / khép mắt
export function buildFigure(look) {
  const L = { ...defaultLook(), ...look }, bw = BW[L.build] || 1, robeHex = OPTIONS.robe[L.robe][1], trimHex = OPTIONS.trim[L.trim][1];
  const mats = {
    cloth: new THREE.MeshStandardMaterial({ color: robeHex, roughness: 0.92 }),
    trim: new THREE.MeshStandardMaterial({ color: trimHex ? new THREE.Color(trimHex) : shade(robeHex, 0.62), roughness: 0.85 }),
    skin: new THREE.MeshStandardMaterial({ color: OPTIONS.skin[L.skin][1], roughness: 0.75 }),
    hair: new THREE.MeshStandardMaterial({ color: OPTIONS.hairColor[L.hairColor][1], roughness: 0.6 }),
    bead: new THREE.MeshStandardMaterial({ color: '#5a3b28', roughness: 0.5 }),
  };
  const fOpt = { mood: L.mood, age: L.age, shaved: L.hair === 'cao' }, faces = { open: faceTex({ ...fOpt, closed: false }), closed: faceTex({ ...fOpt, closed: true }) };
  mats.skin.map = faces.open;
  const group = new THREE.Group(), poses = {};
  ['stand', 'anjali', 'sit'].forEach((pose) => {
    const p = parts(pose, bw), g = new THREE.Group();
    const add = (geo, m) => { if (!geo) return; const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; g.add(mesh); };
    add(merge(p.cloth), mats.cloth); add(merge(p.trim), mats.trim); add(merge(p.skin), mats.skin); add(hairGeo(L.hair, p.hc), mats.hair);
    add(accGeo(L.acc, p, bw), L.acc === 'hat' ? mats.bead : mats.trim);
    g.visible = pose === 'stand'; poses[pose] = g; group.add(g);
  });
  group.scale.setScalar(S * (L.height || 1));
  return {
    group, poses, mats, pose: 'stand',
    setPose(p) { this.pose = p; Object.keys(poses).forEach((k) => (poses[k].visible = k === p)); this.eyes(p === 'sit'); },
    eyes(closed) { mats.skin.map = closed ? faces.closed : faces.open; },
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
  const cloth = new THREE.InstancedMesh(G.cloth, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), n);
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
  const bow = { value: 0 }, bend = (m) => { m.onBeforeCompile = (sh) => { sh.uniforms.uBow = bow; sh.vertexShader = 'uniform float uBow;\n' + sh.vertexShader.replace('#include <begin_vertex>', BEND); }; };
  [cloth.material, skin.material, hairMat].forEach(bend);
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

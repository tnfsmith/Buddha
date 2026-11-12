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
const ROBES = ['#8a94a8', '#8a94a8', '#b9bcc4', '#8d6548', '#e9e2d0', '#4f5d86', '#75805a', '#9aa3b5'];
export function makeCrowd(list, seed = 3) {
  const G = crowdGeos(), r = rng(seed), n = list.length, d = new THREE.Object3D(), c = new THREE.Color(), group = new THREE.Group();
  const cloth = new THREE.InstancedMesh(G.cloth, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 }), n);
  const skin = new THREE.InstancedMesh(G.skin, new THREE.MeshStandardMaterial({ map: faceTex({ closed: true, mood: 'hoa' }), roughness: 0.75 }), n);
  const caps = [], buns = [], mats = [];
  list.forEach((p, i) => {
    d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.rot || 0, 0); d.scale.setScalar(S * (0.95 + r() * 0.1)); d.updateMatrix(); mats.push(d.matrix.clone());
    cloth.setMatrixAt(i, d.matrix); skin.setMatrixAt(i, d.matrix);
    cloth.setColorAt(i, c.set(p.robe || ROBES[Math.floor(r() * ROBES.length)])); skin.setColorAt(i, c.set(OPTIONS.skin[Math.floor(r() * 5)][1]));
    const h = r(); if (h > 0.34) (h > 0.74 ? buns : caps).push(i);
  });
  const hairMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
  const mk = (geo, ids) => { const m = new THREE.InstancedMesh(geo, hairMat, Math.max(1, ids.length)); m.count = ids.length; ids.forEach((id, k) => { m.setMatrixAt(k, mats[id]); m.setColorAt(k, c.set(OPTIONS.hairColor[r() < 0.6 ? 0 : Math.floor(r() * 4)][1])); }); return m; };
  // cúi lạy: phần thân trên gập về trước quanh hông; chắp tay: đổi sang bộ hình ngồi chắp tay
  const bow = { value: 0 }, bend = (m) => { m.onBeforeCompile = (sh) => { sh.uniforms.uBow = bow; sh.vertexShader = 'uniform float uBow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n if (transformed.y > 0.2) { float a = uBow*1.0; float cb = cos(a), sb = sin(a); vec3 q = transformed - vec3(0.,0.2,0.04); transformed = vec3(q.x, q.y*cb - q.z*sb, q.y*sb + q.z*cb) + vec3(0.,0.2,0.04); }'); }; };
  [cloth.material, skin.material, hairMat].forEach(bend);
  group.userData.bow = bow; group.userData.setAnjali = (on) => { if (group.userData.aj === on) return; group.userData.aj = on; cloth.geometry = on ? G.clothA : G.cloth; skin.geometry = on ? G.skinA : G.skin; };
  [cloth, skin, mk(G.cap, caps), mk(G.bun, buns)].forEach((m) => { m.frustumCulled = false; group.add(m); });
  return group;
}

// ───────── Tịnh danh: quy tắc đặt tên ngắn gọn, hướng Phật pháp ─────────
export const VOCAB = { an: 'bình an', 'tâm': 'tâm', minh: 'sáng suốt', 'tịnh': 'thanh tịnh', 'thiện': 'lành', 'từ': 'thương yêu', bi: 'cảm thông', 'hỷ': 'vui theo điều lành', 'xả': 'buông xả', 'giới': 'giữ giới', 'định': 'vững chãi',
  'tuệ': 'trí tuệ', 'huệ': 'trí tuệ', 'nhẫn': 'nhẫn nại', 'đức': 'đức hạnh', 'hạnh': 'nết lành', 'chánh': 'ngay thẳng', 'chân': 'chân thật', 'giác': 'tỉnh thức', 'ngộ': 'hiểu ra', 'liên': 'hoa sen', quang: 'ánh sáng', thanh: 'trong sạch',
  'hòa': 'hòa hợp', 'phúc': 'phước lành', 'phước': 'phước lành', 'nguyện': 'tâm nguyện', 'tín': 'niềm tin', 'tấn': 'tinh tấn', 'niệm': 'chánh niệm', 'viên': 'tròn đầy', 'diệu': 'nhiệm mầu', khai: 'mở ra', 'nguyên': 'cội nguồn',
  'lạc': 'an vui', 'đạo': 'con đường', 'pháp': 'giáo pháp', 'trí': 'hiểu biết', 'hiền': 'hiền hòa', 'kính': 'cung kính', 'khiêm': 'khiêm hạ', 'tĩnh': 'yên lặng', 'như': 'như thật', 'phổ': 'rộng khắp', 'hải': 'rộng như biển', 'vân': 'mây',
  'bảo': 'quý báu', 'thông': 'thông suốt', 'thuần': 'thuần hậu', 'bình': 'bình thản', 'nhiên': 'tự nhiên', 'lành': 'hiền lành' };
const FIRST = ['Tâm', 'Minh', 'Diệu', 'Thiện', 'Chánh', 'Tịnh', 'An', 'Từ', 'Huệ', 'Đức', 'Thanh', 'Viên', 'Khai', 'Nguyên', 'Phúc', 'Quang', 'Liên', 'Hòa'];
const SECOND = ['An', 'Tịnh', 'Hạnh', 'Nhẫn', 'Lạc', 'Giác', 'Niệm', 'Tuệ', 'Hòa', 'Quang', 'Đức', 'Tín', 'Tấn', 'Hỷ', 'Xả', 'Minh', 'Nguyện', 'Thông', 'Nhiên', 'Bình'];
const BAN_WORDS = ['phật', 'thánh', 'tổ', 'sư', 'thầy', 'chúa', 'thần'];
const BAN_PHRASES = ['bồ tát', 'la hán', 'như lai', 'thế tôn', 'hòa thượng', 'thượng tọa', 'đại đức', 'sư phụ', 'thiền sư', 'pháp vương', 'giáo chủ', 'tôn giả'];
const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
const BAN_STRIPPED = ['phat', ...BAN_PHRASES.map(strip)];

export function tidyName(raw) { return String(raw || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean).map((w) => w[0].toLocaleUpperCase('vi') + w.slice(1).toLocaleLowerCase('vi')).join(' '); }
export function checkName(raw) {
  const name = tidyName(raw), low = name.toLocaleLowerCase('vi'), words = low ? low.split(' ') : [], flat = strip(low);
  const short = words.length >= 2 && words.length <= 3 && name.length <= 16 && words.every((w) => w.length <= 7);
  const letters = words.length > 0 && words.every((w) => /^\p{L}+$/u.test(w));
  const dharma = words.some((w) => VOCAB[w]);
  const humble = !words.some((w) => BAN_WORDS.includes(w)) && !BAN_PHRASES.some((p) => low.includes(p)) && !BAN_STRIPPED.some((p) => (' ' + flat + ' ').includes(' ' + p + ' '));
  const rules = [
    { ok: short, text: 'Ngắn gọn: 2 chữ, nhiều nhất 3 chữ, tối đa 16 ký tự' },
    { ok: letters, text: 'Chỉ gồm chữ cái tiếng Việt, không số hay ký hiệu' },
    { ok: dharma, text: 'Có ít nhất một chữ mang nghĩa tu tập (bấm gợi ý bên dưới)' },
    { ok: humble, text: 'Không tự xưng quả vị hay giáo phẩm (Phật, Bồ Tát, Thánh, Sư…)' },
  ];
  const meaning = words.filter((w) => VOCAB[w]).map((w) => VOCAB[w]).join(' · ');
  return { name, ok: rules.every((r) => r.ok), rules, meaning };
}
export function suggestNames(n = 6, rand = Math.random) {
  const out = new Set();
  while (out.size < n) { const a = FIRST[Math.floor(rand() * FIRST.length)], b = SECOND[Math.floor(rand() * SECOND.length)]; if (a !== b && VOCAB[a.toLocaleLowerCase('vi')] !== VOCAB[b.toLocaleLowerCase('vi')]) out.add(a + ' ' + b); }
  return [...out];
}

// Cõi mở rộng: hàng trăm đảo xa dựng theo lô, bảo tháp, đàn hạc — để không gian giãn nở về mọi phía.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng } from './gfx.js';

const C = new THREE.Color();
function paint(g, fn) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { fn(C, p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = C.r; c[i * 3 + 1] = C.g; c[i * 3 + 2] = C.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals(); return g;
}
const flat = (hex, v = 0) => (c, x, y, z) => { c.set(hex); if (v) c.offsetHSL(0, 0, Math.sin(x * 9.1 + z * 7.3 + y * 5) * v); };
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);

// Một đảo đơn vị (bán kính 1). v: 0 rừng xanh · 1 hoa đào + tịnh thất · 2 cây vàng + tịnh thất · 3 có bảo tháp
function isleGeo(v, seed) {
  const r = rng(seed), list = [];
  const warp = (g) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.15 * Math.sin(a * 3 + seed) + 0.09 * Math.sin(a * 5 + y * 3 + seed * 2.3) + 0.05 * Math.sin(a * 9 + y * 7); p.setXYZ(i, x * k, y + (y < -0.2 ? 0.07 * Math.sin(a * 4 + seed) : 0), z * k); } g.computeVertexNormals(); return g; };
  const deep = 1.05 + r() * 0.5;
  list.push(paint(warp(lathe([[0.02, -deep], [0.2, -deep * 0.86], [0.5, -deep * 0.56], [0.78, -0.3], [0.95, -0.1], [1.0, 0]], 11)), (c, x, y) => { c.set('#8d7f72').lerp(new THREE.Color('#55505f'), Math.min(1, -y / deep)); c.offsetHSL(0, 0, Math.sin(x * 11 + y * 13) * 0.035); }));
  const grass = v === 2 ? '#a9b060' : v === 1 ? '#86ad68' : '#74a05a';
  list.push(paint(warp(lathe([[1.0, 0], [0.97, 0.06], [0.72, 0.12], [0.36, 0.16], [0.001, 0.18]], 11)), flat(grass, 0.05)));
  const tops = v === 1 ? ['#f3bccb', '#f7d3dc', '#7fae62'] : v === 2 ? ['#e6c45e', '#f0d77e', '#b9b85a'] : ['#5f9a54', '#77ad5e', '#4f8a50'];
  const nT = 3 + Math.floor(r() * 4);
  for (let i = 0; i < nT; i++) { const a = r() * 6.28, d = 0.25 + r() * 0.5, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.16 + r() * 0.14, cr = 0.15 + r() * 0.13;
    const tr = new THREE.CylinderGeometry(0.02, 0.034, h, 5); tr.translate(x, 0.13 + h / 2, z); list.push(paint(tr, flat('#6b4b34')));
    const cn = new THREE.IcosahedronGeometry(cr, 1); cn.scale(1, 0.82, 1); cn.translate(x, 0.13 + h + cr * 0.6, z); list.push(paint(cn, flat(tops[i % 3], 0.06)));
    if (r() < 0.6) { const c2 = new THREE.IcosahedronGeometry(cr * 0.7, 1); c2.translate(x + cr * 0.7, 0.13 + h + cr * 0.35, z + cr * 0.3); list.push(paint(c2, flat(tops[(i + 1) % 3], 0.06))); } }
  if (v === 1 || v === 2) { const b = new THREE.BoxGeometry(0.34, 0.15, 0.26); b.translate(0, 0.24, 0); list.push(paint(b, flat(v === 2 ? '#c9a45a' : '#8d5a3c')));
    const rf = new THREE.ConeGeometry(0.34, 0.16, 4); rf.rotateY(Math.PI / 4); rf.scale(1.15, 1, 0.95); rf.translate(0, 0.39, 0); list.push(paint(rf, flat(v === 2 ? '#d8b25c' : '#4d5f68'))); }
  if (v === 3) { let y = 0.16; for (let k = 0; k < 5; k++) { const s = 1 - k * 0.14, bd = new THREE.CylinderGeometry(0.15 * s, 0.17 * s, 0.2, 6); bd.translate(0, y + 0.1, 0); list.push(paint(bd, flat('#efe3c8')));
      const rf = new THREE.ConeGeometry(0.33 * s, 0.11, 6); rf.translate(0, y + 0.255, 0); list.push(paint(rf, flat(k % 2 ? '#c98a3a' : '#b5533c'))); y += 0.3; }
    const sp = new THREE.ConeGeometry(0.03, 0.34, 5); sp.translate(0, y + 0.17, 0); list.push(paint(sp, flat('#f0d27a'))); }
  const rocks = 2 + Math.floor(r() * 3); for (let i = 0; i < rocks; i++) { const a = r() * 6.28, d = 0.6 + r() * 0.3, rk = new THREE.IcosahedronGeometry(0.06 + r() * 0.07, 0); rk.scale(1, 0.7, 1); rk.translate(Math.cos(a) * d, 0.1, Math.sin(a) * d); list.push(paint(rk, flat('#8a8580', 0.04))); }
  return mergeGeometries(list);
}

function craneGeo() {
  const zero = (g) => { g = g.index ? g.toNonIndexed() : g; if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
  const body = new THREE.SphereGeometry(1, 6, 4); body.scale(0.085, 0.075, 0.5);
  const neck = new THREE.CylinderGeometry(0.018, 0.034, 0.5, 4); neck.rotateX(Math.PI / 2 - 0.22); neck.translate(0, 0.06, 0.68);
  const legs = new THREE.CylinderGeometry(0.012, 0.012, 0.55, 3); legs.rotateX(Math.PI / 2); legs.translate(0, -0.03, -0.7);
  const wing = (s) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.2, s * 1.2, 0, 0.02, 0, 0, -0.2, s * 1.2, 0, 0.02, s * 1.05, 0, -0.24, 0, 0, -0.2], 3)); g.computeVertexNormals(); return g; };
  return mergeGeometries([zero(body), zero(neck), zero(legs), wing(1), wing(-1)]);
}

export function buildRealm(seed = 91) {
  const r = rng(seed), group = new THREE.Group(), isles = [];
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide });
  const place = (v, x, y, z, size) => isles.push({ v, x, y, z, size, rot: r() * 6.28, sy: 0.85 + r() * 0.4 });
  // vỏ đảo trải khắp mọi hướng; càng xa càng cao và càng lớn. Chừa trục Đại Thiền Đường – Tôn tượng.
  let tries = 0;
  while (isles.length < 300 && tries++ < 4000) {
    const a = r() * Math.PI * 2, R = 250 + Math.pow(r(), 1.35) * 1500, x = Math.cos(a) * R, z = Math.sin(a) * R - 120;
    if (z < -60 && z > -1150 && Math.abs(x) < 300 + (-z) * 0.22) continue;
    if (z > 60 && Math.abs(x) < 120 + z * 0.5 && R < 520) continue;              // chừa phía máy quay mặc định
    const y = -4 + r() * 26 + Math.pow(r(), 1.6) * R * 0.34, size = (9 + r() * 14) * (1 + R / 900) * (r() < 0.12 ? 1.9 : 1);
    if (isles.some((o) => Math.hypot(o.x - x, o.z - z, (o.y - y) * 1.5) < (o.size + size) * 1.5)) continue;
    place(r() < 0.5 ? 0 : r() < 0.55 ? 1 : 2, x, y, z, size);
  }
  // bảo tháp trên các đảo lớn, rải thành vòng cung xa
  [[-560, 150, -330, 62], [610, 170, -420, 66], [-900, 250, -900, 84], [940, 270, -1000, 88], [-380, 95, 420, 46], [470, 110, 520, 50], [-1150, 320, -260, 90], [1220, 340, -180, 94], [-240, 420, -1500, 110], [300, 440, -1560, 112], [-760, 60, 180, 52], [820, 70, 60, 54], [60, 210, 980, 70], [-1320, 180, 700, 86], [1380, 200, 760, 88]].forEach(([x, y, z, s]) => place(3, x, y, z, s));
  const d = new THREE.Object3D();
  for (let v = 0; v < 4; v++) { const L = isles.filter((o) => o.v === v), m = new THREE.InstancedMesh(isleGeo(v, 17 + v * 5), mat, L.length);
    L.forEach((o, i) => { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.size, o.size * o.sy, o.size); d.updateMatrix(); m.setMatrixAt(i, d.matrix); });
    m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; group.add(m); }
  // đàn hạc
  const U = { uT: { value: 0 } }, cm = new THREE.MeshBasicMaterial({ color: '#fffdf4', side: THREE.DoubleSide });
  cm.onBeforeCompile = (sh) => { sh.uniforms.uT = U.uT; sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float w = abs(position.x); float ph = float(gl_InstanceID)*1.7; transformed.y += w * (sin(uT*3.6 + ph)*0.45 + 0.08) * smoothstep(0.04, 0.3, w);'); };
  const flocks = [{ c: [0, 46, -30], R: 150, w: 0.05, n: 9, s: 4.2 }, { c: [-330, 120, -380], R: 260, w: -0.035, n: 11, s: 5 }, { c: [380, 150, -520], R: 300, w: 0.03, n: 11, s: 5 }, { c: [0, 250, -200], R: 620, w: 0.016, n: 13, s: 6 }];
  const total = flocks.reduce((s, f) => s + f.n, 0), cranes = new THREE.InstancedMesh(craneGeo(), cm, total); cranes.frustumCulled = false; group.add(cranes);
  const update = (time, night) => { U.uT.value = time; cm.color.setScalar(1 - 0.55 * night); let k = 0;
    flocks.forEach((f, fi) => { const th = time * f.w + fi * 2.1, sg = Math.sign(f.w), cx = f.c[0] + Math.cos(th) * f.R, cz = f.c[2] + Math.sin(th) * f.R, cy = f.c[1] + Math.sin(time * 0.11 + fi) * 6;
      const fx = -Math.sin(th) * sg, fz = Math.cos(th) * sg, rx = fz, rz = -fx;
      for (let i = 0; i < f.n; i++) { const row = Math.ceil(i / 2), side = i % 2 ? 1 : -1, lat = row * 1.7 * f.s * side, back = row * 1.5 * f.s;
        d.position.set(cx + rx * lat - fx * back, cy + Math.sin(time * 0.7 + i * 1.3) * 0.6 * f.s * 0.3 - row * 0.25, cz + rz * lat - fz * back); d.rotation.set(0, Math.atan2(fx, fz), -0.22 * sg); d.scale.setScalar(f.s); d.updateMatrix(); cranes.setMatrixAt(k++, d.matrix); } });
    cranes.instanceMatrix.needsUpdate = true; };
  return { group, isles, update };
}

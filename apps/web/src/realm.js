// Cõi mở rộng: hàng trăm đảo xa trong một InstancedMesh, bảo tháp, đàn hạc — để không gian giãn nở về mọi phía.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, makeNoise, tactile } from './gfx.js';

const C = new THREE.Color();
// Tô màu từng đỉnh và gắn nhãn `aT`: 0 giữ nguyên màu · 1 tán cây (nhuộm theo màu riêng của từng đảo) · 2 am nhỏ (đảo không có am thì thu về 0)
function paint(g, fn, t = 0) {
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { fn(C, p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = C.r; c[i * 3 + 1] = C.g; c[i * 3 + 2] = C.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(n).fill(t), 1));
  if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals(); return g;
}
const flat = (hex, v = 0) => (c, x, y, z) => { c.set(hex); if (v) c.offsetHSL(0, 0, Math.sin(x * 9.1 + z * 7.3 + y * 5) * v); };
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg);
// khối 20 mặt với pháp tuyến hình cầu: tán cây tròn mịn dù rất ít tam giác
const ico = (r, dt = 0) => { const g = new THREE.IcosahedronGeometry(r, dt), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) n.setXYZ(i, p.getX(i) / r, p.getY(i) / r, p.getZ(i) / r); return g; };

// Một đảo đơn vị (bán kính 1). Dùng chung cho mọi đảo xa (§12.3 mục 3); khác biệt giữa các đảo đến từ màu tán, có/không có am,
// độ sâu vỏ đá (shader) cùng góc xoay và tỉ lệ của từng instance. stupa: đảo lớn mang bảo tháp năm tầng.
// hi = bản gần (~900 tam giác): vách đá gãy khúc nhiều bậc, vân tầng đá, rêu rủ dưới mép cỏ, tán cây chùm nhiều khối.
// Bản xa (~220 tam giác) giữ dáng cũ. buildRealm đổi bản theo khoảng cách tới máy quay (lod).
function isleGeo(seed, stupa, hi) {
  const r = rng(seed), N = makeNoise(seed), list = [], deep = 1.3, seg = hi ? (stupa ? 22 : 16) : stupa ? 11 : 8;
  const warp = (g, rock) => { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x);
      let k = 1 + 0.15 * Math.sin(a * 3 + seed) + 0.09 * Math.sin(a * 5 + y * 3 + seed * 2.3) + 0.05 * Math.sin(a * 9 + y * 7);
      if (hi && rock && y < -0.03) k *= 1 + 0.34 * (N.fbm(x * 2.2 + 3, y * 3.2, z * 2.2 + 3, 3) - 0.5) * Math.min(1, -y * 5);
      p.setXYZ(i, x * k, y + (y < -0.2 ? 0.07 * Math.sin(a * 4 + seed) : 0), z * k); } g.computeVertexNormals(); return g; };
  const rockC = (c, x, y, z) => { const t = Math.min(1, -y / deep), n = N.fbm(x * 3 + 7, y * 2.5, z * 3 + 7, 2), band = 0.5 + 0.5 * Math.sin(y * 21 + n * 5);
    c.set('#968676').lerp(new THREE.Color('#4f4a58'), t * 0.9).lerp(new THREE.Color('#b8a58a'), band * 0.32 * (1 - t));
    if (y > -0.34 && n + 0.5 * (y + 0.34) > 0.62) c.lerp(new THREE.Color('#58763a'), 0.75);
    c.offsetHSL(0, 0, Math.sin(x * 11 + y * 13) * 0.03); };
  const prof = hi ? [[0.03, -deep], [0.19, -1.16], [0.35, -0.98], [0.47, -0.8], [0.62, -0.62], [0.72, -0.45], [0.85, -0.3], [0.9, -0.17], [0.97, -0.06], [1.0, 0]] : [[0.02, -deep], [0.5, -deep * 0.56], [0.78, -0.3], [0.95, -0.1], [1.0, 0]];
  list.push(paint(warp(lathe(prof, seg), true), rockC));
  list.push(paint(warp(lathe(hi ? [[1.04, 0.0], [0.93, 0.1], [0.62, 0.16], [0.001, 0.19]] : [[1.0, 0], [0.72, 0.12], [0.001, 0.18]], seg)), flat('#7ea85f', 0.05)));
  for (let i = 0; i < 4; i++) { const a = r() * 6.28, d = 0.3 + r() * 0.45, x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.16 + r() * 0.14, cr = 0.16 + r() * 0.13;
    const tr = new THREE.CylinderGeometry(0.02, 0.034, h, hi ? 5 : 3, 1, true); tr.translate(x, 0.13 + h / 2, z); list.push(paint(tr, flat('#6b4b34')));
    const crown = (rr, ox, oy, oz, dt) => { const cn = ico(rr, dt);
      if (dt) { const p = cn.attributes.position; for (let j = 0; j < p.count; j++) { const vx = p.getX(j), vy = p.getY(j), vz = p.getZ(j), k = 0.86 + 0.28 * N.n3(vx * 9 + i, vy * 9, vz * 9); p.setXYZ(j, vx * k, vy * k, vz * k); } }
      cn.scale(1, 0.82, 1); cn.translate(x + ox, 0.13 + h + cr * 0.6 + oy, z + oz);
      const y0 = 0.13 + h + oy, base = ['#ffffff', '#e2e2e2', '#f1f1f1', '#d6d6d6'][i];
      list.push(paint(cn, (c, px, py) => { c.set(base).multiplyScalar(0.78 + 0.32 * Math.min(1, Math.max(0, (py - y0) / (cr * 1.4)))); }, 1)); };
    crown(cr, 0, 0, 0, hi ? 1 : 0); if (hi) { crown(cr * 0.62, cr * 0.55, -cr * 0.18, cr * 0.3, 0); crown(cr * 0.55, -cr * 0.5, -cr * 0.1, -cr * 0.35, 0); } }
  if (stupa) { let y = 0.16; for (let k = 0; k < 5; k++) { const s = 1 - k * 0.14, bd = new THREE.CylinderGeometry(0.15 * s, 0.17 * s, 0.2, hi ? 8 : 6, 1, true); bd.translate(0, y + 0.1, 0); list.push(paint(bd, flat('#efe3c8')));
      const rf = new THREE.ConeGeometry(0.33 * s, 0.11, hi ? 8 : 6, 1, true); rf.translate(0, y + 0.255, 0); list.push(paint(rf, flat(k % 2 ? '#c98a3a' : '#b5533c'))); y += 0.3; }
    const sp = new THREE.ConeGeometry(0.03, 0.34, 5); sp.translate(0, y + 0.17, 0); list.push(paint(sp, flat('#f0d27a'))); }
  else { const b = new THREE.BoxGeometry(0.34, 0.15, 0.26); b.translate(0, 0.24, 0); list.push(paint(b, flat('#a8794c'), 2));
    const rf = new THREE.ConeGeometry(0.34, 0.16, 4, 1, true); rf.rotateY(Math.PI / 4); rf.scale(1.15, 1, 0.95); rf.translate(0, 0.39, 0); list.push(paint(rf, flat('#4d5f68'), 2)); }
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
  // vân đá thủ tục (gfx.tactile) theo tọa độ thế giới: gồ ghề, rêu trên mặt ngửa; cùng một chương trình shader cho mọi đảo xa
  const mat = tactile(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide }), [0.045, 0.3, 0.2, 0]), vein = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh) => { vein(sh); sh.vertexShader = 'attribute float aT; attribute vec4 iV;\n' + sh.vertexShader
    .replace('#include <color_vertex>', '#include <color_vertex>\n if (aT > .5 && aT < 1.5) vColor.rgb *= iV.rgb;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n if (aT > 1.5) transformed *= step(.5, iV.a); if (transformed.y < 0.) transformed.y *= .7 + .6*fract(iV.a*7.); else if (aT < 1.5 && transformed.y > .19) transformed.y = .19 + (transformed.y - .19)*(.7 + .9*fract(iV.a*13.));'); };
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
  // Mỗi loại đảo (300 đảo thường, 15 đảo bảo tháp) có hai InstancedMesh: bản gần chi tiết và bản xa gọn. lod() xếp lại khi máy quay
  // đã dời đủ xa: đảo cách máy quay dưới ngưỡng theo mức chất lượng (trừ bán kính đảo, trễ 8 %) vào bản gần.
  // iV = (màu tán r,g,b, số ngẫu nhiên: ≥ 0,5 thì có am; phần lẻ ×7 đổi độ sâu vỏ đá, ×13 đổi chiều cao cây) đi cùng ma trận. Xa dần thì tan vào sương (gfx.js).
  const d = new THREE.Object3D(), TINT = [['#5f9a54', '#77ad5e', '#4f8a50'], ['#f3bccb', '#f7d3dc', '#eab0c4'], ['#e6c45e', '#f0d77e', '#d9b44e']], sets = [];
  const mesh = (L, seed, stupa) => { const S = { L, M: [], V: [], P: [], near: new Uint8Array(L.length).fill(2) };
    S.m = [true, false].map((hi) => { const geo = isleGeo(seed, stupa, hi), m = new THREE.InstancedMesh(geo, mat, L.length); geo.setAttribute('iV', new THREE.InstancedBufferAttribute(new Float32Array(L.length * 4), 4)); m.frustumCulled = false; group.add(m); return m; });
    L.forEach((o, i) => { d.position.set(o.x, o.y, o.z); d.rotation.set(0, o.rot, 0); d.scale.set(o.size, o.size * o.sy, o.size); d.updateMatrix(); S.M.push(d.matrix.clone()); S.P.push(new THREE.Vector3(o.x, o.y, o.z));
      const k = r(); C.set(TINT[o.v % 3][i % 3]); S.V.push([C.r, C.g, C.b, o.v ? 0.5 + k * 0.5 : k * 0.5]); });
    sets.push(S); };
  mesh(isles.filter((o) => o.v < 3), 17, false); mesh(isles.filter((o) => o.v === 3), 32, true);
  const last = new THREE.Vector3(1e9, 0, 0); let lastQ = -1;
  const lod = (cam, q = 2) => {
    if (q === lastQ && cam.distanceToSquared(last) < 400) return false;
    last.copy(cam); lastQ = q; const T = [380, 520, 700][q] ?? 700;
    sets.forEach((S) => { const c = [0, 0];
      S.L.forEach((o, i) => { const dd = S.P[i].distanceTo(cam) - o.size, nv = dd < (S.near[i] === 0 ? T * 1.08 : T / 1.08) ? 0 : 1; S.near[i] = nv;
        const m = S.m[nv], at = c[nv]++; m.setMatrixAt(at, S.M[i]); m.geometry.attributes.iV.array.set(S.V[i], at * 4); });
      S.m.forEach((m, k) => { m.count = c[k]; m.visible = c[k] > 0; m.instanceMatrix.needsUpdate = true; m.geometry.attributes.iV.needsUpdate = true; }); });
    return true;
  };
  lod(new THREE.Vector3(0, 30, 100));
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
  // stats() báo số đảo đang vẽ bản gần và bản xa
  return { group, isles, update, lod, stats: () => ({ near: sets[0].m[0].count + sets[1].m[0].count, far: sets[0].m[1].count + sets[1].m[1].count }) };
}

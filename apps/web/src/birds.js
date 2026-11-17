// Chim nhỏ ghé Vân Đảo: bay tới đậu cạnh nhân vật, trên cây, nóc Tịnh Thất, Bia, Cổng; ríu rít rồi bay đi.
// Cả đàn là một InstancedMesh (một lệnh vẽ): màu lông là màu riêng từng instance, cánh vỗ ngay trong vertex shader theo góc `iF`.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const PAL = ['#e8b93a', '#8a6a4c', '#4f86c6', '#d9694a', '#7aa65a'];
// aK = (cánh: +1 trái · −1 phải · 0 thân, tỉ lệ màu lông của instance 0..1 — còn lại là màu đỉnh: bụng, mỏ, mắt, chân)
const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const shape = (pts) => new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));
function birdGeo() {
  const C = new THREE.Color(), part = (g, hex, wing = 0, fy = null) => { g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, n = p.count, c = new Float32Array(n * 3), k = new Float32Array(n * 2); C.set(hex || '#efe6d2');
    for (let i = 0; i < n; i++) { C.toArray(c, i * 3); k[i * 2] = wing; k[i * 2 + 1] = hex ? 0 : fy ? fy(p.getY(i)) : 1; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aK', new THREE.BufferAttribute(k, 2)); g.deleteAttribute('uv'); return g; };
  // thân hình giọt nước liền một khối (ngực tròn, thuôn về đuôi); lưng màu lông, bụng sáng chuyển dần
  const b = new THREE.LatheGeometry([[0.001, -0.27], [0.05, -0.21], [0.105, -0.1], [0.13, 0], [0.118, 0.1], [0.07, 0.17], [0.001, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 12); b.rotateX(Math.PI / 2); b.scale(1, 0.95, 1); b.translate(0, 0.13, 0);
  const h = new THREE.SphereGeometry(0.095, 12, 10); h.translate(0, 0.25, 0.14);
  const bk = new THREE.ConeGeometry(0.028, 0.09, 6); bk.rotateX(Math.PI / 2); bk.translate(0, 0.245, 0.265);
  const eye = (s) => { const e = new THREE.SphereGeometry(0.017, 8, 6); e.translate(s * 0.062, 0.275, 0.205); const l = new THREE.SphereGeometry(0.006, 5, 4); l.translate(s * 0.068, 0.283, 0.219); return [part(e, '#151515'), part(l, '#ffffff')]; };
  // đuôi xòe ba lông; cánh dẹt có mép sau khía thành lông vũ, gốc cánh ở (±0,09; 0,17) để shader vỗ cánh quanh trục thân
  const tl = shape([[0, 0], [-0.07, -0.2], [-0.035, -0.235], [0, -0.215], [0.035, -0.235], [0.07, -0.2]]); tl.rotateX(Math.PI / 2 - 0.3); tl.translate(0, 0.17, -0.17);
  const wing = (s) => { const g = shape([[0, 0.08], [0.1, 0.1], [0.22, 0.07], [0.31, 0.01], [0.25, -0.02], [0.26, -0.06], [0.19, -0.05], [0.18, -0.09], [0.11, -0.07], [0.08, -0.1], [0, -0.07]]); g.rotateX(Math.PI / 2); g.translate(0.09, 0.17, 0); if (s < 0) g.scale(-1, 1, 1); return part(g, 0, s); };
  const leg = (s) => { const g = new THREE.CylinderGeometry(0.008, 0.008, 0.09, 4); g.translate(s * 0.04, 0.02, 0.02); return part(g, '#6b4a2a'); };
  return mergeGeometries([part(b, 0, 0, (y) => sm(0.05, 0.14, y)), part(h, 0, 0, (y) => sm(0.2, 0.26, y)), part(bk, '#e0902a'), part(tl), ...eye(1), ...eye(-1), leg(1), leg(-1), wing(1), wing(-1)]);
}

export function buildBirds(n = 12) {
  const group = new THREE.Group(), birds = [], V = (x, y, z) => new THREE.Vector3(x, y, z), geo = birdGeo(), flap = new Float32Array(n), C = new THREE.Color();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => { sh.vertexShader = 'attribute vec2 aK; attribute float iF;\n' + sh.vertexShader
    .replace('#include <color_vertex>', 'vColor = vec4(mix(color, instanceColor, aK.y), 1.);')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n if (aK.x != 0.) { vec3 pv = vec3(.09*aK.x, .17, 0.), q = transformed - pv; float f = clamp(-iF - 1., 0., 1.), a = mix(iF, -.25, f)*aK.x, b = 1.4*f*aK.x, c = cos(b), s = sin(b); q = vec3(q.x*c + q.z*s, q.y, q.z*c - q.x*s); c = cos(a); s = sin(a); transformed = pv + vec3(q.x*c - q.y*s, q.x*s + q.y*c, q.z); }'); };
  geo.setAttribute('iF', new THREE.InstancedBufferAttribute(flap, 1));
  const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.castShadow = true; mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false; group.add(mesh);
  for (let i = 0; i < n; i++) {
    mesh.setColorAt(i, C.set(PAL[i % PAL.length]));
    // `g` chỉ giữ vị trí/góc/tỉ lệ của từng con (không nằm trong cảnh); ma trận được chép sang InstancedMesh cuối mỗi lần cập nhật
    const g = new THREE.Object3D(); g.scale.setScalar(1.5); g.visible = false;
    birds.push({ g, flap: 0, state: 'away', t: 0, wait: 3 + i * 4.5 + Math.random() * 6, a: V(0, 0, 0), b: V(0, 0, 0), c: V(0, 0, 0), yaw: 0, chirpIn: 1, perch: -1 });
  }
  const bez = (o, a, c, b, t) => { const u = 1 - t; o.set(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z); };
  const tmp = V(0, 0, 0), busy = new Set(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  // perches(): danh sách điểm đậu [{p:Vector3, near:boolean}] tính theo hệ tọa độ thế giới; onChirp(pan, n)
  // opts: { n: số chim được ghé (0–12), freq: hệ số tần suất (0,5 thưa · 1 vừa · 2 năng ghé) }
  const update = (dt, time, perches, cam, onChirp, opts = {}) => {
    const nOn = opts.n === undefined ? 6 : opts.n, fq = opts.freq || 1;
    birds.forEach((B, idx) => { B.off = idx >= nOn; });
    for (const B of birds) {
      B.t += dt;
      if (B.off && B.state === 'away') { B.t = 0; continue; }
      if (B.off && B.state === 'perch') B.t = B.dur + 1;
      if (B.state === 'away') { if (B.t > B.wait && perches.length) { let k = Math.floor(Math.random() * perches.length), tries = 0; while (busy.has(k) && tries++ < 6) k = (k + 1) % perches.length; if (busy.has(k)) { B.t = 0; B.wait = 2 / fq; continue; }
          busy.add(k); B.perch = k; B.b.copy(perches[k].p); const an = Math.random() * 6.283, far = 46 + Math.random() * 20; B.a.set(B.b.x + Math.cos(an) * far, B.b.y + 16 + Math.random() * 10, B.b.z + Math.sin(an) * far);
          B.c.set((B.a.x + B.b.x) / 2 + Math.sin(an) * 9, B.b.y + 7, (B.a.z + B.b.z) / 2 - Math.cos(an) * 9); B.state = 'arrive'; B.t = 0; B.dur = 4.6 + Math.random(); B.g.visible = true; } }
      else if (B.state === 'arrive' || B.state === 'leave') { const k = Math.min(1, B.t / B.dur), e = B.state === 'arrive' ? 1 - Math.pow(1 - k, 2.2) : k * k;
        const from = B.state === 'arrive' ? B.a : B.b, to = B.state === 'arrive' ? B.b : B.a; bez(B.g.position, from, B.c, to, e); bez(tmp, from, B.c, to, Math.min(1, e + 0.03));
        if (tmp.distanceToSquared(B.g.position) > 1e-6) B.yaw = Math.atan2(tmp.x - B.g.position.x, tmp.z - B.g.position.z); B.g.rotation.set(0, B.yaw, 0);
        B.flap = Math.sin(time * 34 + B.a.x) * (k > 0.93 && B.state === 'arrive' ? 0.5 : 1) * 0.95 + 0.15;
        B.g.scale.setScalar(1.5 * (B.state === 'leave' ? 1 - 0.5 * e : 1));
        if (k >= 1) { if (B.state === 'arrive') { B.state = 'perch'; B.t = 0; B.dur = 7 + Math.random() * 9; B.chirpIn = 0.6 + Math.random(); B.yaw0 = B.yaw; } else { B.state = 'away'; B.t = 0; B.wait = (9 + Math.random() * 20) / fq; B.g.visible = false; busy.delete(B.perch); } } }
      else if (B.state === 'perch') { const P = perches[B.perch]; if (P) B.b.copy(P.p);
        const hop = Math.max(0, Math.sin(B.t * 5.2 + B.a.z)) * (Math.sin(B.t * 0.9 + B.a.x) > 0.55 ? 0.07 : 0); B.g.position.set(B.b.x, B.b.y + hop, B.b.z);
        B.g.rotation.set(Math.sin(B.t * 3.1) * 0.08, B.yaw0 + Math.sin(B.t * 0.8 + B.a.x) * 0.9, Math.sin(B.t * 2.3) * 0.12); B.flap = -2;   // đậu: xếp cánh dọc theo lưng
        B.chirpIn -= dt; if (B.chirpIn <= 0) { B.chirpIn = (1.6 + Math.random() * 3.2) / Math.sqrt(fq); if (onChirp && cam) { tmp.copy(B.g.position).project(cam); onChirp(Math.max(-1, Math.min(1, tmp.x)), 2 + Math.floor(Math.random() * 4), B.a.x); } }
        if (B.t > B.dur || !P || (P.moved && P.moved())) { B.state = 'leave'; B.t = 0; B.dur = 4.5 + Math.random(); const an = Math.random() * 6.283; B.a.set(B.b.x + Math.cos(an) * 60, B.b.y + 24, B.b.z + Math.sin(an) * 60); B.c.set(B.b.x + Math.cos(an) * 12, B.b.y + 9, B.b.z + Math.sin(an) * 12); } }
    }
    // chép tư thế sang InstancedMesh; chỉ vẽ tới con đang hiện có số thứ tự lớn nhất, không con nào thì bỏ cả lệnh vẽ
    let top = 0;
    birds.forEach((B, i) => { if (B.g.visible) { B.g.updateMatrix(); mesh.setMatrixAt(i, B.g.matrix); flap[i] = B.flap; top = i + 1; } else mesh.setMatrixAt(i, ZERO); });
    mesh.count = top; mesh.visible = top > 0; mesh.instanceMatrix.needsUpdate = true; geo.attributes.iF.needsUpdate = true;
  };
  return { group, update, birds };
}

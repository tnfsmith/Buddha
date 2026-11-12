import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildRealm } from './realm.js';
import { buildBirds } from './birds.js';
import { NOISE, OUT, rng, puffAtlas, buddhaTex } from './gfx.js';
import { buildHome, buildNeighbor, groundH, floorH, pvFloor, DECKS, STAIR, P, islandUniforms, SX, SZ, HILL, POND } from './island.js';
import { buildFigure, makeCrowd, defaultLook, suggestNames, OPTIONS } from './people.js';

export { groundH };
const BUD = new THREE.Vector3(0, 0, -760), SEAT = new THREE.Vector3(0, 3, -256);
// Tôn tượng phóng 1,5 lần và ngự trên đài mây cao BL: vai ≈ 305, mắt ≈ 370, đỉnh đầu ≈ 460 — luôn cao hơn mọi tầng
export const BS = 1.5, BL = 75, BUD_EYE = BL + 196 * BS, BUD_SHOULDER = BL + 153 * BS;
const DAY = new THREE.Color(1.0, 0.95, 0.85), NIGHT = new THREE.Color(0.2, 0.22, 0.36);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const faceBud = (x, z) => Math.atan2(BUD.x - x, BUD.z - z);
const ease = (k) => k * k * (3 - 2 * k);

export const ANCHORS = {
  kuti: { node: 'kuti', label: [-13, -7, 17.5], cam: [[-8.6, 23.4, 7.4], [-13, 22.1, -6.4]], face: 0, sit: true, seatH: 0.36 },
  pad: { deck: 0, node: 'pad', label: [28.5, 2, 5], cam: [[44, 19, 24], [25, 13.5, 0]], sit: true },
  garden: { node: 'garden', label: [-21, 5, 15.5], cam: [[-2, 22, 36], [-13, 15.5, 7]] },
  tea: { node: 'tea', label: [8, -9, 8.5], cam: [[17, 19.5, 6], [7, 13.6, -8.5]], sit: true, seatH: 0.2, face: Math.atan2(7 - 5.852, -8.5 + 6.923) },
  gate: { node: 'gate', label: [17, 17, 3.2], cam: [[34, 19, 38], [16, 14, 15]] },
  stele: { node: 'stele', label: [10.5, 10, 6.2], cam: [[19, 18, 28], [10, 14, 10]] },
};
const NODES = { kuti: [-13, -5.6], kDoor: [-13, -0.9], kFoot: [-13, 5.6], mid: [2, -1], fork: [9, 6], gate: [13.5, 13.5], stele: [9.4, 12.6], padA: [20, 2.8], pad: [26.5, 2], teaA: [5.2, -3.6], tea: [5.852, -6.923], gA: [-7.5, 3], gG: [-13, 8], gB: [-15.6, 7], garden: [-18.6, 6] };
const EDGES = [['kuti', 'kDoor'], ['kDoor', 'kFoot'], ['kFoot', 'gA'], ['kFoot', 'gG'], ['mid', 'fork'], ['fork', 'gate'], ['gate', 'stele'], ['fork', 'stele'], ['fork', 'padA'], ['padA', 'pad'], ['mid', 'teaA'], ['teaA', 'tea'], ['mid', 'gA'], ['gA', 'gG'], ['gG', 'gB'], ['gB', 'garden']];

// Các tầng tỉnh thức: [x, z, cỡ đảo]; cao độ tăng dần về phía Tôn tượng
export const TIER_ISLES = [
  { y: [4, 18], list: [[-105, -70, 13], [118, -30, 15], [165, 70, 11], [72, -150, 10], [-150, 40, 9], [-70, -175, 12], [215, -120, 13], [-235, -95, 14], [-190, -235, 11], [255, -265, 12], [-315, -330, 13], [335, -385, 12], [130, 150, 10], [-120, 140, 11], [-88, -8, 7], [92, -100, 8], [-42, -128, 7], [34, -205, 9], [152, -62, 7], [-172, -42, 8], [196, -8, 8], [-205, -165, 9], [60, 118, 6], [-64, 92, 6]] },
  { y: [62, 84], list: [[-250, -170, 15], [265, -205, 16], [-350, -290, 14], [365, -330, 15], [-285, -440, 13], [300, -470, 14]] },
  { y: [140, 165], list: [[-345, -520, 15], [360, -550, 16], [-455, -440, 13], [468, -470, 14], [-265, -650, 13], [280, -670, 13]] },
  { y: [225, 252], list: [[-330, -720, 15], [342, -740, 16], [-440, -640, 13], [452, -660, 14]] },
];
export const TIER_LABEL = [[-150, 30, 40], [-250, 92, -170], [-345, 172, -520], [-292, 256, -720], [-200, 372, -724]];
// nhãn Tầng 3 và Tầng 4 dóng phải về điểm neo, chữ kéo sang trái để không đè thân Tôn tượng
export const TIER_LABEL_LEFT = [false, false, false, true, true];

const seatOf = (an) => (an && an.deck !== undefined ? DECKS[an.deck].seat || 0.02 : (an && an.seatH) || 0.02);
export class World {
  static V3 = THREE.Vector3;
  static NODES = NODES;
  static floorH = floorH;
  constructor(canvas, look, quality, startPos) {
    this.startPos = startPos && isFinite(startPos.x) && isFinite(startPos.z) ? startPos : null;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(DAY.clone(), 260, 2000);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.5, 7000);
    this.controls = new OrbitControls(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.45, zoomSpeed: 0.7 });
    this.controls.target.set(12, 36, 0);
    this.mode = 'island'; this.time = 0; this.tween = null; this.rnd = rng(7); this.baseFov = 58;
    this.fixedQ = quality !== undefined; this.quality = quality !== undefined ? quality : 2; this.acc = 0; this.accN = 0;
    this.u = { uTime: { value: 0 }, uNight: { value: 0 }, uAmber: { value: 0 }, uJade: { value: 0 }, uCalm: { value: 0 }, uCam: { value: V(0, 0, 0) }, uMist: { value: 0.7 },
      uHalo: { value: 1 }, uRainbow: { value: 0.5 }, uHaloWhite: { value: 0 }, uTier2: { value: 0 }, uBud: { value: V(0, 0.2, -1).normalize() }, uB: { value: 0 }, uP: { value: 0 } };
    this._lights(); this._sky(); this._clouds(); this._buddha();
    this.home = buildHome(); this.scene.add(this.home.group);
    this._tiers(); this._hall(); this.realm = buildRealm(91); this.scene.add(this.realm.group); this._puffs(); this._fx();
    this.look = { ...defaultLook(), ...look }; this._avatar();
    this._composer(); this.setLimits(); this.resize();
    this.camera.position.copy(this.islandCam()); this.controls.target.copy(this.islandTarget());
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0xfff1d6, 0x9aa6c4, 0.55); this.scene.add(this.hemi);
    const s = (this.sun = new THREE.DirectionalLight(0xffe3b4, 2.6)); s.position.set(-60, 120, -190); s.target.position.set(0, 12, 0); this.scene.add(s, s.target);
    s.castShadow = true; s.shadow.mapSize.set(2048, 2048); Object.assign(s.shadow.camera, { left: -58, right: 58, top: 50, bottom: -50, near: 40, far: 420 }); s.shadow.bias = -0.0004; s.shadow.normalBias = 0.7;
    this.fill = new THREE.DirectionalLight(0xdfe8ff, 0.7); this.fill.position.set(60, 90, 140); this.scene.add(this.fill);
  }

  _sky() {
    const mk = (uni) => new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: uni,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform float uNight,uTier2,uTime; uniform vec3 uBud; varying vec3 vDir; ${NOISE}
      void main(){ vec3 d = normalize(vDir); float h = clamp(d.y,0.,1.); float g = max(dot(d,uBud),0.);
        vec3 hz = vec3(1.0,0.95,0.85);
        vec3 warm = mix(vec3(0.99,0.90,0.74), vec3(1.0,0.82,0.52), pow(g,5.));
        vec3 col = mix(hz, warm, smoothstep(0.,0.10,h)*(0.30+0.70*pow(g,3.)));
        vec3 blue = mix(vec3(0.50,0.71,0.94), vec3(0.24,0.46,0.84), smoothstep(0.12,0.9,h));
        col = mix(col, blue, smoothstep(0.05,0.55,h)*(1.-0.75*pow(g,6.)));
        vec2 cp = d.xz/(d.y+0.22)*1.4 + vec2(uTime*0.004,0.); float ci = smoothstep(0.50,0.86,fbm(cp*vec2(1.0,2.6)))*smoothstep(0.05,0.35,h);
        col = mix(col, mix(vec3(0.99), vec3(1.0,0.90,0.72), pow(g,2.)), ci*0.6);
        col = mix(col, col*vec3(0.80,1.0,0.97)+vec3(0.07,0.05,0.), uTier2*0.5);
        vec3 nz = mix(vec3(0.20,0.22,0.36), vec3(0.02,0.03,0.10), pow(h,0.55)) + vec3(0.07,0.08,0.16)*smoothstep(0.5,0.9,fbm(cp*0.7+9.))*h;
        col = mix(col, nz, uNight*0.9); float a = 1.; ${OUT} }` });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), mk(this.u)); this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.scene.add(this.sky);
    // Ánh sáng môi trường lấy từ chính bầu trời
    try {
      const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), mk({ uNight: { value: 0 }, uTier2: { value: 0 }, uTime: { value: 0 }, uBud: { value: V(0, 0.2, -1).normalize() } })));
      const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(es, 0, 1, 500).texture; this.scene.environmentIntensity = 0.85; pm.dispose();
    } catch (e) { this.hemi.intensity = 1.1; }
    const n = 1100, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = this.rnd() * Math.PI * 2, e = Math.asin(0.06 + this.rnd() * 0.94), R = 4200; pos.set([R * Math.cos(e) * Math.cos(a), R * Math.sin(e), R * Math.cos(e) * Math.sin(a)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(1.6, 1.6, 1.8), size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); this.stars.frustumCulled = false; this.scene.add(this.stars);
  }

  _clouds() {
    const mk = (y, scale, speed, alpha, solid, order) => {
      const mat = new THREE.ShaderMaterial({ transparent: !solid, depthWrite: solid, fog: false, uniforms: { ...this.u, uScale: { value: scale }, uSpeed: { value: speed }, uAlpha: { value: alpha }, uSolid: { value: solid ? 1 : 0 } },
        vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
        fragmentShader: `uniform float uTime,uScale,uSpeed,uAlpha,uNight,uAmber,uJade,uCalm,uSolid; uniform vec3 uCam; varying vec3 vW; ${NOISE}
        float hgt(vec2 p){ return fbm(p)*0.55 + noise(p*2.7+31.)*0.2 + noise(p*0.33+7.)*0.35; }
        void main(){ vec2 p = vW.xz*uScale + vec2(uTime*uSpeed*(1.-.75*uCalm), uTime*uSpeed*.37);
          float n = hgt(p); float lit = clamp(0.5 + (n - hgt(p + vec2(0.03,-0.30)))*2.5, 0., 1.);
          float a = mix(smoothstep(0.42,0.74,n)*uAlpha, 1.0, uSolid);
          vec3 col = mix(vec3(0.83,0.85,0.94), vec3(1.0,0.985,0.955), lit*0.7 + smoothstep(0.3,0.8,n)*0.3);
          col = mix(col, vec3(1.0,0.90,0.70), 0.20*lit);
          col = mix(col, vec3(1.0,0.80,0.50), uAmber*0.42); col = mix(col, vec3(0.78,0.97,0.93), uJade*0.22);
          vec3 hz = mix(vec3(1.0,0.95,0.85), vec3(0.20,0.22,0.36), uNight*0.9);
          col = mix(col, col*vec3(0.36,0.40,0.62), uNight*0.85);
          float f = smoothstep(160., 1400., length(vW.xz-uCam.xz));
          col = mix(col, hz, f); a = mix(a, 1.0, f*uSolid) * mix(1.0, 1.0-f, 1.0-uSolid); ${OUT} }` });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(11000, 11000), mat); m.rotation.x = -Math.PI / 2; m.position.y = y; m.renderOrder = order; m.frustumCulled = false; this.scene.add(m); return m;
    };
    mk(-9, 0.0055, 0.012, 1, true, -5); mk(-3, 0.0045, 0.02, 0.8, false, 1); mk(2.5, 0.0085, 0.03, 0.5, false, 2);
  }

  _buddha() {
    const g = (this.budGroup = new THREE.Group()); g.position.set(BUD.x, BL, BUD.z); g.scale.setScalar(BS); this.scene.add(g);
    this.budFig = new THREE.Mesh(new THREE.PlaneGeometry(262, 328), new THREE.MeshBasicMaterial({ map: buddhaTex(), alphaTest: 0.5, fog: false }));
    this.budFig.position.set(0, 148, 0); g.add(this.budFig);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1100), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: this.u,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uTime,uHalo,uRainbow,uHaloWhite; varying vec2 vUv;
      void main(){ vec2 p = vUv*2.-1.; float r = length(p); float ang = atan(p.y,p.x);
        float glow = exp(-r*r*7.0);
        float rings = smoothstep(0.012,0.0,abs(r-0.31)) + 0.6*smoothstep(0.010,0.0,abs(r-0.42)) + 0.4*smoothstep(0.008,0.0,abs(r-0.55));
        float rays = pow(0.5+0.5*sin(ang*16.+uTime*0.04),5.)*smoothstep(1.0,0.30,r)*smoothstep(0.14,0.38,r);
        vec3 c6 = 0.55+0.45*cos(ang*3.+uTime*0.03+vec3(0.,2.1,4.2));
        vec3 col = mix(vec3(1.0,0.74,0.34), vec3(1.0,0.88,0.56), glow)*(1.0+0.22*glow+0.45*rings);
        col = mix(col, c6*1.12, clamp(rays*uRainbow*0.9,0.,0.85));
        col = mix(col, vec3(1.0,1.04,1.16)*(0.62+0.55*glow), uHaloWhite*0.8);
        float a = clamp((glow*0.85 + rings*0.30)*min(uHalo,1.6) + rays*(0.16+0.26*uRainbow)*uHalo, 0., 1.)*smoothstep(1.0,0.8,r); ${OUT} }` }));
    halo.position.set(0, 196, -14); halo.scale.setScalar(0.8); halo.renderOrder = -1; g.add(halo); this.halo = halo;
    this.waves = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 160), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.4, 0.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(BUD.x, 7, BUD.z); m.renderOrder = 6; this.scene.add(m); this.waves.push(m); }
  }

  _tiers() {
    this.isles = []; const crowd = []; this.glowSeats = []; this.friends = [];
    const names = suggestNames(12, rng(99)); let seed = 1;
    TIER_ISLES.forEach((T, tier) => T.list.forEach(([x, z, size], k) => {
      const nb = buildNeighbor(tier, seed++, size), y = T.y[0] + (T.y[1] - T.y[0]) * this.rnd();
      nb.group.position.set(x, y - nb.top, z); nb.group.rotation.y = this.rnd() * 6.28; nb.group.updateMatrixWorld(true); this.scene.add(nb.group);
      const isle = { tier, x, y, z, size, nb, seats: nb.seats.map((s) => V(s.x, s.y, s.z).applyMatrix4(nb.group.matrixWorld)) };
      this.isles.push(isle);
      isle.seats.forEach((p, i) => {
        if (tier === 0 && k < 3 && i === 0) return this.friends.push({ isle, pos: p, name: names[k] });
        crowd.push({ x: p.x, y: p.y, z: p.z, rot: faceBud(p.x, p.z) }); if (tier >= 2) this.glowSeats.push({ p, tier });
      });
    }));
    // Tầng 4: không còn đảo, chỉ Vân Tọa sáng quanh hào quang
    const T4 = [[-128, 366, -724], [128, 366, -724], [0, 362, -640]];
    // vầng quang hình bầu dục ngang tai, chạy dưới ba cụm Vân Tọa
    [[128, 100, 356, 0.42], [178, 142, 362, 0.22]].forEach(([rx, rz, y, op]) => { const g = new THREE.TorusGeometry(1, 0.012, 6, 200); g.scale(rx, rz, 125); const ring = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.45, 0.9), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); ring.rotation.x = Math.PI / 2; ring.position.set(0, y, -738); this.scene.add(ring); });
    for (let i = 0; i < 36; i++) { const c = T4[i % 3], j = Math.floor(i / 3), a = j * 2.4 + (i % 3) * 1.1, d = j ? 7.5 + Math.sqrt(j) * 7.2 : 0, x = c[0] + Math.cos(a) * d, y = c[1] + Math.sin(j * 1.7) * 1.2 + (j ? 0 : 0.5), z = c[2] + Math.sin(a) * d * 0.75; crowd.push({ x, y, z, rot: faceBud(x, z), robe: '#9a7436', sc: 2.2 }); this.glowSeats.push({ p: V(x, y, z), tier: 4 }); }
    this.tierCrowd = makeCrowd(crowd, 5); this.scene.add(this.tierCrowd);
    // Ba bạn đồng tu ở đảo gần: nhân vật riêng, chào và thăm được
    const fr = rng(21);
    this.friends.forEach((f, i) => {
      const look = { skin: Math.floor(fr() * 5), robe: [2, 3, 4][i], trim: i, hair: ['buithap', 'cao', 'buicao'][i], hairColor: [0, 0, 2][i], age: ['tre', 'trung', 'cao'][i], mood: ['hoa', 'nghiem', 'tuoi'][i], acc: ['hat', 'khong', 'khan'][i] };
      f.fig = buildFigure(look); f.fig.setPose('sit'); f.fig.group.position.copy(f.pos); f.fig.group.rotation.y = faceBud(f.pos.x, f.pos.z); this.scene.add(f.fig.group);
      f.head = f.pos.clone().add(V(0, 2.6, 0)); f.until = 0;
      f.arrive = f.pos.clone().add(V(Math.sin(f.fig.group.rotation.y + 1.2) * 3.2, 0, Math.cos(f.fig.group.rotation.y + 1.2) * 3.2));
    });
    // Cầu Ánh Sáng giữa các đảo Tầng 3 và về phía hào quang
    this.lbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.55, 1.0), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const t3 = this.isles.filter((i) => i.tier === 3), arc = (a, b, lift, rad) => { const mid = a.clone().lerp(b, 0.5); mid.y += lift; this.scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 48, rad, 6), this.lbMat)); };
    t3.forEach((a, i) => { const p = V(a.x, a.y + 4, a.z); arc(p, V(Math.sign(a.x) * 190, 250, -735), 40, 0.9); const b = t3[(i + 2) % t3.length]; if (b !== a && Math.sign(b.x) === Math.sign(a.x)) arc(p, V(b.x, b.y + 4, b.z), 22, 0.6); });
    this.homeLb = new THREE.Group(); this.homeLbMat = this.lbMat.clone(); this.scene.add(this.homeLb);
    [this.isles[0], this.isles[1], { x: 0, y: 4, z: -230 }].forEach((e) => { const a = V(HILL.x, 33, HILL.z), b = V(e.x, e.y + 4, e.z), mid = a.clone().lerp(b, 0.5); mid.y += 46; this.homeLb.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 60, 0.7, 6), this.homeLbMat)); });
    // Vân lộ: từ thềm Cổng Vân Môn tới ba đảo bạn
    const start = V(34, 6, 34);
    this.bridges = this.friends.map((f) => { const mid = start.clone().lerp(f.arrive, 0.5); mid.y = Math.min(start.y, f.arrive.y) - 4; return new THREE.CatmullRomCurve3([start, mid, f.arrive.clone().add(V(0, -0.5, 0))]); });
  }

  _hall() {
    const seats = [];
    for (let rho = 200; rho <= 520; rho += 16) { const n = Math.floor((2 * 0.56 * rho) / 15);
      for (let i = 0; i < n; i++) { const phi = -0.56 + (1.12 * (i + 0.5)) / n + (this.rnd() - 0.5) * 0.004, x = rho * Math.sin(phi), z = BUD.z + rho * Math.cos(phi); if (Math.hypot(x - SEAT.x, z - SEAT.z) < 9) continue; seats.push({ x, y: 3 + (this.rnd() - 0.5) * 0.8, z, row: (rho - 200) / 16 }); } }
    this.seats = seats; const n = seats.length, d = new THREE.Object3D();
    this.hallCrowd = makeCrowd(seats.map((s) => ({ x: s.x, y: s.y + 0.55, z: s.z, rot: faceBud(s.x, s.z) })), 9); this.scene.add(this.hallCrowd);
    const a = new THREE.SphereGeometry(1.9, 10, 6); a.scale(1, 0.42, 1); const b = new THREE.SphereGeometry(1.2, 7, 5); b.scale(1, 0.5, 1); b.translate(1.5, -0.1, 0.4); const c2 = new THREE.SphereGeometry(1.1, 7, 5); c2.scale(1, 0.5, 1); c2.translate(-1.4, -0.1, -0.5);
    const merged = new THREE.BufferGeometry(); { const gs = [a, b, c2].map((g) => g.toNonIndexed()), tot = gs.reduce((s, g) => s + g.attributes.position.count, 0), pp = new Float32Array(tot * 3), nn = new Float32Array(tot * 3); let o = 0; gs.forEach((g) => { pp.set(g.attributes.position.array, o); nn.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; }); merged.setAttribute('position', new THREE.BufferAttribute(pp, 3)); merged.setAttribute('normal', new THREE.BufferAttribute(nn, 3)); }
    this.seatMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#bfeee4', emissiveIntensity: 0 });
    this.seatMat.onBeforeCompile = (sh) => { sh.uniforms.uB = this.u.uB; sh.vertexShader = 'uniform float uB;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed *= (1.0 + uB);'); };
    const puff = new THREE.InstancedMesh(merged, this.seatMat, n + 1);
    seats.concat([{ x: SEAT.x, y: SEAT.y, z: SEAT.z }]).forEach((s, i) => { d.position.set(s.x, s.y, s.z); d.rotation.set(0, i * 1.7, 0); d.updateMatrix(); puff.setMatrixAt(i, d.matrix); });
    puff.frustumCulled = false; this.scene.add(puff);
    this.pillarMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.0, 0.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.8, 16, 8, 1, true), this.pillarMat, n + 1);
    seats.concat([{ x: SEAT.x, y: SEAT.y, z: SEAT.z }]).forEach((s, i) => { d.position.set(s.x, s.y - 8.6, s.z); d.rotation.set(0, 0, 0); d.updateMatrix(); pil.setMatrixAt(i, d.matrix); });
    pil.frustumCulled = false; pil.renderOrder = 7; this.scene.add(pil);
    const lp = [];
    for (let i = 0; i < n; i++) { const s = seats[i], t = seats[i + 1]; if (t && t.row === s.row) lp.push(s.x, s.y + 1.4, s.z, t.x, t.y + 1.4, t.z);
      let best = null, bd = 1e9; for (let j = Math.max(0, i - 90); j < i; j++) { const q = seats[j]; if (q.row === s.row - 1) { const dd = Math.hypot(q.x - s.x, q.z - s.z); if (dd < bd) { bd = dd; best = q; } } } if (best) lp.push(s.x, s.y + 1.4, s.z, best.x, best.y + 1.4, best.z); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.filaMat = new THREE.LineBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.fila = new THREE.LineSegments(lg, this.filaMat); this.fila.renderOrder = 8; this.fila.frustumCulled = false; this.scene.add(this.fila);
    this.beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.35, 1.5), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide });
    [[0, -256], [-90, -330], [95, -350], [-40, -430], [60, -470], [-150, -470], [160, -440], [0, -540]].forEach(([x, z], i) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(3, 30, 460, 18, 1, true), this.beamMat); m.position.set(x, 232, z); m.rotation.z = (i % 3 - 1) * 0.05; this.scene.add(m); });
    const pn = (n + 1) * 3, st = new Float32Array(pn * 3), sd = new Float32Array(pn);
    for (let i = 0; i < pn; i++) { const s = i < n * 3 ? seats[Math.floor(i / 3)] : SEAT; st.set([s.x + (this.rnd() - 0.5) * 2, s.y + 3, s.z + (this.rnd() - 0.5) * 2], i * 3); sd[i] = this.rnd(); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(st, 3)); pg.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    this.merit = new THREE.Points(pg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, uniforms: { ...this.u, uTarget: { value: V(BUD.x, BL + 117 * BS, BUD.z + 14) } },
      vertexShader: `attribute float aSeed; uniform float uP,uTime; uniform vec3 uTarget; varying float vA;
      void main(){ float k = clamp(uP*1.7 - aSeed*0.7, 0., 1.); k = k*k*(3.-2.*k); vec3 p = mix(position, uTarget, k); p.y += sin(k*3.14159)*(70.+90.*aSeed); p.x += sin(aSeed*40.+uTime*0.6)*5.*sin(k*3.14159);
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv; gl_PointSize = (2.2+3.2*aSeed)*220./max(-mv.z,1.) + 1.2; vA = sin(k*3.14159)*0.95; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5); vec3 col = vec3(1.9,1.5,0.8); float a = smoothstep(0.5,0.05,d)*vA; ${OUT} }` }));
    this.merit.frustumCulled = false; this.merit.renderOrder = 9; this.scene.add(this.merit);
  }

  _puffs() {
    const items = [], r = this.rnd, add = (x, y, z, size, group) => items.push([x, y, z, size, r(), group, Math.floor(r() * 4)]);
    for (let i = 0; i < 640; i++) { const a = r() * Math.PI * 2, R = 55 + Math.pow(r(), 0.8) * 1000; add(Math.cos(a) * R, -11.5 + r() * 2, Math.sin(a) * R - 220, 30 + r() * 38, 0); }
    for (let i = 0; i < 54; i++) { const a = r() * Math.PI * 2, R = 1150 + r() * 1500, az = Math.atan2(Math.cos(a) * R, -(Math.sin(a) * R)); if (Math.abs(az) < 0.5 && Math.sin(a) < 0) continue; add(Math.cos(a) * R, 30 + r() * 330, Math.sin(a) * R, 320 + r() * 420, 4); }
    const home = this.home;
    for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2, o = (1 + 0.16 * Math.sin(2 * a + 0.8) + 0.09 * Math.sin(3 * a + 2.1)) * (0.98 + r() * 0.25); add(SX * o * Math.cos(a), -13 + r() * 8, SZ * o * Math.sin(a), 13 + r() * 12, 6); }
    for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, o = 0.7 + r() * 0.45; add(SX * o * Math.cos(a), 12.5 + r() * 4, SZ * o * Math.sin(a), 12 + r() * 11, 1); }
    for (let i = 0; i < 9; i++) add(27 + (r() - 0.5) * 12, 9.0 + r() * 2, 2 + (r() - 0.5) * 9, 6 + r() * 5, 2);
    add(-8, -7, 21, 14, 2); add(-7, -9, 23, 11, 2);
    this.isles.forEach((I) => { const n = 7 + Math.floor(I.size / 3); for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + r(), d = I.size * (0.85 + r() * 0.3); add(I.x + Math.cos(a) * d, I.y - I.size * (0.25 + r() * 0.6), I.z + Math.sin(a) * d * 0.8, I.size * (0.7 + r() * 0.7), 3); }
      if (I.tier > 0) for (let i = 0; i < 3; i++) add(I.x + (r() - 0.5) * I.size * 3, I.y - I.size * 1.6 - r() * 10, I.z + (r() - 0.5) * I.size * 2, I.size * (1.6 + r()), 3); });
    this.bridges.forEach((c) => { for (let i = 0; i <= 44; i++) { const p = c.getPoint(i / 44); add(p.x, p.y - 1.2, p.z, 4.5 + r() * 3.5, 2); } });
    this.glowSeats.forEach((s) => add(s.p.x, s.p.y - (s.tier === 4 ? 2.0 : 0.1), s.p.z, s.tier === 4 ? 5.4 : s.tier === 3 ? 3.2 : 2.4, 5));
    this.realm.isles.forEach((I) => { const n = I.size > 40 ? 5 : 3; for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + r() * 2; add(I.x + Math.cos(a) * I.size * 0.9, I.y - I.size * (0.35 + r() * 0.7), I.z + Math.sin(a) * I.size * 0.7, I.size * (1.1 + r() * 0.9), 3); } });
    for (let i = 0; i < 230; i++) { const x = (r() * 2 - 1) * 1300, z = -1500 + r() * 2100, y = 14 + Math.pow(r(), 1.5) * 330; if (Math.abs(x) < 280 && z < -100 && z > -820 && y < 520) continue; add(x, y, z, 34 + r() * 80, 7); }
    // đài mây nâng Tôn tượng: các lớp mây dày dần từ biển mây lên tới tòa sen
    for (let i = 0; i < 46; i++) { const k = i / 46, a = r() * Math.PI * 2, rr = Math.sqrt(r()), w = 250 - 110 * k; add(Math.cos(a) * rr * w, 6 + k * (BL - 12) + r() * 6, BUD.z + 26 + Math.sin(a) * rr * 70, 70 + r() * 60 - 25 * k, 2); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(Math.cos(a) * 168, BL - 8 + r() * 6, BUD.z + 40 + Math.sin(a) * 34, 34 + r() * 16, 5); }
    void home;
    const n = items.length, g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const ip = new Float32Array(n * 3), im = new Float32Array(n * 4);
    items.forEach((it, i) => { ip.set(it.slice(0, 3), i * 3); im.set(it.slice(3, 7), i * 4); });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(ip, 3)); g.setAttribute('iMeta', new THREE.InstancedBufferAttribute(im, 4)); g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { ...this.u, uTex: { value: puffAtlas() } },
      vertexShader: `attribute vec3 iPos; attribute vec4 iMeta; uniform float uTime,uMist; varying vec2 vUv; varying float vA; varying float vD; varying float vG; varying vec3 vC;
      void main(){ vec3 c = iPos; float g = iMeta.z, sd = iMeta.y; vG = g; vC = c;
        vec2 cell = vec2(mod(iMeta.w,2.), floor(iMeta.w/2.)); vUv = (vec2(sd > 0.5 ? uv.x : 1.-uv.x, uv.y) + cell)*0.5;
        float edge = 1.0;
        if (g < 0.5) { c.x = mod(c.x + uTime*0.9 + 1100., 2200.) - 1100.; edge = smoothstep(1100., 860., abs(c.x)); }
        else if (g > 6.5) { c.x = mod(c.x + uTime*(1.1 + sd*1.4) + 1300., 2600.) - 1300.; edge = smoothstep(1300., 1000., abs(c.x)); if (c.z < 300.) edge *= smoothstep(260., 560., abs(c.x)); }
        else c.x += sin(uTime*0.03+sd*6.28)*(g>3.5&&g<4.5?12.:0.6);
        c.y += sin(uTime*0.07+sd*12.)*(g<0.5 ? 1.3 : (g>6.5 ? 2.4 : (g>2.5&&g<4.5 ? 1.6 : 0.5)));
        vec4 mv = viewMatrix*vec4(c,1.);
        vec2 q = g<0.5 ? vec2(position.x*2.3, (position.y+0.40)*0.30) : (g>6.5 ? vec2(position.x*1.9, position.y*0.62) : (g>3.5&&g<4.5 ? vec2(position.x*1.5, position.y*0.62) : position.xy*1.12));
        mv.xy += q*iMeta.x*(1.+0.08*sin(uTime*0.11+sd*20.));
        gl_Position = projectionMatrix*mv; vD = -mv.z;
        vA = g<0.5 ? 0.92 : (g<1.5 ? uMist*0.42 : (g<2.5 ? 0.5 : (g<3.5 ? 0.82 : (g<4.5 ? 0.9 : (g<5.5 ? 0.75 : (g<6.5 ? 0.42 : 0.36)))))) * edge; }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uNight,uAmber; uniform vec3 uCam,uBud; varying vec2 vUv; varying float vA; varying float vD; varying float vG; varying vec3 vC;
      void main(){ vec4 t = texture2D(uTex, vUv); float lum = t.r; float g = max(dot(normalize(vC-uCam), uBud), 0.);
        vec3 col = mix(vec3(0.78,0.80,0.91), vec3(1.0,0.985,0.955), smoothstep(0.6,1.0,lum));
        col = mix(col, vec3(1.0,0.92,0.78), 0.10 + 0.22*pow(g,4.));
        col += vec3(1.0,0.88,0.66)*pow(g,8.)*(1.-t.a)*0.35;
        col = mix(col, vec3(1.0,0.84,0.60), uAmber*0.3);
        bool lum5 = vG > 4.5 && vG < 6.5; if (lum5) col = vec3(1.9,1.7,1.25);
        vec3 hz = mix(vec3(1.0,0.95,0.85), vec3(0.20,0.22,0.36), uNight*0.9); col = mix(col, col*vec3(0.36,0.40,0.62), uNight*(lum5 ? 0.0 : 0.85));
        float f = smoothstep(300., 2600., vD); col = mix(col, hz, f*(lum5 ? 0.2 : 0.8));
        float a = t.a*t.a*(3.-2.*t.a)*vA*(1.-f*0.5)*smoothstep(1.,8.,vD)*(vG > 6.5 ? smoothstep(14.,90.,vD) : 1.); ${OUT} }` });
    this.puffs = new THREE.Mesh(g, mat); this.puffs.frustumCulled = false; this.puffs.renderOrder = 5; this.scene.add(this.puffs);
  }

  _fx() {
    const N = 90; this.burstPos = new Float32Array(N * 3).fill(-9999); this.burstList = [];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.burstPos, 3));
    this.burstPts = new THREE.Points(g, new THREE.PointsMaterial({ color: new THREE.Color(2, 1.6, 0.9), size: 0.6, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); this.burstPts.frustumCulled = false; this.scene.add(this.burstPts);
    this.ride = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 10), new THREE.MeshStandardMaterial({ color: '#fff', roughness: 1, emissive: '#fff4e0', emissiveIntensity: 0.6 })); this.ride.scale.y = 0.4; this.ride.visible = false; this.scene.add(this.ride);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.5, 0.8), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring);
  }

  _avatar() {
    const keep = this.av ? { p: this.av.pos.clone(), rot: this.av.rot, pose: this.fig.pose, st: this.av.state, where: this.av.where } : null;
    if (this.fig) { this.scene.remove(this.fig.group); this.fig.dispose(); this.scene.remove(this.hallFig.group); this.hallFig.dispose(); }
    this.fig = buildFigure(this.look); this.scene.add(this.fig.group);
    this.hallFig = buildFigure(this.look); this.hallFig.setPose('sit'); this.hallFig.group.position.set(SEAT.x, SEAT.y + 0.55, SEAT.z); this.hallFig.group.rotation.y = Math.PI; this.scene.add(this.hallFig.group);
    this.av = { pos: keep ? keep.p : (this.startPos ? V(this.startPos.x, floorH(this.startPos.x, this.startPos.z), this.startPos.z) : V(2.6, floorH(2.6, 1.2), 1.2)), rot: keep ? keep.rot : (this.startPos ? this.startPos.rot || 0 : 0.5), state: keep ? keep.st : 'idle', where: keep ? keep.where : 'home', path: [], speed: 0, phase: 0, blink: 3, hold: 0 };
    if (!keep && this.startPos && this.startPos.sit && ANCHORS[this.startPos.sit]) { const an = ANCHORS[this.startPos.sit], nd = NODES[an.node], A = this.av; A.pos.set(nd[0], floorH(nd[0], nd[1]) + seatOf(an), nd[1]); A.state = 'sit'; A.sit = true; A.an = an; A.id = this.startPos.sit; A.rot = this.startPos.rot !== undefined ? this.startPos.rot : an.face || 0; A.restoreSit = true; }
    if (keep) this.fig.setPose(keep.pose);
  }
  setLook(look) { this.look = { ...this.look, ...look }; this._avatar(); }
  headPos() { const h = this.fig.pose === 'sit' ? 2.0 : 3.7; return V(this.av.pos.x, this.av.pos.y + (this.av.where === 'home' ? this.home.group.position.y : 0) + h * (this.look.height || 1), this.av.pos.z); }

  _composer() {
    try {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, rt); this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.24, 0.6, 1.0); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    } catch (e) { this.composer = null; }
  }
  applyQuality() {
    const q = this.quality, pr = Math.min(window.devicePixelRatio || 1, q >= 2 ? 2 : q === 1 ? 1.25 : 1);
    this.renderer.setPixelRatio(pr); this.renderer.setSize(this.w, this.h, false); this.sun.castShadow = q >= 1;
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(this.w, this.h); }
  }

  // Hạt sáng: từ Bia Tích Lũy vào thân rồi thấm vào cây Bồ-đề, hoặc từ mình sang đảo bạn
  burst(color = 0xffd98a, to = null) {
    this.burstPts.material.color.set(color).multiplyScalar(2);
    const io = this.home.group.position, from = to ? this.headPos() : this.home.stele.position.clone().add(V(0, 2.4, 0)).add(io), mid = to ? from.clone().lerp(to, 0.5).add(V(0, 14, 0)) : this.headPos(), end = to || this.home.tree.group.position.clone().add(V(0, 9, 0)).add(io);
    this.burstList = []; for (let i = 0; i < 90; i++) this.burstList.push({ from, mid, to: end, t0: this.time + i * 0.018, j: V(this.rnd() - 0.5, this.rnd() - 0.5, this.rnd() - 0.5).multiplyScalar(2.4) });
  }

  // ───────── Đi lại ─────────
  _route(target) {
    const pos = this.av.pos, near = (x, z) => Object.keys(NODES).reduce((b, k) => (Math.hypot(NODES[k][0] - x, NODES[k][1] - z) < Math.hypot(NODES[b][0] - x, NODES[b][1] - z) ? k : b), 'mid');
    const a = near(pos.x, pos.z), prev = { [a]: null }, q = [a];
    while (q.length) { const k = q.shift(); if (k === target) break; EDGES.forEach(([x, y]) => { const o = x === k ? y : y === k ? x : null; if (o && !(o in prev)) { prev[o] = k; q.push(o); } }); }
    const out = []; for (let k = target; k; k = prev[k]) out.unshift(NODES[k]);
    return out;
  }
  walkTo(id, done) {
    const an = ANCHORS[id]; if (!an || this.av.where !== 'home' || this.av.state === 'travel') return false;
    this.fig.setPose('stand'); this.av.path = this._route(an.node).map(([x, z]) => V(x, 0, z)); this.av.state = 'walk'; this.av.done = done; this.av.sit = !!an.sit; this.av.id = id; this.av.an = an;
    return true;
  }
  // Chọn một khu: máy quay bám theo nhân vật suốt đường đi, tới nơi mới chuyển sang góc nhìn của khu
  goZone(id, done) {
    if (!this.walkTo(id, done)) return false;
    this.mode = 'zone'; this.setLimits();
    const A = this.av, io = this.home.group.position.y, tg = V(A.pos.x, A.pos.y + io + 2.1, A.pos.z), cur = this.camera.position.clone().sub(this.controls.target); cur.y = 0;
    if (cur.lengthSq() < 1) cur.set(0.5, 0, 1); cur.normalize().multiplyScalar(13); this.follow = { zone: id, off: V(cur.x, 6.2, cur.z) };
    this.flyTo(V(tg.x + cur.x, tg.y + 6.2, tg.z + cur.z), tg, 46, 0.9); return true;
  }
  // hướng ngồi trong Tịnh Thất: 0 cửa chính, 1 bên phải, 2 vào trong, 3 bên trái
  setFace(k) { if (this.av.state === 'sit') this.av.rotTo = -k * Math.PI / 2; }
  stopWalk() { const A = this.av; if (A.state === 'walk' && !A.id) { A.path = []; A.state = 'idle'; A.speed = 0; } }
  // nhấp đúp: phóng tới điểm đó; nhấp đúp lần nữa: trở lại góc nhìn trước
  zoomAt(nx, ny) {
    if (this.zoomed) { const z = this.zoomed; this.zoomed = null; this.flyTo(z.p, z.t, z.fov, 0.8); return false; }
    let P = this.mode === 'island' || this.mode === 'zone' ? this.pickAny(nx, ny) : null;
    if (!P) { this.ray = this.ray || new THREE.Raycaster(); this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera); const d = this.camera.position.distanceTo(this.controls.target); P = this.ray.ray.origin.clone().addScaledVector(this.ray.ray.direction, d); }
    this.zoomed = { p: this.camera.position.clone(), t: this.controls.target.clone(), fov: this.baseFov };
    const dir = this.camera.position.clone().sub(P), len = dir.length(), near = this.mode === 'island' || this.mode === 'zone' ? Math.max(7, Math.min(13, len * 0.3)) : len * 0.38; dir.normalize(); if (dir.y < 0.22) { dir.y = 0.22; dir.normalize(); }
    this.flyTo(P.clone().addScaledVector(dir, near), P, Math.min(this.baseFov, 46), 0.8); return true;
  }
  pickAny(nx, ny) { this.ray = this.ray || new THREE.Raycaster(); this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera); const hit = this.ray.intersectObject(this.home.group, true).find((h) => h.object.isMesh && !h.object.isPoints && h.object.material && !h.object.material.transparent); return hit ? hit.point : null; }
  _birds(dt) {
    if (!this.birds) { this.birds = buildBirds(6); this.scene.add(this.birds.group); const H = this.home, gy = H.group.position.y, bb = new THREE.Box3().setFromObject(H.pv.group), tb = new THREE.Box3().setFromObject(H.tree.group);
      this.perchFix = [V(HILL.x + 0.6, bb.max.y - gy - 0.05, HILL.z), V(HILL.x - 5.9, pvFloor() + 1.5, HILL.z + 4.44), V(HILL.x + 5.9, pvFloor() + 1.5, HILL.z - 4.44), V(10.5 + 0.2, groundH(10.5, 10) + 3.42, 10), V(17.13, groundH(15.5, 15.5) + 3.0, 17.13), V(-15.6, groundH(-15.6, 7) + 4.36, 7), V((tb.min.x + tb.max.x) / 2 + 1.2, tb.max.y - gy - 0.5, (tb.min.z + tb.max.z) / 2), V(STAIR.x + STAIR.hw + 0.17, pvFloor() - STAIR.rise + 0.6, STAIR.z0 + STAIR.run * 0.5), V(26.5 - 2.2, DECKS[0].base + 0.9, 3.6)]; }
    const A = this.av, gy = this.home.group.position.y, list = this.perchFix.map((p) => ({ p: V(p.x, p.y + gy, p.z) }));
    if (A.where === 'home' && (A.state === 'sit' || A.state === 'idle')) { const ax = A.pos.x, az = A.pos.z; [[1.25, 0.5], [-1.1, 0.9], [0.3, 1.5]].forEach(([dx, dz]) => { const x = ax + dx * Math.cos(A.rot) + dz * Math.sin(A.rot), z = az - dx * Math.sin(A.rot) + dz * Math.cos(A.rot); list.push({ p: V(x, floorH(x, z) + gy + 0.02, z), moved: () => this.av.state === 'walk' || this.av.state === 'travel' }); }); }
    this.birds.group.visible = this.mode === 'island' || this.mode === 'zone' || this.mode === 'creator'; this.birds.update(dt, this.time, list, this.camera, this.birds.group.visible ? this.onChirp : null);
  }
  walkToPoint(x, z) {
    if (this.av.where !== 'home' || this.av.state === 'travel' || this.mode !== 'island') return false;
    const p = this.av.pos, blocked = (px, pz) => { const a = (px - POND.x) / (POND.rx + 0.5), b = (pz - POND.z) / (POND.rz + 0.5); return a * a + b * b < 1 || (Math.abs(px - HILL.x) < 8.4 && Math.abs(pz - HILL.z) < 6.4) || this.home.frac(px, pz) > 0.88; };
    for (let i = 1; i <= 12; i++) if (blocked(p.x + ((x - p.x) * i) / 12, p.z + ((z - p.z) * i) / 12)) return false;
    this.fig.setPose('stand'); this.av.path = [V(x, 0, z)]; this.av.state = 'walk'; this.av.done = null; this.av.sit = false;
    this.ring.position.set(x, groundH(x, z) + 0.12 + this.home.group.position.y, z); this.ring.material.opacity = 0.9; return true;
  }
  pickGround(nx, ny) {
    this.ray = this.ray || new THREE.Raycaster(); this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hit = this.ray.intersectObject(this.home.land, false)[0]; return hit && hit.face.normal.y > 0.6 ? hit.point : null;
  }
  greet(i) { const f = this.friends[i]; this.av.rotTo = Math.atan2(f.pos.x - this.av.pos.x, f.pos.z - this.av.pos.z); if (this.av.state !== 'walk' && this.av.state !== 'travel') { this.fig.setPose('anjali'); this.av.hold = 2.8; this.av.state = 'idle'; } f.fig.setPose('anjali'); f.fig.eyes(false); f.until = this.time + 3; }
  rejoice(i) { const f = this.friends[i]; this.burst(0xbfeee4, f.pos.clone().add(V(0, 3, 0))); }
  visit(i, done) {
    if (this.av.state === 'travel') return; const f = this.friends[i], from = this.av.pos.clone();
    const pts = this.av.where === 'home' ? [from, V(22, groundH(17, 17) + 1, 22), ...this.bridges[i].getPoints(8)] : [from, ...this.bridges[this.av.where].getPoints(8).reverse(), V(22, groundH(17, 17) + 1, 22), P(13.5, 13.5)];
    this.av.curve = new THREE.CatmullRomCurve3(pts); this.av.k = 0; this.av.state = 'travel'; this.av.dest = i; this.av.done = done; this.fig.setPose('stand'); this.ride.visible = true; void f;
  }
  goHome(done) { if (this.av.where === 'home') return; const w = this.av.where; this.visit(w, done); this.av.dest = 'home'; }

  // ───────── Camera ─────────
  // điện thoại: bảng thu gọn mặc định; lùi xa và ngước lên để thấy cả đảo lẫn trọn Tôn tượng
  islandCam() { return this.portrait ? V(30, 56, 300) : V(28, 30, 108); }
  islandTarget() { return this.portrait ? V(6, 153, 40) : V(12, 36, 0); }
  flyTo(p, t, fov = 52, dur = 1.6) { this.tween = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), f0: this.baseFov, p, t, fov, k: this.snap ? 0.999 : 0, dur }; this.controls.enabled = false; }
  setMode(mode, opt = {}) {
    this.mode = mode;
    if (mode === 'hall') { if (this.portrait) this.flyTo(V(0, 60, -250), V(0, 148, -418), 58, 2); else this.flyTo(V(0, 20, -170), V(0, 60, -352), 58, 2); }
    else if (mode === 'overview') this.flyTo(V(180, 262, 520), V(-10, 196, -470), 58, 2.2);
    else if (mode === 'realm') this.flyTo(V(-460, 420, 900), V(40, 210, -450), 60, 3.2);
    else if (mode === 'tier') { const k = opt.tier; if (k === 4) this.flyTo(V(-188, 382, -640), V(-30, 366, -742), 52, 2.2); else { const I = this.isles.find((x) => x.tier === k), s = I.size / 14; this.flyTo(V(I.x + 20 * s * Math.sign(-I.x), I.y + 9 * s, I.z + 30 * s), V(I.x, I.y + 2.5, I.z), 44, 2.2); } }
    else if (mode === 'creator') { const a = this.av.pos.clone(); a.y += this.av.where === 'home' ? this.home.group.position.y : 0; this.flyTo(V(a.x + 2.2, a.y + 3.5, a.z + 8.2), V(a.x, a.y + 2.2, a.z), 34, 1.4); }
    else if (mode === 'zone') { const c = ANCHORS[opt.zone].cam, y = this.home.group.position.y; this.flyTo(V(c[0][0], c[0][1] + y, c[0][2]), V(c[1][0], c[1][1] + y, c[1][2]), 48, 1.5); }
    else this.flyTo(this.islandCam(), this.islandTarget(), this.portrait ? 64 : 58, 1.8);
  }
  setLimits() {
    const m = this.mode, c = this.controls;
    if (m === 'hall' && this.wide) Object.assign(c, { minDistance: 40, maxDistance: 700, minPolarAngle: 1.0, maxPolarAngle: 2.0 });
    else if (m === 'hall') Object.assign(c, { minDistance: 40, maxDistance: 190, minPolarAngle: 1.25, maxPolarAngle: 2.1 });
    else if (m === 'creator') Object.assign(c, { minDistance: 5, maxDistance: 18, minPolarAngle: 0.9, maxPolarAngle: 1.75 });
    else if (m === 'realm') Object.assign(c, { minDistance: 60, maxDistance: 1900, minPolarAngle: 0.4, maxPolarAngle: 1.75 });
    else if (m === 'overview' || m === 'tier') Object.assign(c, { minDistance: 30, maxDistance: 900, minPolarAngle: 0.5, maxPolarAngle: 1.75 });
    else if (m === 'island') Object.assign(c, { minDistance: 14, maxDistance: 380, minPolarAngle: 0.5, maxPolarAngle: this.portrait ? 1.95 : 1.64 });
    else Object.assign(c, { minDistance: 14, maxDistance: 260, minPolarAngle: 0.5, maxPolarAngle: 1.54 });
  }
  applyFov() { const b = (this.baseFov * Math.PI) / 360, k = this.portrait ? 1.5 : 1; this.camera.fov = (Math.atan(Math.tan(b) * k) * 360) / Math.PI; this.camera.updateProjectionMatrix(); }
  project(v) { const p = v.clone().project(this.camera); return { x: (p.x * 0.5 + 0.5) * this.w, y: (-p.y * 0.5 + 0.5) * this.h, vis: p.z < 1 && p.z > -1 }; }
  resize() {
    const c = this.renderer.domElement, w = (this.w = c.clientWidth || window.innerWidth), h = (this.h = c.clientHeight || window.innerHeight);
    this.camera.aspect = w / h; this.portrait = w / h < 0.8;
    if (this.portrait) this.camera.setViewOffset(w, h * 1.45, 0, h * 0.45, w, h); else this.camera.clearViewOffset();
    this.applyQuality(); this.applyFov();
  }

  update(dt, s) {
    const u = this.u, v = s.vis, isl = s.isl, H = this.home; this.time += dt; u.uTime.value = this.time; islandUniforms.uTime.value = this.time;
    if (!this.fixedQ) { this.acc += dt; if (++this.accN >= 80) { const avg = this.acc / this.accN; this.acc = 0; this.accN = 0; if (avg > 0.036 && this.quality > 0 && this.time > 4) { this.quality--; this.applyQuality(); } } }
    if (this.tween) { const tw = this.tween; tw.k = Math.min(1, tw.k + dt / tw.dur); const e = ease(tw.k);
      this.camera.position.lerpVectors(tw.p0, tw.p, e); this.controls.target.lerpVectors(tw.t0, tw.t, e); this.baseFov = tw.f0 + (tw.fov - tw.f0) * e; this.applyFov();
      if (tw.k >= 1) { this.tween = null; this.controls.enabled = true; this.setLimits(); } }
    this._avatarStep(dt, s); this.realm.update(this.time, v.night);
    // Thuyết giảng: Tôn tượng mở mắt, cử động miệng, giơ ấn thuyết pháp; hội chúng chắp tay và đảnh lễ
    { const sm = s.sermon || { on: false, speak: 0, bow: 0, anjali: false };
      if (sm.on && !this.budFrames) this.budFrames = [this.budFig.material.map, buddhaTex({ open: true, hand: true }), buddhaTex({ open: true, hand: true, mouth: 0.5 }), buddhaTex({ open: true, hand: true, mouth: 1 })];
      if (this.budFrames) { const f = sm.on ? 1 + (sm.speak > 0.62 ? 2 : sm.speak > 0.22 ? 1 : 0) : 0; if (this.budFig.material.map !== this.budFrames[f]) this.budFig.material.map = this.budFrames[f]; }
      this.sBow = (this.sBow || 0) + ((sm.bow || 0) - (this.sBow || 0)) * Math.min(1, dt * 7);
      [this.hallCrowd, this.tierCrowd].forEach((c) => { if (c && c.userData.bow) { c.userData.bow.value = this.sBow; c.userData.setAnjali(!!sm.anjali); } }); }
    if (this.tween || !this.controls.enabled) this.camera.lookAt(this.controls.target); else this.controls.update();
    const cam = this.camera.position; u.uCam.value.copy(cam); this.sky.position.copy(cam); this.stars.position.copy(cam);
    u.uBud.value.set(BUD.x - cam.x, BUD_EYE - cam.y, BUD.z - cam.z).normalize();
    this.budFig.lookAt(cam.x, BL + 148 * BS, cam.z); const nb = 1 + 0.12 * v.night; this.budFig.material.color.setRGB(0.96 * nb, 0.88 * nb, 0.74 * nb);
    u.uNight.value = v.night; u.uAmber.value = v.amber; u.uJade.value = v.jade; u.uCalm.value = v.calm;
    let pulse = 0; s.waves.forEach((age, i) => { const m = this.waves[i]; if (!m) return; const k = age / 14; m.visible = k < 1; m.scale.setScalar(40 + age * 58); m.material.opacity = (1 - k) * 0.6; pulse = Math.max(pulse, Math.exp(-age / 2.5)); });
    for (let i = s.waves.length; i < this.waves.length; i++) this.waves[i].visible = false;
    { const dB = Math.hypot(cam.x - BUD.x, cam.y - BUD_EYE, cam.z - BUD.z), near = Math.min(1, Math.max(0, (dB - 160) / 420)); this.haloK = (this.haloK ?? 1) + ((0.32 + 0.68 * near) - (this.haloK ?? 1)) * Math.min(1, 0.05 * 60 * 0.016 * 4); u.uHalo.value = (1 + 0.5 * pulse + 0.35 * v.merit) * this.haloK; } u.uRainbow.value = v.rainbow; u.uHaloWhite.value = v.haloWhite;
    u.uTier2.value = isl.tier >= 2 ? 1 : isl.sky || 0;
    u.uB.value = 0.1 * v.breath * s.breath; this.seatMat.emissiveIntensity = 0.6 * v.jade * s.breath + 0.25 * v.amber; this.seatMat.emissive.set(v.amber > 0.5 ? '#ffcf8a' : '#bfeee4');
    this.pillarMat.opacity = 0.16 * v.amber; this.filaMat.opacity = 0.5 * v.fila * (0.75 + 0.25 * Math.sin(this.time * 0.8)); this.filaMat.color.setHSL((this.time * 0.02) % 1, 0.55, 0.78).multiplyScalar(1.5);
    this.beamMat.opacity = 0.09 * v.beams; this.stars.material.opacity = v.night * 0.9; u.uP.value = v.merit;
    this.scene.fog.color.copy(DAY).lerp(NIGHT, v.night * 0.9);
    const dim = 1 - 0.6 * v.night; this.hemi.intensity = 0.55 * dim; this.sun.intensity = 2.6 * dim; this.fill.intensity = 0.7 * dim; this.scene.environmentIntensity = 0.85 * dim;
    this.hallFig.group.scale.y = this.hallFig.group.scale.x * (1 + 0.012 * s.breath);

    // Vân Đảo theo tiến trình và tầng
    const t4 = isl.tier >= 4 ? 1 : 0, kk = Math.min(1, dt * 2);
    u.uMist.value += ((t4 ? 1 : isl.mist) - u.uMist.value) * kk;
    H.group.position.y += ((t4 ? -7 : 0) - H.group.position.y) * Math.min(1, dt * 1.5);
    const bs = 0.26 + 0.74 * isl.bodhi, tg = H.tree.group; tg.scale.setScalar(tg.scale.x + (bs - tg.scale.x) * kk); H.tree.leaves.count = Math.max(30, Math.floor(H.tree.count * Math.min(1, 0.12 + isl.bodhi)));
    H.glints.material.opacity = (isl.tier >= 2 ? 1 : 0.6 * isl.gold) * (0.6 + 0.4 * Math.sin(this.time * 2));
    H.lotus.forEach((l, i) => { l.g.visible = i < isl.lotus; l.fl.material = i < isl.goldCount ? l.goldM : l.pinkM; });
    H.water.uniforms.uClar.value = isl.clarity; H.water.uniforms.uWater.value = isl.water; H.water.uniforms.uNight.value = v.night; H.evolve(isl.lv === undefined ? 1 : isl.lv, isl, this.time); H.brook.material.uniforms.uNight.value = v.night; this._birds(dt);
    H.tea.visible = isl.tea; DECKS[1].on = !!isl.tea; if (H.pglints) { H.pglints.material.uniforms.uOn.value = isl.water * (1 - 0.3 * v.night); H.pglints.visible = isl.water > 0.3; } H.veil.scale.setScalar(Math.max(0.001, 1 - isl.gate * (isl.open ? 1 : 0.35)));
    H.streamMat.opacity = isl.stream ? 0.5 + 0.2 * Math.sin(this.time * 1.4) : 0;
    const lux = isl.tier >= 3, pm = H.pv.mats;
    pm.roof.color.set(lux ? '#e4eef8' : '#55606b'); pm.roof.emissive.set(lux ? '#9fc7ea' : '#000000'); pm.roof.emissiveIntensity = lux ? 1.1 : 0;
    pm.wood.color.set(lux ? '#f2f6fb' : '#7a3b28'); pm.wood.emissive.set(lux ? '#bcd9f2' : '#000000'); pm.wood.emissiveIntensity = lux ? 0.9 : 0;
    this.homeLbMat.opacity = lux ? 0.5 + 0.2 * Math.sin(this.time) : 0; this.lbMat.opacity = 0.45 + 0.15 * Math.sin(this.time * 0.7);
    H.steleMat.opacity = 0.7 + 0.3 * Math.sin(this.time * 1.5); H.pv.altar.material.emissiveIntensity = 1.6 + 0.5 * Math.sin(this.time * 1.1);
    this.ring.material.opacity = Math.max(0, this.ring.material.opacity - dt * 0.7); this.ring.scale.setScalar(1 + (0.9 - this.ring.material.opacity) * 1.2);
    this.friends.forEach((f) => { if (f.until && this.time > f.until) { f.until = 0; f.fig.setPose('sit'); } f.fig.group.scale.y = f.fig.group.scale.x * (1 + 0.012 * s.breath); });

    if (this.burstList.length) { let alive = false;
      this.burstList.forEach((b, i) => { const k = (this.time - b.t0) / 2.6; let p = null;
        if (k >= 0 && k <= 1) { const a = k < 0.5 ? b.from : b.mid, c = k < 0.5 ? b.mid : b.to, q = (k < 0.5 ? k : k - 0.5) * 2, e = ease(q); p = a.clone().lerp(c, e).addScaledVector(b.j, Math.sin(q * Math.PI)); p.y += Math.sin(q * Math.PI) * 2.5; }
        if (k <= 1) alive = true; this.burstPos.set(p ? [p.x, p.y, p.z] : [0, -9999, 0], i * 3); });
      this.burstPts.geometry.attributes.position.needsUpdate = true; if (!alive) this.burstList = []; }
    if (this.quality >= 1 && this.composer) { this.bloom.strength = 0.24 + 0.22 * v.night; this.composer.render(dt); } else this.renderer.render(this.scene, this.camera);
  }

  _avatarStep(dt, s) {
    const A = this.av, g = this.fig.group, io = this.home.group.position.y;
    const turn = (to, rate = 6) => { let d = to - A.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); A.rot += d * Math.min(1, dt * rate); };
    if (A.state === 'walk') {
      const to = A.path[0], d = V(to.x - A.pos.x, 0, to.z - A.pos.z), L = d.length(), last = A.path.length === 1;
      A.speed += ((last && L < 2.2 ? 1.2 : 3.3) - A.speed) * Math.min(1, dt * 4); const step = A.speed * dt;
      if (L <= step + 0.05) { A.path.shift();
        if (!A.path.length) { A.state = 'idle'; A.speed = 0;
          if (A.sit) { A.state = 'sit'; this.fig.setPose('sit'); A.pos.y = floorH(A.pos.x, A.pos.z) + seatOf(A.an); A.rotTo = A.an && A.an.face !== undefined ? A.an.face : Math.PI; }
          else if (A.an && A.an.face !== undefined && A.id) A.rotTo = A.an.face;
          if (this.follow) { const f2 = this.follow; this.follow = null; if (f2.zone && ANCHORS[f2.zone]) { const c = ANCHORS[f2.zone].cam; this.flyTo(V(c[0][0], c[0][1] + io, c[0][2]), V(c[1][0], c[1][1] + io, c[1][2]), 48, 1.6); } }
          if (A.done) { const f = A.done; A.done = null; f(A.id); } } }
      else { d.normalize(); A.pos.x += d.x * step; A.pos.z += d.z * step; A.phase += dt * A.speed * 1.5; turn(Math.atan2(d.x, d.z)); }
      if (A.state !== 'sit') { const fy = floorH(A.pos.x, A.pos.z); A.pos.y += (fy - A.pos.y) * Math.min(1, dt * 14); }
      if (this.follow && A.state === 'walk' && !this.tween) { const tg = V(A.pos.x, A.pos.y + io + 2.1, A.pos.z), off = this.follow.off, k1 = 1 - Math.exp(-dt * 5), k2 = 1 - Math.exp(-dt * 2.6);
        this.controls.target.lerp(tg, k1); this.camera.position.lerp(V(tg.x + off.x, tg.y + off.y, tg.z + off.z), k2); }
    } else if (A.state === 'travel') {
      A.k = Math.min(1, A.k + dt / 6.5); const e = ease(A.k), p = A.curve.getPoint(e), tan = A.curve.getTangent(Math.min(0.999, e));
      A.pos.copy(p); turn(Math.atan2(tan.x, tan.z), 4); this.ride.position.set(p.x, p.y - 0.35 + (A.where === 'home' ? io : 0), p.z);
      if (this.mode === 'island' && !this.tween) { const delta = p.clone().add(V(0, 3, 0)).sub(this.controls.target).multiplyScalar(Math.min(1, dt * 2)); this.controls.target.add(delta); this.camera.position.add(delta); }
      if (A.k >= 1) { A.state = 'idle'; this.ride.visible = false; A.where = A.dest;
        if (A.dest === 'home') { A.pos.copy(P(13.5, 13.5)); } else { const f = this.friends[A.dest]; A.pos.copy(f.arrive); A.rotTo = Math.atan2(f.pos.x - A.pos.x, f.pos.z - A.pos.z); }
        if (A.done) { const f = A.done; A.done = null; f(A.dest); } }
    } else {
      if (A.restoreSit) { A.restoreSit = false; this.fig.setPose('sit'); }
      if (A.state === 'sit' && A.an && A.where === 'home') A.pos.y = floorH(A.pos.x, A.pos.z) + seatOf(A.an);
      if (A.rotTo !== undefined) { turn(A.rotTo, 5); if (Math.abs(Math.atan2(Math.sin(A.rotTo - A.rot), Math.cos(A.rotTo - A.rot))) < 0.01) A.rotTo = undefined; }
      if (A.hold > 0) { A.hold -= dt; if (A.hold <= 0 && this.fig.pose === 'anjali' && this.mode !== 'creator') this.fig.setPose('stand'); }
      if (this.fig.pose !== 'sit') { A.blink -= dt; if (A.blink < 0) { this.fig.eyes(A.blink > -0.13); if (A.blink < -0.13) { this.fig.eyes(false); A.blink = 2.5 + this.rnd() * 3.5; } } }
    }
    const base = this.look.height ? 1.9 * this.look.height : 1.9, bob = A.state === 'walk' ? 0.045 * Math.abs(Math.sin(A.phase)) : 0;
    g.position.set(A.pos.x, A.pos.y + bob + (A.where === 'home' ? io : 0), A.pos.z); g.rotation.y = A.rot; g.rotation.z = A.state === 'walk' ? 0.018 * Math.sin(A.phase) : 0;
    g.scale.set(base, base * (1 + 0.012 * s.breath * (this.fig.pose === 'sit' ? 1 : 0.5)), base);
    if (this.mode === 'creator' && !this.tween) { const t = V(A.pos.x, g.position.y + (this.fig.pose === 'sit' ? 1.4 : 2.5), A.pos.z); this.controls.target.lerp(t, Math.min(1, dt * 4)); }
  }
}

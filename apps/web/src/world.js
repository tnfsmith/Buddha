import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildRealm } from './realm.js';
import { BIO } from './audio.js';
import { buildBirds } from './birds.js';
import { NOISE, OUT, rng, puffAtlas, buildBuddha, buddhaFace, lodPair, UNI, moodMix, gfxBackend, tierOf, governor, hue } from './gfx.js';
import { buildHome, buildNeighbor, bakeLocal, groundH, floorH, pvFloor, DECKS, STAIR, SX, SZ, HILL, POND } from './island.js';
import { buildFigure, buildPet, makeCrowd, defaultLook, suggestNames } from './people.js';

export { groundH };
const BUD = new THREE.Vector3(0, 0, -760), SEAT = new THREE.Vector3(0, 3, -256);
// Tôn tượng phóng 1,5 lần và ngự trên đài mây cao BL: vai ≈ 305, mắt ≈ 370, đỉnh đầu ≈ 460 — luôn cao hơn mọi tầng
export const BS = 1.5, BL = 75, BUD_EYE = BL + 196 * BS, BUD_SHOULDER = BL + 153 * BS;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// Bloom lọc kép (dual filter kiểu Kawase): tầng đầu lọc sáng (chỉ phần vượt ~1 trong HDR: hào quang, lõi đèn, hạt công đức, viền
// mây ngược nắng), thu nhỏ dần qua n tầng (5 điểm lấy mẫu), phóng to dần cộng ngược lên (8 điểm), cuối cùng cộng vào ảnh HDR với
// cường độ k. 2n lượt vẽ nhỏ, gọn hơn UnrealBloomPass (bỏ khỏi gói, ~8 KB).
// Máy quay quỹ đạo (thay OrbitControls, gọn hơn ~17 KB, chỉ những gì cảnh dùng): kéo một ngón hoặc chuột trái để xoay quanh tâm,
// cuộn chuột hoặc chụm hai ngón để tiến lùi; quán tính theo dampingFactor như OrbitControls; giới hạn khoảng cách và góc ngẩng;
// phát 'start'/'end' khi bắt đầu/thôi chạm. Chạm nhẹ để đi (main.js) vẫn nhận click như trước.
class Orbit extends THREE.EventDispatcher {
  constructor(cam, el) {
    super(); Object.assign(this, { object: cam, target: new THREE.Vector3(), enabled: true, enableDamping: true, dampingFactor: 0.05, rotateSpeed: 1, zoomSpeed: 1, minDistance: 0, maxDistance: Infinity, minPolarAngle: 0, maxPolarAngle: Math.PI });
    const P = new Map(), d = (this.d = { th: 0, ph: 0, k: 1 }); let pin = 0; this.s = new THREE.Spherical(); this.o = new THREE.Vector3(); el.style.touchAction = 'none';
    const gap = () => { const [a, b] = [...P.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }, ev = (type) => this.dispatchEvent({ type });
    el.addEventListener('pointerdown', (e) => { if (!this.enabled || (e.pointerType === 'mouse' && e.button)) return; if (!P.size) { try { el.setPointerCapture(e.pointerId); } catch (x) { void x; } ev('start'); } P.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (P.size === 2) pin = gap(); });
    el.addEventListener('pointermove', (e) => { const q = P.get(e.pointerId); if (!q || !this.enabled) return; const h = (2 * Math.PI * this.rotateSpeed) / (el.clientHeight || 1);
      if (P.size === 1) { d.th -= (e.clientX - q.x) * h; d.ph -= (e.clientY - q.y) * h; } q.x = e.clientX; q.y = e.clientY;
      if (P.size === 2) { const n = gap(); if (pin > 0 && n > 0) d.k *= pin / n; pin = n; } });
    const up = (e) => { if (!P.delete(e.pointerId)) return; pin = 0; if (!P.size) ev('end'); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { if (!this.enabled) return; e.preventDefault(); ev('start'); d.k *= Math.pow(0.95, (this.zoomSpeed * Math.abs(e.deltaY * 0.01)) * (e.deltaY < 0 ? 1 : -1)); ev('end'); }, { passive: false });
  }
  update() {
    const c = this.object, t = this.target, s = this.s, d = this.d, f = this.enableDamping ? this.dampingFactor : 1;
    s.setFromVector3(this.o.copy(c.position).sub(t)); s.theta += d.th * f; s.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, s.phi + d.ph * f)); s.makeSafe();
    s.radius = Math.max(this.minDistance, Math.min(this.maxDistance, s.radius * d.k)); c.position.copy(t).add(this.o.setFromSpherical(s)); c.lookAt(t);
    d.th *= 1 - f; d.ph *= 1 - f; d.k = 1; return true;
  }
}
function bloomFx(n) {
  const q = new FullScreenQuad(), M = (f, add) => new THREE.ShaderMaterial({ uniforms: { t: { value: null }, h: { value: new THREE.Vector2() }, k: { value: 1 } }, depthTest: false, depthWrite: false, transparent: add, blending: add ? THREE.AdditiveBlending : THREE.NoBlending,
    vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}', fragmentShader: 'uniform sampler2D t;uniform vec2 h;uniform float k;varying vec2 v;vec3 s(vec2 o){return texture2D(t,v+o*h).rgb;}void main(){' + f + '}' });
  const D = M('vec3 c=(s(vec2(0.))*4.+s(vec2(-1.))+s(vec2(1.))+s(vec2(1.,-1.))+s(vec2(-1.,1.)))/8.;if(k>.5)c*=smoothstep(1.02,1.42,dot(c,vec3(.2126,.7152,.0722)));gl_FragColor=vec4(c,1.);', false),
    U = M('gl_FragColor=vec4(k*(s(vec2(-2.,0.))+s(vec2(2.,0.))+s(vec2(0.,-2.))+s(vec2(0.,2.))+2.*(s(vec2(-1.))+s(vec2(1.))+s(vec2(1.,-1.))+s(vec2(-1.,1.))))/12.,1.);', true),
    mips = Array.from({ length: n }, () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
  const pass = (m, src, dst, k) => { m.uniforms.t.value = src.texture; m.uniforms.h.value.set(0.5 / src.width, 0.5 / src.height); m.uniforms.k.value = k; q.material = m; r0.setRenderTarget(dst); q.render(r0); };
  let r0;
  return { k: 0.3, mips,
    setSize(w, h) { mips.forEach((m) => { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); m.setSize(w, h); }); },
    render(r, src) { const ac = r.autoClear; r0 = r; r.autoClear = false;   // cộng dồn lên đích có sẵn: không được xóa
      mips.forEach((m, i) => pass(D, i ? mips[i - 1] : src, m, i ? 0 : 1)); for (let i = n - 1; i > 0; i--) pass(U, mips[i], mips[i - 1], 1); pass(U, mips[0], src, this.k); r.autoClear = ac; } };
}
const faceBud = (x, z) => Math.atan2(BUD.x - x, BUD.z - z);
const ease = (k) => k * k * (3 - 2 * k);
// Đường cong cubic-bezier(x1, y1, x2, y2) như CSS: giải t theo x bằng Newton rồi lấy y
const bezier = (x1, y1, x2, y2) => (x) => { let t = x; for (let i = 0; i < 6; i++) { const u = 1 - t; t -= (3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t - x) / (3 * u * u * x1 + 6 * u * t * (x2 - x1) + 3 * t * t * (1 - x2) || 1e-6); } const u = 1 - t; return 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t; };
const GLIDE = bezier(0.2, 0.7, 0.2, 1);
const ADD = (color, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, ...o });
const RGB = (r, g, b) => new THREE.Color(r, g, b);
const FRIEND_DAY = [6, 24, 44];   // ngày trong hành trình 49 ngày của ba bạn đồng tu: đảo của mỗi bạn lớn dần theo đó (#95)

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

const seatOf = (an) => (an && an.deck !== undefined ? DECKS[an.deck].seat || 0.02 : (an && an.seatH) || 0.02);
// ───────── Chọn mức chất lượng ban đầu theo thiết bị (để máy yếu khỏi giật vài giây trước khi tự hạ) ─────────
const GFX_KEY = 'vandao.gfx', GFX_TTL = 14 * 24 * 3600 * 1000;
export const isMobile = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
function saveGfx(q) { try { localStorage.setItem(GFX_KEY, JSON.stringify({ q, at: Date.now() })); } catch (e) { void e; } }
/**
 * Mức 0 cho trình vẽ phần mềm (SwiftShader, llvmpipe) và điện thoại yếu (≤ 4 GB RAM hoặc ≤ 4 lõi hoặc màn nhỏ);
 * mức 1 cho điện thoại/máy tính bảng còn lại và máy tính yếu; mức 2 cho máy tính. Lần trước đã phải tự hạ mức
 * (lưu ở localStorage 'vandao.gfx', hết hạn sau 14 ngày để thử lại) thì bắt đầu luôn ở mức đó.
 */
// Trình vẽ phần mềm (SwiftShader, llvmpipe…): mọi điểm ảnh do CPU tô, nên chỉ làm phần bắt buộc
const isSoft = (renderer) => { let gpu = ''; try { const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'); gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || ''); } catch (e) { void e; } return /swiftshader|llvmpipe|software|microsoft basic render/i.test(gpu); };
export function pickQuality(renderer, nav = navigator, mobile = isMobile()) {
  const mem = nav.deviceMemory || 8, cores = nav.hardwareConcurrency || 8, small = Math.min(screen.width || 0, screen.height || 0) <= 400;
  let q = isSoft(renderer) ? 0 : mobile ? (mem <= 4 || cores <= 4 || small ? 0 : 1) : mem <= 4 && cores <= 4 ? 1 : 2;
  try { const g = JSON.parse(localStorage.getItem(GFX_KEY) || 'null'); if (g && Date.now() - g.at < GFX_TTL && g.q < q) q = g.q; } catch (e) { void e; }
  return q;
}

export class World {
  static V3 = THREE.Vector3;
  static NODES = NODES;
  static floorH = floorH;
  static pickQuality = pickQuality;
  constructor(canvas, look, quality, startPos) {
    this.startPos = startPos && isFinite(startPos.x) && isFinite(startPos.z) ? startPos : null;
    this.gfx = gfxBackend();   // { ask, gpu, use }: cờ ?r=webgpu đã ghi nhận; trình vẽ đang dùng vẫn là WebGL2 (xem gfx.js)
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    // ACES Filmic: mây trắng và hào quang vàng nén dần về vùng sáng thay vì cháy trắng; độ phơi sáng đi theo tâm trạng (gfx.MOOD)
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
    // Bóng đổ chỉ phủ Vân Đảo: tự quyết khi nào vẽ lại (update), ở xa đảo thì giữ bản đồ bóng cũ
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; r.shadowMap.autoUpdate = false;
    r.info.autoReset = false; this.pf = { t0: 0, n: 0, calls: 0, tris: 0, last: null };   // số liệu hiệu năng gộp mọi lượt vẽ của một khung hình (kể cả bloom)
    this.scene = new THREE.Scene(); this.scene.fog = new THREE.Fog(0xffffff, 260, 2000);
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.5, 7000);
    this.controls = new Orbit(this.camera, canvas);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, rotateSpeed: 0.45, zoomSpeed: 0.7 });
    this.controls.target.set(12, 36, 0);
    this.touch = 0; this.controls.addEventListener('start', () => { this.touch = 1e18; }); this.controls.addEventListener('end', () => { this.touch = performance.now(); });
    this.mode = 'island'; this.time = 0; this.tween = null; this.rnd = rng(7); this.baseFov = 58;
    // Mức chất lượng: cố định khi URL có ?q / #q=, không thì chọn theo thiết bị ngay từ đầu (pickQuality) rồi tự hạ khi chậm
    this.fixedQ = quality !== undefined; this.mobile = isMobile(); this.soft = isSoft(r); this.quality = quality !== undefined ? quality : pickQuality(r); this.res = 1; this.hold = null;
    this.gov = governor(); this.acc = 0; this.drawn = 0;
    this.u = { ...UNI, uAmber: { value: 0 }, uJade: { value: 0 }, uCalm: { value: 0 }, uCam: { value: V(0, 0, 0) }, uMist: { value: 0.7 },
      uHalo: { value: 1 }, uRainbow: { value: 0.5 }, uHaloWhite: { value: 0 }, uTier2: { value: 0 }, uBud: { value: V(0, 0.2, -1).normalize() }, uB: { value: 0 }, uP: { value: 0 }, uRay: { value: 0 }, uVeil: { value: 0 } };
    this.moodW = [0, 1, 0, 0]; moodMix(this.moodW);
    this._lights(); this._sky(); this._clouds(); this._buddha();
    this.home = buildHome(); this.scene.add(this.home.group);
    this._tiers(); this._hall(); this.realm = buildRealm(91); this.scene.add(this.realm.group); this._puffs(); this._fx();
    this.look = { ...defaultLook(), ...look }; this._avatar();
    this._composer(); this.setLimits(); this.resize();
    this.camera.position.copy(this.islandCam()); this.controls.target.copy(this.islandTarget());
    // §12.3 mục 4: biên dịch trước mọi shader (kể cả vật đang ẩn); bản cho mức thấp hơn biên dịch sau khi cảnh đã chạy
    this.warmed = this._warm();
    if (!this.fixedQ && this.quality > 0) this.warmLater = setTimeout(() => { const go = () => this._warm(this.quality - 1); if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 4000 }); else go(); }, 8000);
    // §12.3 mục 6: tab ẩn thì không vẽ; quay lại thì bỏ mẫu đo khung hình cũ để không hạ chất lượng nhầm
    document.addEventListener('visibilitychange', () => this.gov.reset(performance.now()));
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0xfff1d6, 0x9aa6c4, 0.55); this.scene.add(this.hemi);
    const s = (this.sun = new THREE.DirectionalLight(0xffe3b4, 2.6)); s.position.set(-60, 120, -190); s.target.position.set(0, 12, 0); this.scene.add(s, s.target);
    s.castShadow = true; s.shadow.mapSize.set(2048, 2048); Object.assign(s.shadow.camera, { left: -58, right: 58, top: 50, bottom: -50, near: 40, far: 420 }); s.shadow.bias = -0.0004; s.shadow.normalBias = 0.7;
    this.fill = new THREE.DirectionalLight(0xdfe8ff, 0.7); this.fill.position.set(60, 90, 140); this.scene.add(this.fill);
  }

  // Vòm trời: tán xạ gần đúng Rayleigh (thiên đỉnh thẫm, chân trời sáng dần theo khối lượng không khí) và Mie (quầng ấm quanh
  // mặt trời/mặt trăng, đậm hơn ở chân trời), đĩa sáng mềm, mây ti, sao đêm sinh trong shader. Màu lấy từ tâm trạng (UNI).
  // Trời và biển mây vẽ sau cùng trong nhóm vật đục (renderOrder 9–10) để phần bị đảo che khỏi phải chạy shader.
  _sky() {
    const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.u,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform float uNight,uTier2,uTime; uniform vec3 uBud,uSun,uZen,uHz,uSunC,uCl; varying vec3 vDir; ${NOISE}
void main(){ vec3 d = normalize(vDir); float h = max(d.y,0.), mu = max(dot(d,uSun),0.), g = max(dot(d,uBud),0.), od = 1./(h*5.+.22);
 vec3 col = mix(uZen, uHz, 1.-exp(-od*.5));
 col = mix(col, uSunC*.94, min(pow(mu,4.)*(.2+.5*(1.-exp(-od*.35))) + pow(g,3.)*(.72-.5*uNight), 1.));
 col += uSunC*(pow(mu,120.)*.45 + smoothstep(.9994,.9998,mu)*(.4+1.6*uNight));
 vec2 cp = d.xz/(d.y+.22)*1.4 + vec2(uTime*.004,0.); float ci = smoothstep(.5,.86,fbm(cp*vec2(1.,2.6)))*smoothstep(.05,.35,h);
 col = mix(col, mix(uCl, uSunC, pow(mu,2.)*.6), ci*.45);
 col = mix(col, col*vec3(.8,1.,.97)+vec3(.07,.05,0.), uTier2*.5);
 vec3 sp = d*240., id = floor(sp); float st = hash(id.xy + id.z*7.3);
 col += vec3(.85,.92,1.)*step(.997,st)*smoothstep(.5,.1,length(fract(sp)-.5))*(.6+.4*sin(uTime*(1.+st*4.)+st*90.))*uNight*smoothstep(.03,.3,h)*1.6;
 float a = 1.; ${OUT} }` });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), mat); this.sky.renderOrder = 10; this.sky.frustumCulled = false; this.scene.add(this.sky);
    // Ánh sáng môi trường (IBL) lấy từ chính bầu trời đang hiện: PMREM dựng lại khi tâm trạng đổi đủ nhiều (_env)
    this.es = new THREE.Scene(); this.es.add(new THREE.Mesh(new THREE.SphereGeometry(100, 24, 12), mat));
    this.scene.environmentIntensity = 0.85; this._env(); this.envAt = -1e9;   // lần dựng lại đầu tiên (đúng tâm trạng lúc mở cảnh) không phải chờ
  }
  _env() {
    try { this.pm = this.pm || new THREE.PMREMGenerator(this.renderer); const old = this.envRT; this.envRT = this.pm.fromScene(this.es, 0, 1, 500); this.scene.environment = this.envRT.texture; if (old) old.dispose(); }
    catch (e) { this.pm = 0; }
    this.envW = this.moodW.slice(); this.envAt = performance.now(); this.renderer.setRenderTarget(null);
  }

  // Biển mây: một mặt phẳng đục duy nhất. Vẻ có khối nhờ dời điểm lấy mẫu theo tia nhìn (parallax), viền bạc khi nhìn ngược nắng,
  // ánh sáng thấm qua chỗ mây mỏng (xấp xỉ tán xạ dưới bề mặt); xa dần thì tan vào màu chân trời. Chân đảo nối vào mây bằng sương độ cao (gfx.js).
  _clouds() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(11000, 11000), new THREE.ShaderMaterial({ fog: false, uniforms: this.u,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float uTime,uJade,uCalm;uniform vec3 uCam,uSun,uCl,uSh,uHz,uSunC;varying vec3 vW;${NOISE}
float hgt(vec2 p){p+=.3*sin(p.yx*1.9+1.3);float s=0.,k=.5;vec2 q=p*1.3;
for(int i=0;i<4;i++){s+=k*abs(noise(q)*2.-1.);q=q*2.05+17.;k*=.5;}
return s*.62+noise(p*.33+7.)*.5-.1;}
void main(){vec3 v=vW-uCam;float ds=length(v.xz);v=normalize(v);
vec2 p=vW.xz*.0055+vec2(uTime*.012*(1.-.75*uCalm),uTime*.0045);
p+=v.xz/max(-v.y,.16)*(hgt(p)-.5)*.07;
float n=hgt(p),lit=clamp(.55+(n-hgt(p+uSun.xz*.08))*5.,0.,1.),mu=max(dot(v,uSun),0.),thin=1.-smoothstep(.3,.7,n),ao=smoothstep(.12,.7,n);
float shade=smoothstep(1.3,.85,length((vW.xz+uSun.xz/max(uSun.y,.2)*18.)/vec2(34.,24.)));
vec3 col=mix(uSh*.8,mix(uCl,uCl*uSunC*1.2,.3),clamp(lit*.7+ao*.45-.12,0.,1.)*(1.-.45*shade));
col*=.8+.2*ao;
col=mix(col,col*uSunC*1.15,(1.-lit)*thin*.4);
col+=uSunC*pow(mu,5.)*(.1+.45*thin);
col=mix(col,vec3(.78,.97,.93),uJade*.2);
col=mix(col*1.08,uHz,1.-exp(-ds*ds*1.4e-6));float a=1.;${OUT}}` }));
    m.rotation.x = -Math.PI / 2; m.position.y = -6; m.renderOrder = 9; m.frustumCulled = false; this.scene.add(m);
  }

  _buddha() {
    const g = (this.budGroup = new THREE.Group()); g.position.set(BUD.x, BL, BUD.z); g.scale.setScalar(BS); this.scene.add(g);
    // Tôn tượng tạc khối bằng vàng (gfx.buildBuddha): quay mặt về Đại Thiền Đường và Vân Đảo; nhìn từ các tầng hai bên thấy dáng nghiêng,
    // từ cụm Vân Tọa sau lưng thấy lưng và nhục kế. Tay phải giơ ấn thuyết pháp bằng phép xoay trên GPU (budArm), không dựng lại hình.
    const B = buildBuddha(this.soft); this.budFig = B.mesh; this.budArm = B.arm; this.budK = 0; g.add(this.budFig);
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
    halo.position.set(0, 199, -40); halo.scale.setScalar(0.8); halo.renderOrder = -1; g.add(halo); this.halo = halo;
    // Quanh Tôn tượng: mưa hoa (cánh hoa hồng nhạt xoay nhẹ, rơi chậm trước tượng; dày lên khi thuyết giảng) và hạt sáng vàng bay lên
    // quanh thân tượng. Một hệ Points cộng sáng trên GPU (hoa luôn là đốm sáng, kể cả trước hào quang), cỡ hạt theo đơn vị thế giới (uPx);
    // không chạm tới khuôn mặt tranh vẽ.
    { const n = 300, p = new Float32Array(n * 3), sd = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const pet = i < 180, a = this.rnd() * 6.28, rr = pet ? 90 + this.rnd() * 290 : 60 + this.rnd() * 170;
        p.set([BUD.x + Math.cos(a) * rr, 0, BUD.z + 70 + Math.sin(a) * rr * 0.55], i * 3); sd.set([this.rnd(), pet ? 0 : 1, this.rnd()], i * 3); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(p, 3)); pg.setAttribute('aS', new THREE.BufferAttribute(sd, 3));
      this.budFx = new THREE.Points(pg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, uniforms: { ...this.u, uRain: { value: 0.45 } },
        vertexShader: `attribute vec3 aS;uniform float uTime,uPx,uRain;varying float vA,vK,vR;
void main(){vec3 q=position;float pet=1.-aS.y,f;
if(pet>.5){f=fract(uTime*.011*(.7+.6*aS.z)+aS.x*7.);q.y=${BL + 470}.-f*500.;q.x+=sin(uTime*.4+aS.z*30.)*16.*f;q.z+=cos(uTime*.31+aS.x*20.)*10.*f;
vA=smoothstep(0.,.08,f)*smoothstep(1.,.85,f)*step(aS.x,uRain);}
else{f=fract(uTime*.018*(.6+.8*aS.z)+aS.x);float an=uTime*.03+aS.x*6.283;q.xz=vec2(${BUD.x}.,${BUD.z}.)+(q.xz-vec2(${BUD.x}.,${BUD.z}.))*mat2(cos(an),sin(an),-sin(an),cos(an));
q.y=${BL + 10}.+f*360.;vA=sin(f*3.1416)*(.55+.45*sin(uTime*2.3+aS.z*40.));}
vec4 mv=viewMatrix*vec4(q,1.);gl_Position=projectionMatrix*mv;vK=pet;vR=aS.z*6.283+uTime*(.6+aS.z)*pet;
gl_PointSize=mix(3.6,8.,pet)*projectionMatrix[1][1]*uPx/max(-mv.z,1.);}`,
        fragmentShader: `uniform float uNight;varying float vA,vK,vR;
void main(){vec2 c=gl_PointCoord-.5,q=mat2(cos(vR),sin(vR),-sin(vR),cos(vR))*c;float d;
vec3 col;float a;
if(vK>.5){d=length(q*vec2(1.,2.1))*2.;a=smoothstep(1.,.7,d)*(1.-.35*smoothstep(.05,.0,abs(q.x))*step(0.,q.y));col=mix(vec3(1.,.66,.76),vec3(1.,.9,.7),smoothstep(-.3,.3,q.y))*(.75-.3*uNight);}
else{d=length(c)*2.;a=exp(-d*d*5.);col=vec3(1.9,1.5,.8);}
a*=vA;${OUT}}` }));
      this.budFx.frustumCulled = false; this.budFx.renderOrder = 6; this.scene.add(this.budFx); }
    this.waves = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 160), ADD(RGB(1.7, 1.4, 0.8), { opacity: 0, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.set(BUD.x, 7, BUD.z); m.renderOrder = 6; this.scene.add(m); this.waves.push(m); }
  }

  _tiers() {
    this.isles = []; const crowd = []; this.glowSeats = []; this.friends = [];
    const names = suggestNames(12, rng(99)), root = (this.isleBake = new THREE.Group()); let seed = 1; this.scene.add(root);
    TIER_ISLES.forEach((T, tier) => T.list.forEach(([x, z, size], k) => {
      // đảo bạn đồng tu: Vân Môn quay về phía đoạn vân lộ tới (điểm cuối vòng mép Vân Đảo), đổi sang hệ tọa độ của đảo
      const fk = tier === 0 && k < 3, y = T.y[0] + (T.y[1] - T.y[0]) * this.rnd(), ry = this.rnd() * 6.28, q = fk && this._arc(x, z).at(-1), hx = q ? q.x - x : 0, hz = q ? q.z - z : 0, hl = Math.hypot(hx, hz) || 1, c = Math.cos(ry), sn = Math.sin(ry);
      const nb = buildNeighbor(tier, seed++, size, fk ? FRIEND_DAY[k] / 49 : -1, fk ? [(hx * c - hz * sn) / hl, (hx * sn + hz * c) / hl] : null);
      nb.group.position.set(x, y - nb.top, z); nb.group.rotation.y = ry; root.add(nb.group); nb.group.updateMatrixWorld(true);
      const Wp = (p) => p && V(...p).applyMatrix4(nb.group.matrixWorld), inv = nb.group.matrixWorld.clone().invert();
      const isle = { tier, x, y, z, size, nb, seats: nb.seats.map((s) => V(s.x, s.y, s.z).applyMatrix4(nb.group.matrixWorld)), gate: Wp(nb.gate), pad: Wp(nb.pad), ground: (a, b) => { const l = V(a, 0, b).applyMatrix4(inv); return y - nb.top + nb.hf(l.x, l.z); } };
      this.isles.push(isle);
      isle.seats.forEach((p, i) => {
        if (tier === 0 && k < 3 && i === 0) return this.friends.push({ isle, pos: p, name: names[k], day: FRIEND_DAY[k], gate: isle.gate, pad: isle.pad, ground: isle.ground });
        crowd.push({ x: p.x, y: p.y, z: p.z, rot: faceBud(p.x, p.z) }); if (tier >= 2) this.glowSeats.push({ p, tier });
      });
    }));
    // T1.2: gộp toàn bộ đảo láng giềng (tĩnh sau khi dựng) theo vật liệu, tán lá gộp theo loại lá → ~1 lệnh vẽ cho mỗi chất liệu
    bakeLocal(root, [], [], { all: true });
    // Tầng 4: không còn đảo, chỉ Vân Tọa sáng quanh hào quang
    const T4 = [[-128, 366, -724], [128, 366, -724], [0, 362, -640], [0, 364, -836]];   // hai bên vai, trước mặt, sau lưng
    // vầng quang hình bầu dục ngang tai, chạy dưới bốn cụm Vân Tọa (hai vòng gộp một hình; độ sáng từng vòng nằm ở màu đỉnh)
    const lit = [[128, 100, 356, 0.42], [178, 142, 362, 0.22]].map(([rx, rz, y, op]) => { const g = new THREE.TorusGeometry(1, 0.012, 4, 120); g.scale(rx, rz, 125); g.rotateX(Math.PI / 2); g.translate(0, y, -738); return hue(g, RGB(2.6 * op, 2.1 * op, 1.2 * op)); });
    // Cầu Ánh Sáng giữa các đảo Tầng 3 và về phía hào quang: mọi nhịp cầu chung một hình
    const tube = (a, b, lift, rad, n = 48) => { const mid = a.clone().lerp(b, 0.5); mid.y += lift; return hue(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), n, rad, 4), RGB(1.25, 1.05, 0.62)); };
    const t3 = this.isles.filter((i) => i.tier === 3);
    t3.forEach((a, i) => { const p = V(a.x, a.y + 4, a.z); lit.push(tube(p, V(Math.sign(a.x) * 190, 250, -735), 40, 0.9)); const b = t3[(i + 2) % t3.length]; if (b !== a && Math.sign(b.x) === Math.sign(a.x)) lit.push(tube(p, V(b.x, b.y + 4, b.z), 22, 0.6)); });
    this.lbMat = ADD(0xffffff, { vertexColors: true, opacity: 0.55 }); this.scene.add(new THREE.Mesh(mergeGeometries(lit), this.lbMat));
    this.homeLbMat = ADD(0xffffff, { vertexColors: true, opacity: 0 });
    this.homeLb = new THREE.Mesh(mergeGeometries([this.isles[0], this.isles[1], { x: 0, y: 4, z: -230 }].map((e) => tube(V(HILL.x, 33, HILL.z), V(e.x, e.y + 4, e.z), 46, 0.7, 60))), this.homeLbMat); this.scene.add(this.homeLb);
    for (let i = 0; i < 48; i++) { const c = T4[i % 4], j = Math.floor(i / 4), a = j * 2.4 + (i % 4) * 1.1, d = j ? 7.5 + Math.sqrt(j) * 7.2 : 0, x = c[0] + Math.cos(a) * d, y = c[1] + Math.sin(j * 1.7) * 1.2 + (j ? 0 : 0.5), z = c[2] + Math.sin(a) * d * 0.75; crowd.push({ x, y, z, rot: faceBud(x, z), robe: '#9a7436', sc: 2.2 }); this.glowSeats.push({ p: V(x, y, z), tier: 4 }); }
    this.tierCrowd = makeCrowd(crowd, 5); this.scene.add(this.tierCrowd);
    // Ba bạn đồng tu ở đảo gần: nhân vật riêng, chào và thăm được
    const fr = rng(21);
    this.friends.forEach((f, i) => {
      const look = { skin: Math.floor(fr() * 5), robe: [2, 3, 4][i], trim: i, hair: ['buithap', 'cao', 'buicao'][i], hairColor: [0, 0, 2][i], age: ['tre', 'trung', 'cao'][i], mood: ['hoa', 'nghiem', 'tuoi'][i], acc: ['hat', 'khong', 'khan'][i] };
      f.fig = buildFigure(look); f.fig.setPose('sit'); f.fig.group.position.copy(f.pos); f.rot0 = f.fig.group.rotation.y = faceBud(f.pos.x, f.pos.z); this.scene.add(f.fig.group);
      f.head = f.pos.clone().add(V(0, 2.6, 0)); f.until = 0;
      f.arrive = f.pos.clone().add(V(Math.sin(f.fig.group.rotation.y + 1.2) * 3.2, 0, Math.cos(f.fig.group.rotation.y + 1.2) * 3.2));
    });
    // Vân lộ: từ thềm Cổng Vân Môn tới bãi đáp trước Vân Môn của ba đảo bạn
    this.bridges = this.friends.map((f) => { const pts = this._arc(f.isle.x, f.isle.z), end = f.pad.clone().add(V(0, 2.4, 0)), mid = pts.at(-1).clone().lerp(end, 0.5); mid.y = Math.min(6, end.y) - 4; return new THREE.CatmullRomCurve3([...pts, mid, end]); });
  }
  // vòng theo mép ngoài Vân Đảo (bán kính 50, đảo rộng tối đa ~42) về phía (tx, tz) rồi mới băng qua biển mây: không xuyên qua lòng đảo
  _arc(tx, tz) { const pts = [V(34, 6, 34)], A = Math.PI / 4; let d = Math.atan2(tz, tx) - A, a = A; d = Math.atan2(Math.sin(d), Math.cos(d));
    while (Math.abs(d) > 0.55) { const st = Math.sign(d) * Math.min(0.7, Math.abs(d) - 0.5); a += st; d -= st; pts.push(V(Math.cos(a) * 50, 6, Math.sin(a) * 50)); } return pts; }

  _hall() {
    const seats = [];
    for (let rho = 200; rho <= 520; rho += 16) { const n = Math.floor((2 * 0.56 * rho) / 15);
      for (let i = 0; i < n; i++) { const phi = -0.56 + (1.12 * (i + 0.5)) / n + (this.rnd() - 0.5) * 0.004, x = rho * Math.sin(phi), z = BUD.z + rho * Math.cos(phi); if (Math.hypot(x - SEAT.x, z - SEAT.z) < 9) continue; seats.push({ x, y: 3 + (this.rnd() - 0.5) * 0.8, z, row: (rho - 200) / 16 }); } }
    this.seats = seats; const n = seats.length, d = new THREE.Object3D(), all = seats.concat([{ x: SEAT.x, y: SEAT.y, z: SEAT.z }]);
    this.hallCrowd = makeCrowd(seats.map((s) => ({ x: s.x, y: s.y + 0.55, z: s.z, rot: faceBud(s.x, s.z) })), 9); this.scene.add(this.hallCrowd);
    // Vân Tọa: ba khối mây dẹt gộp một hình; mức chất lượng 0 (điện thoại) dùng bản ít mặt hơn (88 thay vì 212 tam giác/ghế)
    const blob = (r, w, h, x = 0, y = 0, z = 0, sy = 0.5) => { const g = new THREE.SphereGeometry(r, w, h).toNonIndexed(); g.deleteAttribute('uv'); g.scale(1, sy, 1); g.translate(x, y, z); return g; };
    const puffGeo = ([wa, ha], [wb, hb]) => mergeGeometries([blob(1.9, wa, ha, 0, 0, 0, 0.42), blob(1.2, wb, hb, 1.5, -0.1, 0.4), blob(1.1, wb, hb, -1.4, -0.1, -0.5)]);
    this.puffGeos = [puffGeo([8, 4], [5, 3]), puffGeo([10, 6], [7, 5])];
    // ghế ở xa (theo mức chất lượng 0/1/2: quá 140/220/320) chỉ còn một khối mây dẹt 24 tam giác
    this.seatMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, emissive: '#bfeee4', emissiveIntensity: 0 });
    this.seatMat.onBeforeCompile = (sh) => { sh.uniforms.uB = this.u.uB; sh.vertexShader = 'uniform float uB;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed *= (1.0 + uB);'); };
    const puff = new THREE.InstancedMesh(this.puffGeos[this.quality === 0 ? 0 : 1], this.seatMat, n + 1), puffFar = new THREE.InstancedMesh(blob(2.5, 6, 3, 0, 0, 0, 0.36), this.seatMat, n + 1), pm = [], pp = [];
    all.forEach((s, i) => { d.position.set(s.x, s.y, s.z); d.rotation.set(0, i * 1.7, 0); d.updateMatrix(); pm.push(d.matrix.clone()); pp.push(V(s.x, s.y, s.z)); });
    this.scene.add(puff, puffFar); this.puff = puff; this.puffLod = lodPair(puff, puffFar, pm, pp, [140, 220, 320]); this.puffLod(V(0, 0, 0), 2, true);
    this.pillarMat = ADD(RGB(1.5, 1.0, 0.5), { opacity: 0 });
    const pil = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.8, 16, 8, 1, true), this.pillarMat, n + 1);
    all.forEach((s, i) => { d.position.set(s.x, s.y - 8.6, s.z); d.rotation.set(0, 0, 0); d.updateMatrix(); pil.setMatrixAt(i, d.matrix); });
    pil.frustumCulled = false; pil.renderOrder = 7; this.scene.add(pil);
    const lp = [];
    for (let i = 0; i < n; i++) { const s = seats[i], t = seats[i + 1]; if (t && t.row === s.row) lp.push(s.x, s.y + 1.4, s.z, t.x, t.y + 1.4, t.z);
      let best = null, bd = 1e9; for (let j = Math.max(0, i - 90); j < i; j++) { const q = seats[j]; if (q.row === s.row - 1) { const dd = Math.hypot(q.x - s.x, q.z - s.z); if (dd < bd) { bd = dd; best = q; } } } if (best) lp.push(s.x, s.y + 1.4, s.z, best.x, best.y + 1.4, best.z); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.filaMat = new THREE.LineBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    this.fila = new THREE.LineSegments(lg, this.filaMat); this.fila.renderOrder = 8; this.fila.frustumCulled = false; this.scene.add(this.fila);
    // Tia nắng xuyên mây (crepuscular): các chùm sáng cộng màu nghiêng theo hướng nắng, từ quanh Tôn tượng rọi xuống Đại Thiền Đường.
    // Một InstancedMesh, một lệnh vẽ. Mờ dần theo góc nhìn (kiểu Fresnel: mặt nón quay ngang tầm mắt thì tắt) nên không lộ mép hình nón.
    // Các chùm xòe quạt từ một khe mây phía sau, trên đỉnh đầu Tôn tượng; gần máy quay thì tắt dần để không thành màn sương.
    const up = V(0, 1, 0), apex = V(-70, 600, -1000), RAYS = [[-470, -330], [-330, -540], [-210, -260], [-80, -450], [70, -300], [200, -520], [330, -280], [470, -420], [-560, -650], [580, -620]];
    this.rays = new THREE.InstancedMesh(new THREE.CylinderGeometry(5, 40, 1, 14, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: this.u,
      vertexShader: 'varying vec3 vN, vV; varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix*instanceMatrix*vec4(position,1.); vN = normalMatrix*mat3(instanceMatrix)*vec3(position.x, 0., position.z); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }',
      fragmentShader: `uniform float uTime,uRay; uniform vec3 uSunC; varying vec3 vN, vV; varying vec2 vUv; ${NOISE}
void main(){ float f = abs(dot(normalize(vN), normalize(vV))); vec3 col = uSunC*1.5;
 float a = f*f*smoothstep(0.,.35,vUv.y)*smoothstep(1.,.45,vUv.y)*(.5+.5*noise(vec2(cos(vUv.x*6.283), sin(vUv.x*6.283))*3. + uTime*.04))*smoothstep(80.,340.,length(vV))*uRay; ${OUT} }` }), RAYS.length);
    RAYS.forEach(([x, z], i) => { const ax = apex.clone().sub(V(x, -4, z)), L = ax.length(), k = 1 + (i % 3) * 0.3; d.quaternion.setFromUnitVectors(up, ax.normalize()); d.scale.set(k, L, k); d.position.set(x, -4, z).addScaledVector(ax, L / 2); d.updateMatrix(); this.rays.setMatrixAt(i, d.matrix); });
    this.rays.frustumCulled = false; this.rays.renderOrder = 4; this.scene.add(this.rays);
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
    for (let i = 0; i < 640; i++) { const a = r() * Math.PI * 2, R = 55 + Math.pow(r(), 0.8) * 1000; add(Math.cos(a) * R, -8.5 + r() * 2, Math.sin(a) * R - 220, 30 + r() * 38, 0); }
    for (let i = 0; i < 54; i++) { const a = r() * Math.PI * 2, R = 1150 + r() * 1500, az = Math.atan2(Math.cos(a) * R, -(Math.sin(a) * R)); if (Math.abs(az) < 0.5 && Math.sin(a) < 0) continue; add(Math.cos(a) * R, 30 + r() * 330, Math.sin(a) * R, 320 + r() * 420, 4); }
    for (let i = 0; i < 46; i++) { const a = (i / 46) * Math.PI * 2, o = (1 + 0.16 * Math.sin(2 * a + 0.8) + 0.09 * Math.sin(3 * a + 2.1)) * (0.98 + r() * 0.25); add(SX * o * Math.cos(a), -13 + r() * 8, SZ * o * Math.sin(a), 13 + r() * 12, 6); }
    for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, o = 0.7 + r() * 0.45; add(SX * o * Math.cos(a), 12.5 + r() * 4, SZ * o * Math.sin(a), 12 + r() * 11, 1); }
    for (let i = 0; i < 9; i++) add(27 + (r() - 0.5) * 12, 9.0 + r() * 2, 2 + (r() - 0.5) * 9, 6 + r() * 5, 2);
    add(-8, -7, 21, 14, 2); add(-7, -9, 23, 11, 2);
    this.isles.forEach((I) => { const n = 7 + Math.floor(I.size / 3); for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + r(), d = I.size * (0.85 + r() * 0.3); add(I.x + Math.cos(a) * d, I.y - I.size * (0.25 + r() * 0.6), I.z + Math.sin(a) * d * 0.8, I.size * (0.7 + r() * 0.7), 3); }
      if (I.tier > 0) for (let i = 0; i < 3; i++) add(I.x + (r() - 0.5) * I.size * 3, I.y - I.size * 1.6 - r() * 10, I.z + (r() - 0.5) * I.size * 2, I.size * (1.6 + r()), 3); });
    this.bridges.forEach((c) => { const m = Math.round(c.getLength() / 2.9); for (let i = 0; i <= m; i++) { const p = c.getPoint(i / m); add(p.x, p.y - 1.2, p.z, 4.5 + r() * 3.5, 2); } });
    this.glowSeats.forEach((s) => add(s.p.x, s.p.y - (s.tier === 4 ? 2.0 : 0.1), s.p.z, s.tier === 4 ? 5.4 : s.tier === 3 ? 3.2 : 2.4, 5));
    this.realm.isles.forEach((I) => { const n = I.size > 40 ? 5 : 3; for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + r() * 2; add(I.x + Math.cos(a) * I.size * 0.9, I.y - I.size * (0.35 + r() * 0.7), I.z + Math.sin(a) * I.size * 0.7, I.size * (1.1 + r() * 0.9), 3); } });
    for (let i = 0; i < 230; i++) { const x = (r() * 2 - 1) * 1300, z = -1500 + r() * 2100, y = 14 + Math.pow(r(), 1.5) * 330; if (Math.abs(x) < 280 && z < -100 && z > -820 && y < 520) continue; add(x, y, z, 34 + r() * 80, 7); }
    // đài mây nâng Tôn tượng: các lớp mây dày dần từ biển mây lên tới tòa sen
    for (let i = 0; i < 46; i++) { const k = i / 46, a = r() * Math.PI * 2, rr = Math.sqrt(r()), w = 250 - 110 * k; add(Math.cos(a) * rr * w, 6 + k * (BL - 12) + r() * 6, BUD.z + 26 + Math.sin(a) * rr * 70, 70 + r() * 60 - 25 * k, 2); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(Math.cos(a) * 168, BL - 8 + r() * 6, BUD.z + 40 + Math.sin(a) * 34, 34 + r() * 16, 5); }
    const n = items.length, g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]);
    const ip = new Float32Array(n * 3), im = new Float32Array(n * 4);
    items.forEach((it, i) => { ip.set(it.slice(0, 3), i * 3); im.set(it.slice(3, 7), i * 4); });
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(ip, 3)); g.setAttribute('iMeta', new THREE.InstancedBufferAttribute(im, 4)); g.instanceCount = n;
    // Mây tích dựng theo lô. Tấm mây mang pháp tuyến (gfx.puffAtlas) nên được chiếu sáng thật theo hướng mặt trời trong hệ máy quay:
    // đỉnh hứng nắng ấm, đáy và mặt khuất ngả lam theo màu bóng của tâm trạng, mép mỏng rực viền bạc khi nhìn ngược nắng (tán xạ thuận).
    // Chỗ tấm mây cắm xuống biển mây (y = −6) mờ dần theo độ cao nên không còn đường cắt thẳng; xa thì tan vào chân trời.
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, uniforms: { ...this.u, uTex: { value: puffAtlas() } },
      vertexShader: `attribute vec3 iPos;attribute vec4 iMeta;uniform float uTime,uMist;uniform vec3 uSun;varying vec2 vUv;varying float vA,vD,vG,vF,vY,vS,vB;varying vec3 vC,vL;
void main(){vec3 c=iPos;float g=iMeta.z,sd=iMeta.y;vG=g;vC=c;
vec2 cell=vec2(mod(iMeta.w,2.),floor(iMeta.w/2.));vUv=(vec2(sd>0.5?uv.x:1.-uv.x,uv.y)+cell)*0.5;vF=sd>0.5?1.:-1.;vL=normalize(mat3(viewMatrix)*uSun);vB=g>.5&&g<3.5?2.2:g>4.5&&g<5.5?1.:0.;
float edge=1.0;
if(g<0.5){c.x=mod(c.x+uTime*0.9+1100.,2200.)- 1100.;edge=smoothstep(1100.,860.,abs(c.x));}
else if(g>6.5){c.x=mod(c.x+uTime*(1.1+sd*1.4)+1300.,2600.)- 1300.;edge=smoothstep(1300.,1000.,abs(c.x));if(c.z<300.)edge*=smoothstep(260.,560.,abs(c.x));}
else c.x+=sin(uTime*0.03+sd*6.28)*(g>3.5&&g<4.5?12.:0.6);
c.y+=sin(uTime*0.07+sd*12.)*(g<0.5?1.3:(g>6.5?2.4:(g>2.5&&g<4.5?1.6:0.5)));
vec4 mv=viewMatrix*vec4(c,1.);
vec2 q=g<0.5?vec2(position.x*2.3,(position.y+0.40)*0.30):(g>2.5&&g<3.5?vec2(position.x*1.9,position.y*0.5):g>6.5?vec2(position.x*1.9,position.y*0.62):(g>3.5&&g<4.5?vec2(position.x*1.5,position.y*0.62):position.xy*1.12));
vec2 o=q*iMeta.x*(1.+0.08*sin(uTime*0.11+sd*20.));mv.xy+=o;vY=c.y+viewMatrix[1][0]*o.x+viewMatrix[1][1]*o.y;vS=iMeta.x*.16;
gl_Position=projectionMatrix*mv;vD=-mv.z;
vA=g<0.5?0.72:(g<1.5?uMist*0.42:(g<2.5?0.5:(g<3.5?0.82:(g<4.5?0.9:(g<5.5?0.75:(g<6.5?0.42:0.36))))))*edge;}`,
      fragmentShader: `uniform sampler2D uTex;uniform float uAmber,uNight;uniform vec3 uCam,uSun,uBud,uCl,uSh,uHz,uSunC;varying vec2 vUv;varying float vA,vD,vG,vF,vY,vS,vB;varying vec3 vC,vL;
void main(){vec4 t=texture2D(uTex,vUv,vB);vec3 dir=normalize(vC-uCam),n=vec3((t.rg*2.-1.)*vec2(vF,1.),0.);n.z=sqrt(max(1.-dot(n.xy,n.xy),0.));
n=normalize(mix(n,vec3(0.,0.,1.),vB*.3));
float g=max(dot(dir,uBud),0.),mu=max(dot(dir,uSun),0.),dif=clamp(dot(n,vL)*.5+.5,0.,1.),e=1.-t.b;
vec3 col=mix(uSh*.96,mix(uCl,uCl*uSunC,.25)*1.12,clamp(.44+.5*dif+.14*n.y,0.,1.));
col*=.9+.1*t.b;
col=mix(col,uSunC,0.04+0.2*pow(g,4.));
col+=uSunC*(pow(g,8.)*0.3+pow(mu,6.)*1.1+mu*mu*.2)*e*e;
col=mix(col,vec3(1.0,0.84,0.60),uAmber*0.2);
bool lum5=vG>4.5&&vG<6.5;if(lum5)col=mix(col,vec3(1.9,1.7,1.25)*(1.-.5*uNight),0.85);
float f=smoothstep(300.,2600.,vD);col=mix(col,uHz,f*(lum5?0.2:0.8));
float a=t.a*t.a*(3.-2.*t.a)*vA*(1.-f*0.5)*smoothstep(1.,8.,vD)*(vG>6.5?smoothstep(14.,90.,vD):1.)*smoothstep(0.,vS,vY+6.);${OUT}}` });
    this.puffs = new THREE.Mesh(g, mat); this.puffs.frustumCulled = false; this.puffs.renderOrder = 5; this.scene.add(this.puffs);
  }

  _fx() {
    // Hạt công đức mềm: quầng sáng mềm có lõi, nhấp nháy nhẹ; vị trí tính trên CPU theo hành trình của từng đợt (_meritStep)
    const N = 180, g = new THREE.BufferGeometry(); this.burstList = [];
    [['position', 3], ['aC', 3], ['aA', 2]].forEach(([k, n]) => g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(N * n), n)));
    this.burstPts = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPx: this.u.uPx },
      vertexShader: 'attribute vec3 aC;attribute vec2 aA;uniform float uPx;varying vec3 vC;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aA.y*projectionMatrix[1][1]*uPx/max(-mv.z,.1);vC=aC;vA=aA.x;}',
      fragmentShader: `varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5)*2.;vec3 col=vC*2.2;float a=(exp(-d*d*9.)+.4*exp(-d*d*2.2))*max(1.-d*d,0.)*vA;${OUT}}` }));
    this.burstPts.frustumCulled = false; this.burstPts.visible = false; this.scene.add(this.burstPts);
    // vân mây để du vân: một chùm búp mây dẹt (hạ xuống, nâng lên, tan dần nhờ độ trong)
    const rg = mergeGeometries([[0, 0, 0, 1.6], [1.2, 0.1, 0.35, 1.05], [-1.15, 0.05, -0.25, 1.1], [0.35, 0.15, -1.1, 0.95], [-0.45, 0.1, 1.05, 1]].map(([x, y, z, r]) => new THREE.SphereGeometry(r, 12, 8).translate(x, y, z))); rg.scale(1, 0.45, 1);
    this.ride = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: '#fff', roughness: 1, emissive: '#fff4e0', emissiveIntensity: 0.6, transparent: true })); this.ride.visible = false; this.scene.add(this.ride);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 28), new THREE.MeshBasicMaterial({ color: RGB(1.8, 1.5, 0.8), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); this.ring.rotation.x = -Math.PI / 2; this.scene.add(this.ring);
    // Vầng sáng ấm dưới chỗ ngồi khi nhân vật tọa thiền, sáng lên và dịu xuống theo nhịp thở của thời thiền
    this.aura = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uK: { value: 0 } },
      vertexShader: 'varying vec2 v; void main(){ v = position.xy/1.8; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uK;varying vec2 v;void main(){float r=length(v);vec3 col=vec3(1.,.82,.5);float a=uK*exp(-r*r*5.)*(1.-r);${OUT}}` }));
    this.aura.rotation.x = -Math.PI / 2; this.aura.renderOrder = 5; this.aura.visible = false; this.scene.add(this.aura);
    // Sóng âm trầm 136,1 Hz khi «Trị phóng dật»: hai vòng sóng mềm lan chậm trên mặt mây từ dưới Vân Tọa (Vân Đảo: dưới chân nhân vật),
    // mỗi vòng sống 10 giây như một nhịp thở; vàng đất nhạt, sáng dịu theo nhịp 0,1 Hz cùng âm trầm (audio.js)
    this.ud = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uTime: this.u.uTime, uK: { value: 0 } },
      vertexShader: 'varying vec2 v; void main(){ v = position.xy; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform float uTime,uK;varying vec2 v;void main(){float r=length(v),a=0.;for(int i=0;i<2;i++){float f=fract(uTime*.1+float(i)*.5);a+=(exp(-pow((r-f)*26.,2.))+.35*exp(-pow((r-f+.06)*18.,2.)))*f*(1.-f)*4.;}vec3 col=vec3(.92,.66,.34);a*=.5*uK*(.65+.35*sin(uTime*.628))*smoothstep(1.,.75,r);${OUT}}` }));
    this.ud.rotation.x = -Math.PI / 2; this.ud.renderOrder = 7; this.ud.visible = false; this.scene.add(this.ud);
    // Màn mây trước ống kính cho đoạn lướt vào cảnh (reveal): phủ kín rồi tan dần; ẩn hẳn khi uVeil về 0
    this.veil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false, uniforms: this.u,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `uniform float uTime,uVeil; uniform vec3 uCl,uSh; varying vec2 vUv; ${NOISE}
void main(){ float n = fbm(vUv*vec2(3.,1.8) + vec2(uTime*.05, uVeil*.6)); vec3 col = mix(uSh, uCl, .55+.45*n); float a = smoothstep(.0,.55, uVeil*1.5 - n*.5); ${OUT} }` }));
    this.veil.frustumCulled = false; this.veil.renderOrder = 99; this.veil.visible = false; this.scene.add(this.veil);
  }

  _avatar() {
    // Đổi diện mạo giữa lúc đang đi/ngồi (ví dụ bản từ thiết bị khác vừa về, #93): giữ nguyên đường đi và chỗ ngồi, không để
    // trạng thái 'walk' với đường rỗng (lỗi «reading 'x'» trong _avatarStep)
    const A0 = this.av, keep = A0 ? { p: A0.pos.clone(), rot: A0.rot, pose: this.fig.pose, st: A0.state, where: A0.where,
      go: { path: A0.path || [], speed: A0.speed || 0, done: A0.done, sit: A0.sit, id: A0.id, an: A0.an, track: A0.track, steer: A0.steer, after: A0.after, restoreSit: A0.restoreSit, dest: A0.dest, curve: A0.curve, k: A0.k,
        // chuyến du vân qua Vân Môn (#116): thiếu `trip` thì 'travel' kẹt và _tripStep ném lỗi khi đổi diện mạo giữa chặng
        trip: A0.trip, side: A0.side, wall: A0.wall, hold: A0.hold || 0, phase: A0.phase || 0 } } : null;
    if (this.fig) { this.scene.remove(this.fig.group); this.fig.dispose(); this.scene.remove(this.hallFig.group); this.hallFig.dispose(); }
    this.fig = buildFigure(this.look); this.scene.add(this.fig.group);
    // thú cưng đồng hành (people.buildPet): dựng lại theo diện mạo mới, xuất hiện ngay cạnh chủ
    if (this.pet) { this.scene.remove(this.pet.group); this.pet.dispose(); this.pet = null; }
    if (/^(meo|cho|tho)$/.test(this.look.pet)) { this.pet = buildPet(this.look.pet, this.look.petv); this.scene.add(this.pet.group); }
    this.hallFig = buildFigure(this.look); this.hallFig.setPose('sit'); this.hallFig.group.position.set(SEAT.x, SEAT.y + 0.55, SEAT.z); this.hallFig.group.rotation.y = Math.PI; this.scene.add(this.hallFig.group);
    this.av = { pos: keep ? keep.p : (this.startPos ? V(this.startPos.x, floorH(this.startPos.x, this.startPos.z), this.startPos.z) : V(2.6, floorH(2.6, 1.2), 1.2)), rot: keep ? keep.rot : (this.startPos ? this.startPos.rot || 0 : 0.5), state: keep ? keep.st : 'idle', where: keep ? keep.where : 'home', path: [], speed: 0, phase: 0, blink: 3, hold: 0 };
    if (!keep && this.startPos && this.startPos.sit && ANCHORS[this.startPos.sit]) { const an = ANCHORS[this.startPos.sit], nd = NODES[an.node], A = this.av; A.pos.set(nd[0], floorH(nd[0], nd[1]) + seatOf(an), nd[1]); A.state = 'sit'; A.sit = true; A.an = an; A.id = this.startPos.sit; A.rot = this.startPos.rot !== undefined ? this.startPos.rot : an.face || 0; A.restoreSit = true; }
    if (keep) { Object.assign(this.av, keep.go); if (this.av.state === 'walk' && !this.av.path.length) this.av.state = 'idle'; this.fig.setPose(keep.pose); }
  }
  setLook(look) { this.look = { ...this.look, ...look }; this._avatar(); }
  headPos() { const h = this.fig.pose === 'sit' ? 2.0 : 3.7; return V(this.av.pos.x, this.av.pos.y + (this.av.where === 'home' ? this.home.group.position.y : 0) + h * (this.look.height || 1), this.av.pos.z); }

  // Hậu kỳ (mức ≥ 1): cảnh vẽ vào đích HDR nửa-float khử răng cưa ×4 → bloom lọc kép (bloomFx) cộng quầng sáng ngay trên đích đó →
  // một lượt cuối tone mapping ACES + đổi không gian màu ra màn hình. Không dùng EffectComposer/OutputPass/UnrealBloomPass (nhẹ hơn ~16 KB).
  // Ngưỡng bloom đặt trên mức trắng của mây: chỉ hào quang, lõi đèn đá, hạt công đức, viền mây ngược nắng (đều > 1 trong HDR) mới tỏa sáng.
  _composer() {
    try {
      this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      // điện thoại: bloom nửa độ phân giải (applyQuality) và chỉ 3 tầng thay vì 5 → bớt 4 lượt vẽ toàn màn hình
      this.bloom = bloomFx(this.mobile ? 3 : 5);
      // Lượt cuối có làm nét thích ứng độ tương phản (kiểu AMD CAS, 5 điểm lấy mẫu): nét mảnh như lá, viền áo, tóc xoắn rõ lại sau MSAA
      // và bloom; chỗ tương phản cao hoặc vượt 1 trong HDR (hào quang, mặt trời) thì tự giảm về 0 nên không có viền sáng giả.
      // Sau tone mapping: chỉnh màu kiểu điện ảnh (đường cong chữ S nhẹ, vùng sáng ngả ấm, vùng tối ngả lạnh, tối góc khung) và nhiễu
      // hạt ±0,5/255 (interleaved gradient noise) để dải màu trời và biển mây không bị phân bậc.
      this.out = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { t: { value: this.rt.texture }, px: { value: new THREE.Vector2(1, 1) }, sh: { value: 0.16 } }, depthTest: false, depthWrite: false,
        vertexShader: 'varying vec2 v; void main(){ v = uv; gl_Position = vec4(position.xy, 0., 1.); }',
        fragmentShader: `uniform sampler2D t;uniform vec2 px;uniform float sh;varying vec2 v;
void main(){vec3 c=texture2D(t,v).rgb,a=texture2D(t,v+vec2(0.,px.y)).rgb,b=texture2D(t,v-vec2(0.,px.y)).rgb,d=texture2D(t,v+vec2(px.x,0.)).rgb,e=texture2D(t,v-vec2(px.x,0.)).rgb;
vec3 mn=min(c,min(min(a,b),min(d,e))),mx=max(c,max(max(a,b),max(d,e))),w=-sh*sqrt(clamp(min(mn,1.-mx)/max(mx,1e-4),0.,1.));
gl_FragColor=vec4(max((c+(a+b+d+e)*w)/(1.+4.*w),0.),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
{vec3 g=gl_FragColor.rgb;float l=dot(g,vec3(.2126,.7152,.0722));vec2 e=v-.5;
g=mix(g,g*g*(3.-2.*g),.2);
g+=vec3(.014,.005,-.012)*smoothstep(.5,1.,l)- vec3(.01,.002,-.012)*(1.-smoothstep(0.,.4,l));
g*=1.-.34*dot(e,e);
gl_FragColor.rgb=g+(fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))- .5)/255.;}
}` }));
    } catch (e) { this.rt = null; }
  }
  // DPR tối đa theo bậc (gfx.tierOf: điện thoại không quá 1,5; máy tính 2; trình vẽ phần mềm luôn 1) nhân hệ số độ phân giải động `res` (0,6–1)
  applyQuality() {
    const q = this.quality, T = tierOf(q, this.mobile), pr = Math.min(window.devicePixelRatio || 1, this.soft ? 1 : T.dpr) * this.res, w = Math.max(1, Math.round(this.w * pr)), h = Math.max(1, Math.round(this.h * pr));
    this.renderer.setPixelRatio(pr); this.renderer.setSize(this.w, this.h, false); this.sun.castShadow = T.post; this.shDirty = 3;
    if (this.puff) { this.puff.geometry = this.puffGeos[q === 0 ? 0 : 1]; this.rays.count = q ? 10 : 5; this.home.grass.count = this.soft ? 600 : q ? 3000 : 1550; }   // trình vẽ phần mềm: CPU tô từng lá cỏ, chỉ giữ 600 bụi; điện thoại mức 0 giữ 1.550 bụi cho vừa ngân sách tam giác
    // §12.3 mục 5: đích hậu kỳ theo đúng độ phân giải động; bloom nửa độ phân giải trên điện thoại (ánh hào quang vốn mờ, khác biệt khó thấy)
    if (this.rt) { this.rt.setSize(w, h); this.bloom.setSize(Math.round(w * T.bloom), Math.round(h * T.bloom)); this.out.material.uniforms.px.value.set(1 / w, 1 / h); }
    this.u.uPx.value = h / 2;
  }
  // Biên dịch trước shader của biến thể `q` (bóng đổ bật/tắt; qua bloom thì vẽ vào render target nên không tone mapping)
  _warm(q = this.quality) {
    const r = this.renderer, prev = r.getRenderTarget(), cast = this.sun.castShadow;
    let p = Promise.resolve();
    try {
      this.sun.castShadow = q >= 1;
      r.setRenderTarget(q >= 1 && this.rt ? this.rt : null);
      p = r.compileAsync(this.scene, this.camera);
    } catch (e) { void e; } finally { r.setRenderTarget(prev); this.sun.castShadow = cast; }
    return p.catch(() => {});
  }
  // Đổi mức chất lượng: giữ khung hình cũ trên màn hình (không vẽ) tới khi shader của mức mới sẵn sàng, tối đa 3 giây
  setQuality(q) {
    q = Math.max(0, Math.min(2, q)); if (q === this.quality) return;
    this.quality = q; this.res = 1; this.applyQuality(); saveGfx(q);
    const h = (this.hold = Promise.race([this._warm(q), new Promise((r) => setTimeout(r, 3000))]).then(() => { if (this.hold === h) this.hold = null; }));
  }
  // §12.3 mục 5: độ phân giải động theo thời gian khung (gfx.governor, đồng hồ thật). Chậm thì hạ `res` từng nấc 0,1 tới 0,6
  // rồi mới hạ mức chất lượng; nhanh thì nâng `res` dần về 1. Mục tiêu 30 fps khi thiền (§12.2).
  _adapt() {
    if (this.fixedQ || document.hidden) return;
    const now = performance.now(), d = this.gov(now, this.hold);
    if (d < 0 && this.res > 0.6) this.res = Math.round((this.res - 0.1) * 10) / 10;
    else if (d < 0 && this.quality > 0) { this.gov.mark(now); return this.setQuality(this.quality - 1); }
    else if (d > 0 && this.res < 1) this.res = Math.min(1, Math.round((this.res + 0.1) * 10) / 10);
    else return;
    this.applyQuality(); this.gov.mark(now);
  }
  // Lướt vào cảnh lần đầu (3,5 giây, cubic-bezier): máy quay từ sát biển mây xuyên qua màn mây tiền cảnh, nâng dần lên góc nhìn Vân Đảo
  // rồi trả quyền điều khiển (có quán tính) cho người dùng. Bỏ qua khi người dùng chọn giảm chuyển động hoặc cảnh mở thẳng vào chỗ khác.
  reveal() {
    const p = this.islandCam(), t = this.islandTarget();
    this.camera.position.set(p.x - 34, 7, p.z + 170); this.controls.target.set(t.x, t.y + 26, t.z); this.baseFov = 72; this.applyFov();
    this.flyTo(p, t, this.portrait ? 64 : 58, 3.5); this.tween.glide = 1;
  }

  // Tích lũy công đức (chủ dự án yêu cầu 18/11/2026). Hạt sáng bay vòng cung từ Bia Tích Lũy, chậm dần rồi đáp nhẹ xuống đầu
  // nhân vật, lượn quanh vai rồi thấm vào; nhân vật ấm sáng lên (không hào quang sau đầu, AGENTS.md 1.6) và mỉm cười; hạt bay tiếp
  // tới tán Bồ-đề, lượn quanh tán rồi tan: lá reo, lung linh, cây sáng và vươn lên một chút. k = tỉ lệ công đức (E / 22,5).
  // Lần lớn (k ≥ 0,6, cách lần trước ≥ 15 giây, đang ở Vân Đảo) thì máy quay dõi theo vừa phải rồi quay nhanh về Bia Tích Lũy;
  // các lần khác, hoặc lần đến khi đang có đợt lớn, chỉ có hạt sáng (gom vào đợt đang chạy, máy quay đứng yên).
  // Đường bay hình vòm (chủ dự án 18/11/2026): hạt cất thẳng lên, vượt vòm rồi đáp thẳng xuống (đầu nhân vật, ngọn Bồ-đề, bạn đồng tu).
  // T = [bay tới đầu / tới bạn, đáp quanh vai, bay vòm tới ngọn cây]; Tùy Hỷ tới bạn ở đảo khác bay vòm cao nên lâu hơn.
  burst(color = 0xffd98a, to = null, k = 0.5) {
    const H = this.headPos(), far = !!to && H.distanceTo(to.pos) > 25, n = Math.round(30 + 46 * Math.min(1, k));
    const big = k >= 0.6 && this.time - (this.mcAt || -99) > 15 && (this.mode === 'island' || this.mode === 'zone') && !this.tween && (to || this.av.where === 'home');
    const T = to ? [far ? 4 : 1.7, 0.8, 0] : big ? [1.9, 0.75, 2.4] : [1.2, 0.35, 1.6];
    const ev = { t0: this.time, wall: performance.now(), c: new THREE.Color(color), to, T, n, k, far, sp: to ? (far ? 1 : 0.9) : big ? 1.4 : 0.6, big };   // hạt tới rải rác, không dồn một chỗ
    this.burstList.push(ev); this.burstList = this.burstList.slice(-3);
    if (to) this._sfx('gift', H, { k });
    if (big) { this.mcAt = this.time; this._cine(ev); }
  }
  // hiệu ứng âm (main.js nối onSfx sang Vân Nhạc); pan theo vị trí trên màn hình
  _sfx(kind, at, o = {}) { if (!this.onSfx) return; let pan = 0; if (at) { const v = at.clone().project(this.camera); pan = Math.max(-1, Math.min(1, v.x)) * 0.8; } this.onSfx(kind, { ...o, pan }); }
  // Tùy Hỷ: đứng thì quay về phía bạn, chắp tay; đang ngồi thiền thì giữ nguyên tư thế
  rejoice(i) { const f = this.friends[i], A = this.av; if (!/walk|travel|sit/.test(A.state)) { A.rotTo = Math.atan2(f.pos.x - A.pos.x, f.pos.z - A.pos.z); this.fig.setPose('anjali'); A.hold = 2.8; A.state = 'idle'; } this.burst(0xbfeee4, f, 0.7); }
  // Máy quay cho đợt lớn: khung nhìn vừa đủ thấy đường bay, dịch chậm theo hạt; không bay xa (nhiều lần tích lũy liên tiếp).
  // Tùy Hỷ: bạn ở gần (đang thăm đảo bạn) thì khung cả hai rồi tới bạn. Bạn ở đảo khác: cận mặt mình lúc hạt cất lên khỏi đôi tay,
  // máy quay bay theo đàn hạt qua vòm (ev.track, _meritStep) để thấy rõ hướng bay, dừng trước mặt bạn lúc hạt đáp, rồi trở về.
  _cine(ev) {
    const io = this.home.group.position, H = this.headPos(), st = this.home.stele.position.clone().add(io).add(V(0, 2, 0)), cam = this.camera.position, TG = this.home.tree.group, S = TG.scale.x;
    const tr = TG.position.clone().add(io).add(V(0, 8 * S, 0)), top = TG.position.clone().add(io).add(V(0, 10 * S, 0));
    // Khung ngang: nhìn ngang đường bay. Khung dọc (điện thoại) hẹp ngang nên đứng sau đầu bắt đầu, nhìn dọc theo đường bay: đầu gần ở dưới, đích ở trên
    const side = (a, b, d, up = 3.5) => { const m = a.clone().lerp(b, 0.5), q = cam.clone().sub(m), L = a.distanceTo(b);
      if (this.portrait && L > 1) { const k = a.clone().sub(b).setY(0).normalize(); return [a.clone().addScaledVector(k, 7).add(V(0, up + 2, 0)), a.clone().lerp(b, 0.6)]; }
      q.y = 0; q.setLength(Math.max(d, L * 0.95)); return [m.clone().add(q).add(V(0, up, 0)), m]; };
    const to = ev.to, F = to ? to.pos.clone().add(V(0, 2.6, 0)) : null, back = [[cam.clone(), this.controls.target.clone()], this.baseFov], c = ANCHORS.stele.cam;
    let shots;
    if (to) { const dir = F.clone().sub(H).setY(0).normalize(), fa = V(Math.sin(to.fig.group.rotation.y), 0, Math.cos(to.fig.group.rotation.y)), m = H.clone().lerp(F, 0.5), land = ev.sp * 0.5 + ev.T[0];
      let pp = V(dir.z, 0, -dir.x); if (pp.dot(cam.clone().sub(H)) < 0) pp.negate();
      shots = !ev.far ? [[0, [m.clone().addScaledVector(fa, 9).add(V(0, 3, 0)), m], 50], [land - 0.4, [F.clone().addScaledVector(fa, 6.5).add(V(0, 1.5, 0)), F], 46], [land + 2, ...back]]   // trước mặt bạn (hướng về Tôn tượng, thường trống)
        : [[0, [H.clone().addScaledVector(pp, this.portrait ? 9 : 7).addScaledVector(dir, 3).add(V(0, 0.8, 0)), H.clone().addScaledVector(dir, this.portrait ? 0.5 : 1.5).add(V(0, 1.2, 0))], 48], [land + 2.2, ...back, 1.5]];
      if (ev.far) ev.track = { from: 1.1, land: land + 0.1, to: land + 2.2, dir, pp }; }   // bạn thường ngồi dưới tán cây: giữ góc cao chếch sau, không chui vào tán
    else shots = [[0, side(st, H, 9, 3), 50], [1.9, side(H, H, 6.5, 1.2), 46], [3.3, side(H, tr, 11, 4), 50], [4.7, side(top, top, 7 + 7 * S, 2 + 2 * S), 50], [7.7, [V(c[0][0], c[0][1] + io.y, c[0][2]), V(c[1][0], c[1][1] + io.y, c[1][2])], 48]];
    ev.shots = shots.map(([t, [pp, tt], f, d], i) => ({ t, p: pp, q: tt, f, d: d || (i ? (i === shots.length - 1 ? 0.8 : 1.1) : 0.9) }));
  }
  // Mỗi khung: vị trí từng hạt theo thời gian, độ sáng nhân vật/cây/bạn đồng tu, các cảnh máy quay
  _meritStep(dt = 1 / 60) {
    const io = this.home.group.position, P = this.burstPts.geometry.attributes, pos = P.position.array, col = P.aC.array, aa = P.aA.array, H = this.headPos(), t = this.time;
    const TG = this.home.tree.group, S = TG.scale.x, st = this.home.stele.position.clone().add(io).add(V(0, 2.4, 0)), top = TG.position.clone().add(io).add(V(0, 11.6 * S, 0));
    // đường vòm bậc ba: cất thẳng lên khỏi điểm đầu, đáp thẳng xuống điểm cuối (h: độ cao vòm)
    const B3 = (a, d, h, e, jt) => { const u = 1 - e, b = a.clone().add(V(0, h, 0)).add(jt), c = d.clone().add(V(0, h, 0)).add(jt); return a.clone().multiplyScalar(u * u * u).addScaledVector(b, 3 * u * u * e).addScaledVector(c, 3 * u * e * e).addScaledVector(d, e * e * e); };
    const ez = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }, bump = (x, a, b, c) => ez((x - a) / (b - a)) * (1 - ez((x - b) / c));
    let k = 0, glow = 0, joy = 0, fr = null, frG = 0, me = false;
    this.burstList = this.burstList.filter((ev) => t - ev.t0 < Math.max(ev.sp + ev.T[0] + ev.T[1] + ev.T[2] + 1.2, ev.shots ? ev.shots[ev.shots.length - 1].t + 0.2 : 0));   // giữ tới cảnh quay cuối
    this.burstList.forEach((ev, ei) => { const [a, b, c] = ev.T, el = t - ev.t0, half = ev.sp * 0.5, Fh = ev.to ? ev.to.pos.clone().add(V(0, 2.6, 0)) : null, hit = ev.to ? a : a + b + c;
      if (this.touch >= 1e17 || this.touch > ev.wall) ev.user = true;   // người dùng chạm/kéo máy quay: trả quyền, bỏ các cảnh còn lại
      if (ev.to) { fr = ev.to; frG = Math.max(frG, bump(el, a - 0.1, half + a + 0.5, 2)); glow = Math.max(glow, 0.6 * bump(el, 0, 0.5, 1.6)); if (el < 2.6) me = true; }   // Tùy Hỷ: mình ấm lên, mỉm cười lúc gửi; bạn sáng lúc nhận
      else { glow = Math.max(glow, (ev.big ? 1 : 0.55) * bump(el, half + a - 0.3, half + a + 0.4, 1.6)); joy = Math.max(joy, (ev.big ? 1 : 0.5) * bump(el, hit - 0.15, hit + half + 0.4, 2.4)); }
      if (!ev.hit && el >= hit) { ev.hit = 1; if (ev.to) this._sfx('chime', Fh, { k: 0.4 }); else if (t - (this.chimeAt || -9) > 0.8) { this.chimeAt = t; this._sfx('chime', top, { k: ev.k }); } }   // chạm đích: chuông gió leng keng
      const G = ev.to ? Fh : H, sit = ev.to || this.fig.pose === 'sit', y0 = sit ? 0.25 : 0.35, dy = sit ? 0.75 : 1.15, dist = ev.to ? H.distanceTo(Fh) : 0;   // đáp quanh đỉnh đầu, rơi nhẹ xuống vai/ngực
      for (let i = 0; i < ev.n && k < 180; i++, k++) { const s = ((i * 0.618034) % 1), ph = i * 2.39996 + ei, tau = el - s * ev.sp, j = V(Math.cos(ph), Math.sin(ph * 1.7) * 0.6, Math.sin(ph)); let q = null, al = 1, sz = 1;
        const land = (u) => { const r = 0.7 + 0.1 * u, w = ph + u * 2.2; return G.clone().add(V(Math.cos(w) * r, y0 + 0.2 * j.y - dy * u, Math.sin(w) * r)); };
        if (tau > 0 && tau < a) { const e = ez(tau / a), end = land(0);
          if (ev.to) { const from = H.clone().add(V(0, this.fig.pose === 'sit' ? -0.8 : -1.2, 0)).addScaledVector(j, 0.3);   // rời đôi tay chắp, vòm cao dần theo khoảng cách
            q = B3(from, end, ev.far ? Math.min(40, Math.max(14, dist * 0.28)) : 3 + dist * 0.3, e, j.clone().multiplyScalar(ev.far ? 2.4 : 0.6)); al = ez(tau / 0.3) * (1 - 0.5 * ez((e - 0.75) / 0.25)); sz = (ev.far ? 1.25 : 1) - 0.4 * ez((e - 0.6) / 0.4); }
          else { const from = st.clone().addScaledVector(j, 0.7); q = B3(from, end, 2.5 + 0.25 * from.distanceTo(end), e, j.clone().multiplyScalar(0.9)); al = ez(tau / 0.25) * (1 - 0.6 * ez((e - 0.5) / 0.5)); sz = 1 - 0.4 * e; } }
        else if (tau >= a && tau < a + b) { const u = (tau - a) / b; q = land(u); al = 0.4 * (1 - u) + (ev.to ? 0 : 0.15 * u); sz = 0.6 - 0.2 * u; }   // tỏa quanh vai rồi thấm vào người (không tụ thành vầng sau đầu)
        else if (!ev.to && tau >= a + b && tau < a + b + c + 1) { const u = (tau - a - b) / c, rr = 3 * S * Math.sqrt((i * 0.381966 + 0.5) % 1), rd = V(Math.cos(ph), 0, Math.sin(ph)), dst = top.clone().addScaledVector(rd, rr).add(V(0, -2.2 * S * (rr / (3 * S)) ** 2, 0));
          if (u < 1) { q = B3(land(1), dst, 4 + 5 * S, ez(u), j.clone().multiplyScalar(0.8)); al = 0.15 + 0.85 * ez(u * 2.5); sz = 0.45 + 0.55 * ez(u * 2); }   // vượt vòm rồi chụp thẳng xuống ngọn cây
          else { const v = (tau - a - b - c) / 1, f = (1 - v) ** 3; q = dst.addScaledVector(rd, 1.8 * S * (1 - (1 - v) ** 2)).add(V(0, -2.4 * S * v * v, 0)); al = (1 - v) ** 1.6 * (1 + 0.8 * f); sz = 1 + 1.3 * f; } }   // chạm: lóe sáng, tỏa ra trên tán rồi thấm xuống lá
        if (q) { pos.set([q.x, q.y, q.z], k * 3); ev.c.toArray(col, k * 3); aa[k * 2] = al * (0.75 + 0.25 * Math.sin(t * 9 + ph)); aa[k * 2 + 1] = (ev.big ? 0.62 : 0.46) * (0.7 + 0.6 * s) * sz; } else aa[k * 2] = 0; }
      if (ev.user || this.dir) return;
      if (ev.shots) { const sh = ev.shots.find((x) => !x.done && el >= x.t); if (sh) { sh.done = 1; this.flyTo(sh.p, sh.q, sh.f, sh.d); } }
      // Tùy Hỷ tới bạn ở đảo khác: máy quay bay theo tâm đàn hạt (chếch sau, một bên, cao dần), nhìn trước theo hướng bay rồi chuyển dần về phía bạn
      const tk = ev.track; if (tk && !this.tween && el >= tk.from && el < tk.to) { const from = H.clone().add(V(0, this.fig.pose === 'sit' ? -0.8 : -1.2, 0)), pr = ez((el - tk.from) / (tk.land - tk.from));
        const pc = B3(from, Fh.clone().add(V(0, y0, 0)), Math.min(40, Math.max(14, dist * 0.28)), ez((el - half) / a), V(0, 0, 0));
        const want = pc.clone().addScaledVector(tk.dir, -12 + 3 * pr).addScaledVector(tk.pp, (this.portrait ? 6 : 8) - 2 * pr).add(V(0, 3 + 6 * pr, 0)), look = pc.clone().addScaledVector(tk.dir, 8).lerp(Fh, pr * pr);
        this.camera.position.lerp(want, 1 - Math.exp(-dt * 2.6)); this.controls.target.lerp(look, 1 - Math.exp(-dt * 3.5)); } });
    for (let i = k; i < 180; i++) aa[i * 2] = 0;
    P.position.needsUpdate = P.aC.needsUpdate = P.aA.needsUpdate = true; this.burstPts.geometry.setDrawRange(0, k); this.burstPts.visible = k > 0;
    this.fig.glow(glow); this.fig.smile(glow > 0.25 || me); this.friends.forEach((f) => { f.fig.glow(f === fr ? frG : 0); f.fig.smile((f === fr && frG > 0.25) || (f.host && f.fig.pose !== 'sit')); });
    this.joy = (this.joy || 0) + (joy - (this.joy || 0)) * 0.2; UNI.uJoy.value = this.joy;
  }
  // ───────── Đi lại ─────────
  // Chỗ không bước vào được: hồ, khối đồi Tịnh Thất (chỉ lên xuống theo bậc đá), mép đảo
  _blocked(px, pz) { const a = (px - POND.x) / (POND.rx + 0.5), b = (pz - POND.z) / (POND.rz + 0.5); return a * a + b * b < 1 || (Math.abs(px - HILL.x) < 8.4 && Math.abs(pz - HILL.z) < 6.4) || this.home.frac(px, pz) > 0.88; }
  _clear(x0, z0, x1, z1) { for (let i = 1; i <= 12; i++) if (this._blocked(x0 + ((x1 - x0) * i) / 12, z0 + ((z1 - z0) * i) / 12)) return false; return true; }
  _near(x, z, ok = () => true) { return Object.keys(NODES).filter(ok).reduce((b, k) => (b === null || Math.hypot(NODES[k][0] - x, NODES[k][1] - z) < Math.hypot(NODES[b][0] - x, NODES[b][1] - z) ? k : b), null); }
  _route(target, from) {
    const pos = this.av.pos;
    const a = from || this._near(pos.x, pos.z), prev = { [a]: null }, q = [a];
    while (q.length) { const k = q.shift(); if (k === target) break; EDGES.forEach(([x, y]) => { const o = x === k ? y : y === k ? x : null; if (o && !(o in prev)) { prev[o] = k; q.push(o); } }); }
    const out = []; for (let k = target; k; k = prev[k]) out.unshift(NODES[k]);
    return out;
  }
  walkTo(id, done) {
    const an = ANCHORS[id]; if (!an || this.av.where !== 'home' || this.av.state === 'travel') return false;
    this.fig.setPose('stand'); this.av.path = this._route(an.node).map(([x, z]) => V(x, 0, z)); this.av.state = 'walk'; this.av.done = done; this.av.sit = !!an.sit; this.av.id = id; this.av.an = an; this.av.track = false; this.av.steer = false; this.av.after = null;
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
  // Nút + / −: phóng to, thu nhỏ quanh điểm đang nhìn, trong giới hạn của chế độ hiện tại
  dolly(k) { if (this.tween) return; const c = this.controls, off = this.camera.position.clone().sub(c.target); off.setLength(Math.max(c.minDistance, Math.min(c.maxDistance, off.length() * k))); this.zoomed = null; this.flyTo(c.target.clone().add(off), c.target.clone(), this.baseFov, 0.3); }
  // Đưa máy quay về bên nhân vật: đang ngồi ở phân khu thì dùng góc nhìn của khu, còn lại thì đứng chếch phía sau
  focusAvatar(dur = 1.1) {
    const A = this.av, io = A.where === 'home' ? this.home.group.position.y : 0; this.zoomed = null; this.follow = null;
    if (A.state === 'sit' && A.id && ANCHORS[A.id]) { const c = ANCHORS[A.id].cam; return this.flyTo(V(c[0][0], c[0][1] + io, c[0][2]), V(c[1][0], c[1][1] + io, c[1][2]), 48, dur); }
    const tg = V(A.pos.x, A.pos.y + io + (this.fig.pose === 'sit' ? 1.5 : 2.3), A.pos.z), d = this.camera.position.clone().sub(tg); d.y = 0; if (d.lengthSq() < 1) d.set(0.5, 0, 1);
    d.setLength(11); this.flyTo(V(tg.x + d.x, tg.y + 5, tg.z + d.z), tg, 46, dur);
  }
  // Xả thiền: máy quay về bên nhân vật, nhân vật chắp tay xá rồi đứng dậy; xong mới gọi `done` (để đi tiếp theo lệnh)
  wake(done) {
    const A = this.av; this.focusAvatar(1.2); if (A.state !== 'sit') { if (done) done(); return; }
    Object.assign(A, { state: 'idle', sit: false, hold: 1.7, after: done || null }); if (A.where === 'home') A.pos.y = floorH(A.pos.x, A.pos.z); this.fig.setPose('anjali');
  }
  // ───────── Vân Du: khi tọa thiền, máy quay rời chỗ ngồi đi viếng các cảnh ─────────
  // k: 0 bên nhân vật · 1 Vân Đảo · 2 Biển mây · 3–5 ba tầng đảo · 6 ngang tầm mắt Tôn tượng. Không điểm nhìn nào cao hơn mắt Ngài (AGENTS.md mục 1.2).
  // main.js tính k từ thời gian ngồi yên; null = kết thúc, máy quay trở về bên nhân vật.
  setVandu(k) {
    if (k === null || k === undefined) { if (this.vd) { this.vd = null; this.controls.enabled = true; this.focusAvatar(3); } return; }
    if (!this.vd) {
      const A = this.av, io = A.where === 'home' ? this.home.group.position.y : 0, h = V(A.pos.x, A.pos.y + io + 1.6, A.pos.z);
      const tier = (n) => { const I = this.isles.find((x) => x.tier === n), q = (I.size / 14) * 2.4; return [V(I.x + 20 * q * Math.sign(-I.x), I.y + 9 * q, I.z + 30 * q), V(I.x, I.y + 2.5, I.z)]; };
      const W = [[V(h.x + 6, h.y + 3.2, h.z + 9), h], [this.islandCam(), this.islandTarget()], [V(-60, 64, 170), V(-190, 74, -150)], tier(1), tier(2), tier(3), [V(-330, 362, -430), V(-10, 352, -760)]];
      this.vd = { p: new THREE.CatmullRomCurve3(W.map((w) => w[0])), t: new THREE.CatmullRomCurve3(W.map((w) => w[1])), n: W.length - 1, k: 0 }; this.zoomed = null; this.follow = null; this.tween = null;
    }
    this.vd.k = Math.max(0, Math.min(this.vd.n, k));
  }
  /** Điểm đặt máy quay và điểm nhìn của Vân Du tại vị trí k, kèm độ đung đưa nhẹ (calm: bỏ đung đưa cho người chọn giảm chuyển động) */
  vanduAt(k, tm = this.time) {
    const d = this.vd, u = k / d.n, a = this.calm ? 0 : 1.5 + 4.5 * Math.min(1, k), p = d.p.getPoint(u), t = d.t.getPoint(u);
    p.x += Math.sin(tm * 0.05) * a; p.y = Math.min(BUD_EYE - 2, p.y + Math.sin(tm * 0.037) * a * 0.3); p.z += Math.cos(tm * 0.043) * a; return { p, t };
  }
  pickAny(nx, ny) { this.ray = this.ray || new THREE.Raycaster(); this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera); const hit = this.ray.intersectObject(this.home.group, true).find((h) => h.object.isMesh && !h.object.isPoints && h.object.material && !h.object.material.transparent); return hit ? hit.point : null; }
  _birds(dt) {
    if (!this.birds) { this.birds = buildBirds(12); this.scene.add(this.birds.group); const H = this.home, gy = H.group.position.y, bb = new THREE.Box3().setFromObject(H.pv.group), tb = new THREE.Box3().setFromObject(H.tree.group);
      this.perchFix = [V(HILL.x + 0.6, bb.max.y - gy - 0.05, HILL.z), V(HILL.x - 5.9, pvFloor() + 1.5, HILL.z + 4.44), V(HILL.x + 5.9, pvFloor() + 1.5, HILL.z - 4.44), V(10.5 + 0.2, groundH(10.5, 10) + 3.42, 10), V(17.13, groundH(15.5, 15.5) + 3.0, 13.87), V(-15.6, groundH(-15.6, 7) + 4.36, 7), V((tb.min.x + tb.max.x) / 2 + 1.2, tb.max.y - gy - 0.5, (tb.min.z + tb.max.z) / 2), V(STAIR.x + STAIR.hw + 0.17, pvFloor() - STAIR.rise + 0.6, STAIR.z0 + STAIR.run * 0.5), V(26.5 - 2.2, DECKS[0].base + 0.9, 3.6)]; }
    const A = this.av, gy = this.home.group.position.y, list = this.perchFix.map((p) => ({ p: V(p.x, p.y + gy, p.z) }));
    if (A.where === 'home' && (A.state === 'sit' || A.state === 'idle')) { const ax = A.pos.x, az = A.pos.z; [[1.25, 0.5], [-1.1, 0.9], [0.3, 1.5]].forEach(([dx, dz]) => { const x = ax + dx * Math.cos(A.rot) + dz * Math.sin(A.rot), z = az - dx * Math.sin(A.rot) + dz * Math.cos(A.rot); list.push({ p: V(x, floorH(x, z) + gy + 0.02, z), moved: () => this.av.state === 'walk' || this.av.state === 'travel' }); }); }
    this.birds.group.visible = this.mode === 'island' || this.mode === 'zone' || this.mode === 'creator'; this.birds.update(dt, this.time, list, this.camera, this.birds.group.visible ? this.onChirp : null, this.birdOpts);
  }
  // Bấm lên mặt đảo: đi thẳng tới đó; bị chắn (đang ngồi trong Tịnh Thất, hồ nằm giữa đường) thì theo lối đi tới nút gần đích nhất
  walkToPoint(x, z) {
    const A = this.av; if (A.where !== 'home' || A.state === 'travel' || (this.mode !== 'island' && this.mode !== 'zone') || this._blocked(x, z)) return false;
    let path = [V(x, 0, z)];
    if (!this._clear(A.pos.x, A.pos.z, x, z)) {
      const end = this._near(x, z, (k) => this._clear(NODES[k][0], NODES[k][1], x, z)); if (!end) return false;
      const start = this._blocked(A.pos.x, A.pos.z) ? null : this._near(A.pos.x, A.pos.z, (k) => this._clear(A.pos.x, A.pos.z, NODES[k][0], NODES[k][1]));
      path = [...this._route(end, start).map(([nx, nz]) => V(nx, 0, nz)), ...path];
    }
    this._go(path); this.ring.position.set(x, groundH(x, z) + 0.12 + this.home.group.position.y, z); this.ring.material.opacity = 0.9; return true;
  }
  _go(path) { const A = this.av; if (A.state !== 'walk') this.fig.setPose('stand'); Object.assign(A, { path, state: 'walk', done: null, sit: false, id: null, an: null, after: null, hold: 0, exit: false }); this.follow = null; A.track = this.camera.position.distanceTo(this.controls.target) < 90 && this.controls.target.distanceTo(V(A.pos.x, A.pos.y + this.home.group.position.y, A.pos.z)) < 40; }
  // Phím mũi tên / WASD: đi theo hướng máy quay đang nhìn. kx: phải (+) / trái (−); kz: tới (+) / lui (−)
  steer(kx, kz) { this.key = kx || kz ? { x: kx, z: kz } : null; if (!this.key && this.av.steer) { this.av.steer = false; this.stopWalk(); } }
  _steer() {
    const A = this.av, K = this.key; if (!K || A.where !== 'home' || A.state === 'travel' || (this.mode !== 'island' && this.mode !== 'zone') || this.tween) return;
    if (A.exit && A.state === 'walk') return;   // đang xuống bậc đá: đi hết lối rồi mới nhận hướng phím
    if (this._blocked(A.pos.x, A.pos.z)) {   // đang ở trên đồi Tịnh Thất: xuống theo bậc đá trước
      const out = this._route(this._near(A.pos.x, A.pos.z, (k) => !this._blocked(NODES[k][0], NODES[k][1]))); this._go(out.map(([nx, nz]) => V(nx, 0, nz))); A.exit = true; return;
    }
    const f = V(this.controls.target.x - this.camera.position.x, 0, this.controls.target.z - this.camera.position.z).normalize(), dx = f.x * K.z - f.z * K.x, dz = f.z * K.z + f.x * K.x, n = Math.hypot(dx, dz) || 1;
    // đi thẳng theo hướng bấm; bị chắn thì trượt dọc theo vật cản
    const d = [[dx / n, dz / n], [Math.sign(dx), 0], [0, Math.sign(dz)]].find(([ux, uz]) => (ux || uz) && !this._blocked(A.pos.x + ux * 0.4, A.pos.z + uz * 0.4) && !this._blocked(A.pos.x + ux * 1.2, A.pos.z + uz * 1.2));
    if (!d) { if (A.steer) { A.steer = false; this.stopWalk(); } return; }
    if (!A.steer || A.state !== 'walk') this._go([V(0, 0, 0)]);
    A.steer = true; A.path = [V(A.pos.x + d[0] * 4, 0, A.pos.z + d[1] * 4)];
  }
  pickGround(nx, ny) {
    this.ray = this.ray || new THREE.Raycaster(); this.ray.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hit = this.ray.intersectObject(this.home.land, false)[0]; return hit && hit.face.normal.y > 0.6 ? hit.point : null;
  }
  greet(i) { const f = this.friends[i]; this.av.rotTo = Math.atan2(f.pos.x - this.av.pos.x, f.pos.z - this.av.pos.z); if (this.av.state !== 'walk' && this.av.state !== 'travel') { this.fig.setPose('anjali'); this.av.hold = 2.8; this.av.state = 'idle'; } f.fig.setPose('anjali'); f.fig.eyes(false); f.until = this.time + 3; }
  // Du vân qua Vân Môn (chủ dự án 18/11/2026): đi bộ ra Vân Môn → vân mây từ trời hạ xuống trước mặt → bước lên → vân nâng lên → bay theo vân lộ
  // → dừng trên bãi đáp trước Vân Môn bên kia, hạ xuống → bước xuống → đi qua cổng vào. Máy quay nhìn ngang, đứng xa vừa đủ thấy cảnh quanh; âm thanh theo từng bước.
  visit(i, done) { this._trip(i, done); }
  goHome(done) { if (this.av.where !== 'home') this._trip('home', done); }
  _trip(dest, done) {
    const A = this.av; if (A.state === 'travel' || A.where === dest || (A.where !== 'home' && dest !== 'home')) return;   // chỉ đi giữa Vân Đảo và một đảo bạn (vân lộ nối qua Vân Đảo)
    const io = this.home.group.position.y, hp = (x, z) => V(x, floorH(x, z) + io, z), home = A.where === 'home', fs = !home && this.friends[A.where], ts = dest !== 'home' && this.friends[dest];
    const HG = hp(15.5, 15.5), HW = hp(16.2, 16.2), HP = V(17.8, HW.y, 17.8), gA = home ? HG : fs.gate, pA = home ? HP : fs.pad, gB = ts ? ts.gate : HG, pB = ts ? ts.pad : HP, up = V(0, 2.4, 0);
    const br = this.bridges[home ? dest : A.where].getPoints(20), out = pA.clone().sub(gA).setY(0).normalize(), walk = [...(home ? this._route('gate').map(([x, z]) => hp(x, z)) : []), gA, home ? HW : pA.clone().addScaledVector(out, -1.7)];
    const curve = new THREE.CatmullRomCurve3(home ? [pA.clone().add(up), ...br] : [...br.reverse(), pB.clone().add(up)]);
    A.trip = { st: 'walk', t: 0, i: 0, walk, out, inn: gB.clone().sub(pB).setY(0).normalize(), curve, fly: Math.min(11, Math.max(6.5, curve.getLength() / 20)), pA, pB, gB, end: ts ? ts.arrive : hp(12.5, 12.5), op: 0 };
    Object.assign(A, { state: 'travel', dest, done, k: 0, hold: 0, wall: performance.now() }); this.fig.setPose('stand');
    const P = this._wp(), d = walk[0].clone().sub(P).setY(0); this.tcDir = d.lengthSq() > 1e-4 ? d.normalize() : out.clone(); A.side = V(this.tcDir.z, 0, -this.tcDir.x).dot(this.camera.position.clone().sub(P)) < 0 ? -1 : 1;
    if (this.mode === 'island' || this.mode === 'zone') this.tween = null;
  }
  _wp() { return this.av.pos.clone().add(V(0, this.av.where === 'home' ? this.home.group.position.y : 0, 0)); }
  _tripStep(dt, turn, io) {
    const A = this.av, T = A.trip, R = this.ride, U = (y) => V(0, y, 0), cl = (x) => Math.max(0, Math.min(1, x)), go = (st) => { T.st = st; T.t = 0; };
    const setW = (p) => A.pos.set(p.x, p.y - (A.where === 'home' ? io : 0), p.z), hop = (a, b, u) => a.clone().lerp(b, ease(u)).add(U(0.35 * Math.sin(Math.PI * u)));
    T.t += dt; T.walking = false; let foc, dir, far = 0, c = null;
    if (T.st === 'walk' || T.st === 'in') {   // đi bộ (trên đảo đang đứng)
      const to = T.walk[T.i], P = this._wp(), d = to.clone().sub(P).setY(0), L = d.length(), sp = 2.4 * dt;
      if (L <= sp) { P.x = to.x; P.z = to.z; if (++T.i >= T.walk.length) { if (T.st === 'in') return this._tripEnd(); go('summon'); this._sfx('summon', T.pA); } }
      else { P.addScaledVector(d, sp / L); turn(Math.atan2(d.x, d.z)); A.phase += dt * 3.6; T.walking = true; }
      P.y = A.where === 'home' ? floorH(P.x, P.z) + io : this.friends[A.where].ground(P.x, P.z); setW(P); foc = P.add(U(1.8)); dir = L > 1e-3 ? d : this.tcDir;
      if (T.st === 'in') { T.op = Math.max(0, T.op - dt / 1.4); c = T.pB.clone().add(U(0.25 + 1.6 * (1 - T.op))); }   // vân mây bay lên, tan dần
    } else if (T.st === 'summon') {   // vân mây từ trời hạ xuống trước mặt
      const e = 1 - (1 - cl(T.t / 1.8)) ** 3; T.op = e; c = T.pA.clone().add(U(0.25 + 7 * (1 - e) ** 2)); R.scale.setScalar(0.35 + 0.65 * e); turn(Math.atan2(T.out.x, T.out.z)); foc = T.pA.clone().add(U(2)); dir = T.out;
      if (T.t >= 1.8) { go('board'); this._sfx('step', T.pA); }
    } else if (T.st === 'board') {   // bước lên vân mây
      if (A.where !== 'sky') { T.from = this._wp(); A.where = 'sky'; } const u = cl(T.t / 1.1); c = T.pA.clone().add(U(0.25)); setW(hop(T.from, c.clone().add(U(0.32)), u)); A.phase += dt * 3; T.walking = u < 1; foc = T.pA.clone().add(U(2)); dir = T.out;
      if (u >= 1) { go('lift'); this._sfx('cloud', null, { dur: 2.8 + T.fly }); }
    } else if (T.st === 'lift' || T.st === 'fly' || T.st === 'descend') {   // vân nâng lên · bay theo vân lộ · hạ xuống bãi đáp bên kia
      const L = T.st === 'lift', D = T.st === 'descend', u = cl(T.t / (L ? 1.3 : D ? 1.5 : T.fly)), tan = T.curve.getTangent(L ? 0 : D ? 0.999 : Math.min(0.999, ease(u)));
      c = L ? T.pA.clone().add(U(0.25 + 2.15 * ease(u))) : D ? T.pB.clone().add(U(2.4 - 2.15 * ease(u))) : T.curve.getPoint(ease(u)); if (!L) A.k = D ? 1 : u;
      setW(c.clone().add(U(0.32))); turn(Math.atan2(tan.x, tan.z), 3); foc = (L ? T.pA : D ? T.pB : c).clone().add(U(L || D ? 2 : 1)); dir = D ? T.inn : tan; far = !L && !D;
      if (u >= 1) { if (L) go('fly'); else if (!D) go('descend'); else { go('alight'); this._sfx('step', T.pB); T.from = this._wp(); A.where = A.dest; setW(T.from); } }
    } else if (T.st === 'alight') {   // bước xuống, mây ở lại rồi tan
      const u = cl(T.t / 1.1), to = T.pB.clone().addScaledVector(T.inn, 2.2); to.y = A.dest === 'home' ? floorH(to.x, to.z) + io : this.friends[A.dest].ground(to.x, to.z); setW(hop(T.from, to, u)); A.phase += dt * 3; T.walking = true;
      c = T.pB.clone().add(U(0.25)); foc = T.pB.clone().add(U(2)); dir = T.inn; if (u >= 1) { go('in'); T.walk = [T.gB, T.end]; T.i = 0; }
    }
    if (c) { R.position.copy(c); R.material.opacity = T.op; R.visible = T.op > 0.01; }
    const free = this.touch < 1e17 && !(this.touch > A.wall), cam = (this.mode === 'island' || this.mode === 'zone') && !this.tween && !this.dir;
    if (cam && free) {   // máy quay nhìn ngang theo hướng đi, giữ một bên; bay thì lùi xa hơn, cao hơn
      if (dir.x * dir.x + dir.z * dir.z > 1e-6) this.tcDir.lerp(V(dir.x, 0, dir.z).normalize(), 1 - Math.exp(-dt * 3)).normalize();
      // tâm nhìn bám sát nhân vật (không tụt lại khi bay nhanh); chỉ hướng nhìn, khoảng cách, độ cao được làm mượt (một lần, không trễ chồng);
      // 1,6 giây đầu chuyển êm từ góc đang nhìn
      if (!T.cf) Object.assign(T, { cf: this.controls.target.clone(), c0: this.camera.position.clone().sub(this.controls.target), dd: 14, hh: 4.5, la: 1, age: 0 });
      const Dd = this.tcDir, kk = 1 - Math.exp(-dt * 1.5), b = ease(Math.min(1, (T.age += dt) / 1.6)); T.cf.lerp(foc, 1 - Math.exp(-dt * (far ? 30 : 3)));
      T.dd += ((far ? 24 : 14) * (this.portrait ? 1.18 : 1) - T.dd) * kk; T.hh += ((far ? 7 : 4.5) * (this.portrait ? 0.65 : 1) - T.hh) * kk; T.la += ((far ? 5 : 1) - T.la) * kk;
      this.camera.position.copy(T.cf).add(V(Dd.z, 0, -Dd.x).multiplyScalar(A.side * T.dd).addScaledVector(Dd, -T.dd * 0.1).add(U(T.hh)).multiplyScalar(b).addScaledVector(T.c0, 1 - b)); this.controls.target.copy(T.cf).addScaledVector(Dd, T.la); }
    else if (cam) { const d = foc.clone().sub(this.controls.target).multiplyScalar(Math.min(1, dt * 2)); this.controls.target.add(d); this.camera.position.add(d); }   // người dùng đã tự xoay: giữ góc họ chọn
  }
  _tripEnd() { const A = this.av, f = this.friends[A.dest]; A.trip = null; A.state = 'idle'; A.k = 1; this.ride.visible = false;
    if (f) { A.rotTo = Math.atan2(f.pos.x - A.pos.x, f.pos.z - A.pos.z); if (this.touch < 1e17 && !(this.touch > A.wall) && (this.mode === 'island' || this.mode === 'zone') && !this.dir) { const [mp, mt] = this._meet(A.dest, A.side); this.flyTo(mp, mt, 50, 1.4); } }   // tới nơi: qua vai nhân vật nhìn bạn đang đứng đón
    if (A.done) { const d = A.done; A.done = null; d(A.dest); } }
  // Bạn đồng tu đón khách (#95): khách sắp tới thì đứng dậy, quay về phía khách, mỉm cười; ở cùng thì đứng chờ (mời cùng tọa thiền thì ngồi cùng, quay về Tôn tượng);
  // khách về thì chắp tay tiễn rồi ngồi lại thiền
  _friendStep(dt, breath = 0) {
    const Av = this.av; this.friends.forEach((f, i) => { const g = f.fig.group, host = (Av.where === i && Av.state !== 'travel') || (Av.state === 'travel' && Av.dest === i && Av.k > 0.72);
    if (f.until && this.time > f.until) { f.until = 0; if (!host) f.fig.setPose('sit'); }
    if (host !== !!f.host) { f.host = host; if (host) f.fig.setPose('stand'); else if (Av.state === 'travel' && Av.where === i) { f.fig.setPose('anjali'); f.until = this.time + 2.4; } else f.fig.setPose('sit'); }
    if (host) { const want = Av.state === 'sit' ? 'sit' : f.until ? 'anjali' : 'stand'; if (f.fig.pose !== want) f.fig.setPose(want); }
    const yaw = (host || (f.until && Av.where === i)) && Av.state !== 'sit' ? Math.atan2(Av.pos.x - f.pos.x, Av.pos.z - f.pos.z) : f.rot0; g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 4);
    f.fig.group.scale.y = f.fig.group.scale.x * (1 + 0.012 * breath); });
  }
  // góc gặp bạn đồng tu: gần như ở Vân Đảo của mình, qua vai nhân vật nhìn bạn đang đứng đón
  _meet(i, side) { const f = this.friends[i], u = f.pos.clone().sub(f.arrive).setY(0).normalize(), sv = V(u.z, 0, -u.x).multiplyScalar(side); return [f.arrive.clone().addScaledVector(u, -5.5).addScaledVector(sv, 3).add(V(0, 4.2, 0)), f.arrive.clone().lerp(f.pos, 0.65).add(V(0, 2.6, 0))]; }

  // ───────── Camera ─────────
  // điện thoại: bảng thu gọn mặc định; lùi xa và ngước lên để thấy cả đảo lẫn trọn Tôn tượng
  islandCam() { return this.portrait ? V(30, 56, 300) : V(28, 30, 108); }
  islandTarget() { return this.portrait ? V(6, 153, 40) : V(12, 36, 0); }
  flyTo(p, t, fov = 52, dur = 1.6) { this.tween = { p0: this.camera.position.clone(), t0: this.controls.target.clone(), f0: this.baseFov, p, t, fov, k: this.snap ? 0.999 : 0, dur }; this.controls.enabled = false; }
  setMode(mode, opt = {}) {
    this.mode = mode;
    if (mode === 'hall') { if (this.portrait) this.flyTo(V(0, 60, -250), V(0, 148, -418), 58, 2); else this.flyTo(V(0, 20, -170), V(0, 60, -352), 58, 2); }
    else if (mode === 'overview') { if (this.portrait) this.flyTo(V(60, 262, 560), V(-190, 244, -470), 58, 2.2); else this.flyTo(V(180, 262, 520), V(-10, 196, -470), 58, 2.2); }
    else if (mode === 'realm') this.flyTo(V(-460, 420, 900), V(40, 210, -450), 60, 3.2);
    else if (mode === 'tier') { const k = opt.tier; if (k === 4) this.flyTo(V(-188, 382, -640), V(-30, 366, -742), 52, 2.2); else { const I = this.isles.find((x) => x.tier === k), s = I.size / 14; this.flyTo(V(I.x + 20 * s * Math.sign(-I.x), I.y + 9 * s, I.z + 30 * s), V(I.x, I.y + 2.5, I.z), 44, 2.2); } }
    else if (mode === 'creator') {   // nhìn trực diện, thấy trọn người từ đầu tới chân (khung dọc dời ảnh lên để chừa bảng tùy chọn: điểm nhắm hiện ở ~27 % từ trên)
      const A = this.av, a = A.pos.clone(), P = this.portrait; a.y += A.where === 'home' ? this.home.group.position.y : 0;
      this.flyTo(a.clone().add(V(Math.sin(A.rot) * (P ? 8.6 : 8), P ? 2.4 : 1.9, Math.cos(A.rot) * (P ? 8.6 : 8))), V(a.x, a.y + (P ? 2.5 : 1.6), a.z), 34, 1.4); }
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
    else if (m === 'island') Object.assign(c, { minDistance: 4, maxDistance: 380, minPolarAngle: 0.5, maxPolarAngle: this.portrait ? 1.95 : 1.64 });
    else Object.assign(c, { minDistance: 3.2, maxDistance: 260, minPolarAngle: 0.5, maxPolarAngle: 1.54 });   // phân khu: zoom được tới sát nhân vật
  }
  // Máy quay mở đầu thuyết giảng (sermon.js chọn cảnh theo chặng, st.shot): cận trực diện Tôn tượng mở mắt (face) → lia ngang
  // theo vòng cung trước hàng đệ tử đầu tiên, thấy hội chúng đảnh lễ hướng về Tôn tượng (pan) → nâng máy sau hội chúng, thấy cả Đại Thiền Đường (rise) →
  // xoay chậm quanh hội chúng trong lời mở đầu (orbit) → nửa giây trước nội dung bài giảng thì về cận Tôn tượng (close, đúng góc
  // của main.js). Mỗi cảnh hòa từ vị trí máy quay lúc chuyển cảnh; hết các cảnh này thì trả máy quay cho main.js.
  _direct(dt, sm) {
    const sh = sm.on && this.mode === 'hall' ? sm.shot : '';
    if (!sh) { if (this.dir) { this.dir = null; this.controls.enabled = true; } return; }
    let d = this.dir; if (!d || d.sh !== sh) d = this.dir = { sh, t: 0, p: this.camera.position.clone(), q: this.controls.target.clone(), f: this.baseFov };
    const t = (d.t += dt), P = this.portrait, e = (x) => { x = Math.min(1, x); return x * x * (3 - 2 * x); };
    let p, q, f, b = 0.5;
    if (sh === 'face') { p = V(0, P ? 262 : 250, P ? -380 : -455); q = V(0, 335, -760); f = P ? 62 : 50; b = 0.4; }
    else if (sh === 'pan') { const a = (e(t / 3.5) * 2 - 1) * (P ? 0.3 : 0.48); p = V(172 * Math.sin(a), 10, -760 + 172 * Math.cos(a)); q = V(270 * Math.sin(a * 0.85), 3, -760 + 270 * Math.cos(a * 0.85)); f = P ? 62 : 46; b = 0.4; }
    else if (sh === 'rise') { const u = e(t / 1.8); p = V(0, 35 + 85 * u, -215 + 65 * u); q = V(0, 210, -720); f = P ? 68 : 60; }
    else if (sh === 'orbit') { const a = 0.55 * Math.sin(t * 0.09); p = V(Math.sin(a) * 330, (P ? 75 : 45) + 12 * Math.sin(t * 0.13), -600 + Math.cos(a) * 330); q = V(0, P ? 250 : 150, -700); f = P ? 70 : 62; b = 1.4; }
    else { p = P ? V(-20, 240, -175) : V(-30, 96, -300); q = V(0, P ? 365 : 318, -760); f = P ? 58 : 56; }
    const k = e(t / b);
    this.camera.position.lerpVectors(d.p, p, k); this.controls.target.lerpVectors(d.q, q, k); this.baseFov = d.f + (f - d.f) * k; this.applyFov();
    this.tween = null; this.controls.enabled = false;
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
    const u = this.u, isl = s.isl, H = this.home, now = performance.now(), ud = BIO.mode === 'uddhacca' ? Math.min(1, (now - BIO.at) / 5000) : 0;
    const v = ud ? { ...s.vis, amber: s.vis.amber * (1 - 0.6 * ud) } : s.vis;   // «Trị phóng dật»: sắc hổ phách nhạt hơn, phần chính là sóng âm (this.ud)
    this._adapt();
    // Lần cập nhật đầu tiên: nếu cảnh mở ở Vân Đảo, không nhảy thẳng (snap) và người dùng không chọn giảm chuyển động thì lướt vào cảnh
    if (!this.began) { this.began = 1; let calm = false; try { calm = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { void e; } if (!this.snap && !calm && !this.tween && this.mode === 'island') this.reveal(); }
    // Thiền tiết kiệm (§12.5): đang tọa thiền hay ở Đại Thiền Đường, máy quay đứng yên và không ai chạm màn hình → chỉ vẽ 30 khung/giây.
    // `world.meditating = true/false` để lớp ứng dụng chỉ định rõ; để trống thì suy từ tư thế ngồi. Thời gian bỏ qua được cộng dồn nên chuyển động không chậm đi.
    this.saver = (this.meditating ?? (this.av.state === 'sit' || this.mode === 'hall')) && !this.tween && !this.dir && now - this.touch > 1500;
    this.acc += dt; if (this.saver && now - this.drawn < 28) return;
    dt = this.acc; this.acc = 0; this.drawn = now;
    this.time += dt; u.uTime.value = this.time;
    this._direct(dt, s.sermon || {});
    if (this.tween) { const tw = this.tween; tw.k = Math.min(1, tw.k + dt / tw.dur); const e = tw.glide ? GLIDE(tw.k) : ease(tw.k);
      this.camera.position.lerpVectors(tw.p0, tw.p, e); this.controls.target.lerpVectors(tw.t0, tw.t, e); this.baseFov = tw.f0 + (tw.fov - tw.f0) * e; this.applyFov();
      if (tw.glide) u.uVeil.value = Math.max(0, 1 - tw.k * 1.7);
      if (tw.k >= 1) { this.tween = null; this.controls.enabled = true; this.setLimits(); } }
    if (!this.tween || !this.tween.glide) u.uVeil.value = Math.max(0, u.uVeil.value - dt * 1.5);   // bị ngắt giữa chừng thì màn mây vẫn tan dần
    this.veil.visible = u.uVeil.value > 0;
    this._avatarStep(dt, s);
    if (this.pet) { const A = this.av, h = this.mode === 'hall', io = A.where === 'home' ? this.home.group.position.y : 0;   // Đại Thiền Đường: ngồi cạnh Vân Tọa của mình
      this.pet.step(dt, this.time, h ? SEAT : A.pos, h ? Math.PI : A.rot, h || A.state === 'sit' || A.where === 'sky' || this.mode === 'creator', h ? () => SEAT.y + 0.55 : (x, z) => (A.where === 'home' ? floorH(x, z) + io : A.pos.y), isl.lv === undefined ? 1 : isl.lv); }
    { const K = this.ud.material.uniforms.uK; K.value += ((BIO.mode === 'uddhacca' ? (this.mode === 'hall' ? 1.1 : 0.6) : 0) - K.value) * Math.min(1, dt * 0.8); this.ud.visible = K.value > 0.01;
      if (this.ud.visible) { const h = this.mode === 'hall'; this.ud.position.set(h ? SEAT.x : this.av.pos.x, h ? -2 : this.av.pos.y + 0.5, h ? SEAT.z : this.av.pos.z); this.ud.scale.setScalar(h ? 170 : 16); } }
    this.realm.update(this.time, v.night);
    // Thuyết giảng: Tôn tượng mở mắt, cử động miệng, giơ ấn thuyết pháp; hội chúng chắp tay và đảnh lễ
    { const sm = s.sermon || { on: false, speak: 0, bow: 0, anjali: false };
      if (sm.on && !this.budFrames) this.budFrames = [this.budFig.material.map, buddhaFace({ open: true }), buddhaFace({ open: true, mouth: 0.5 }), buddhaFace({ open: true, mouth: 1 })];
      if (this.budFrames) { const f = sm.on ? 1 + (sm.speak > 0.62 ? 2 : sm.speak > 0.22 ? 1 : 0) : 0; if (this.budFig.material.map !== this.budFrames[f]) this.budFig.material.map = this.budFrames[f]; }
      // giơ ấn thuyết pháp khi bắt đầu thí pháp (sau phần hội chúng đảnh lễ), hạ về ấn thiền định khi hết bài
      { const up = sm.on && sm.ph !== 'homage' && sm.ph !== 'wait1' ? 1 : 0, k = this.budK + (up - this.budK) * Math.min(1, dt * 1.4); if (Math.abs(k - this.budK) > 1e-4) { this.budK = k; this.budArm(k * k * (3 - 2 * k)); } }
      { const R = this.budFx.material.uniforms.uRain; R.value += ((sm.on ? 1 : 0.45) - R.value) * Math.min(1, dt * 0.5); }   // mưa hoa dày dần khi thuyết giảng
      this.sBow = (this.sBow || 0) + ((sm.bow || 0) - (this.sBow || 0)) * Math.min(1, dt * 7);
      [this.hallCrowd, this.tierCrowd].forEach((c) => { if (c && c.userData.bow) { c.userData.bow.value = this.sBow; c.userData.setAnjali(!!sm.anjali); } });
      [this.hallFig, ...this.friends.map((f) => f.fig)].forEach((f) => f.bow(this.sBow)); }   // chỗ ngồi của mình và bạn đồng tu cúi lạy cùng hội chúng
    if (this.vd && !this.tween) { const w = this.vanduAt(this.vd.k), k = this.snap ? 1 : 1 - Math.exp(-dt * 0.5);   // lướt chậm tới điểm đang muốn: vào Vân Du không giật
      this.controls.enabled = false; this.camera.position.lerp(w.p, k); this.controls.target.lerp(w.t, k); if (Math.abs(this.baseFov - 54) > 0.05) { this.baseFov += (54 - this.baseFov) * k; this.applyFov(); } }
    if (this.tween || !this.controls.enabled) this.camera.lookAt(this.controls.target); else this.controls.update();
    const cam = this.camera.position, q = this.quality, home = this.mode !== 'hall' && cam.distanceTo(H.group.position) < 330;
    [this.hallCrowd, this.tierCrowd].forEach((c) => c && c.userData.lod(cam, q)); this.realm.lod(cam, q); this.puffLod(cam, q); u.uCam.value.copy(cam); this.sky.position.copy(cam);
    // Nhân vật chi tiết ở xa chỉ còn vài điểm ảnh: bạn đồng tu quá 150/200/260 (theo mức) thì không vẽ; mức 0 cũng bỏ nhân vật của mình ở Đại Thiền Đường khi đứng xa
    this.friends.forEach((f) => { f.fig.group.visible = cam.distanceTo(f.pos) < [150, 200, 260][q]; }); this.hallFig.group.visible = q > 0 || cam.distanceTo(SEAT) < 300;
    u.uBud.value.set(BUD.x - cam.x, BUD_EYE - cam.y, BUD.z - cam.z).normalize();
    u.uNight.value = v.night; u.uAmber.value = v.amber; u.uJade.value = v.jade; u.uCalm.value = v.calm;
    // Tâm trạng ánh sáng: Trăng Thiền theo đêm của thời thiền, Hoàng Hôn Tím theo sắc hổ phách, Sương Sớm theo mốc «Niệm hơi thở mây»
    // (và phảng phất trong màn sương những ngày đầu hành trình), còn lại là Ngày Vàng
    { const W = this.moodW, n = v.night, a = v.amber * (1 - n), dw = Math.max(v.jade, 0.4 * Math.max(0, Math.min(1, (isl.mist - 0.15) / 0.6))) * (1 - n - a); W[0] = dw; W[1] = 1 - n - a - dw; W[2] = a; W[3] = n;
      const M = moodMix(W), dim = M[16] / 0.5, sc = u.uSunC.value, hz = u.uHz.value;
      const mx = Math.max(hz.x, hz.y, hz.z), L = (c) => 0.45 + 0.55 * c;
      this.scene.fog.color.setRGB(hz.x, hz.y, hz.z, THREE.SRGBColorSpace); this.sun.color.setRGB(L(sc.x), L(sc.y), L(sc.z), THREE.SRGBColorSpace);
      this.hemi.color.setRGB(hz.x / mx, hz.y / mx, hz.z / mx, THREE.SRGBColorSpace); this.hemi.intensity = M[16]; this.sun.intensity = M[15]; this.fill.intensity = 0.6 * dim; this.scene.environmentIntensity = 0.75 * dim; this.renderer.toneMappingExposure = M[17];
      this.budFig.material.color.setScalar(1 - 0.12 * n);
      // IBL theo tâm trạng: PMREM tốn kém nên chỉ dựng lại ở mức 2 trên GPU thật, khi trọng số lệch quá 0,2 so với lần dựng trước và cách nhau ít nhất 3 giây
      if (q > 1 && !this.soft && this.pm && now - this.envAt > 3000 && W.reduce((d, w, i) => d + Math.abs(w - this.envW[i]), 0) > 0.2) this._env(); }
    let pulse = 0; s.waves.forEach((age, i) => { const m = this.waves[i]; if (!m) return; const k = age / 14; m.visible = k < 1; m.scale.setScalar(40 + age * 58); m.material.opacity = (1 - k) * 0.6; pulse = Math.max(pulse, Math.exp(-age / 2.5)); });
    for (let i = s.waves.length; i < this.waves.length; i++) this.waves[i].visible = false;
    { const dB = Math.hypot(cam.x - BUD.x, cam.y - BUD_EYE, cam.z - BUD.z), near = Math.min(1, Math.max(0, (dB - 160) / 420)); this.haloK = (this.haloK ?? 1) + ((0.32 + 0.68 * near) - (this.haloK ?? 1)) * Math.min(1, 0.05 * 60 * 0.016 * 4); u.uHalo.value = (1 + 0.5 * pulse + 0.35 * v.merit) * this.haloK; } u.uRainbow.value = v.rainbow; u.uHaloWhite.value = v.haloWhite;
    u.uTier2.value = isl.tier >= 2 ? 1 : isl.sky || 0;
    u.uB.value = 0.1 * v.breath * s.breath; this.seatMat.emissiveIntensity = 0.6 * v.jade * s.breath + 0.25 * v.amber; this.seatMat.emissive.set(v.amber > 0.5 ? '#ffcf8a' : '#bfeee4');
    this.pillarMat.opacity = 0.16 * v.amber; this.filaMat.opacity = 0.5 * v.fila * (0.75 + 0.25 * Math.sin(this.time * 0.8)); this.filaMat.color.setHSL((this.time * 0.02) % 1, 0.55, 0.78).multiplyScalar(1.5);
    // tia nắng: luôn có một chút ở mức ≥ 1, rực lên ở mốc «Tưởng ánh sáng»; mức 0 chỉ bật ở mốc đó để đỡ tô điểm ảnh
    u.uRay.value = (q ? 0.07 + 0.07 * this.moodW[2] : 0) + 0.3 * v.beams; this.rays.visible = u.uRay.value > 0.003; u.uP.value = v.merit; this.merit.visible = v.merit > 0;
    this.hallFig.group.scale.y = this.hallFig.group.scale.x * (1 + 0.012 * s.breath);

    // Vân Đảo theo tiến trình và tầng
    const t4 = isl.tier >= 4 ? 1 : 0, kk = Math.min(1, dt * 2);
    u.uMist.value += ((t4 ? 1 : isl.mist) - u.uMist.value) * kk;
    H.group.position.y += ((t4 ? -7 : 0) - H.group.position.y) * Math.min(1, dt * 1.5);
    const bs = 0.26 + 0.74 * isl.bodhi, tg = H.tree.group, jy = this.joy || 0; this.treeS = (this.treeS || tg.scale.x) + (bs - (this.treeS || tg.scale.x)) * kk; tg.scale.setScalar(this.treeS * (1 + 0.06 * jy)); H.tree.leaves.count = Math.max(30, Math.floor(H.tree.count * Math.min(1, 0.12 + isl.bodhi + 0.12 * jy)));   // công đức vừa thấm: cây vươn lên, lá sum xuê hơn
    // hạt công đức vàng bay lên khắp đảo (nhiều dần theo tiến trình, rộ lên lúc hồi hướng), ánh lấp lánh tán Bồ-đề và mặt hồ: một hệ Points
    H.motes.material.uniforms.uK.value.set((0.3 + 0.7 * isl.bodhi) * (1 + v.merit), (isl.tier >= 2 ? 1 : 0.6 * isl.gold) * (0.6 + 0.4 * Math.sin(this.time * 2)) + 1.3 * jy, isl.water > 0.3 ? isl.water * (1 - 0.3 * v.night) : 0, tg.scale.x);
    H.setLotus(isl.lotus, isl.goldCount);
    H.water.uniforms.uClar.value = isl.clarity; H.water.uniforms.uWater.value = isl.water; H.evolve(isl.lv === undefined ? 1 : isl.lv, isl, this.time); this._birds(dt);
    H.tea.visible = isl.tea; DECKS[1].on = !!isl.tea; H.veil.scale.setScalar(Math.max(0.001, 1 - isl.gate * (isl.open ? 1 : 0.35)));
    const lux = isl.tier >= 3, pm = H.pv.mats;
    pm.roof.color.set(lux ? '#e4eef8' : '#55606b'); pm.roof.emissive.set(lux ? '#9fc7ea' : '#000000'); pm.roof.emissiveIntensity = lux ? 1.1 : 0;
    pm.wood.color.set(lux ? '#f2f6fb' : '#7a3b28'); pm.wood.emissive.set(lux ? '#bcd9f2' : '#000000'); pm.wood.emissiveIntensity = lux ? 0.9 : 0;
    this.homeLbMat.opacity = lux ? 0.5 + 0.2 * Math.sin(this.time) : 0; this.lbMat.opacity = 0.45 + 0.15 * Math.sin(this.time * 0.7);
    H.steleMat.opacity = 0.7 + 0.3 * Math.sin(this.time * 1.5); H.pv.altar.material.emissiveIntensity = 1.6 + 0.5 * Math.sin(this.time * 1.1);
    this.ring.material.opacity = Math.max(0, this.ring.material.opacity - dt * 0.7); this.ring.scale.setScalar(1 + (0.9 - this.ring.material.opacity) * 1.2);
    this._friendStep(dt, s.breath);

    this._meritStep(dt);
    // vật liệu cộng sáng đang tắt (độ mờ 0) thì bỏ hẳn lượt vẽ: các cột sáng tốn tô điểm ảnh dù không thấy
    [this.pillarMat, this.filaMat, this.homeLbMat, this.ring.material].forEach((m) => { m.visible = m.opacity > 0.003; });
    if (document.hidden || this.hold) return;   // tab ẩn, hoặc đang chờ shader của mức chất lượng mới: không vẽ
    const r = this.renderer, inf = r.info; inf.reset();
    // bóng đổ chỉ phủ Vân Đảo: vẽ lại khi máy quay ở gần đảo (hoặc vài khung đầu / sau khi đổi mức), còn lại dùng bản đồ bóng sẵn có
    if (home || this.shDirty > 0) { r.shadowMap.needsUpdate = true; this.shDirty--; }
    if (q >= 1 && this.rt) { this.bloom.k = 0.2 + 0.16 * v.night; r.setRenderTarget(this.rt); r.render(this.scene, this.camera); this.bloom.render(r, this.rt); r.setRenderTarget(null); this.out.render(r); }
    else r.render(this.scene, this.camera);
    this._perfTick(inf);
  }

  // Đo hiệu năng: mỗi 10 giây phát sự kiện `vandao:perf` {fps, ms, calls, triangles, quality, dpr} cho lớp số liệu lắng nghe (net/metrics.js).
  // Không gửi gì ra mạng từ đây; world.perf() trả số liệu khung hình gần nhất để kiểm thử và gỡ lỗi.
  _perfTick(inf) {
    const P = this.pf, now = performance.now(); P.calls = inf.render.calls; P.tris = inf.render.triangles;
    if (!P.t0) P.t0 = now; P.n++;
    if (now - P.t0 >= 10000) { const fps = (P.n * 1000) / (now - P.t0); P.last = { fps: Math.round(fps * 10) / 10, ms: Math.round(10000 / fps) / 10 }; P.t0 = now; P.n = 0;
      try { window.dispatchEvent(new CustomEvent('vandao:perf', { detail: this.perf() })); } catch (e) { void e; } }
  }
  perf() {
    const inf = this.renderer.info, L = this.pf.last, crowd = (c) => (c ? c.userData.lodStats() : null);
    return { fps: L ? L.fps : null, ms: L ? L.ms : null, calls: this.pf.calls, triangles: this.pf.tris, quality: this.quality, res: this.res, dpr: this.renderer.getPixelRatio(), mode: this.mode,
      geometries: inf.memory.geometries, textures: inf.memory.textures, programs: inf.programs ? inf.programs.length : 0, crowd: { hall: crowd(this.hallCrowd), tier: crowd(this.tierCrowd) }, realm: this.realm ? this.realm.stats() : null,
      backend: this.gfx.use, webgpuAsked: this.gfx.ask, saver: !!this.saver };
  }

  _avatarStep(dt, s) {
    const A = this.av, g = this.fig.group, io = this.home.group.position.y;
    const turn = (to, rate = 6) => { let d = to - A.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); A.rot += d * Math.min(1, dt * rate); };
    this._steer(); const px = A.pos.x, py = A.pos.y, pz = A.pos.z;
    if (A.state === 'walk') {
      const to = A.path[0], d = V(to.x - A.pos.x, 0, to.z - A.pos.z), L = d.length(), last = A.path.length === 1;
      A.speed += ((last && L < 2.2 ? 1.2 : 3.3) - A.speed) * Math.min(1, dt * 4); const step = A.speed * dt;
      if (L <= step + 0.05) { A.path.shift();
        if (!A.path.length) { A.state = 'idle'; A.speed = 0;
          if (A.sit) { A.state = 'sit'; this.fig.setPose('sit'); A.pos.y = floorH(A.pos.x, A.pos.z) + seatOf(A.an); A.rotTo = A.an && A.an.face !== undefined ? A.an.face : Math.PI; }
          else if (A.an && A.an.face !== undefined && A.id) A.rotTo = A.an.face;
          if (this.follow) { const f2 = this.follow; this.follow = null; if (f2.zone && ANCHORS[f2.zone]) { const c = ANCHORS[f2.zone].cam; this.flyTo(V(c[0][0], c[0][1] + io, c[0][2]), V(c[1][0], c[1][1] + io, c[1][2]), 48, 1.6); } }
          if (A.done) { const f = A.done; A.done = null; f(A.id); } } }
      else if (A.steer && this._blocked(A.pos.x + (d.x / L) * step, A.pos.z + (d.z / L) * step)) A.speed = 0;   // đi bằng phím: không bước vào chỗ cấm dù chỉ một khung hình
      else { d.normalize(); A.pos.x += d.x * step; A.pos.z += d.z * step; A.phase += dt * A.speed * 1.5; turn(Math.atan2(d.x, d.z)); }
      if (A.state !== 'sit') { const fy = floorH(A.pos.x, A.pos.z); A.pos.y += (fy - A.pos.y) * Math.min(1, dt * 14); }
      if (this.follow && A.state === 'walk' && !this.tween) { const tg = V(A.pos.x, A.pos.y + io + 2.1, A.pos.z), off = this.follow.off, k1 = 1 - Math.exp(-dt * 5), k2 = 1 - Math.exp(-dt * 2.6);
        this.controls.target.lerp(tg, k1); this.camera.position.lerp(V(tg.x + off.x, tg.y + off.y, tg.z + off.z), k2); }
      // đi bằng phím hoặc bấm khi đang nhìn gần: máy quay trượt theo đúng quãng nhân vật vừa đi, giữ nguyên góc và độ zoom người dùng đã chọn
      else if (A.track && !this.tween) { const d = V(A.pos.x - px, A.pos.y - py, A.pos.z - pz); this.controls.target.add(d); this.camera.position.add(d); }
    } else if (A.state === 'travel') this._tripStep(dt, turn, io);
    else {
      if (A.restoreSit) { A.restoreSit = false; this.fig.setPose('sit'); }
      if (A.state === 'sit' && A.an && A.where === 'home') A.pos.y = floorH(A.pos.x, A.pos.z) + seatOf(A.an);
      if (A.rotTo !== undefined) { turn(A.rotTo, 5); if (Math.abs(Math.atan2(Math.sin(A.rotTo - A.rot), Math.cos(A.rotTo - A.rot))) < 0.01) A.rotTo = undefined; }
      if (A.hold > 0) { A.hold -= dt; if (A.hold <= 0) { if (this.fig.pose === 'anjali' && this.mode !== 'creator') this.fig.setPose('stand'); if (A.after) { const f = A.after; A.after = null; f(); } } }
      if (this.fig.pose !== 'sit') { A.blink -= dt; if (A.blink < 0) { this.fig.eyes(A.blink > -0.13); if (A.blink < -0.13) { this.fig.eyes(false); A.blink = 2.5 + this.rnd() * 3.5; } } }
    }
    const base = this.look.height ? 1.9 * this.look.height : 1.9, wk = A.state === 'walk' || (A.trip && A.trip.walking), bob = wk ? 0.045 * Math.abs(Math.sin(A.phase)) : 0;
    g.position.set(A.pos.x, A.pos.y + bob + (A.where === 'home' ? io : 0), A.pos.z); g.rotation.y = A.rot; g.rotation.z = wk ? 0.018 * Math.sin(A.phase) : 0;
    g.scale.set(base, base * (1 + 0.012 * s.breath * (this.fig.pose === 'sit' ? 1 : 0.5)), base);
    { const K = this.aura.material.uniforms.uK, k = A.state === 'sit' && A.where === 'home' ? 0.5 + 0.35 * s.breath : 0; K.value += (k - K.value) * Math.min(1, dt * 2); this.aura.visible = K.value > 0.01; this.aura.position.set(A.pos.x, A.pos.y + 0.04, A.pos.z); }
    this.fig.walk(A.phase, A.state === 'walk' ? Math.min(1, A.speed / 3.3) : wk ? 0.7 : 0);   // kinh hành: gấu áo đưa theo từng bước
    if (this.mode === 'creator' && !this.tween) { const t = V(A.pos.x, g.position.y + (this.fig.pose === 'sit' ? (this.portrait ? 1.8 : 1) : this.portrait ? 2.5 : 1.6), A.pos.z); this.controls.target.lerp(t, Math.min(1, dt * 4)); }
  }
}

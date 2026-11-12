// Nguồn sự thật duy nhất cho âm thanh, cảnh và radar: kịch bản 15 phút (900 giây).
export const DUR = 900;

export const STAGES = [
  { id: 's1', t0: 0, t1: 120, name: 'Quy tụ & Xả ly', pali: 'Pubba-kicca', level: 0.85, beat: 12.0, az: 0, el: 0,
    radar: 'Phương Đông · trực diện Tôn tượng', sound: 'Đại Hồng Chung · hòa âm Sarabhañña' },
  { id: 's2', t0: 120, t1: 300, name: 'Niệm hơi thở mây', pali: 'Parikamma-bhāvanā', level: 0.70, beat: 9.0, az: 180, el: -30,
    radar: 'Vòm đáy Vân Tọa · −30°', sound: 'Lụa hơi thở 4 giây hít – 6 giây thở' },
  { id: 's3a', t0: 300, t1: 420, name: 'Lắng dịu phóng dật', pali: 'Uddhacca · Passaddhi', level: 0.62, beat: 7.5, az: 0, el: -45,
    radar: 'Đáy Vân Tọa · −45°', sound: 'Âm trầm trái đất 136,1 Hz' },
  { id: 's3b', t0: 420, t1: 570, name: 'Cận định & Thánh im lặng', pali: 'Ariya-tuṇhībhāva', level: 0.25, beat: 5.5, az: 0, el: 0,
    radar: 'Tâm điểm tĩnh lặng', sound: 'Trừ giảm thính giác · nền Tịnh Thủy' },
  { id: 's3c', t0: 570, t1: 660, name: 'Tưởng ánh sáng', pali: 'Āloka-saññā · AN 7.61', level: 0.58, beat: 10.5, az: 0, el: 60,
    radar: 'Đỉnh đầu · +60°', sound: 'Chuông ngọc tinh khiết' },
  { id: 's4', t0: 660, t1: 810, name: 'Lan tỏa tâm từ toàn cõi', pali: 'Sabbadisā mettā', level: 0.80, beat: 8.5, az: null, el: 0,
    radar: 'Quỹ đạo xoay 360°', sound: 'Chuông xoay pha lê 528 Hz · hòa âm Tăng-già' },
  { id: 's5', t0: 810, t1: 900, name: 'Xuất thiền & Hồi hướng', pali: 'Vuṭṭhāna · Pattidāna', level: 0.80, beat: 13.5, az: 0, el: 0,
    radar: 'Phương Đông & toàn cõi', sound: 'Ba tiếng chuông Thanh Lưu · Sādhu' },
];

export const PAD_FREQS = [108, 136.1, 162, 204.15, 216, 264, 272.2, 324, 396, 408.3, 432, 528, 648];

// Trọng số hòa âm theo giai đoạn (đều có dải trung để loa nhỏ vẫn nghe rõ).
const CHORDS = {
  s1: { 108: 0.34, 162: 0.26, 216: 0.30, 324: 0.16, 432: 0.06 },
  s2: { 162: 0.28, 216: 0.34, 324: 0.24, 432: 0.14 },
  s3a: { 136.1: 0.40, 204.15: 0.28, 272.2: 0.22, 408.3: 0.10 },
  s3b: { 136.1: 0.46, 272.2: 0.34, 408.3: 0.20 },
  s3c: { 136.1: 0.34, 272.2: 0.30, 408.3: 0.16, 432: 0.20 },
  s4: { 264: 0.36, 396: 0.30, 528: 0.22, 216: 0.12 },
  s5: { 108: 0.18, 216: 0.34, 324: 0.26, 432: 0.16, 648: 0.06 },
};

export const levelGain = (L) => 0.55 * Math.pow(L, 1.4);

const XF = 10; // giây chuyển mượt giữa hai giai đoạn

// Tạo đường điều khiển theo giai đoạn: [[t, v], ...]
function stageTrack(vals, { fadeIn = 0, fadeOut = 0 } = {}) {
  const pts = [];
  if (fadeIn > 0) { pts.push([0, 0], [fadeIn, vals[0]]); } else pts.push([0, vals[0]]);
  for (let i = 1; i < STAGES.length; i++) {
    pts.push([STAGES[i].t0, vals[i - 1]], [STAGES[i].t0 + XF, vals[i]]);
  }
  if (fadeOut > 0) { pts.push([DUR - fadeOut, vals[vals.length - 1]], [DUR, 0]); } else pts.push([DUR, vals[vals.length - 1]]);
  return pts;
}

export function valueAt(pts, t) {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [a, va] = pts[i - 1], [b, vb] = pts[i];
      return b === a ? vb : va + (vb - va) * ((t - a) / (b - a));
    }
  }
  return pts[pts.length - 1][1];
}

export function buildTracks() {
  const tr = {};
  // Âm thanh
  PAD_FREQS.forEach((f) => {
    tr['pad' + f] = stageTrack(STAGES.map((s) => (CHORDS[s.id][f] || 0) * levelGain(s.level)), { fadeIn: 4, fadeOut: 8 });
  });
  tr.breathDepth = stageTrack([0.14, 0.5, 0.3, 0.14, 0.2, 0.24, 0.14]);
  tr.beat = stageTrack(STAGES.map((s) => s.beat));
  tr.lowpass = stageTrack([5000, 1100, 700, 1400, 6000, 5000, 5000]);
  tr.orbit = stageTrack([0, 0.12, 0, 0, 0.1, 0.7, 0.25]);
  // Cảnh (0..1)
  tr.vBreath = stageTrack([0.25, 1, 0.6, 0.2, 0.3, 0.5, 0.3]);
  tr.vAmber = stageTrack([0, 0, 1, 0, 0, 0, 0]);
  tr.vNight = stageTrack([0, 0, 0.15, 1, 0.55, 0.1, 0]);
  tr.vBeams = stageTrack([0, 0, 0, 0, 1, 0.15, 0]);
  tr.vFila = stageTrack([0, 0, 0, 0, 0, 1, 0.35]);
  tr.vCalm = stageTrack([0.2, 0.4, 0.6, 1, 0.8, 0.5, 0.3]);
  tr.vHaloWhite = stageTrack([0, 0, 0, 1, 0.6, 0, 0]);
  tr.vRainbow = stageTrack([0.5, 0.35, 0.2, 0.05, 0.3, 1, 0.8]);
  tr.vJade = stageTrack([0, 1, 0.2, 0, 0, 0, 0]);
  tr.vLevel = stageTrack(STAGES.map((s) => s.level), { fadeIn: 4, fadeOut: 8 });
  tr.vMerit = [[0, 0], [812, 0], [888, 1], [900, 1]];
  return tr;
}

export const BELLS = {
  hong: { name: 'Đại Hồng Chung', dur: 14, tau: 3.2, att: 0.16, parts: [[108, 0.45], [216, 0.55], [324, 0.40], [432, 0.30], [648, 0.12]] },
  xoay: { name: 'Chuông xoay 432', dur: 9, tau: 2.4, att: 0.18, parts: [[432, 1], [864, 0.3], [1296, 0.1]] },
  ngoc: { name: 'Chuông ngọc', dur: 7, tau: 1.8, att: 0.15, parts: [[432, 0.5], [648, 0.6], [864, 0.5], [1296, 0.15]] },
  phale: { name: 'Chuông pha lê 528', dur: 10, tau: 2.8, att: 0.18, parts: [[528, 1], [792, 0.28], [1056, 0.25], [1584, 0.08]] },
  thanhluu: { name: 'Chuông Thanh Lưu', dur: 12, tau: 3.0, att: 0.16, parts: [[216, 0.5], [432, 0.6], [648, 0.45], [864, 0.15]] },
  sadhu: { name: 'Sādhu', dur: 9, tau: 4.0, att: 2.0, wide: true, parts: [[216, 0.5], [324, 0.45], [432, 0.4], [648, 0.12]] },
  tinh: { name: 'Chuông tỉnh giác', dur: 4.5, tau: 1.2, att: 0.3, parts: [[1024, 0.6], [2048, 0.45]] },
};

export function buildEvents() {
  const ev = [];
  [3, 38, 75].forEach((t) => ev.push({ t, type: 'hong', az: 0, el: 0, gain: 0.46, wave: true }));
  for (let i = 0; i < 6; i++) ev.push({ t: 135 + i * 30, type: 'xoay', az: (i * 60) % 360, el: -12, gain: 0.2 });
  for (let i = 0; i < 6; i++) ev.push({ t: 575 + i * 15, type: 'ngoc', az: (i * 72 + 20) % 360, el: 60, gain: 0.24 });
  for (let i = 0; i < 8; i++) ev.push({ t: 664 + i * 18, type: 'phale', az: (i * 45) % 360, el: 5, gain: 0.28 });
  [815, 845, 875].forEach((t) => {
    ev.push({ t, type: 'thanhluu', az: 0, el: 0, gain: 0.44, wave: true });
    ev.push({ t: t + 4, type: 'sadhu', az: 0, el: 0, gain: 0.26 });
  });
  return ev.sort((a, b) => a.t - b.t);
}

// Đường bao hơi thở: 4 giây hít, 6 giây thở (0..1)
export function breathEnv(t) {
  const p = ((t % 10) + 10) % 10;
  return p < 4 ? 0.5 * (1 - Math.cos((Math.PI * p) / 4)) : 0.5 * (1 + Math.cos((Math.PI * (p - 4)) / 6));
}

export function stageAt(t) {
  for (let i = STAGES.length - 1; i >= 0; i--) if (t >= STAGES[i].t0) return i;
  return 0;
}

// ───────── Hành trình: Giai đoạn 0 + 4 tầng (theo tài liệu dự án) ─────────
export const TIERS = [
  { key: 0, name: 'Giai đoạn 0 · Sơ nhập Tịnh Cảnh', pali: 'Kalyāṇa-puthujjana', base: 'Giới tịnh và Chánh kiến nhân quả; nhận diện thiện – bất thiện trong ngày.',
    tasks: 'Niệm hơi thở 10 phút/ngày · giữ ngũ giới và 1 việc thiện nhỏ · nhật ký quán chiếu cuối ngày.',
    space: 'Vân Đảo tối giản đủ 6 phân khu; sương còn dày, Bồ-đề còn là cây non; ngồi vòng ngoài Đại Thiền Đường.' },
  { key: 1, name: 'Tầng 1 · Nhập Lưu Tịnh Cảnh', pali: 'biểu trưng Sotāpatti', base: 'Kiến tịnh và Độ nghi tịnh: hướng đến tháo gỡ thân kiến, hoài nghi, giới cấm thủ.',
    tasks: '49 ngày liên tục giới và thiền · đối chiếu Nhân – Duyên – Quả trong đời sống · dẫn dắt ít nhất 3 người sơ nhập.',
    space: 'Cổng Vân Môn mở đôi, sương tan, Suối Pháp lưu chảy quanh vườn; thăm đảo bạn và mời bạn về tịnh thất pháp đàm.' },
  { key: 2, name: 'Tầng 2 · Nhất Lai Thanh Lương', pali: 'biểu trưng Sakadāgāmī', base: 'Đạo phi đạo tri kiến tịnh: nhận diện nhanh tham và sân vừa khởi để buông xả.',
    tasks: 'Bình thản trước 8 ngọn gió đời qua nhật ký phản tỉnh · khởi xướng việc thiện nguyện cùng nhóm.',
    space: 'Trời quanh đảo sang sắc lam ngọc và vàng kim; Bồ-đề nở hoa sen ánh sáng; quyền lập nhóm đồng tu và mục tiêu chung.' },
  { key: 3, name: 'Tầng 3 · Bất Lai Tịnh Quang', pali: 'biểu trưng Anāgāmī', base: 'Hành đạo tri kiến tịnh: an trú Từ – Bi – Hỷ – Xả, định lực sâu lắng.',
    tasks: 'Thiền từ và thiền quán mỗi ngày · điều phối, giải đáp và sách tấn các nhóm sơ nhập.',
    space: 'Tịnh thất gỗ mộc hóa Bạch Ngọc Lưu Ly Điện; Cầu Ánh Sáng nối tới các đạo tràng để hộ trì đồng môn.' },
  { key: 4, name: 'Tầng 4 · Vô Học Vô Biên', pali: 'biểu trưng Arahatta', base: 'Tri kiến tịnh: buông chấp thủ và ngã mạn; phụng sự với tâm vô sở cầu.',
    tasks: 'Chánh niệm liên tục trong mọi oai nghi · đóng góp trí tuệ, công sức cho việc phụng sự mà không cầu danh lợi.',
    space: 'Ranh giới Vân Đảo tan vào biển mây; Vân Tọa tiến gần hào quang; trở thành bậc hộ pháp ẩn danh.' },
];

// ───────── Sáu phân khu Vân Đảo ─────────
export const ZONES = [
  { id: 'kuti', name: 'Tịnh Thất', pali: 'Kuṭi', unlock: 1,
    text: 'Nhà gỗ hai tầng mở bốn phía trên ngọn đồi. Bên trong là Kinh Đài Ánh Sáng: nơi tra cứu Tam tạng ba tầng, đọc pháp ngắn mỗi sáng và viết nhật ký quán tâm.',
    note: 'Kinh Đài AI cần máy chủ GraphRAG; bản dựng thử này chưa nối máy chủ.' },
  { id: 'pad', name: 'Đài Thiền', pali: 'Padhāna-maṇḍapa', unlock: 1,
    text: 'Phiến đá phủ cỏ vươn ra biển mây. Ngồi xuống đây để bắt đầu thời thiền; âm thanh không gian và nhịp thở ánh sáng sẽ khởi động.', action: 'sit' },
  { id: 'garden', name: 'Vườn Tâm Thức', pali: 'Bodhi-uyyāna', unlock: 1,
    text: 'Cây Bồ-đề Tâm và Hồ Sen Tịnh Thủy là tấm gương công phu. Không ai mua được cây hay sen bằng tiền: cây lớn và sen nở chỉ khi hoàn thành Đức – Thiện – Tuệ.' },
  { id: 'tea', name: 'Trà Đạo Tỉnh Thức', pali: 'Sati-pavilion', unlock: 15,
    text: 'Bàn trà đá dưới tán tùng mây: pha trà, ngắm mây, nghe pháp âm, và là nơi tiếp bạn đồng tu ghé thăm để pháp đàm.' },
  { id: 'gate', name: 'Cổng Vân Môn', pali: 'Megha-dvāra', unlock: 29,
    text: 'Cổng vòm mây ở rìa đảo nối với Vân Đảo của đồng môn. Hai chế độ: Độc cư (khép cổng, chuyên tâm) và Nghênh khách (mở cổng đón bạn).', action: 'gate' },
  { id: 'stele', name: 'Bia Tích Lũy', pali: 'Puñña-pāramī', unlock: 1,
    text: 'Bia ánh sáng hiển thị nhiệm vụ mỗi ngày và ba dòng tích lũy: Đức Độ, Thiện Nghiệp, Định Tuệ.', action: 'board' },
];

// ───────── Chuỗi 49 ngày: 7 tuần × 3 trục ─────────
export const WEEKS = [
  { title: 'An trú hơi thở & tịnh hóa thân nghiệp',
    duc: ['Không làm tổn hại (Avihiṃsā)', 'Đi đứng nhẹ nhàng, không sát hại côn trùng, tiết kiệm điện nước, ăn uống có chánh niệm.'],
    thien: ['Bố thí sự hiện diện', 'Dành 15 phút lắng nghe người thân: không cầm điện thoại, không ngắt lời.'],
    tue: ['Thiết lập niệm hơi thở', 'Ngồi tại Đài Thiền 10 phút sáng hoặc tối; đọc một bài pháp ngắn về nhân quả.'],
    reward: 'Sương quanh đảo tan dần; Hồ Sen bắt đầu tích nước; mầm Bồ-đề nhú lên.' },
  { title: 'Tịnh hóa khẩu nghiệp: chân thật & ái ngữ',
    duc: ['Chân ngữ & hòa ngữ', 'Không nói dối, không lời châm chích trên mạng. Khi bực bội, dừng 3 hơi thở trước khi gửi tin nhắn.'],
    thien: ['Bố thí lời lành', 'Mỗi ngày nói hoặc nhắn một lời tri ân, khích lệ chân thành cho người đang gặp áp lực.'],
    tue: ['Quán thọ', 'Thiền 15 phút; quan sát cảm giác dễ chịu, khó chịu khi nghe lời khen chê trong ngày.'],
    reward: 'Nước Hồ Sen sáng màu ngọc bích; chuông gió chánh niệm hiện bên hiên Tịnh Thất.' },
  { title: 'Hộ trì ngũ giới & hạnh tri túc',
    duc: ['Trọn vẹn ngũ giới', 'Giữ trọn 5 giới; thực hành tri túc: kiềm một ham muốn mua sắm hoặc giảm thời gian lướt mạng.'],
    thien: ['San sẻ vật chất', 'Trích phần tiết kiệm trong tuần để giúp một hoàn cảnh khó khăn hoặc góp một suất ăn từ thiện.'],
    tue: ['Tham dự Đại Thiền Đường', 'Lần đầu ngồi Vân Tọa cùng đại chúng; tìm hiểu khác biệt giữa phước thế gian và ba-la-mật.'],
    reward: 'Cây Bồ-đề vươn ba tầng tán; mở khu Trà Đạo Tỉnh Thức.' },
  { title: 'Tâm xả tài & bố thí vô cầu',
    duc: ['Thanh tịnh chánh mạng', 'Rà soát công việc hằng ngày: minh bạch trong giao dịch, không nhận lợi ích bất chính.'],
    thien: ['Phụng sự vô danh', 'Làm một việc thiện ở nơi công cộng hoặc cơ quan mà không kể cho bất kỳ ai biết.'],
    tue: ['Quán tâm', 'Thiền 20 phút; xem lại tâm trước, trong và sau khi làm việc thiện để gột tâm mong cầu khen ngợi.'],
    reward: 'Hồ Sen nở bảy đóa sen vàng; hạt sáng công đức bắt đầu xoay quanh Tịnh Thất.' },
  { title: 'Cung kính khiêm hạ & hộ trì đồng môn',
    duc: ['Đoạn giảm ngã mạn', 'Chủ động chào trước, nhường đường khi tham gia giao thông, lắng nghe ý kiến trái chiều mà không tự ái.'],
    thien: ['Phụng sự cộng đồng', 'Tham gia một việc thiện nguyện thực tế; gửi lời khích lệ cho 3 người sơ nhập mới.'],
    tue: ['Thiền tâm từ', 'Sau 15 phút niệm hơi thở, dành 5 phút rải tâm từ đến gia đình, người trung dung và người từng làm mình bất như ý.'],
    reward: 'Cổng Vân Môn mở một nửa; có thể lên Du Vân sang thăm đảo bạn đồng tu.' },
  { title: 'Nhẫn nại trước tám ngọn gió đời',
    duc: ['Hạnh nhẫn nhục', 'Khi gặp chuyện trái ý, giữ giới không nổi giận quát tháo; chỉ ghi nhận: "đang có tâm sân".'],
    thien: ['Vô úy thí', 'Tha thứ thật lòng cho một người từng có lỗi với mình; đem sự an tâm đến người và vật xung quanh.'],
    tue: ['Quán pháp: tam tướng', 'Thiền 25–30 phút; quán vô thường, khổ, vô ngã của mọi biến cố trong tuần.'],
    reward: 'Bầu trời quanh đảo sang sắc Thanh Lương Tịnh Quang; Tịnh Thất hiện những đường vân sáng.' },
  { title: 'Chánh kiến viên mãn & khai mở cổng Nhập Lưu',
    duc: ['Bát quan trai giới', 'Thử thách một ngày cuối tuần (hoặc ngày rằm, mồng một) giữ 8 giới thanh tịnh ngay tại gia đình.'],
    thien: ['Hồi hướng & tùy hỷ', 'Chia sẻ giá trị Chánh pháp cho người hữu duyên; hoan hỷ trước thành tựu và việc thiện của người khác.'],
    tue: ['Tổng kết 49 ngày', 'Thời thiền trọn vẹn tại Đại Thiền Đường; tự vấn đáp chánh kiến về thân kiến, hoài nghi, giới cấm thủ.'],
    reward: 'Cổng Vân Môn mở hoàn toàn, Suối Pháp lưu chảy quanh đảo: bước lên Tầng 1.' },
];

export const PILLARS = [
  { key: 'duc', name: 'Đức', sub: 'Sīla · giữ giới', color: '#5aa79a' },
  { key: 'thien', name: 'Thiện', sub: 'Dāna · phụng sự', color: '#c79a3b' },
  { key: 'tue', name: 'Tuệ', sub: 'Bhāvanā · thiền và chánh kiến', color: '#6f7fc4' },
];

// Công thức tích lũy theo tài liệu: E = B × (trước + trong + sau)/3 × M_trí × M_tự giác
export function kusala({ base = 10, pre = 1, during = 1, post = 1, wise = false, self = false }) {
  return Math.round(base * ((pre + during + post) / 3) * (wise ? 1.5 : 1) * (self ? 1.25 : 1) * 100) / 100;
}

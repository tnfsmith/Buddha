// Tịnh danh: 4 quy tắc (2–3 chữ ≤ 16 ký tự · chữ cái tiếng Việt · có chữ mang nghĩa tu tập · không tự xưng quả vị/giáo phẩm).
// Chuyển nguyên văn từ apps/web/src/people.js để client và máy chủ dùng chung một mã.
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

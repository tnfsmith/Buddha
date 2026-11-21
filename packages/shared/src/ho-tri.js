/** Hợp đồng Bảng Hộ Trì #191. Worker kiểm lại đầu vào trước khi kiểm duyệt nội dung. */
export const HO_TRI_V = 1;
export const HELP_KINDS = Object.freeze({
  can_giup: 'Cần giúp',
  co_the_giup: 'Có thể giúp',
  hoi_phap: 'Hỏi Pháp',
  tuy_hy: 'Tùy hỷ',
});
export const HELP_LIMITS = Object.freeze({ titleMin: 5, titleMax: 80, bodyMax: 1000, replyMax: 600 });

// Mã cấp tỉnh theo Quyết định 19/2025/QĐ-TTg. Giữ tiền tố vn_ trong wire.
export const HELP_AREAS = Object.freeze({
  truc_tuyen: 'Trực tuyến',
  vn_01: 'Hà Nội',
  vn_04: 'Cao Bằng',
  vn_08: 'Tuyên Quang',
  vn_11: 'Điện Biên',
  vn_12: 'Lai Châu',
  vn_14: 'Sơn La',
  vn_15: 'Lào Cai',
  vn_19: 'Thái Nguyên',
  vn_20: 'Lạng Sơn',
  vn_22: 'Quảng Ninh',
  vn_24: 'Bắc Ninh',
  vn_25: 'Phú Thọ',
  vn_31: 'Hải Phòng',
  vn_33: 'Hưng Yên',
  vn_37: 'Ninh Bình',
  vn_38: 'Thanh Hóa',
  vn_40: 'Nghệ An',
  vn_42: 'Hà Tĩnh',
  vn_44: 'Quảng Trị',
  vn_46: 'Huế',
  vn_48: 'Đà Nẵng',
  vn_51: 'Quảng Ngãi',
  vn_52: 'Gia Lai',
  vn_56: 'Khánh Hòa',
  vn_66: 'Đắk Lắk',
  vn_68: 'Lâm Đồng',
  vn_75: 'Đồng Nai',
  vn_79: 'Hồ Chí Minh',
  vn_80: 'Tây Ninh',
  vn_82: 'Đồng Tháp',
  vn_86: 'Vĩnh Long',
  vn_91: 'An Giang',
  vn_92: 'Cần Thơ',
  vn_96: 'Cà Mau',
});

export const HO_TRI_REASON_TEXT = Object.freeze({
  invalid_payload: 'Dữ liệu gửi chưa hợp lệ.',
  invalid_kind: 'Chọn một loại bài Hộ Trì.',
  invalid_area: 'Chọn một tỉnh, thành phố hoặc Trực tuyến.',
  invalid_title: 'Tiêu đề cần từ 5 đến 80 ký tự.',
  invalid_body: 'Nội dung cần có từ 1 đến 1.000 ký tự.',
  invalid_reply: 'Lời trả lời cần có từ 1 đến 600 ký tự.',
  need_adult_confirmation: 'Hãy xác nhận đủ 18 tuổi và đồng ý điều khoản cộng đồng.',
  terms_changed: 'Điều khoản cộng đồng đã đổi. Hãy đọc và xác nhận lại.',
  need_gate: 'Bảng Hộ Trì mở khi Cổng Vân Môn mở nửa.',
  moderation_unavailable: 'Chưa thể sàng lọc nội dung. Hãy thử lại sau.',
  has_phone: 'Hãy bỏ số điện thoại khỏi nội dung.',
  has_address: 'Chỉ ghi khu vực đến tỉnh hoặc thành phố.',
  asks_money: 'Hãy bỏ lời kêu gọi tiền hoặc hiện vật cá nhân.',
  content_hidden: 'Nội dung đã ẩn theo quy tắc cộng đồng.',
  source_required: 'Lời trả lời Hỏi Pháp cần có nguồn tham khảo.',
  not_found: 'Không tìm thấy nội dung này.',
  help_closed: 'Bài này đã đóng hoặc hết hạn.',
  match_conflict: 'Đề nghị đã đổi trạng thái. Hãy tải lại.',
  event_full: 'Sự kiện đã đủ chỗ.',
  event_closed: 'Sự kiện đã đóng hoặc bị hủy.',
});

const postKeys = new Set(['kind', 'title', 'body', 'area', 'anonymous']);
const known = (dictionary, key) => typeof key === 'string' && Object.hasOwn(dictionary, key);
const text = (value) => typeof value === 'string' ? value.normalize('NFC').trim() : '';
const length = (value) => [...value].length;

/** Kiểm hình dạng, không phân loại nội dung. Kết quả dùng được từ form và Worker. */
export function checkHelpPost(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some((key) => !postKeys.has(key))
      || (input.anonymous !== undefined && typeof input.anonymous !== 'boolean')) {
    return { ok: false, code: 'invalid_payload' };
  }
  const { kind, area = null, anonymous = false } = input;
  if (!known(HELP_KINDS, kind)) return { ok: false, code: 'invalid_kind' };
  if (area !== null && !known(HELP_AREAS, area)) return { ok: false, code: 'invalid_area' };
  const title = text(input.title), body = text(input.body);
  const titleLength = length(title);
  if (titleLength < HELP_LIMITS.titleMin || titleLength > HELP_LIMITS.titleMax || title.includes('\0')) {
    return { ok: false, code: 'invalid_title' };
  }
  if (length(body) < 1 || length(body) > HELP_LIMITS.bodyMax || body.includes('\0')) {
    return { ok: false, code: 'invalid_body' };
  }
  return { ok: true, post: { kind, title, body, area, anonymous } };
}

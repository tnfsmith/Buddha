// Bạn đồng tu (#121, PROJECT_ROADMAP.md §10.4, docs/contracts/ban-dong-tu.md): luật dùng chung máy khách và máy chủ.
// Chỉ kết nối người đã biết nhau ngoài đời: qua liên kết/mã mời hoặc đúng «Tịnh danh · mã»; không danh bạ công khai, không vị trí GPS,
// không chữ tự do (chỉ lời mẫu). Không điểm, không xếp hạng, không huy hiệu (AGENTS.md mục 1).
// Hàm thuần: máy chủ dùng để kiểm, máy khách dùng để hiện đúng nút và lý do.
import { ZONE_UNLOCK, gateLevel } from './schedule.js';

export const DONG_TU_V = 1;
/** Trạng thái hiện diện máy khách gửi lên; 'vang' (vắng) do máy chủ suy ra khi quá ONLINE_MS không có nhịp */
export const PRESENCE = Object.freeze(['online', 'thien', 'tham', 'tra']);
export const ONLINE_MS = 3 * 60_000;
/** Máy khách gửi nhịp hiện diện khi trang đang hiện: đổi trạng thái thì gửi ngay, không thì 2 phút một lần */
export const HEARTBEAT_MS = 2 * 60_000;
/** Lời mời gặp chờ trả lời tối đa 10 phút; hoạt động cùng giờ bắt đầu sau khi nhận 60 giây để hai bên kịp chuẩn bị */
export const INVITE_TTL_MS = 10 * 60_000;
export const MEET_LEAD_MS = 60_000;
/** Liên kết mời kết bạn: sống 7 ngày, dùng tối đa 5 lần (bảng `invite` của 0004) */
export const LINK_TTL_MS = 7 * 86_400_000;
export const LINK_USES = 5;
/** Giới hạn mềm để giữ đúng tinh thần «bạn quen biết ngoài đời» và ngân sách cảnh 3D */
export const MAX_COMPANIONS = 50;
export const REQUESTS_PER_DAY = 5;
/** Lời kết nối theo «Tịnh danh · mã» chờ tối đa 14 ngày; người gửi chỉ thấy «đã gửi» tới khi bên kia đồng ý hoặc hết hạn (không có tín hiệu từ chối) */
export const REQUEST_TTL_MS = 14 * 86_400_000;
/** Số Vân Đảo bạn đồng tu dựng gần đảo mình (còn lại chỉ hiện trong danh sách): thân thiết trước, rồi quen biết */
export const NEAR_ISLES = Object.freeze({ than: 4, quen: 4 });

export const SESSION_MAX = 6;
export const SESSION_AHEAD_MS = 7 * 86_400_000;
export const SESSION_MIN_LEAD_MS = MEET_LEAD_MS;
export const SESSION_STEP_MS = 5 * 60_000;
export const SESSION_OPEN_MAX = 3;
export const SESSION_REMIND_MS = Object.freeze([600_000, 60_000]);

// `tien_trinh` dùng ngày và trạng thái hoàn thành từ hành trình đã lưu.
export const CHEER_LINES = Object.freeze({
  tuy_hy: 'Tùy hỷ công phu của bạn.',
  cung_giu: 'Mình cùng giữ thời thiền ngày mai nhé.',
  nho_ban: 'Mình nhớ bạn, khi nào rảnh mình cùng ngồi một thời nhé.',
  cam_on: 'Cảm ơn bạn đã cùng tu tập.',
  tien_trinh: null,
});

/**
 * Các kiểu gặp. `host`: bên có Vân Đảo làm nơi gặp ('from' = người mời, 'to' = người nhận); `place` 'dtd' = Đại Thiền Đường (không phải du vân).
 * `min`: số phút của hoạt động cùng giờ (null = không giới hạn, kết thúc khi khách về).
 */
export const MEET_KINDS = Object.freeze(Object.assign(Object.create(null), {
  tham: { host: 'from', synced: false, min: null, label: 'Mời ghé thăm Vân Đảo của mình' },
  xin_tham: { host: 'to', synced: false, min: null, label: 'Xin ghé thăm Vân Đảo của bạn' },
  thien: { host: 'from', synced: true, min: 15, label: 'Mời cùng ngồi thiền' },
  tra: { host: 'from', synced: true, min: 10, label: 'Mời cùng Trà Đạo' },
  tham_quan: { host: 'from', synced: false, min: null, label: 'Mời tham quan Vân Đảo của mình' },
}));
/** Chỉ các khóa định nghĩa ở trên (không nhận khóa kế thừa như `toString`, `constructor`, `__proto__`) */
export const isMeetKind = (k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(MEET_KINDS, k);
/** Lời mẫu (không chữ tự do cho tới khi GĐ5 có kiểm duyệt) */
export const LINES = Object.freeze({
  tham: 'Mời bạn ghé Vân Đảo của mình.',
  xin_tham: 'Mình xin ghé thăm Vân Đảo của bạn.',
  thien: 'Mời bạn cùng ngồi một thời thiền 15 phút.',
  tra: 'Mời bạn cùng thưởng một tuần trà tỉnh thức.',
  tham_quan: 'Mời bạn tham quan Vân Đảo của mình.',
  ok: 'Mình tới ngay.',
  sau: 'Để lúc khác nhé, cảm ơn bạn.',
  dang_thien: 'Mình đang thiền, lát nữa nhé.',
});

const CROCK = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
/** Mã mời 8 ký tự Crockford base32 (không I, L, O, U); `bytes` là 8 byte ngẫu nhiên (crypto.getRandomValues) */
export function makeInviteCode(bytes) {
  if (!bytes || bytes.length < 8) throw new Error('cần 8 byte ngẫu nhiên');
  return Array.from(bytes.slice(0, 8), (b) => CROCK[b & 31]).join('');
}
/** Chuẩn hóa mã người dùng gõ: bỏ cách/gạch, viết hoa, O→0, I/L→1. Trả null nếu không phải mã hợp lệ. */
export function normInviteCode(s) {
  const c = String(s ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(c) ? c : null;
}
export const showInviteCode = (c) => `${c.slice(0, 4)}-${c.slice(4)}`;
export const inviteUrl = (origin, code) => `${String(origin).replace(/\/+$/, '')}/#ban=${code}`;
/** Đọc mã từ địa chỉ: …/#ban=XXXX-XXXX (có thể kèm tham số khác sau &) */
export function inviteFromHash(hash) {
  const m = /(?:^#|&)ban=([^&]+)/.exec(String(hash || ''));
  if (!m) return null;
  try { return normInviteCode(decodeURIComponent(m[1])); } catch { return null; }   // mã hóa URL hỏng → không hợp lệ, không ném lỗi
}

/** «Tuệ Thái · 5696», «Tuệ Thái #5696», «Tuệ Thái 5696» → { tinh_danh, tag }. Chỉ tìm đúng, không gợi ý gần đúng. */
export function parseFriendQuery(q) {
  const s = String(q ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  const m = /^(.{2,40}?)\s*[·#\-–]?\s*(\d{4})$/u.exec(s);
  if (!m) return null;
  const name = m[1].replace(/[\s·#\-–]+$/u, '').trim();
  if (!/^[\p{L} ]{2,16}$/u.test(name)) return null;
  return { tinh_danh: name.split(' ').map((w) => w[0].toLocaleUpperCase('vi') + w.slice(1).toLocaleLowerCase('vi')).join(' '), tag: m[2] };
}

/** Thân thiết khi cả hai cùng chọn; một bên bỏ chọn thì về quen biết. Không có nấc nào tự lên theo số lần gặp. */
export const closenessOf = (meWant, friendWant) => (meWant && friendWant ? 'than' : 'quen');

/** Hiện diện của bạn đồng tu: quá ONLINE_MS không có nhịp thì là 'vang' */
export function presenceOf(row, now) {
  if (!row || !PRESENCE.includes(row.state) || !Number.isFinite(row.updated_at) || now - row.updated_at > ONLINE_MS) return 'vang';
  return row.state;
}
/** Lần cuối thấy, chỉ ở mức thô để giữ riêng tư: 'vua_xong' (< 10 phút) · 'hom_nay' · 'tuan_nay' · 'lau_roi' · null */
export function seenBucket(at, now) {
  if (!Number.isFinite(at)) return null;
  const d = now - at;
  return d < 600_000 ? 'vua_xong' : d < 86_400_000 ? 'hom_nay' : d < 7 * 86_400_000 ? 'tuan_nay' : 'lau_roi';
}
export const PRESENCE_TEXT = Object.freeze({ online: 'Đang ở Vân Đạo', thien: 'Đang tọa thiền', tham: 'Đang thăm đảo bạn', tra: 'Đang thưởng trà', vang: 'Vắng mặt' });
export const SEEN_TEXT = Object.freeze({ vua_xong: 'vừa xong', hom_nay: 'hôm nay', tuan_nay: 'trong tuần', lau_roi: 'đã lâu' });

/** Người này có thể du vân rời đảo (Cổng Vân Môn đã nửa mở, ngày 29) hay đã hoàn thành chương trình */
export const canTravel = (p) => !!p && (p.completed === true || gateLevel(p.day || 0) >= 0.5);
const teaOpen = (p) => !!p && (p.completed === true || (p.day || 0) >= ZONE_UNLOCK.tea);

/**
 * Kiểm một lời mời gặp. `me` là người mời, `friend` là người nhận: { day, completed, open (cổng Nghênh khách) } và với `friend` thêm
 * `presence` đã suy bằng presenceOf ('online' | 'thien' | 'tham' | 'tra' | 'vang').
 * `rel`: { accepted, blocked } — `blocked` chỉ đúng khi chính người mời đã chặn người kia; phía bị chặn truyền
 * { accepted: false } và nhận `not_companion`, để không lộ việc bị chặn (hợp đồng §3.4). Trả { ok, code, host, guest, place, quiet } — `quiet`: người nhận đang thiền, lời mời chờ sau thời thiền.
 * Máy chủ chạy cùng hàm với ngày/hiện diện của máy chủ; máy khách dùng để ẩn/khóa nút và ghi lý do.
 */
export function canMeet(kind, me, friend, rel, place = null) {
  if (!isMeetKind(kind)) return { ok: false, code: 'invalid_kind' };
  const K = MEET_KINDS[kind];
  if (!rel || rel.blocked) return { ok: false, code: 'blocked' };
  if (!rel.accepted) return { ok: false, code: 'not_companion' };
  const fp = (friend && friend.presence) || 'vang';
  if (fp === 'vang') return { ok: false, code: 'friend_away' };
  const host = K.host === 'from' ? me : friend, guest = K.host === 'from' ? friend : me;
  const where = place || (kind === 'thien' && !canTravel(guest) ? 'dtd' : 'dao');
  if (where === 'dtd' && kind !== 'thien') return { ok: false, code: 'invalid_place' };
  if (where === 'dao') {
    if (!canTravel(guest)) return { ok: false, code: 'guest_gate_closed' };
    if (!host.open) return { ok: false, code: 'host_doc_cu' };
    if (kind === 'tra' && !teaOpen(host)) return { ok: false, code: 'tea_closed' };
  }
  return { ok: true, code: null, host: K.host, guest: K.host === 'from' ? 'to' : 'from', place: where, quiet: fp === 'thien' };
}

/**
 * Ghé thăm đảo bạn khi bạn vắng. `me`: người đi { day, completed }; `host`: chủ đảo { open } — chế độ HIỆN HÀNH (máy chủ đọc lúc ghé);
 * `rel`: { accepted, blocked, closeness, allowAway } — `blocked` theo cùng quy tắc của canMeet. Đã cho phép từ trước nhưng chủ chuyển sang Độc cư thì không ghé được.
 * Trả { ok, code }.
 */
export function canVisitAway(me, host, rel) {
  if (!rel || rel.blocked) return { ok: false, code: 'blocked' };
  if (!rel.accepted) return { ok: false, code: 'not_companion' };
  if (rel.closeness !== 'than') return { ok: false, code: 'not_than' };
  if (rel.allowAway !== true) return { ok: false, code: 'away_not_allowed' };
  if (!canTravel(me)) return { ok: false, code: 'guest_gate_closed' };
  if (!host || host.open !== true) return { ok: false, code: 'host_doc_cu' };
  return { ok: true, code: null };
}

/** Kiểm thân yêu cầu POST /meet: { to, kind, place? } → { ok, v } | { ok:false, code } */
export function checkMeetPayload(p) {
  if (!p || typeof p !== 'object') return { ok: false, code: 'invalid_payload' };
  if (typeof p.to !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(p.to)) return { ok: false, code: 'invalid_to' };
  if (!isMeetKind(p.kind)) return { ok: false, code: 'invalid_kind' };
  if (p.place !== undefined && p.place !== null && !['dao', 'dtd'].includes(p.place)) return { ok: false, code: 'invalid_place' };
  return { ok: true, v: { to: p.to, kind: p.kind, place: p.place ?? null } };
}

/**
 * Pha của một lời mời theo giờ máy chủ: 'cho' (chờ trả lời) · 'sap' (đã nhận, sắp bắt đầu) · 'dang' (đang cùng làm) · 'xong' · 'het_han' · 'tu_choi' · 'huy'.
 * `inv`: { kind, status, created_at, responded_at, start_at }. `startIn`: số mili giây còn tới lúc bắt đầu.
 */
export function meetPhase(inv, now) {
  if (!inv) return { phase: 'het_han' };
  if (inv.status === 'tu_choi' || inv.status === 'huy') return { phase: inv.status };
  if (inv.status === 'cho') return now - inv.created_at > INVITE_TTL_MS ? { phase: 'het_han' } : { phase: 'cho', left: INVITE_TTL_MS - (now - inv.created_at) };
  const K = isMeetKind(inv.kind) ? MEET_KINDS[inv.kind] : {}, start = inv.start_at ?? inv.responded_at ?? now;
  if (now < start) return { phase: 'sap', startIn: start - now };
  if (K.min && now >= start + K.min * 60_000) return { phase: 'xong' };
  return { phase: 'dang' };
}
/** Giờ bắt đầu khi lời mời được nhận (máy chủ đặt): hoạt động cùng giờ sau MEET_LEAD_MS, ghé thăm thì ngay */
export const meetStartAt = (kind, acceptedAt) => (isMeetKind(kind) && MEET_KINDS[kind].synced ? acceptedAt + MEET_LEAD_MS : acceptedAt);

export function sessionPhase(session, now) {
  if (session.status === 'huy') return 'huy';
  const left = session.start_at - now;
  if (left > SESSION_MIN_LEAD_MS) return 'hen';
  if (left > 0) return 'sap';
  return left > -MEET_KINDS.thien.min * 60_000 ? 'dang' : 'xong';
}

/** Lý do không mời được, để hiện cạnh nút bị khóa */
export const REASON_TEXT = Object.freeze({
  need_character: 'Hãy tạo nhân vật và giữ hành trình trước khi mời bạn.',
  blocked: 'Không thể mời người này.',
  not_companion: 'Hai bạn chưa kết nối đồng tu.',
  friend_away: 'Bạn đang vắng mặt.',
  guest_gate_closed: 'Cổng Vân Môn của người đi thăm chưa mở (mở nửa từ ngày 29).',
  host_doc_cu: 'Cổng Vân Môn của chủ đảo đang ở chế độ Độc cư.',
  tea_closed: 'Trà Đạo Tỉnh Thức của chủ đảo chưa mở (mở từ ngày 15).',
  invalid_place: 'Nơi gặp không hợp lệ.',
  not_than: 'Chỉ bạn thân thiết mới ghé được khi chủ đảo vắng.',
  away_not_allowed: 'Bạn chưa cho phép ghé khi vắng.',
});

/**
 * Chọn bạn đồng tu dựng Vân Đảo gần đảo mình: thân thiết trước rồi quen biết, mỗi nhóm theo lúc kết nối (cũ trước), tối đa NEAR_ISLES.
 * Người ẩn hiện diện vẫn được dựng (đảo không lộ trạng thái). Trả [{ id, closeness, ring }] — ring 0 gần nhất.
 */
export function nearIsles(list) {
  const pick = (c) => (list || []).filter((x) => x && x.closeness === c).sort((a, b) => (a.accepted_at - b.accepted_at) || (a.id < b.id ? -1 : 1)).slice(0, NEAR_ISLES[c]);
  return [...pick('than').map((x) => ({ id: x.id, closeness: 'than', ring: 0 })), ...pick('quen').map((x) => ({ id: x.id, closeness: 'quen', ring: 1 }))];
}

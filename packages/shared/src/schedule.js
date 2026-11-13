// Lịch chuẩn: thời thiền 15 phút với 7 mốc, chuỗi 49 ngày và ngày mở các phân khu Vân Đảo.
export const DUR = 900; // giây

// 7 mốc chuẩn hóa (bất biến): 00:00 · 02:00 · 05:00 · 07:00 · 09:30 · 11:00 · 13:30
export const MILESTONES = Object.freeze([
  { t: 0, name: 'Quy tụ' },
  { t: 120, name: 'Niệm hơi thở mây' },
  { t: 300, name: 'Lắng dịu phóng dật' },
  { t: 420, name: 'Cận định và Thánh im lặng' },
  { t: 570, name: 'Tưởng ánh sáng' },
  { t: 660, name: 'Tâm từ toàn cõi' },
  { t: 810, name: 'Xuất thiền và Hồi hướng' },
].map(Object.freeze));

export const DAYS = 49;
export const PILLARS = Object.freeze(['duc', 'thien', 'tue']);

// Ngày mở phân khu (Trà Đạo ngày 15; Cổng Vân Môn nửa mở ngày 29, mở hẳn ngày 43)
export const ZONE_UNLOCK = Object.freeze({ kuti: 1, pad: 1, garden: 1, tea: 15, gate: 29, stele: 1 });
export const GATE_FULL_DAY = 43;
export const gateLevel = (day) => (day >= GATE_FULL_DAY ? 1 : day >= ZONE_UNLOCK.gate ? 0.5 : 0);

// Ngày đủ cả 3 trục
export const allDone = (done, day) => { const x = done && done[day]; return !!(x && x.duc && x.thien && x.tue); };

// Khóa 1 nấc mỗi ngày: chỉ tiến khi ngày xác nhận gần nhất < hôm nay và đủ 3 trục của ngày hiện tại.
// Trả về trạng thái mới (không sửa đầu vào). `today` dạng 'YYYY-MM-DD' theo múi giờ người dùng.
export function advance(state, today) {
  let { day, completed } = state;
  if (state.lastDate && state.lastDate < today && allDone(state.done, day) && day < DAYS) day++;
  if (day === DAYS && allDone(state.done, DAYS)) completed = true;
  return { day, completed };
}

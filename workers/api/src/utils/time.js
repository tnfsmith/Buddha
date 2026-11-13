// workers/api/src/utils/time.js
// Xử lý múi giờ, tính ngày địa phương và khoảng cách ngày lịch

/**
 * Trả về chuỗi ngày địa phương 'YYYY-MM-DD' theo múi giờ
 * @param {number} timestampMs - UTC mili-giây
 * @param {string} timeZone - IANA timezone (ví dụ 'Asia/Ho_Chi_Minh')
 */
export function getLocalDate(timestampMs, timeZone = 'Asia/Ho_Chi_Minh') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date(timestampMs));
  } catch {
    // Dự phòng múi giờ mặc định nếu múi giờ không hợp lệ
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date(timestampMs));
  }
}

/**
 * Tính số ngày lịch đã trôi qua giữa hai chuỗi ngày 'YYYY-MM-DD' (dateB - dateA)
 */
export function daysBetween(dateA, dateB) {
  const [y1, m1, d1] = dateA.split('-').map(Number);
  const [y2, m2, d2] = dateB.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.floor((utc2 - utc1) / (24 * 60 * 60 * 1000));
}

/**
 * Kiểm tra tính hợp lệ của chuỗi IANA timezone
 */
export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz.includes('/')) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

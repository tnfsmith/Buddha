// Hẹn giờ đồng tu (#151, hợp đồng docs/contracts/ban-dong-tu.md §9.4): tệp lịch .ics có nhắc trước 10 phút, và giờ địa phương cho
// ô datetime-local. Thuần, không gọi mạng. Tệp không ghi tên bạn đồng tu (tệp có thể bị chia sẻ, đồng bộ sang lịch khác).
import { SESSION_STEP_MS } from '@vandao/shared/dong-tu.js';

const MIN = 15;   // một thời thiền
const p2 = (n) => String(n).padStart(2, '0');
/** UTC dạng iCalendar: 20261120T110500Z */
export const icsTime = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}T${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}Z`; };
const escText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** Gấp dòng dài hơn 75 byte UTF-8 (RFC 5545 §3.1), không cắt giữa một ký tự */
function fold(line) {
  const enc = new TextEncoder(), out = [];
  let cur = '', n = 0, lim = 75;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    if (n + b > lim) { out.push(cur); cur = ' '; n = 1; lim = 75; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join('\r\n');
}

/** Tệp .ics cho một phiên: { id, start_at }. host: tên miền để UID là duy nhất. now: giờ tạo tệp. */
export function icsFor(s, { host, url, now = Date.now() }) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Van Dao//Dong tu//VI', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:dong-tu-${s.id}@${host}`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(s.start_at)}`,
    `DTEND:${icsTime(s.start_at + MIN * 60_000)}`,
    `SUMMARY:${escText('Đồng tu: cùng ngồi thiền ở Đại Thiền Đường')}`,
    `DESCRIPTION:${escText('Thời thiền 15 phút cùng bạn đồng tu trên Vân Đạo. Mở Vân Đạo trước giờ hẹn một phút.')}`,
    ...(url ? [`URL:${url}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText('Còn 10 phút: cùng ngồi thiền ở Đại Thiền Đường')}`, 'TRIGGER:-PT10M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
/** Tên tệp theo giờ địa phương: van-dao-dong-tu-20261120-1805.ics */
export const icsName = (ms) => { const d = new Date(ms); return `van-dao-dong-tu-${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}.ics`; };
/** Tải tệp về máy (điện thoại mở bằng ứng dụng Lịch) */
export function icsDownload(s, opts) {
  const blob = new Blob([icsFor(s, opts)], { type: 'text/calendar;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = icsName(s.start_at); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

/** Giờ địa phương cho ô datetime-local: 2026-11-20T18:05 */
export const localInput = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`; };
/** Mốc 5 phút kế tiếp, không sớm hơn ms */
export const ceilStep = (ms) => Math.ceil(ms / SESSION_STEP_MS) * SESSION_STEP_MS;
/** Ngày giờ dễ đọc: «thứ sáu, 20/11 lúc 18:05» */
export const whenText = (ms) => {
  const d = new Date(ms), wd = d.toLocaleDateString('vi-VN', { weekday: 'long' });
  return `${wd}, ${p2(d.getDate())}/${p2(d.getMonth() + 1)} lúc ${p2(d.getHours())}:${p2(d.getMinutes())}`;
};

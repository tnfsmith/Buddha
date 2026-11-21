// Điểm vào kiểm thử: xuất lớp DO như workers/api sẽ xuất lại khi ghép binding (hợp đồng §3)
export { ReminderClock } from '../src/reminder-clock.js';
export default { fetch: () => new Response('ok') };

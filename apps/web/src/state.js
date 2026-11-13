// Trạng thái hành trình trên máy (localStorage 'vandao.v1'). GĐ1 sẽ chuyển sang IndexedDB + outbox (PROJECT_ROADMAP.md §4.5).
// Đối tượng S giữ nguyên danh tính suốt vòng đời trang: mọi nơi import { S } đều thấy cùng một bản.
import { advance, allDone as allDoneIn } from '@vandao/shared/schedule.js';
import { defaultLook } from './people.js';

export const KEY = 'vandao.v1';
export const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
export const fresh = () => ({ v: 1, day: 1, lastDate: null, done: {}, totals: { duc: 0, thien: 0, tue: 0 }, sacca: 0, sessions: 0, completed: false, open: false, name: '', look: defaultLook(), birds: { n: 6, freq: 1, vol: 0.6 }, music: { on: false, source: 'time', song: 'van-thuy', mood: 'an', order: 'one', span: 5, vol: 0.6 } });

export const S = fresh();
/** true khi trình duyệt chặn lưu trữ cục bộ: tiến trình chỉ giữ trong bộ nhớ */
export let mem = true;

const replace = (obj) => { for (const k of Object.keys(S)) delete S[k]; Object.assign(S, obj); };

try { const raw = localStorage.getItem(KEY); if (raw) replace(Object.assign(fresh(), JSON.parse(raw))); S.look = { ...defaultLook(), ...S.look }; S.music = { ...fresh().music, ...S.music }; S.birds = { ...fresh().birds, ...S.birds }; localStorage.setItem(KEY, JSON.stringify(S)); mem = false; } catch (e) { mem = true; }

export const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* chỉ giữ trong bộ nhớ */ } };
export const allDone = (d) => allDoneIn(S.done, d);

/** "Trở về ngày 1": giữ Tịnh danh và diện mạo, xóa phần còn lại */
export function resetState(keep) { replace(Object.assign(fresh(), keep)); }

// Khóa 1 nấc mỗi ngày (luật chung ở packages/shared/schedule.js)
Object.assign(S, advance(S, today()));
save();

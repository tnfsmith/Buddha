import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { byUser } from '../guard.js';
import { bad, readJson } from '../lib.js';
import { getPracticeProfile, writePracticeProfile } from '../practice-profile.js';
import { refreshReminders } from '../reminder-data.js';

const practiceProfileApp = new Hono();
const fields = ['level', 'minutes', 'time_window', 'familiarity', 'precepts', 'uposatha', 'no_money', 'at_home'];

function normalizeProfile(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p) ||
      Object.keys(p).length !== fields.length || !fields.every((key) => Object.hasOwn(p, key))) return null;
  const { level, minutes, time_window, familiarity, precepts, uposatha, no_money, at_home } = p;
  if (!['nhe', 'vua', 'sau'].includes(level) || !Number.isInteger(minutes) || minutes < 5 || minutes > 120) return null;
  if (!['sang', 'trua', 'toi', 'linh_hoat'].includes(time_window) ||
      ![null, 'moi', 'da_quy_y', 'tu_lau'].includes(familiarity) ||
      !['vn_2', 'vn_4', 'vn_6', 'vn_10', 'khong'].includes(uposatha)) return null;
  if (!Array.isArray(precepts) || precepts.length > 5 ||
      !precepts.every((x) => Number.isInteger(x) && x >= 1 && x <= 5) || new Set(precepts).size !== precepts.length) return null;
  if (typeof no_money !== 'boolean' || typeof at_home !== 'boolean') return null;
  return { level, minutes, time_window, familiarity, precepts: [...precepts].sort((a, b) => a - b), uposatha, no_money, at_home };
}

practiceProfileApp.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
}, authMiddleware, byUser('RL_API'));

practiceProfileApp.get('/', async (c) => c.json(await getPracticeProfile(c.env.DB, c.get('user').id)));

practiceProfileApp.put('/', async (c) => {
  const type = c.req.header('Content-Type')?.split(';')[0].trim().toLowerCase();
  const body = type === 'application/json' ? await readJson(c) : null;
  const profile = normalizeProfile(body?.profile), rev = body?.rev;
  if (!profile || !Number.isSafeInteger(rev) || rev < 0 || Object.keys(body).length !== 2 || !Object.hasOwn(body, 'rev')) {
    return bad(c, 'invalid_practice_profile', 'Hồ sơ tu tập hoặc phiên bản không hợp lệ');
  }
  const db = c.env.DB, userId = c.get('user').id;
  const desired = JSON.stringify(profile);
  const matches = (current) => JSON.stringify(current.profile) === desired;
  const conflict = () => bad(c, 'practice_profile_conflict', 'Hồ sơ đã đổi. Hãy đọc lại trước khi lưu.', 409);
  const current = await getPracticeProfile(db, userId);
  if (matches(current)) return c.json(current);
  if (current.rev !== rev) return conflict();

  const written = await writePracticeProfile(db, userId, profile, rev);
  if (written) {
    if (current.profile?.uposatha !== written.profile.uposatha) await refreshReminders(c.env, userId, Date.now());
    return c.json(written);
  }
  // Hai thiết bị lưu cùng lựa chọn thì gửi lại vẫn thành công mà không tăng rev hai lần.
  const latest = await getPracticeProfile(db, userId);
  return matches(latest) ? c.json(latest) : conflict();
});

export default practiceProfileApp;

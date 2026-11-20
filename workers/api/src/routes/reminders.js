import { Hono } from 'hono';
import { checkReminders, pauseUntil } from '@vandao/shared/reminder.js';
import { authMiddleware } from '../auth/session.js';
import { byUser } from '../guard.js';
import { bad, readJson } from '../lib.js';
import { readReminders, reminderView, replaceReminders } from '../reminder-data.js';

const remindersApp = new Hono();
const missing = (c) => bad(c, 'profile_not_found', 'Hồ sơ không tồn tại.', 404);
remindersApp.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); },
  authMiddleware, byUser('RL_API'));

remindersApp.get('/', async (c) => {
  const state = await readReminders(c.env.DB, c.get('user').id);
  return state ? c.json(reminderView(c.env, state, Date.now())) : missing(c);
});

remindersApp.put('/', async (c) => {
  const body = await readJson(c);
  if (!body || Object.keys(body).some((k) => k !== 'reminders' && k !== 'pause_days')) {
    return bad(c, 'invalid_reminder', 'Danh sách nhắc không hợp lệ.');
  }
  const checked = checkReminders(body.reminders);
  if (!checked.ok) return bad(c, checked.code, 'Lịch nhắc không phù hợp.');
  const now = Date.now(), uid = c.get('user').id;
  const pause = Object.hasOwn(body, 'pause_days') ? pauseUntil(body.pause_days, now) : null;
  if (pause && !pause.ok) return bad(c, pause.code, 'Tịnh khẩu nhận số ngày từ 0 đến 30.');
  const state = await readReminders(c.env.DB, uid);
  if (!state) return missing(c);
  const saved = await replaceReminders(c.env, uid, state, checked.v, pause ? pause.v : state.policy.paused_until, now);
  return saved ? c.json(reminderView(c.env, saved, now))
    : bad(c, 'reminder_conflict', 'Lịch vừa thay đổi. Hãy đọc lại trước khi lưu.', 409);
});

export default remindersApp;

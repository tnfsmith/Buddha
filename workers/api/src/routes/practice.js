import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { byUser } from '../guard.js';
import { bad, readJson } from '../lib.js';
import { getToday } from '../practice-choices.js';
import { changePracticeChoice } from '../practice-swap.js';
import { practiceSummary } from '../practice-summary.js';

const practiceApp = new Hono();
const privateRoute = [async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); }, authMiddleware, byUser('RL_API')];

practiceApp.get('/today', ...privateRoute, async (c) => {
  const result = await getToday(c.env.DB, c.get('user').id, Date.now());
  return result ? c.json(result) : bad(c, 'journey_not_found', 'Chưa có hành trình', 404);
});

practiceApp.post('/swap', ...privateRoute, async (c) => {
  const db = c.env.DB, userId = c.get('user').id, now = Date.now();
  const result = await changePracticeChoice(db, userId, await readJson(c), now);
  if (!result.ok) return bad(c, result.code, 'Không thể đổi gợi ý. Hãy đọc lại gợi ý hôm nay.', result.status);
  const today = await getToday(db, userId, now);
  return today ? c.json(today) : bad(c, 'journey_not_found', 'Chưa có hành trình', 404);
});

practiceApp.get('/summary', ...privateRoute, async (c) => {
  const range = c.req.query('range');
  if (range !== 'week' && range !== 'cycle') return bad(c, 'invalid_range', 'Chọn tổng kết tuần hoặc chu kỳ.');
  const summary = await practiceSummary(c.env.DB, c.get('user').id, range, Date.now());
  return summary ? c.json(summary) : bad(c, 'journey_not_found', 'Chưa có hành trình', 404);
});

export default practiceApp;

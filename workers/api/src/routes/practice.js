import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { byUser } from '../guard.js';
import { bad } from '../lib.js';
import { getToday } from '../practice-choices.js';

const practiceApp = new Hono();
const privateRoute = [async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); }, authMiddleware, byUser('RL_API')];

practiceApp.get('/today', ...privateRoute, async (c) => {
  const result = await getToday(c.env.DB, c.get('user').id, Date.now());
  return result ? c.json(result) : bad(c, 'journey_not_found', 'Chưa có hành trình', 404);
});

export default practiceApp;

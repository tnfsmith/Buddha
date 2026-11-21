import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { byUser } from '../guard.js';
import { bad, readJson } from '../lib.js';
import { getTierProgress, updateTierProgress } from '../tier-progress.js';

const app = new Hono();
const errors = {
  journey_not_found: [404, 'Chưa có hành trình Sơ nhập đang hoạt động.'],
  cycle_conflict: [409, 'Chu kỳ đã đổi. Hãy tải lại tình trạng cổng.'],
  reflection_too_early: [409, 'Tự vấn tuần 7 được xác nhận từ ngày 49.'],
  tier_not_ready: [409, 'Còn điều kiện chưa hoàn tất.'],
};

const fail = (c, code) => bad(c, code, errors[code][1], errors[code][0]);

app.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
}, authMiddleware, byUser('RL_API'));

app.get('/1', async (c) => {
  const row = await getTierProgress(c.env.DB, c.get('user').id);
  return row ? c.json(row) : fail(c, 'journey_not_found');
});

function change(action) {
  return async (c) => {
    const type = c.req.header('Content-Type')?.split(';')[0].trim().toLowerCase();
    const body = type === 'application/json' ? await readJson(c) : null;
    const reflect = action === 'reflection';
    if (!body || !Number.isSafeInteger(body.cycle) || body.cycle < 1 ||
        Object.keys(body).length !== (reflect ? 2 : 1) || (reflect && body.done !== true)) {
      return bad(c, 'invalid_payload', 'Dữ liệu xác nhận không hợp lệ.');
    }
    const result = await updateTierProgress(c.env.DB, c.get('user').id, body.cycle, action, Date.now());
    return result.value ? c.json(result.value) : fail(c, result.code);
  };
}

app.post('/1/reflection', change('reflection'));
app.post('/1/open', change('open'));

export default app;

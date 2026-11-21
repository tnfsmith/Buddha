import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { socialQuota, userIdOk } from '../companions-data.js';
import { cancelSession, createSession, parseSession, respondSession } from '../companion-sessions.js';
import { bad, readJson } from '../lib.js';

const app = new Hono(), HOUR = 3_600_000, DAY = 24 * HOUR;
const errors = {
  invalid_payload: [400, 'Giờ hẹn hoặc danh sách bạn chưa hợp lệ.'],
  not_found: [404, 'Không tìm thấy lời hẹn hoặc bạn đồng tu.'],
  need_character: [409, 'Hãy tạo nhân vật trước khi mời.'],
  session_limit: [409, 'Bạn đang có ba hẹn sắp tới.'],
  session_closed: [409, 'Hẹn này đã kết thúc hoặc đã hủy.'],
  session_response_conflict: [409, 'Lời hẹn đã được trả lời.'],
};

const fail = (c, code) => bad(c, code, errors[code][1], errors[code][0]);
app.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); }, authMiddleware);

app.post('/', socialQuota('session_create', 10, DAY), async (c) => {
  const uid = c.get('user').id, now = Date.now();
  const input = parseSession(await readJson(c), uid, now);
  if (!input) return fail(c, 'invalid_payload');
  const result = await createSession(c.env.DB, uid, input, now);
  return result.code ? fail(c, result.code) : c.json(result, 201);
});

app.post('/:id/respond', socialQuota('session_respond', 60, HOUR), async (c) => {
  const id = c.req.param('id');
  if (!userIdOk(id)) return fail(c, 'not_found');
  const body = await readJson(c);
  if (!body || Object.keys(body).length !== 1 || typeof body.accept !== 'boolean') return fail(c, 'invalid_payload');
  const result = await respondSession(c.env.DB, c.get('user').id, id, body.accept, Date.now());
  return result.code ? fail(c, result.code) : c.json(result);
});

app.post('/:id/cancel', socialQuota('session_cancel', 60, HOUR), async (c) => {
  const id = c.req.param('id');
  return userIdOk(id) && await cancelSession(c.env.DB, c.get('user').id, id) ? c.body(null, 204) : fail(c, 'not_found');
});

app.onError((error, c) => {
  console.error('[Hẹn đồng tu]', c.req.method, error?.name);
  return bad(c, 'internal_error', 'Lỗi xử lý nội bộ máy chủ.', 500);
});

export default app;

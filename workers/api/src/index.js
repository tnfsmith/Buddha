// workers/api/src/index.js
// Điểm khởi nhập chính của Worker API Vân Đạo (PROJECT_ROADMAP.md §3, §5)
import { Hono } from 'hono';
import authApp from './routes/auth.js';
import meApp from './routes/me.js';
import profileApp from './routes/profile.js';
import practiceProfileApp from './routes/practice-profile.js';
import tierProgressApp from './routes/tier-progress.js';
import syncApp from './routes/sync.js';
import exportApp from './routes/export.js';
import accountApp from './routes/account.js';
import rtApp from './routes/rt.js';
import contentApp from './routes/content.js';
import companionsApp from './routes/companions.js';
import companionSessionsApp from './routes/companion-sessions.js';
import metricsApp from './routes/metrics.js';
import mediaApp from './routes/media.js';
import inviteCard from './routes/invite-card.js';
import { byIp, turnstile } from './guard.js';
import { runCron } from './cron.js';

const app = new Hono();

// CORS: trình duyệt gọi cùng nguồn gốc nên không cần; chỉ mở cho các nguồn của chính Vân Đạo (production, staging,
// preview pr-N và phiên bản, máy dev). Không dùng `*` vì /api/auth và dữ liệu cá nhân đi qua đây.
const ORIGINS = [
  /^https:\/\/vandao\.ainextbrain\.com$/,
  /^https:\/\/([a-z0-9-]+-)?vandao-staging\.vandao-staging\.workers\.dev$/,
  /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/,
];
export const allowOrigin = (o) => Boolean(o) && ORIGINS.some((re) => re.test(o));
app.use('/api/*', async (c, next) => {
  const origin = c.req.header('Origin');
  if (c.req.method === 'OPTIONS') {
    if (!allowOrigin(origin)) return c.body(null, 403);
    return c.body(null, 204, {
      'Access-Control-Allow-Origin': origin, 'Vary': 'Origin', 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Max-Age': '600',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-d1-bookmark',
    });
  }
  await next();
  if (allowOrigin(origin)) { c.header('Access-Control-Allow-Origin', origin); c.header('Access-Control-Allow-Credentials', 'true'); c.header('Vary', 'Origin'); }
});

// Giới hạn tần suất theo IP và Turnstile cho các bước đăng nhập (§5, §6.3, §6.4)
for (const p of ['/api/auth/sign-in/anonymous', '/api/auth/sign-in/recovery-code', '/api/auth/device-link/start', '/api/auth/passkey/verify-authentication']) app.post(p, byIp('RL_AUTH'));
app.post('/api/auth/sign-in/device-link', byIp('RL_POLL'));
app.post('/api/auth/email-otp/send-verification-otp', byIp('RL_OTP'));
for (const p of ['/api/auth/sign-in/recovery-code', '/api/auth/device-link/start', '/api/auth/email-otp/send-verification-otp']) app.post(p, turnstile());
app.post('/api/v1/metrics', byIp('RL_POLL'));

// Kiểm tra sức khỏe dịch vụ
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'vandao-api', time: Date.now() });
});

// Gắn các phân hệ định tuyến
app.route('/api/auth', authApp);
app.route('/api/v1/me', meApp);
app.route('/api/v1/profile', profileApp);
app.route('/api/v1/practice/profile', practiceProfileApp);
app.route('/api/v1/tier-progress', tierProgressApp);
app.route('/api/v1/sync', syncApp);
app.route('/api/v1/export', exportApp);
app.route('/api/v1/account', accountApp);
app.route('/api/v1/rt', rtApp);
app.route('/api/v1/content', contentApp);
app.route('/api/v1/metrics', metricsApp);
app.route('/api/v1/sessions', companionSessionsApp);
app.route('/api/v1', companionsApp);

// Đường dẫn /api/* không tồn tại: trả 404 JSON, không rơi xuống trang SPA
app.all('/api/*', (c) => c.json({ error: { code: 'not_found', message: 'Không có API này' } }, 404));

app.route('/media', mediaApp);
app.route('/moi', inviteCard);

// Chuyển tiếp các request tĩnh không thuộc /api/* hoặc /media/* cho Static Assets (apps/web)
app.all('*', async (c) => {
  // Static Assets đã phục vụ tệp có thật trước Worker. Tệp thiếu không được thay bằng trang SPA.
  if (c.req.path.startsWith('/assets/')) return c.text('Not Found', 404, { 'Cache-Control': 'no-store' });
  if (c.env?.ASSETS && typeof c.env.ASSETS.fetch === 'function') {
    const response = await c.env.ASSETS.fetch(c.req.raw);
    if (response.status !== 404 || !['GET', 'HEAD'].includes(c.req.method)) return response;
    await response.body?.cancel();
    return c.env.ASSETS.fetch(new Request(new URL('/', c.req.url), { method: c.req.method }));
  }
  return c.text('Not Found', 404);
});

// Xử lý lỗi toàn cục: ghi log (không kèm dữ liệu người dùng), trả thông báo chung
app.onError((err, c) => {
  console.error('[API Error]', c.req.method, new URL(c.req.url).pathname, err && err.message);
  return c.json({ error: { code: 'internal_error', message: 'Lỗi xử lý nội bộ máy chủ' } }, 500);
});

// Cron Trigger (wrangler.jsonc → triggers.crons): dọn dữ liệu hằng đêm
app.scheduled = (controller, env, ctx) => { ctx.waitUntil(runCron(env, controller.scheduledTime || Date.now())); };

export { app };
export default app;

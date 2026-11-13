// workers/api/src/index.js
// Điểm khởi nhập chính của Worker API Vân Đạo (PROJECT_ROADMAP.md §3, §5)
import { Hono } from 'hono';
import authApp from './routes/auth.js';
import meApp from './routes/me.js';
import profileApp from './routes/profile.js';
import syncApp from './routes/sync.js';
import exportApp from './routes/export.js';
import accountApp from './routes/account.js';
import rtApp from './routes/rt.js';
import contentApp from './routes/content.js';

const app = new Hono();

// Middleware CORS
app.use('*', async (c, next) => {
  await next();
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-d1-bookmark');
});

app.options('*', (c) => c.text('', 204));

// Kiểm tra sức khỏe dịch vụ
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'vandao-api', time: Date.now() });
});

// Gắn các phân hệ định tuyến
app.route('/api/auth', authApp);
app.route('/api/v1/me', meApp);
app.route('/api/v1/profile', profileApp);
app.route('/api/v1/sync', syncApp);
app.route('/api/v1/export', exportApp);
app.route('/api/v1/account', accountApp);
app.route('/api/v1/rt', rtApp);
app.route('/api/v1/content', contentApp);

// Xử lý lỗi toàn cục
app.onError((err, c) => {
  if (globalThis.console) {
    globalThis.console.error('[API Error]', err);
  }
  return c.json({
    error: {
      code: 'internal_error',
      message: err.message || 'Lỗi xử lý nội bộ máy chủ'
    }
  }, 500);
});

export default app;

import { expect, it, vi } from 'vitest';
import app from '../src/index.js';

it('trả 404 không lưu cache khi tệp tĩnh bị thiếu và vẫn chuyển trang gốc tới Static Assets', async () => {
  const assets = { fetch: vi.fn(async () => new Response('<html>Vân Đạo</html>', { headers: { 'Content-Type': 'text/html' } })) };
  for (const method of ['GET', 'HEAD']) {
    const missing = await app.request('/assets/app-missing.js', { method }, { ASSETS: assets });
    expect(missing.status).toBe(404);
    expect(missing.headers.get('Cache-Control')).toBe('no-store');
    expect(missing.headers.get('Content-Type')).toMatch(/^text\/plain/);
  }
  expect(assets.fetch).not.toHaveBeenCalled();
  const root = await app.request('/', {}, { ASSETS: assets });
  expect(root.status).toBe(200);
  expect(await root.text()).toBe('<html>Vân Đạo</html>');
  expect(assets.fetch).toHaveBeenCalledTimes(1);
});

it('giữ trang gốc cho đường dẫn SPA và giữ lỗi của phương thức ghi', async () => {
  const assets = { fetch: vi.fn(async request => new URL(request.url).pathname === '/'
    ? new Response('<html>Vân Đạo</html>') : new Response(null, { status: 404 })) };
  const navigation = await app.request('/hanh-trinh/offline', {}, { ASSETS: assets });
  expect(navigation.status).toBe(200);
  expect(await navigation.text()).toBe('<html>Vân Đạo</html>');
  expect(assets.fetch).toHaveBeenCalledTimes(2);
  const written = await app.request('/unknown', { method: 'POST' }, { ASSETS: assets });
  expect(written.status).toBe(404);
  expect(assets.fetch).toHaveBeenCalledTimes(3);
});

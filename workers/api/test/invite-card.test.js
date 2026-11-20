import { expect, it, vi } from 'vitest';
import app from '../src/index.js';
import { INVITE_IMAGE_KEY } from '../src/routes/media.js';
import { call, env, guest } from './helpers.js';

const origin = 'https://pr-160-vandao-staging.vandao-staging.workers.dev';
const html = '<!doctype html><html><head><meta property="og:title" content="cũ"><meta name="robots" content="index"></head><body>Vân Đạo</body></html>';
const assets = { fetch: request => {
  expect(request.url).toBe(origin + '/');
  expect(request.headers.get('Cookie')).toBeNull();
  return new Response(html, { headers: { 'Content-Type': 'text/html', ETag: '"old"', 'Cache-Control': 'public, max-age=60' } });
} };
const request = (path, bindings = {}, init = {}) => app.request(origin + path, init, { ...env, ASSETS: assets, ...bindings });
const meta = (property, content) => `<meta property="${property}" content="${content}">`;

async function hostInvite() {
  const host = await guest();
  const uid = host.user.id;
  await env.DB.prepare('UPDATE profile SET tinh_danh = ?, tag = ?, look_json = ? WHERE user_id = ?')
    .bind('Tuệ An', '0123', '{"height":1}', uid).run();
  await env.DB.prepare('UPDATE journey SET day = 17 WHERE user_id = ? AND is_current = 1').bind(uid).run();
  const issued = await call('/api/v1/companions/link', { method: 'POST', body: '{}' }, host.token);
  expect(issued.status).toBe(200);
  return { uid, token: host.token, ...(await issued.json()) };
}

it('hiện tên và mã trên HTML gốc, dùng đúng origin và giữ nguyên lượt mời', async () => {
  const { code, uses_left } = await hostInvite();
  const alias = code.slice(0, 4).toLowerCase() + '-' + code.slice(4).toLowerCase();
  const res = await request(`/moi/${alias}?utm=x`, {}, { headers: { Cookie: 'sample=test', 'X-Forwarded-Host': 'elsewhere.invalid' } });
  expect(res.status).toBe(200);
  expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  expect(res.headers.get('Vary')).toBe('*');
  expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
  expect(res.headers.get('ETag')).toBeNull();
  const body = await res.text();
  expect(body).toContain(meta('og:title', 'Tuệ An · 0123 mời bạn tu cùng trên Vân Đạo'));
  expect(body).toContain(meta('og:url', `${origin}/moi/${code}`));
  expect(body).toContain(meta('og:image', `${origin}/media/${INVITE_IMAGE_KEY}`));
  expect(body).toContain('<meta name="robots" content="noindex">');
  expect(body).toContain('<body>Vân Đạo</body>');
  expect(body.match(/property="og:title"/g)).toHaveLength(1);
  expect(body).not.toContain('Ngày 17');
  expect(await env.DB.prepare('SELECT uses_left FROM invite WHERE code = ?').bind(code).first('uses_left')).toBe(uses_left);
});

it('chỉ thêm ngày khi người mời bật cờ boolean và có đúng một d=1', async () => {
  const { uid, code } = await hostInvite();
  const page = `/moi/${code}`;
  const settings = value => env.DB.prepare('UPDATE profile SET settings_json = ? WHERE user_id = ?')
    .bind(JSON.stringify({ dong_tu: { chia_se_tien_trinh: value } }), uid).run();
  for (const value of [false, 'true', 1]) {
    await settings(value);
    expect(await (await request(page + '?d=1')).text()).not.toContain('Ngày 17');
  }
  await settings(true);
  const included = await (await request(page + '?d=1')).text();
  expect(included).toContain('Ngày 17 của hành trình Sơ nhập.');
  expect(included).toContain(meta('og:url', `${origin}${page}?d=1`));
  for (const query of ['', '?d=0', '?d=1&d=1']) {
    expect(await (await request(page + query)).text()).not.toContain('Ngày 17');
  }
});

it('dùng thẻ chung cho mã hỏng, mất hiệu lực, hồ sơ Ẩn và D1 khác', async () => {
  const { uid, code, token } = await hostInvite();
  const page = `/moi/${code}?d=1`;
  const generic = async (path, bindings) => {
    const res = await request(path, bindings);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(meta('og:title', 'Mời bạn tu cùng trên Vân Đạo'));
    expect(body).toContain(meta('og:url', origin + '/'));
    expect(body).not.toContain('Tuệ An');
  };
  await generic('/moi/x');
  await generic('/moi/%E0%A4%A');
  await generic('/moi/00000000');
  await generic(page, { DB: env.OTHER_DB });
  await env.DB.prepare("UPDATE profile SET visibility = 'an' WHERE user_id = ?").bind(uid).run();
  await generic(page);
  await env.DB.prepare("UPDATE profile SET visibility = 'dong_tu' WHERE user_id = ?").bind(uid).run();
  await env.DB.prepare('UPDATE invite SET uses_left = 0 WHERE code = ?').bind(code).run();
  await generic(page);
  await env.DB.prepare('UPDATE invite SET uses_left = 1, expires_at = 1 WHERE code = ?').bind(code).run();
  await generic(page);
  expect((await call('/api/v1/companions/link', { method: 'POST', body: '{"renew":true}' }, token)).status).toBe(200);
  await generic(page);
});

it('thoát tên trong thuộc tính và trả thẻ chung khi truy vấn D1 lỗi', async () => {
  const { uid, code } = await hostInvite();
  await env.DB.prepare('UPDATE profile SET tinh_danh = ? WHERE user_id = ?').bind('Tuệ "An<&>', uid).run();
  expect(await (await request(`/moi/${code}`)).text()).toContain('Tuệ &quot;An&lt;&amp;&gt; · 0123');
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const broken = await request(`/moi/${code}`, { DB: { prepare() { throw new Error('chi tiết không ghi'); } } });
    expect(await broken.text()).toContain(meta('og:title', 'Mời bạn tu cùng trên Vân Đạo'));
    expect(log.mock.calls).toEqual([['[Thẻ mời] D1']]);
  } finally { log.mockRestore(); }
});

it('giới hạn theo IP và áp dụng header riêng tư khi không có trang HTML', async () => {
  const limited = await request('/moi/00000000', { RL_POLL: { limit: async () => ({ success: false }) } });
  expect(limited.status).toBe(429);
  expect(limited.headers.get('Cache-Control')).toBe('private, no-store');
  const unavailable = await request('/moi/00000000', { ASSETS: undefined });
  expect(unavailable.status).toBe(503);
  expect(unavailable.headers.get('X-Robots-Tag')).toBe('noindex');
});

it('chỉ phục vụ đúng khóa PNG, không mở các khóa khác hoặc bucket khác', async () => {
  const path = `/media/${INVITE_IMAGE_KEY}`;
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  await env.MEDIA.put(INVITE_IMAGE_KEY, bytes);
  await env.MEDIA.put('og/private.png', 'private');
  const get = await request(path);
  expect(get.status).toBe(200);
  expect(new Uint8Array(await get.arrayBuffer())).toEqual(bytes);
  expect(get.headers.get('Content-Type')).toBe('image/png');
  expect(get.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
  const head = await request(path, {}, { method: 'HEAD' });
  expect(head.status).toBe(200);
  expect(await head.text()).toBe('');
  expect(head.headers.get('Content-Length')).toBe('8');
  expect((await request(path, {}, { headers: { 'If-None-Match': get.headers.get('ETag') } })).status).toBe(304);
  expect((await request('/media/og/private.png')).status).toBe(404);
  expect((await request(path, { MEDIA: env.OTHER_MEDIA })).status).toBe(404);
});

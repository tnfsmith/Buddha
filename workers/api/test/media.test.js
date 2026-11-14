import { beforeAll, beforeEach, it, expect } from 'vitest';
import { applyD1Migrations } from 'cloudflare:test';
import { env, call } from './helpers.js';
import app from '../src/index.js';

const key = 'bai-giang/loi-phat-day/kiem-media/v2-12345678/vi-thu.mp3';
const cues = key.replace('.mp3', '.cues.json');
const url = '/media/' + key;
const text = async response => new TextDecoder().decode(await response.arrayBuffer());
beforeAll(async () => { await applyD1Migrations(env.OTHER_DB, env.TEST_MIGRATIONS); });
beforeEach(async () => {
  await env.DB.prepare('DELETE FROM content_item WHERE id = ?').bind('kiem-media').run();
  await env.DB.prepare("INSERT INTO content_item(id,version,kind,title,source_ref,status,body_r2_key) VALUES (?,2,'bai_giang','Thử','Nguồn','da_duyet',?)").bind('kiem-media', key).run();
  await env.MEDIA.put(key, '0123456789');
  await env.MEDIA.put(cues, '{"v":1}');
});

it('GET/HEAD đúng header, byte và body_r2_key có trong API', async () => {
  const response = await call(url);
  expect(response.status).toBe(200);
  expect(await text(response)).toBe('0123456789');
  expect(response.headers.get('content-type')).toBe('audio/mpeg');
  expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  const head = await call(url, { method: 'HEAD' });
  expect(head.status).toBe(200); expect(head.headers.get('content-length')).toBe('10'); expect(await head.text()).toBe('');
  const { items } = await (await call('/api/v1/content?kind=bai_giang')).json();
  expect(items.find(x => x.id === 'kiem-media').body_r2_key).toBe(key);
});

it.each([['bytes=2-5', '2345', 'bytes 2-5/10'], ['bytes=7-', '789', 'bytes 7-9/10'], ['bytes=-3', '789', 'bytes 7-9/10'], ['bytes=8-99', '89', 'bytes 8-9/10']])('Range %s', async (range, body, contentRange) => {
  const response = await call(url, { headers: { Range: range } });
  expect(response.status).toBe(206); expect(await text(response)).toBe(body);
  expect(response.headers.get('content-range')).toBe(contentRange);
  expect(response.headers.get('content-length')).toBe(String(body.length));
});

it.each(['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=9007199254740999-'])('Range không hợp lệ %s → 416', async range => {
  const response = await call(url, { headers: { Range: range } });
  expect(response.status).toBe(416); expect(response.headers.get('content-range')).toBe('bytes */10');
  expect(await text(response)).toBe('');
});

it('ETag → 304; If-Range không khớp trả đầy đủ 200', async () => {
  const etag = (await call(url, { method: 'HEAD' })).headers.get('etag');
  const same = await call(url, { headers: { 'If-None-Match': `"other", W/${etag}`, Range: 'bytes=0-1' } });
  expect(same.status).toBe(304); expect(await same.text()).toBe('');
  const changed = await call(url, { headers: { 'If-Range': '"other"', Range: 'bytes=0-1' } });
  expect(changed.status).toBe(200); expect(await text(changed)).toBe('0123456789');
});

it('cues công khai theo đúng khóa MP3, kiểu JSON; object thiếu → 404', async () => {
  const response = await call('/media/' + cues);
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('application/json');
  expect(await response.json()).toEqual({ v: 1 });
  await env.MEDIA.delete(cues);
  expect((await call('/media/' + cues)).status).toBe(404);
});

it.each(['cho_duyet', 'ngung', 'nhap'])('khóa của bài %s → 404 kể cả HEAD, Range, ETag', async status => {
  await env.DB.prepare('UPDATE content_item SET status = ? WHERE id = ?').bind(status, 'kiem-media').run();
  for (const init of [{}, { method: 'HEAD' }, { headers: { Range: 'bytes=0-1', 'If-None-Match': '*' } }]) expect((await call(url, init)).status).toBe(404);
});

it('object có ở cả hai bucket nhưng chỉ D1 môi trường hiện tại được quyền công khai', async () => {
  await env.OTHER_MEDIA.put(key, '0123456789');
  const other = await app.request(url, {}, { ...env, DB: env.OTHER_DB, MEDIA: env.OTHER_MEDIA });
  expect(other.status).toBe(404);
  expect((await call(url)).status).toBe(200);
});

it.each(['bai-giang/_mau-giong/a.mp3', 'bai-giang/x/%2e%2e%2fa.mp3', 'bai-giang/x/a%00.mp3', 'bai-giang/x/a.MP3', '%'])('khóa lạ/đường dẫn nguy hiểm %s → 404', async path => {
  const response = await call('/media/' + path);
  expect(response.status).toBe(404);
});

it('POST không được phục vụ như trang SPA', async () => { expect((await call(url, { method: 'POST' })).status).toBe(405); });

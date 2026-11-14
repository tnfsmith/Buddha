import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { stripVTControlCharacters } from 'node:util';

const root = fileURLToPath(new URL('../../', import.meta.url)), credentials = new Map();
const sha = data => createHash('sha256').update(data).digest('hex');
const hmac = (key, text) => createHmac('sha256', key).update(text).digest();
const encode = text => encodeURIComponent(text).replace(/[!'()*]/g, x => '%' + x.charCodeAt(0).toString(16).toUpperCase());

export function signedUrl({ account, bucket, key, id, secret, expires = 604800, now = new Date() }) {
  if (!Number.isInteger(expires) || expires < 1 || expires > 604800) throw new Error('Hạn URL phải trong 1–604800 giây');
  const host = `${account}.r2.cloudflarestorage.com`, uri = '/' + [bucket, ...key.split('/')].map(encode).join('/');
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, ''), date = timestamp.slice(0, 8), scope = `${date}/auto/s3/aws4_request`;
  const query = Object.entries({ 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${id}/${scope}`, 'X-Amz-Date': timestamp, 'X-Amz-Expires': String(expires), 'X-Amz-SignedHeaders': 'host' })
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encode(k)}=${encode(v)}`).join('&');
  const request = `GET\n${uri}\n${query}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
  const signing = hmac(hmac(hmac(hmac('AWS4' + secret, date), 'auto'), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signing).update(`AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${sha(request)}`).digest('hex');
  return `https://${host}${uri}?${query}&X-Amz-Signature=${signature}`;
}

async function auth(target) {
  if (credentials.has(target)) return credentials.get(target);
  const token = process.env[`CF_${target}_API_TOKEN`], account = process.env[`CF_${target}_ACCOUNT_ID`];
  if (!token || !account) throw new Error(`Thiếu cấu hình Cloudflare ${target}`);
  let id;
  for (const path of ['user/tokens/verify', `accounts/${account}/tokens/verify`]) {
    const response = await fetch('https://api.cloudflare.com/client/v4/' + path, { headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) });
    const data = await response.json();
    if (response.ok && data.success && data.result?.id) { id = data.result.id; break; }
  }
  if (!id) throw new Error(`Không xác định được token ID cho R2 ${target}; cần R2 token có quyền S3`);
  const value = { token, account, id, secret: sha(token), bucket: target === 'STAGING' ? 'vandao-media-staging' : 'vandao-media' };
  credentials.set(target, value); return value;
}

export async function listenUrl(key, target = 'STAGING') { return signedUrl({ ...await auth(target), key }); }

export async function uploadAudio(file, key, target = 'STAGING') {
  if (!/^bai-giang\/[a-z0-9_./-]+\.(mp3|cues\.json)$/.test(key) || key.includes('..')) throw new Error('Khóa R2 không hợp lệ');
  const config = await auth(target), url = signedUrl({ ...config, key }), expected = sha(readFileSync(file));
  const existing = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (existing.status === 200) {
    if (sha(Buffer.from(await existing.arrayBuffer())) !== expected) throw new Error('Khóa R2 đã có dữ liệu khác; không ghi đè');
    return { key, skipped: true, sha256: expected, url };
  }
  if (existing.status !== 404) throw new Error(`Không đọc kiểm tra được R2 ${target}: HTTP ${existing.status}`);
  const env = { ...process.env, CLOUDFLARE_API_TOKEN: config.token, CLOUDFLARE_ACCOUNT_ID: config.account, WRANGLER_SEND_METRICS: 'false', WRANGLER_LOG: 'error' };
  for (const name of Object.keys(env)) if (/^(CF_|GOOGLE_|OPENAI_)/.test(name)) delete env[name];
  const result = spawnSync(process.execPath, [join(root, 'node_modules/wrangler/bin/wrangler.js'), 'r2', 'object', 'put', `${config.bucket}/${key}`, '--remote', '--file', file,
    '--content-type', key.endsWith('.mp3') ? 'audio/mpeg' : 'application/json'], { env, cwd: root, encoding: 'utf8', windowsHide: true, timeout: 180000 });
  if (result.error || result.status !== 0) {
    let detail = [result.error?.code, result.status, result.stderr, result.stdout].filter(Boolean).join(' ');
    for (const [name, value] of Object.entries(process.env)) if (/^(CF_|CLOUDFLARE_|GOOGLE_|OPENAI_)/.test(name) && value) detail = detail.replaceAll(value, '[redacted]');
    detail = stripVTControlCharacters(detail).slice(-600);
    throw new Error(`Upload R2 ${target} lỗi: ${detail}`);
  }
  const check = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (check.status !== 200 || sha(Buffer.from(await check.arrayBuffer())) !== expected) throw new Error(`R2 ${target} không khớp SHA-256 sau upload`);
  return { key, skipped: false, sha256: expected, url };
}

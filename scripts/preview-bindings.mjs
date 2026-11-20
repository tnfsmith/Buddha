const DB_ID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const KV_ID = /^[0-9a-f]{32}$/i;
const PR_NUMBER = /^[1-9]\d{0,8}$/;

export function previewBinding(raw, pr) {
  const selected = raw?.trim() ? JSON.parse(raw) : {};
  if (!selected || typeof selected !== 'object' || Array.isArray(selected)) throw new Error('Bản đồ preview phải là một đối tượng.');
  const usedD1 = new Set(), usedKv = new Set();
  let pair = null;
  for (const [number, value] of Object.entries(selected)) {
    if (!PR_NUMBER.test(number) || !value || typeof value.d1 !== 'string' || !DB_ID.test(value.d1) ||
        typeof value.kv !== 'string' || !KV_ID.test(value.kv) || Object.keys(value).length !== 2) {
      throw new Error('Cặp D1/KV preview không hợp lệ.');
    }
    const d1 = value.d1.toLowerCase(), kv = value.kv.toLowerCase();
    if (usedD1.has(d1) || usedKv.has(kv)) throw new Error('Mỗi PR phải có D1 và KV riêng.');
    usedD1.add(d1);
    usedKv.add(kv);
    if (number === pr) pair = { d1, kv, dbName: `vandao-core-preview-pr-${number}`, kvName: `vandao-config-preview-pr-${number}` };
  }
  return pair;
}

export function isolatedConfig(staging, production, pair) {
  if (staging.name !== 'vandao-staging' || !pair) throw new Error('Chỉ tạo cấu hình cho Worker staging và PR có cặp riêng.');
  const db = staging.d1_databases.find((v) => v.binding === 'DB');
  const kv = staging.kv_namespaces.find((v) => v.binding === 'CONFIG');
  if (!db || !kv) throw new Error('Thiếu binding DB hoặc CONFIG trong cấu hình staging.');
  const reserved = [staging, production];
  if (reserved.some((env) => env.d1_databases.some((v) => v.database_id?.toLowerCase() === pair.d1) ||
      env.kv_namespaces.some((v) => v.id?.toLowerCase() === pair.kv))) {
    throw new Error('Từ chối binding D1/KV staging hoặc production ở preview.');
  }
  const { name, main, compatibility_date, compatibility_flags, assets, r2_buckets, vars, ratelimits } = staging;
  return {
    name, main, compatibility_date, compatibility_flags, assets, r2_buckets, vars, ratelimits,
    workers_dev: true,
    preview_urls: true,
    d1_databases: [{ binding: 'DB', database_id: pair.d1, database_name: pair.dbName, migrations_dir: db.migrations_dir }],
    kv_namespaces: [{ binding: 'CONFIG', id: pair.kv }],
  };
}

export async function verifyPreviewResources(account, token, pair, request = fetch) {
  if (!KV_ID.test(account ?? '') || !token) throw new Error('Thiếu thông tin tài khoản Cloudflare staging.');
  const read = async (path) => {
    const res = await request(`https://api.cloudflare.com/client/v4/accounts/${account}/${path}`, {
      headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error('Cloudflare không xác nhận được tài nguyên preview.');
    const json = await res.json();
    if (!json.success) throw new Error('Cloudflare không xác nhận được tài nguyên preview.');
    return json.result;
  };
  const [d1, kv] = await Promise.all([read(`d1/database/${pair.d1}`), read(`storage/kv/namespaces/${pair.kv}`)]);
  if (d1?.uuid !== pair.d1 || d1.name !== pair.dbName || kv?.id !== pair.kv || kv.title !== pair.kvName) {
    throw new Error('Tên hoặc ID Cloudflare không đúng cặp của PR. Dừng trước khi áp migration.');
  }
}

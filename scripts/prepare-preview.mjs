import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unstable_readConfig } from 'wrangler';
import { contentSql, readContentRows } from './content-data.mjs';
import { isolatedConfig, previewBinding, verifyPreviewResources } from './preview-bindings.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = resolve(root, 'workers/api/wrangler.jsonc');
const [configFile, sqlFile] = process.argv.slice(2);
if (!configFile || !sqlFile || dirname(resolve(configFile)) !== dirname(source)) {
  throw new Error('Cấu hình preview tạm phải nằm cạnh wrangler.jsonc để giữ đường dẫn tài nguyên.');
}
const pair = previewBinding(process.env.BUDDHA_PREVIEW_BINDINGS, process.env.PR);
const staging = unstable_readConfig({ config: source, env: 'staging' });
const production = unstable_readConfig({ config: source, env: '' });
const config = isolatedConfig(staging, production, pair);
await verifyPreviewResources(process.env.CLOUDFLARE_ACCOUNT_ID, process.env.CLOUDFLARE_API_TOKEN, pair);
writeFileSync(configFile, JSON.stringify(config, null, 2));
writeFileSync(sqlFile, contentSql(readContentRows(resolve(root, 'content'))));

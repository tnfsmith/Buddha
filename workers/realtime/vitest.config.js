// Kiểm thử Durable Object ReminderClock (#106) trong workerd (Miniflare) với D1 thật đủ migration và DO SQLite.
// Dịch vụ push là hàm giả do test gắn vào đối tượng; không gọi dịch vụ thật. Khóa VAPID sinh mới mỗi lần chạy.
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const b64u = (b) => Buffer.from(b).toString('base64url');

export default defineConfig(async () => {
  const migrations = await readD1Migrations(here('../../db/migrations'));
  const pair = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', pair.privateKey), raw = await webcrypto.subtle.exportKey('raw', pair.publicKey);
  return {
    plugins: [cloudflareTest({
      main: './test/worker.js',
      miniflare: {
        compatibilityDate: '2026-11-01',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: ['DB'],
        durableObjects: { REMINDER_CLOCK: { className: 'ReminderClock', useSQLite: true } },
        bindings: { TEST_MIGRATIONS: migrations, REMINDERS_ENABLED: '1', VAPID_PUBLIC_KEY: b64u(raw), VAPID_PRIVATE_KEY: jwk.d, VAPID_SUBJECT: 'mailto:kiem-thu@vandao.invalid' },
      },
    })],
    test: { name: 'realtime', include: ['test/**/*.test.js'], setupFiles: ['./test/setup.js'] },
  };
});

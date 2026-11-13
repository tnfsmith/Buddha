// workers/api/test/d1-mock.js
// Giả lập D1 Database bằng SQLite in-memory (node:sqlite) chạy trên Node 26 LTS
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createTestD1() {
  const db = new DatabaseSync(':memory:');

  // Nạp và chạy toàn bộ các file migration theo đúng thứ tự 0001 -> 0005
  const migrationsDir = join(__dirname, '../../../db/migrations');
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    db.exec(sql);
  }

  // Bọc API giả lập đúng hợp đồng Cloudflare D1
  return {
    _rawDb: db,
    prepare(query) {
      let boundParams = [];
      return {
        bind(...params) {
          boundParams = params;
          return this;
        },
        async first() {
          const stmt = db.prepare(query);
          return stmt.get(...boundParams) || null;
        },
        async all() {
          const stmt = db.prepare(query);
          const rows = stmt.all(...boundParams);
          return { results: rows, success: true };
        },
        async run() {
          const stmt = db.prepare(query);
          const result = stmt.run(...boundParams);
          return {
            success: true,
            meta: {
              changes: result.changes,
              last_row_id: result.lastInsertRowid
            }
          };
        }
      };
    },
    async batch(stmts) {
      const results = [];
      for (const stmt of stmts) {
        results.push(await stmt.run());
      }
      return results;
    }
  };
}

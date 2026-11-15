// #46: Markdown/YAML → hàng D1. Không có yêu cầu Hội đồng hoặc dấu reviewed_*.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { readingMarkup } from './tts/profile.mjs';

export function parseContent(text, file = 'content') {
  const match = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: thiếu YAML front-matter`);
  const doc = parseDocument(match[1], { uniqueKeys: true });
  if (doc.errors.length) throw new Error(`${file}: YAML không hợp lệ`);
  const fields = doc.toJS({ maxAliasCount: 20 });
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new Error(`${file}: front-matter phải là đối tượng`);
  return { ...fields, body: match[2] };
}

export function displayBody(body) {
  const text = body.replace(readingMarkup, '$1');
  if (/\[\[|\]\]/.test(text)) throw new Error('Cú pháp [[hiển thị|cách đọc]] không hợp lệ');
  return text.split('\n').map(x => x.trim()).filter(Boolean).join('\n').normalize('NFC');
}

const textField = (value, key) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Thiếu ${key}`);
  return value.trim().normalize('NFC');
};

export function publishedRow(article) {
  if (article.status !== 'da_duyet') return null;
  const id = textField(article.id, 'id');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('id không hợp lệ');
  if (!Number.isSafeInteger(article.version) || article.version < 1) throw new Error('version không hợp lệ');
  if (article.kind !== 'bai_giang') throw new Error('Thư mục này chỉ nạp bai_giang');
  const tier = article.tier ?? 0, lang = article.lang ?? 'vi';
  if (!Number.isInteger(tier) || tier < 0 || tier > 4 || typeof lang !== 'string' || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(lang)) throw new Error('tier/lang không hợp lệ');
  const body = displayBody(article.body);
  if (!body.split('\n').some(x => !x.startsWith('>'))) throw new Error('Bài không có ý nào');
  const key = article.body_r2_key || null;
  if (key && (typeof key !== 'string' || !/^bai-giang\/[a-z0-9_./-]+\.mp3$/.test(key) || key.includes('..') || key.includes('//') || key.startsWith('bai-giang/_'))) throw new Error('body_r2_key không hợp lệ');
  const reviewedAt = article.reviewed_at === '' ? null : article.reviewed_at ?? null;
  if (reviewedAt !== null && (!Number.isSafeInteger(reviewedAt) || reviewedAt < 0)) throw new Error('reviewed_at không hợp lệ');
  if (article.meta != null && (typeof article.meta !== 'object' || Array.isArray(article.meta))) throw new Error('meta phải là khối YAML');
  return { id, version: article.version, kind: article.kind, tier, lang,
    title: textField(article.title, 'title'), body_inline: body, body_r2_key: key,
    source_ref: textField(article.source_ref, 'source_ref'), status: 'da_duyet',
    reviewed_by: article.reviewed_by == null || article.reviewed_by === '' ? null : textField(article.reviewed_by, 'reviewed_by'), reviewed_at: reviewedAt,
    meta: article.meta == null ? null : JSON.stringify(article.meta),
  };
}

export function readPublished(dir) {
  const seen = new Set(), rows = [];
  for (const file of readdirSync(dir).filter(x => x.endsWith('.md') && x.toLowerCase() !== 'readme.md').sort()) {
    let row;
    try { row = publishedRow(parseContent(readFileSync(join(dir, file), 'utf8'), file)); }
    catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }); }
    if (!row) continue;
    const key = `${row.id}:${row.version}`;
    if (seen.has(key)) throw new Error(`Trùng (id, version): ${key}`);
    seen.add(key); rows.push(row);
  }
  return rows;
}

// Một câu mỗi dòng: hỗ trợ cả D1 exec và wrangler --file, không nội suy SQL thô.
const literal = value => value == null ? 'NULL' : typeof value === 'number' ? String(value)
  : String(value).split('\n').map(x => `'${x.replaceAll("'", "''")}'`).join('||char(10)||');
export function contentSql(rows) {
  const columns = ['id', 'version', 'kind', 'tier', 'lang', 'title', 'body_inline', 'body_r2_key', 'source_ref', 'status', 'reviewed_by', 'reviewed_at', 'meta'];
  return rows.map(row => `INSERT INTO content_item (${columns.join(',')}) VALUES (${columns.map(key => literal(row[key])).join(',')}) ON CONFLICT(id,version) DO UPDATE SET ${columns.slice(2).map(key => `${key}=excluded.${key}`).join(',')};`).join('\n');
}

// #46: Markdown/YAML → hàng D1. Không có yêu cầu Hội đồng hoặc dấu reviewed_*.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { readingMarkup } from './tts/profile.mjs';
import { isParami, isPunna } from '../packages/shared/src/parami.js';

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

function header(article) {
  const id = textField(article.id, 'id');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('id không hợp lệ');
  if (!Number.isSafeInteger(article.version) || article.version < 1) throw new Error('version không hợp lệ');
  if (!['bai_giang', 'nhiem_vu'].includes(article.kind)) throw new Error('Chỉ nạp kind bai_giang hoặc nhiem_vu');
  const tier = article.tier ?? 0, lang = article.lang ?? 'vi';
  if (!Number.isInteger(tier) || tier < 0 || tier > 4 || typeof lang !== 'string' || !/^[a-z]{2}(?:-[A-Z]{2})?$/.test(lang)) throw new Error('tier/lang không hợp lệ');
  textField(article.title, 'title'); textField(article.source_ref, 'source_ref');
  return { id, tier, lang };
}

/** #87: kiểm cả nháp nhiệm vụ; không chọn phát hành thay chủ dự án. */
export function validateMission(article) {
  header(article);
  if (article.kind !== 'nhiem_vu') throw new Error('Nhiệm vụ phải có kind nhiem_vu');
  const body = textField(article.body, 'body');
  if (body.includes('\n') || body.includes('\r') || [...body].length > 90 || /[.!?]\s+\S|\[\[|\]\]|^>/.test(body)) throw new Error('Nhiệm vụ cần một câu hành động ≤90 ký tự');
  if (article.body_r2_key) throw new Error('Nhiệm vụ không có âm thanh body_r2_key');
  const m = article.meta;
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('Nhiệm vụ thiếu meta');
  const fields = ['nhom', 'gioi', 'parami', 'punna', 'tuan', 'minutes', 'money', 'at_home', 'outdoors', 'needs_others', 'scope', 'safety_note', 'gioi_trai'];
  if (Object.keys(m).some(k => !fields.includes(k))) throw new Error('meta nhiệm vụ có trường chưa khai báo');
  if (!['gioi', 'hanh', 'nguyen', 'trai'].includes(m.nhom)) throw new Error('meta.nhom không hợp lệ');
  if (!Array.isArray(m.parami) || !m.parami.length || !m.parami.every(isParami) || new Set(m.parami).size !== m.parami.length || !isPunna(m.punna)) throw new Error('Mã parami/punna không hợp lệ');
  if (m.nhom === 'gioi' ? !Number.isInteger(m.gioi) || m.gioi < 1 || m.gioi > 5 : m.gioi != null) throw new Error('meta.gioi chỉ là số 1–5 của nhóm gioi');
  if (m.nhom === 'nguyen' ? !Number.isInteger(m.tuan) || m.tuan < 1 || m.tuan > 7 : m.tuan != null) throw new Error('meta.tuan chỉ là số 1–7 của nhóm nguyen');
  if (m.nhom === 'nguyen' && !/^Khi .+ thì tôi .+/.test(body)) throw new Error('Nguyện tuần cần mẫu Khi … thì tôi …');
  if (!Number.isInteger(m.minutes) || m.minutes < 1 || m.minutes > 1440) throw new Error('meta.minutes cần số phút nguyên trong ngày');
  if (m.money !== false && m.money !== 'optional') throw new Error('meta.money chỉ nhận false hoặc optional');
  if (['at_home', 'outdoors', 'needs_others'].some(k => typeof m[k] !== 'boolean')) throw new Error('Cờ hoàn cảnh phải là boolean');
  if (!['doi_thuc', 'dong_tu'].includes(m.scope)) throw new Error('meta.scope không hợp lệ');
  if (m.gioi === 5 || m.nhom === 'trai') textField(m.safety_note, 'meta.safety_note');
  if (m.nhom === 'trai') {
    if (!Array.isArray(m.gioi_trai) || m.gioi_trai.length !== 8 || m.gioi_trai.some(x => typeof x !== 'string' || !x.trim() || [...x.normalize('NFC')].length > 90) || new Set(m.gioi_trai).size !== 8) throw new Error('Thẻ Bát quan trai cần tám giới riêng biệt');
  } else if (m.gioi_trai != null) throw new Error('gioi_trai chỉ dùng cho thẻ trai');
  return article;
}

export function contentRow(article) {
  if (article.status !== 'da_duyet' && article.status !== 'ngung') return null;
  const { id, tier, lang } = header(article);
  const row = { id, version: article.version, kind: article.kind, tier, lang,
    title: textField(article.title, 'title'), source_ref: textField(article.source_ref, 'source_ref'), status: article.status,
  };
  // Phiên bản ngừng chỉ giữ thông tin nhận diện, không mang bài hoặc khóa phát.
  if (article.status === 'ngung') return { ...row,
    body_inline: null, body_r2_key: null, reviewed_by: null, reviewed_at: null, meta: null,
  };
  if (article.kind === 'nhiem_vu') validateMission(article);
  const body = displayBody(article.body);
  if (!body.split('\n').some(x => !x.startsWith('>'))) throw new Error('Bài không có ý nào');
  const key = article.body_r2_key || null;
  if (key && (typeof key !== 'string' || !/^bai-giang\/[a-z0-9_./-]+\.mp3$/.test(key) || key.includes('..') || key.includes('//') || key.startsWith('bai-giang/_'))) throw new Error('body_r2_key không hợp lệ');
  const reviewedAt = article.reviewed_at === '' ? null : article.reviewed_at ?? null;
  if (reviewedAt !== null && (!Number.isSafeInteger(reviewedAt) || reviewedAt < 0)) throw new Error('reviewed_at không hợp lệ');
  if (article.meta != null && (typeof article.meta !== 'object' || Array.isArray(article.meta))) throw new Error('meta phải là khối YAML');
  return { ...row, body_inline: body, body_r2_key: key,
    reviewed_by: article.reviewed_by == null || article.reviewed_by === '' ? null : textField(article.reviewed_by, 'reviewed_by'), reviewed_at: reviewedAt,
    meta: article.meta == null ? null : JSON.stringify(article.meta),
  };
}

export function readContentRows(dir) {
  const seen = new Set(), rows = [];
  const files = (folder) => readdirSync(folder, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const file = join(folder, entry.name);
    return entry.isDirectory() ? files(file) : entry.isFile() && entry.name.endsWith('.md') && entry.name.toLowerCase() !== 'readme.md' ? [file] : [];
  });
  for (const file of files(dir)) {
    let row;
    try {
      const article = parseContent(readFileSync(file, 'utf8'), file);
      if (article.kind === 'nhiem_vu' && article.status !== 'ngung') validateMission(article);
      row = contentRow(article);
    }
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

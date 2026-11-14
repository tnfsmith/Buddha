import { describe, it, expect } from 'vitest';
import { parseContent, publishedRow, displayBody, contentSql, readPublished } from '../content-data.mjs';

const article = { id: 'bai-thu', version: 2, kind: 'bai_giang', title: "Tên 'thử'", source_ref: 'Nguồn thử', status: 'da_duyet', body: 'Ý thứ nhất.\n> Pāli.\nÝ thứ hai.' };
describe('nạp bài giảng đã chọn phát hành', () => {
  it('đọc YAML lồng meta, không đòi reviewed_*', () => {
    const parsed = parseContent('---\nid: bai-thu\nmeta:\n  chuong: [4, 5]\n  loat: duong-xua\n---\nÝ thứ nhất.');
    expect(parsed.meta).toEqual({ chuong: [4, 5], loat: 'duong-xua' });
    expect(publishedRow(article)).toMatchObject({ reviewed_at: null, reviewed_by: null, body_r2_key: null });
  });
  it.each(['nhap', 'cho_duyet', 'ngung'])('không nạp %s kể cả có dấu reviewed', status => {
    expect(publishedRow({ ...article, status, reviewed_at: 123 })).toBeNull();
  });
  it.each(['id', 'title', 'source_ref'])('từ chối bài công khai thiếu %s', field => {
    expect(() => publishedRow({ ...article, [field]: '' })).toThrow();
  });
  it('không coi dòng Pāli là ý; bỏ cách đọc khi ghi chữ hiển thị', () => {
    expect(() => publishedRow({ ...article, body: '> Pāli.' })).toThrow('không có ý');
    expect(displayBody('[[Pháp Cú 129|Pháp Cú một trăm hai mươi chín]]\n> Pāli.')).toBe('Pháp Cú 129\n> Pāli.');
    expect(() => displayBody('[[chưa đóng')).toThrow();
  });
  it('từ chối YAML trùng khóa và khóa media nguy hiểm', () => {
    expect(() => parseContent('---\nid: a\nid: b\n---\nÝ')).toThrow('YAML');
    for (const key of ['../a.mp3', 'https://x/a.mp3', 'bai-giang/_mau-giong/a.mp3', 'bai-giang/x/../a.mp3']) expect(() => publishedRow({ ...article, body_r2_key: key })).toThrow();
  });
  it('SQL escape dấu nháy, có upsert, không có DELETE; tách dòng bằng char(10)', () => {
    const sql = contentSql([publishedRow(article)]);
    expect(sql).toContain("'Tên ''thử'''" );
    expect(sql).toContain('ON CONFLICT(id,version) DO UPDATE SET');
    expect(sql).toContain('||char(10)||');
    expect(sql).not.toMatch(/DELETE|DROP|\n/);
  });
  it('đọc đúng bảy bài v2 đã phát hành trên main', () => {
    const rows = readPublished('content/bai-giang');
    expect(rows).toHaveLength(7);
    expect(rows.every(row => row.version === 2 && row.source_ref)).toBe(true);
  });
});

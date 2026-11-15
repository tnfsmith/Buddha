import { describe, it, expect } from 'vitest';
import { parseContent, publishedRow, displayBody, contentSql, readPublished, validateMission } from '../content-data.mjs';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, sep } from 'node:path';
import { stringify } from 'yaml';
import { PARAMI } from '../../packages/shared/src/parami.js';

const article = { id: 'bai-thu', version: 2, kind: 'bai_giang', title: "Tên 'thử'", source_ref: 'Nguồn thử', status: 'da_duyet', body: 'Ý thứ nhất.\n> Pāli.\nÝ thứ hai.' };
describe('nạp bài giảng đã chọn phát hành', () => {
  it('đọc YAML lồng meta, không đòi reviewed_*', () => {
    const parsed = parseContent('---\nid: bai-thu\nmeta:\n  chuong: [4, 5]\n  loat: duong-xua\n---\nÝ thứ nhất.');
    expect(parsed.meta).toEqual({ chuong: [4, 5], loat: 'duong-xua' });
    expect(publishedRow(article)).toMatchObject({ reviewed_at: null, reviewed_by: null, body_r2_key: null });
  });
  it('giữ khối meta dưới dạng JSON, không ép bài thiếu meta hoặc mở bản nháp', () => {
    const meta = { loat: 'duong-xua', phan: 1, thu_tu: 20, chuong: [4], dot: 'B', note: "Dấu 'nháy' và tiếng Việt" };
    expect(JSON.parse(publishedRow({ ...article, meta }).meta)).toEqual(meta);
    expect(publishedRow(article).meta).toBeNull();
    expect(publishedRow({ ...article, meta, status: 'cho_duyet' })).toBeNull();
    expect(() => publishedRow({ ...article, meta: [] })).toThrow('meta');
    expect(contentSql([publishedRow({ ...article, meta })])).toContain('meta=excluded.meta');
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
  it('giữ đủ bảy bài Lời Phật dạy v2 khi bổ sung loạt khác', () => {
    const rows = readPublished('content/bai-giang');
    const baseline = rows.filter(row => JSON.parse(row.meta || '{}').loat === 'loi-phat-day');
    expect(baseline).toHaveLength(7);
    expect(baseline.every(row => row.version === 2 && row.source_ref)).toBe(true);
  });
});

const mission = { id: 'kiem-nhiem-vu', version: 1, kind: 'nhiem_vu', tier: 0, lang: 'vi', title: 'Bảo vệ sự sống', source_ref: 'Vân Đạo tự biên soạn; tham khảo AN 8.39', status: 'da_duyet', body: 'Dọn một vật sắc khỏi lối đi trong nhà.',
  meta: { nhom: 'gioi', gioi: 1, parami: ['sila', 'metta'], punna: 'sila', tuan: null, minutes: 2, money: false, at_home: true, outdoors: false, needs_others: false, scope: 'doi_thuc' } };
const markdown = ({ body, ...a }) => '---\n' + stringify(a) + '---\n' + body + '\n';
function temporaryCatalog(run) {
  const parent = resolve(tmpdir()), dir = mkdtempSync(join(parent, 'vandao-content-'));
  // Chỉ dọn thư mục thử vừa tạo, là con trực tiếp của thư mục tạm.
  const child = relative(parent, dir);
  if (!child.startsWith('vandao-content-') || child.includes(sep)) throw new Error('Sai đường dẫn dọn fixture');
  try { run(dir); }
  finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('nạp danh mục nhiệm vụ #87 cùng bài giảng', () => {
  it('giữ đúng kind, cờ boolean và mã meta; nháp không được chọn phát hành', () => {
    expect(publishedRow(mission)).toMatchObject({ kind: 'nhiem_vu', tier: 0, body_r2_key: null, reviewed_at: null });
    expect(JSON.parse(publishedRow(mission).meta)).toEqual(mission.meta);
    expect(publishedRow({ ...mission, status: 'cho_duyet' })).toBeNull();
    expect(() => publishedRow({ ...article, kind: 'kinh_van' })).toThrow('kind');
  });
  it.each([
    ['nhom', 'tuan'], ['gioi', 6], ['parami', []], ['parami', ['sila', 'sila']], ['parami', ['khong-co']],
    ['punna', 'cong-duc-tien'], ['minutes', 0], ['minutes', 1.5], ['money', true], ['money', 'false'],
    ['at_home', 'true'], ['outdoors', 0], ['needs_others', null], ['scope', 'app'], ['ghi_chu_ca_nhan', 'không nhận trường lạ'],
  ])('từ chối meta %s sai kiểu hoặc ngoài hợp đồng', (field, value) => {
    expect(() => validateMission({ ...mission, meta: { ...mission.meta, [field]: value } })).toThrow();
  });
  it('giữ optional hợp lệ và đếm 90 ký tự sau NFC, không mở đường âm thanh/markup', () => {
    expect(() => validateMission({ ...mission, meta: { ...mission.meta, money: 'optional' } })).not.toThrow();
    expect(() => validateMission({ ...mission, body: 'ắ'.normalize('NFD').repeat(90) })).not.toThrow();
    for (const body of ['x'.repeat(91), 'Việc một. Việc hai.', 'Một dòng\nDòng khác', '[[Hiển thị|cách đọc]]']) expect(() => validateMission({ ...mission, body })).toThrow();
    expect(() => validateMission({ ...mission, body_r2_key: 'bai-giang/loi-phat-day/a.mp3' })).toThrow('âm thanh');
  });
  it('yêu cầu ghi chú an toàn giới 5; Nguyện tuần đúng mẫu và số tuần', () => {
    expect(() => validateMission({ ...mission, meta: { ...mission.meta, gioi: 5 } })).toThrow('safety_note');
    const meta = { ...mission.meta, nhom: 'nguyen', gioi: null, tuan: 1 };
    expect(() => validateMission({ ...mission, meta })).toThrow('Khi');
    expect(() => validateMission({ ...mission, meta, body: 'Khi vừa thức dậy thì tôi thở ba hơi.' })).not.toThrow();
    expect(() => validateMission({ ...mission, meta: { ...meta, tuan: 8 }, body: 'Khi vừa thức dậy thì tôi thở ba hơi.' })).toThrow('tuan');
  });
  it('một thẻ trai có tám giới, tách khỏi mã Ngũ giới 1–5', () => {
    const meta = { ...mission.meta, nhom: 'trai', gioi: null, safety_note: 'Giảm dần cùng nhân viên y tế nếu đang phụ thuộc.', gioi_trai: Array.from({ length: 8 }, (_, i) => `Giới ${i + 1}`) };
    expect(() => validateMission({ ...mission, meta })).not.toThrow();
    expect(() => validateMission({ ...mission, meta: { ...meta, gioi: 8 } })).toThrow('gioi');
    expect(() => validateMission({ ...mission, meta: { ...meta, gioi_trai: meta.gioi_trai.slice(1) } })).toThrow('tám');
  });
  it('đọc thư mục lồng, bỏ README; từ chối cả nháp lỗi và trùng id/version giữa hai kind', () => temporaryCatalog(dir => {
    const nested = join(dir, 'nhiem-vu', 'so-nhap'); mkdirSync(nested, { recursive: true });
    writeFileSync(join(dir, 'bai.md'), markdown(article)); writeFileSync(join(nested, 'a.md'), markdown(mission));
    writeFileSync(join(nested, 'README.md'), 'Tài liệu không phải mục nội dung.');
    const draftFile = join(nested, 'nhap.md');
    writeFileSync(draftFile, markdown({ ...mission, id: 'nhap', status: 'cho_duyet' }));
    expect(readPublished(dir).map(x => x.kind).sort()).toEqual(['bai_giang', 'nhiem_vu']);
    writeFileSync(draftFile, markdown({ ...mission, id: 'nhap', status: 'cho_duyet', meta: { ...mission.meta, money: 'false' } }));
    expect(() => readPublished(dir)).toThrow('money');
    writeFileSync(draftFile, markdown({ ...mission, id: article.id, version: article.version }));
    expect(() => readPublished(dir)).toThrow('Trùng');
  }));
});

describe('độ phủ danh mục Sơ nhập theo chỉ thị #87', () => {
  const dir = 'content/nhiem-vu/so-nhap';
  const items = readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md').map(f => parseContent(readFileSync(join(dir, f), 'utf8'), f));
  it('đủ 73 câu có nguồn, mã riêng, không quá 90 ký tự và không cần tiền', () => {
    expect(items).toHaveLength(73);
    expect(new Set(items.map(x => x.id)).size).toBe(73);
    expect(new Set(items.map(x => x.body.trim())).size).toBe(73);
    for (const item of items) {
      expect(() => validateMission(item)).not.toThrow();
      expect(item.source_ref).toMatch(/https:\/\//);
      expect(item).toMatchObject({ kind: 'nhiem_vu', tier: 0, lang: 'vi', meta: { money: false, scope: 'doi_thuc' } });
      expect(['cho_duyet', 'da_duyet']).toContain(item.status);
      expect(item.body).not.toMatch(/chứng đắc|mua.*phóng sinh|(?:\d+).*\bVND\b/i);
    }
    expect(readPublished('content').filter(x => x.kind === 'nhiem_vu').map(x => x.id).sort()).toEqual(items.filter(x => x.status === 'da_duyet').map(x => x.id).sort());
  });
  it('mỗi giới 5 việc, đúng tên tích cực và ít nhất 2 việc ở nhà không tốn tiền', () => {
    const names = ['Bảo vệ sự sống', 'Tôn trọng của người', 'Thủy chung và tôn trọng', 'Lời thật, lời lành', 'Tỉnh thức khi tiêu thụ'];
    for (let i = 1; i <= 5; i++) {
      const group = items.filter(x => x.meta.nhom === 'gioi' && x.meta.gioi === i);
      expect(group).toHaveLength(5); expect(group.every(x => x.title === names[i - 1])).toBe(true);
      expect(group.filter(x => x.meta.at_home && x.meta.money === false).length).toBeGreaterThanOrEqual(2);
      if (i === 5) for (const x of group) expect(x.meta.safety_note).toMatch(/phụ thuộc.*nhân viên y tế/);
    }
  });
  it('mười Ba-la-mật có bốn việc mỗi hạnh; bảy tuần khớp hai trọng tâm §5.1', () => {
    const habits = items.filter(x => x.meta.nhom === 'hanh'); expect(habits).toHaveLength(40);
    for (const code of Object.keys(PARAMI)) expect(habits.filter(x => x.meta.parami.length === 1 && x.meta.parami[0] === code)).toHaveLength(4);
    const focus = [['viriya', 'metta'], ['sacca', 'khanti'], ['sila', 'nekkhamma'], ['dana', 'sacca'], ['metta', 'khanti'], ['khanti', 'upekkha'], ['adhitthana', 'panna']];
    const vows = items.filter(x => x.meta.nhom === 'nguyen').sort((a, b) => a.meta.tuan - b.meta.tuan); expect(vows).toHaveLength(7);
    vows.forEach((x, i) => { expect(x.meta.tuan).toBe(i + 1); expect(x.meta.parami).toEqual(focus[i]); });
    expect(items.filter(x => x.meta.nhom === 'trai')).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { checkVariantCoverage, contentRow, parseContent, readContentRows } from '../content-data.mjs';

const example = {
  id: 'sn49-w1-duc-thu', version: 1, kind: 'chuong_trinh', tier: 0, lang: 'vi',
  title: 'Việc thử', source_ref: 'Fixture của Vân Đạo', status: 'da_duyet',
  body: 'Dọn một vật sắc khỏi lối đi trong nhà.',
  meta: {
    program: 'so-nhap-49', schema: 1, week: 1, pillar: 'duc', level: 'nhe', minutes: 5,
    money: false, at_home: true, outdoors: false, needs_others: false,
    punna: 'sila', parami: ['sila', 'metta'], scope: 'doi_thuc',
  },
};
const fromMarkdown = ({ body, ...fields }) => contentRow(parseContent(`---\n${stringify(fields)}---\n${body}\n`));
const complete = () => {
  const rows = [];
  for (let week = 1; week <= 7; week++) {
    for (const pillar of ['duc', 'thien', 'tue']) {
      for (let i = 1; i <= 3; i++) {
        rows.push(contentRow({ ...example, id: `sn49-w${week}-${pillar}-thu-${i}`, body: `Dọn khu vực số ${i}.`,
          meta: { ...example.meta, week, pillar, level: i === 1 ? 'nhe' : 'vua' } }));
      }
    }
  }
  return rows;
};

describe('nạp biến thể #103 theo hợp đồng #112', () => {
  it('đọc YAML, giữ meta và chỉ xuất hàng đã chọn hoặc ngừng', () => {
    const row = fromMarkdown(example);
    expect(row).toMatchObject({ kind: 'chuong_trinh', version: 1, body_inline: example.body, body_r2_key: null });
    expect(JSON.parse(row.meta)).toEqual(example.meta);
    for (const status of ['nhap', 'cho_duyet']) expect(fromMarkdown({ ...example, status })).toBeNull();
    expect(fromMarkdown({ ...example, version: 2, status: 'ngung', body: '', meta: undefined }))
      .toMatchObject({ version: 2, status: 'ngung', body_inline: null, meta: null });
  });

  it.each([
    { id: 'nhiem-vu-cu' }, { tier: 1 }, { tier: null }, { lang: 'en' }, { version: 0 }, { status: 'duyet' },
    { source_ref: '' }, { body: 'ắ'.repeat(91) }, { body: 'Việc đầu. Việc sau.' }, { body: 'Một dòng.\nDòng hai.' },
    { body_r2_key: 'bai-giang/thu.mp3' },
  ])('từ chối định dạng sai ở bản biên tập %j', (patch) => {
    expect(() => fromMarkdown({ ...example, status: 'cho_duyet', ...patch })).toThrow();
  });

  it.each([
    ['program', 'khac'], ['schema', '1'], ['week', 8], ['pillar', 'gioi'], ['level', 'cao'], ['minutes', 1.5],
    ['money', true], ['at_home', 'true'], ['outdoors', 0], ['needs_others', null], ['punna', 'tien'],
    ['punna', ['sila']], ['parami', ['sila', 'sila']], ['parami', [['sila']]], ['scope', 'app'], ['note', 'ngoài hợp đồng'],
  ])('từ chối meta %s sai kiểu hoặc ngoài hợp đồng', (key, value) => {
    expect(() => fromMarkdown({ ...example, status: 'cho_duyet', meta: { ...example.meta, [key]: value } })).toThrow();
  });

  it('kiểm 21 ô với đúng 63 mục và bỏ phiên bản cũ khi đếm độ phủ', () => {
    const rows = complete();
    const newest = { ...rows[0], version: 2 };
    expect(rows).toHaveLength(63);
    expect(() => checkVariantCoverage([newest, ...rows])).not.toThrow();
    const stopped = { ...newest, status: 'ngung', meta: null, body_inline: null };
    expect(() => checkVariantCoverage([...rows, stopped])).toThrow('Tuần 1/duc cần 3–6');
    expect(() => checkVariantCoverage([stopped, ...rows, { ...newest, version: 3 }])).not.toThrow();
  });

  it('mỗi ô cần việc miễn phí, tại nhà, nhẹ và làm một mình dưới giới hạn phút', () => {
    const [first, ...others] = complete();
    const meta = JSON.parse(first.meta);
    for (const change of [{ minutes: 6 }, { money: 'optional' }, { at_home: false }, { needs_others: true }]) {
      const variant = { ...first, meta: JSON.stringify({ ...meta, ...change }) };
      expect(() => checkVariantCoverage([variant, ...others])).toThrow('thiếu phương án nhẹ');
    }
  });

  it('danh mục nhiệm vụ cũ còn nguyên và danh mục trống không đạt điều kiện bật bộ chọn', () => {
    const rows = readContentRows('content/nhiem-vu/so-nhap');
    expect(rows.filter((row) => row.kind === 'nhiem_vu' && row.status === 'da_duyet')).toHaveLength(73);
    expect(() => checkVariantCoverage([])).toThrow('Tuần 1/duc');
  });
});

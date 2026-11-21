import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkHelpPost, HELP_AREAS, HO_TRI_REASON_TEXT, HO_TRI_V } from '../src/ho-tri.js';

const input = { kind: 'can_giup', title: 'Cần người cùng học', body: 'Mình muốn cùng đọc một đoạn.', area: 'vn_79' };

describe('hợp đồng Hộ Trì', () => {

  it('giữ fixture cho máy chủ giả cùng phiên bản và mã lỗi với helper', () => {
    const fixture = JSON.parse(readFileSync(new URL('../../../docs/contracts/ho-tri-fixture.json', import.meta.url), 'utf8'));
    expect(fixture.me.community.v).toBe(HO_TRI_V);
    expect(fixture.me).toMatchObject({ journey: { day: 1 }, community: { allowed: true, reason: null } });
    expect(checkHelpPost(fixture.create_post).ok).toBe(true);
    expect(fixture.help_detail.item.replies).toBe(fixture.help_detail.replies.length);
    expect(fixture.help.items[0].author).toBeNull();
    expect(fixture.me.community.terms_url).toContain(fixture.me.community.terms_version);
    expect(fixture.me_guide.community.guide).toBe(true);
    expect(fixture.me_legacy).not.toHaveProperty('community');
    expect(fixture.help_detail.my_match.other).toBeNull();
    expect(fixture.owner_matches.items.every((row) => !Object.hasOwn(row.other, 'tag'))).toBe(true);
    expect(fixture.match.other.tag).toBe('0472');
    const views = [
      ...fixture.help.items, ...fixture.help_mine.items, fixture.create_published.item, fixture.create_pending.item,
      fixture.help_detail.item, ...fixture.help_detail.replies, fixture.help_phap_detail.item, ...fixture.help_phap_detail.replies,
    ];
    expect(views.every((row) => !row.author || !Object.hasOwn(row.author, 'tag'))).toBe(true);
    for (const [code, { error }] of Object.entries(fixture.errors)) {
      expect(error).toEqual({ code, message: HO_TRI_REASON_TEXT[code] });
    }
  });
  it('giữ mã 34 tỉnh thành và khu vực trực tuyến', () => {
    expect(Object.keys(HELP_AREAS).filter((key) => /^vn_\d{2}$/.test(key))).toHaveLength(34);
    expect(HELP_AREAS).toMatchObject({ vn_01: 'Hà Nội', vn_79: 'Hồ Chí Minh', truc_tuyen: 'Trực tuyến' });
  });

  it('chuẩn hóa tiếng Việt, loại khoảng trắng đầu cuối và điền mặc định', () => {
    const title = 'Cần người cùng học';
    expect(checkHelpPost({ ...input, title: ' ' + title.normalize('NFD') + ' ', body: '  Nội dung  ', area: undefined }))
      .toEqual({ ok: true, post: { kind: 'can_giup', title, body: 'Nội dung', area: null, anonymous: false } });
  });

  it('đếm điểm mã Unicode theo giới hạn lưu trữ', () => {
    expect(checkHelpPost({ ...input, title: 'à'.normalize('NFD').repeat(80), body: '🌿'.repeat(1000) }).ok).toBe(true);
    expect(checkHelpPost({ ...input, title: 'à'.repeat(81) })).toEqual({ ok: false, code: 'invalid_title' });
    expect(checkHelpPost({ ...input, body: '🌿'.repeat(1001) })).toEqual({ ok: false, code: 'invalid_body' });
  });

  it.each([
    [null, 'invalid_payload'],
    [{ ...input, author_id: 'client-id' }, 'invalid_payload'],
    [{ ...input, anonymous: 'false' }, 'invalid_payload'],
    [{ ...input, kind: ['can_giup'] }, 'invalid_kind'],
    [{ ...input, kind: 'toString' }, 'invalid_kind'],
    [{ ...input, area: 'vn_02' }, 'invalid_area'],
    [{ ...input, area: '__proto__' }, 'invalid_area'],
    [{ ...input, title: 'bốn!' }, 'invalid_title'],
    [{ ...input, body: '  ' }, 'invalid_body'],
    [{ ...input, body: 'a\0b' }, 'invalid_body'],
  ])('từ chối dữ liệu không hợp lệ %j', (body, code) => {
    expect(checkHelpPost(body)).toEqual({ ok: false, code });
    expect(HO_TRI_REASON_TEXT[code]).toEqual(expect.any(String));
  });
});

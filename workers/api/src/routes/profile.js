// workers/api/src/routes/profile.js
// Cập nhật hồ sơ hành giả (PROJECT_ROADMAP.md §4.3, §5)
import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { checkName } from '@vandao/shared';
import { isValidTimeZone } from '../utils/time.js';
import { nameKey, randomTag } from '../auth/session.js';
import { readJson, bad, nameError, jsonCapped } from '../lib.js';

const profileApp = new Hono();

profileApp.patch('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const now = Date.now();

  const body = await readJson(c);
  if (!body) return bad(c, 'invalid_body', 'Dữ liệu cập nhật không hợp lệ');

  const current = await db.prepare(
    `SELECT tinh_danh, tinh_danh_key, tag, look_json, settings_json, island_json, tz,
            tz_changed_at, name_changed_at, visibility, pref_seat, rev
     FROM profile
     WHERE user_id = ?`
  ).bind(user.id).first();

  if (!current) {
    return c.json({ error: { code: 'profile_not_found', message: 'Hồ sơ không tồn tại' } }, 404);
  }

  let newName = current.tinh_danh;
  let newNameKey = current.tinh_danh_key;
  let nameChangedAt = current.name_changed_at;

  // 1. Đổi Tịnh danh (kiểm tra 4 quy tắc và giới hạn 30 ngày)
  if (body.tinh_danh !== undefined && body.tinh_danh !== current.tinh_danh) {
    const check = checkName(String(body.tinh_danh ?? ''));
    if (!check.ok) return bad(c, 'invalid_name', nameError(check));

    if (current.name_changed_at && now - current.name_changed_at < 30 * 24 * 60 * 60 * 1000) {
      return c.json({
        error: {
          code: 'name_cooldown',
          message: 'Tịnh danh chỉ được đổi tối đa 1 lần trong 30 ngày'
        }
      }, 429);
    }

    newName = check.name;
    newNameKey = nameKey(check.name);
    // lần đặt tên đầu tiên (khách ẩn danh chưa có tên) không tính vào giới hạn đổi tên 30 ngày
    nameChangedAt = current.tinh_danh ? now : null;
  }

  // 2. Đổi múi giờ (kiểm tra múi giờ IANA và giới hạn 7 ngày chống nhảy ngày)
  let newTz = current.tz;
  let tzChangedAt = current.tz_changed_at;
  if (body.tz !== undefined && body.tz !== current.tz) {
    if (!isValidTimeZone(body.tz)) {
      return c.json({ error: { code: 'invalid_timezone', message: 'Múi giờ không hợp lệ' } }, 400);
    }
    if (current.tz_changed_at && now - current.tz_changed_at < 7 * 24 * 60 * 60 * 1000) {
      return c.json({
        error: {
          code: 'tz_cooldown',
          message: 'Múi giờ chỉ được đổi tối đa 1 lần trong 7 ngày'
        }
      }, 429);
    }
    newTz = body.tz;
    tzChangedAt = now;
  }

  // 3. Diện mạo (look)
  let newLookJson = current.look_json;
  if (body.look !== undefined) {
    newLookJson = jsonCapped(body.look, 4096);
    if (newLookJson === null) return bad(c, 'invalid_look', 'Diện mạo phải là đối tượng JSON, tối đa 4 KB');
  }

  // 4. Cài đặt (settings)
  let newSettingsJson = current.settings_json;
  if (body.settings !== undefined) {
    newSettingsJson = body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings) ? jsonCapped({ ...JSON.parse(current.settings_json || '{}'), ...body.settings }) : null;
    if (newSettingsJson === null) return bad(c, 'invalid_settings', 'Cài đặt phải là đối tượng JSON, tối đa 8 KB');
  }

  // 5. Vị trí đảo (island)
  let newIslandJson = current.island_json;
  if (body.island !== undefined) {
    newIslandJson = jsonCapped(body.island);
    if (newIslandJson === null) return bad(c, 'invalid_island', 'Dữ liệu đảo phải là đối tượng JSON, tối đa 8 KB');
  }

  // 6. Quyền hiển thị (visibility: 'an' | 'dong_tu' | 'cong_khai')
  let newVisibility = current.visibility;
  if (body.visibility !== undefined) {
    if (!['an', 'dong_tu', 'cong_khai'].includes(body.visibility)) {
      return c.json({ error: { code: 'invalid_visibility', message: 'Quyền hiển thị không hợp lệ' } }, 400);
    }
    newVisibility = body.visibility;
  }

  // 7. Ghế ưa thích
  let newPrefSeat = current.pref_seat;
  if (body.pref_seat !== undefined) {
    newPrefSeat = Number.isInteger(body.pref_seat) ? body.pref_seat : null;
  }

  const newRev = (current.rev || 1) + 1;

  // Trùng (Tịnh danh, thẻ) với người khác thì bốc thẻ 4 số mới, tối đa 5 lần
  let tag = current.tag;
  for (let attempt = 0; ; attempt++) {
    try {
      await db.prepare(
        `UPDATE profile
         SET tinh_danh = ?, tinh_danh_key = ?, tag = ?, look_json = ?, settings_json = ?, island_json = ?,
             tz = ?, tz_changed_at = ?, name_changed_at = ?, visibility = ?, pref_seat = ?,
             rev = ?, updated_at = ?
         WHERE user_id = ?`
      ).bind(
        newName, newNameKey, tag, newLookJson, newSettingsJson, newIslandJson,
        newTz, tzChangedAt, nameChangedAt, newVisibility, newPrefSeat,
        newRev, now, user.id
      ).run();
      break;
    } catch (e) {
      if (attempt >= 4 || !/UNIQUE/i.test(String(e && e.message))) throw e;
      tag = randomTag();
    }
  }
  // Better Auth hiện user.name trong hộp thoại passkey/Google → đi theo Tịnh danh "Tên · 1234"
  if (newName && newName !== current.tinh_danh) await db.prepare('UPDATE user SET name = ?, updatedAt = ? WHERE id = ?').bind(`${newName} · ${tag}`, now, user.id).run();

  return c.json({
    success: true,
    profile: {
      tinh_danh: newName,
      tag,
      look: JSON.parse(newLookJson),
      settings: JSON.parse(newSettingsJson),
      island: JSON.parse(newIslandJson),
      tz: newTz,
      visibility: newVisibility,
      pref_seat: newPrefSeat,
      rev: newRev
    }
  });
});

export default profileApp;

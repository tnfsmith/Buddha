// workers/api/src/routes/me.js
// Trạng thái tổng thể của hành giả (PROJECT_ROADMAP.md §5)
import { byUser } from '../guard.js';
import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { ZONE_UNLOCK, gateLevel } from '@vandao/shared';
import { getLocalDate } from '../utils/time.js';
import { bad, currentJourney, kusalaTotals } from '../lib.js';
import { guestPurgeAfter } from '../cron.js';

const meApp = new Hono();

export function computeUnlockedZones(day) {
  const g = gateLevel(day);
  return {
    kuti: day >= ZONE_UNLOCK.kuti,
    pad: day >= ZONE_UNLOCK.pad,
    garden: day >= ZONE_UNLOCK.garden,
    tea: day >= ZONE_UNLOCK.tea,
    gate: g,
    stele: day >= ZONE_UNLOCK.stele,
  };
}

export const profileView = (p) => ({
  tinh_danh: p.tinh_danh, tag: p.tag,
  look: JSON.parse(p.look_json || '{}'), settings: JSON.parse(p.settings_json || '{}'), island: JSON.parse(p.island_json || '{}'),
  tz: p.tz, visibility: p.visibility, pref_seat: p.pref_seat, rev: p.rev,
});

meApp.get('/', authMiddleware, byUser('RL_API'), async (c) => {
  const user = c.get('user'), db = c.env.DB, now = Date.now();
  const profileRow = await db.prepare(
    'SELECT tinh_danh, tag, look_json, settings_json, island_json, tz, visibility, pref_seat, rev FROM profile WHERE user_id = ?',
  ).bind(user.id).first();
  if (!profileRow) return bad(c, 'profile_not_found', 'Chưa có hồ sơ hành giả', 404);
  // Ngày hành trình tiến theo luật chung tới hôm nay (ngày địa phương của người dùng)
  const J = await currentJourney(db, user.id, getLocalDate(now, profileRow.tz), now);
  return c.json({
    user,
    profile: profileView(profileRow),
    journey: J,
    totals: J ? await kusalaTotals(db, user.id, J) : { duc: 0, thien: 0, tue: 0, all: 0 },
    unlocked_zones: computeUnlockedZones(J ? J.day : 1),
    // khách chưa gắn passkey/mã khôi phục: hạn bị dọn nếu không hoạt động 90 ngày (app báo trước, §6.3)
    guest_purge_after: await guestPurgeAfter(db, user.id),
    server_now: now,
  });
});

export default meApp;

// workers/api/src/routes/me.js
// Lấy trạng thái tổng thể của hành giả (PROJECT_ROADMAP.md §5)
import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { ZONE_UNLOCK, gateLevel } from '@vandao/shared';

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
    // Alias tiếng Việt thuận tiện cho UI
    tra_dao: day >= ZONE_UNLOCK.tea,
    cong_van_mon: g === 1,
    cong_van_mon_half: g >= 0.5
  };
}

meApp.get('/', authMiddleware, async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const now = Date.now();

  const profileRow = await db.prepare(
    `SELECT tinh_danh, tag, look_json, settings_json, island_json, tz, visibility, pref_seat, rev
     FROM profile
     WHERE user_id = ?`
  ).bind(user.id).first();

  if (!profileRow) {
    return c.json({ error: { code: 'profile_not_found', message: 'Chưa có hồ sơ hành giả' } }, 404);
  }

  const journeyRow = await db.prepare(
    `SELECT program, cycle, day, started_on, last_done_on, completed_at, sacca_count, sessions_done, sermons_done, rev
     FROM journey
     WHERE user_id = ? AND is_current = 1`
  ).bind(user.id).first();

  const currentProgram = journeyRow?.program || 'so-nhap-49';
  const currentCycle = journeyRow?.cycle || 1;
  const currentDay = journeyRow?.day || 1;

  // Tính tổng Kusala từng trục từ kusala_entry
  const totalsRow = await db.prepare(
    `SELECT
       SUM(CASE WHEN pillar = 'duc' THEN e_score ELSE 0 END) as duc,
       SUM(CASE WHEN pillar = 'thien' THEN e_score ELSE 0 END) as thien,
       SUM(CASE WHEN pillar = 'tue' THEN e_score ELSE 0 END) as tue,
       SUM(e_score) as all_score
     FROM kusala_entry
     WHERE user_id = ? AND program = ? AND cycle = ?`
  ).bind(user.id, currentProgram, currentCycle).first();

  const totals = {
    duc: Number((totalsRow?.duc || 0).toFixed(1)),
    thien: Number((totalsRow?.thien || 0).toFixed(1)),
    tue: Number((totalsRow?.tue || 0).toFixed(1)),
    all: Number((totalsRow?.all_score || 0).toFixed(1))
  };

  const unlockedZones = computeUnlockedZones(currentDay);

  return c.json({
    user,
    profile: {
      tinh_danh: profileRow.tinh_danh,
      tag: profileRow.tag,
      look: JSON.parse(profileRow.look_json || '{}'),
      settings: JSON.parse(profileRow.settings_json || '{}'),
      island: JSON.parse(profileRow.island_json || '{}'),
      tz: profileRow.tz,
      visibility: profileRow.visibility,
      pref_seat: profileRow.pref_seat,
      rev: profileRow.rev
    },
    journey: journeyRow ? {
      program: journeyRow.program,
      cycle: journeyRow.cycle,
      day: journeyRow.day,
      started_on: journeyRow.started_on,
      last_done_on: journeyRow.last_done_on,
      completed_at: journeyRow.completed_at,
      sacca_count: journeyRow.sacca_count,
      sessions_done: journeyRow.sessions_done,
      sermons_done: journeyRow.sermons_done,
      rev: journeyRow.rev
    } : null,
    totals,
    unlocked_zones: unlockedZones,
    server_now: now
  });
});

export default meApp;

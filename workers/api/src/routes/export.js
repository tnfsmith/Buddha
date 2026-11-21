// workers/api/src/routes/export.js
// Xuất toàn bộ dữ liệu người dùng (Luật BVDLCN 91/2025, GDPR - PROJECT_ROADMAP.md §5, §15)
import { perDay } from '../guard.js';
import { Hono } from 'hono';
import { authMiddleware } from '../auth/session.js';
import { getPracticeProfile } from '../practice-profile.js';
import { exportCompanions } from '../companions-data.js';
import { deedView } from './deeds.js';
import { exportSessions } from '../companion-sessions.js';
import { exportCheers } from '../companion-cheers.js';
import { exportTierProgress } from '../tier-progress.js';

const exportApp = new Hono();

exportApp.get('/', authMiddleware, perDay('export', 2), async (c) => {
  const user = c.get('user');
  const db = c.env.DB;
  const now = Date.now();

  const userRow = await db.prepare(
    `SELECT id, name, email, emailVerified, createdAt, updatedAt, isAnonymous
     FROM user WHERE id = ?`
  ).bind(user.id).first();

  const profileRow = await db.prepare(
    `SELECT tinh_danh, tag, look_json, settings_json, island_json, tz, visibility, pref_seat, created_at, updated_at
     FROM profile WHERE user_id = ?`
  ).bind(user.id).first();

  const journeys = await db.prepare(
    `SELECT program, cycle, day, started_on, last_done_on, completed_at, sacca_count, sessions_done, sermons_done, is_current
     FROM journey WHERE user_id = ? ORDER BY cycle ASC`
  ).bind(user.id).all();

  const kusalaEntries = await db.prepare(
    `SELECT id, program, cycle, day, pillar, local_date, base, pre, during, post, wise, self, e_score, note, at, server_at
     FROM kusala_entry WHERE user_id = ? ORDER BY at ASC`
  ).bind(user.id).all();

  const sessions = await db.prepare(
    `SELECT id, kind, ref, place, started_at, duration_s, completed
     FROM practice_session WHERE user_id = ? ORDER BY started_at ASC`
  ).bind(user.id).all();

  const consents = await db.prepare(
    `SELECT kind, version, granted, at FROM consent WHERE user_id = ?`
  ).bind(user.id).all();

  const events = await db.prepare(
    'SELECT id, program, cycle, local_date AS date, kind, slot, value_json, at, server_at FROM practice_event WHERE user_id = ? ORDER BY at, id',
  ).bind(user.id).all();
  const practice = await getPracticeProfile(db, user.id);
  const choices = await db.prepare(`SELECT program, cycle, day, local_date AS date, pillar, variant_id, version,
    snap, profile_rev, chosen_at, swapped_at FROM practice_choice WHERE user_id = ? ORDER BY program, cycle, date, pillar`)
    .bind(user.id).all();
  const companions = await exportCompanions(db, user.id, now);
  const deeds = await db.prepare(`SELECT id, local_date AS date, punna, parami_json, scope, shared, at
    FROM deed_log WHERE user_id = ? ORDER BY at, id`).bind(user.id).all();
  const tiers = await exportTierProgress(db, user.id);

  c.header('Cache-Control', 'no-store');
  return c.json({
    exported_at: now,
    user: userRow,
    profile: profileRow ? {
      ...profileRow,
      look: JSON.parse(profileRow.look_json || '{}'),
      settings: JSON.parse(profileRow.settings_json || '{}'),
      island: JSON.parse(profileRow.island_json || '{}')
    } : null,
    practice_profile: practice.profile ? { ...practice.profile, updated_at: practice.rev } : null,
    practice_choices: choices.results,
    deeds: deeds.results.map(deedView),
    journeys: journeys?.results || [],
    tier_progress: tiers,
    kusala_entries: kusalaEntries?.results || [],
    practice_sessions: sessions?.results || [],
    practice_events: (events?.results || []).map(({ value_json, ...e }) => ({ ...e, value: value_json === null ? null : JSON.parse(value_json) })),
    consents: consents?.results || [],
    ...companions,
    dong_tu_sessions: await exportSessions(db, user.id),
    cheers: await exportCheers(db, user.id, now),
  });
});

export default exportApp;

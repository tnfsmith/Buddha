import { nextReminderAt, PUSH_CHANNEL, REMINDER_KINDS, shardOf } from '@vandao/shared/reminder.js';

const kinds = REMINDER_KINDS.map((kind) => `'${kind}'`).join(',');
const managed = `user_id = ? AND channel = '${PUSH_CHANNEL}' AND kind IN (${kinds})`;
const readRows = (db, uid) => db.prepare(`SELECT id, kind, local_hm, days_mask, active, next_at, paused_until
  FROM reminder WHERE ${managed} ORDER BY kind, id`).bind(uid);

export function pushAvailable(env) {
  return env.REMINDERS_ENABLED === '1' && Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY &&
    env.VAPID_SUBJECT && env.REMINDER_CLOCK);
}

export async function readReminders(db, uid) {
  const [owner, reminders] = await db.batch([
    db.prepare(`SELECT p.tz, COALESCE(pp.uposatha, 'vn_4') AS uposatha, rs.paused_until, rs.write_id,
      EXISTS (SELECT 1 FROM push_subscription WHERE user_id = p.user_id) AS subscribed
      FROM profile p LEFT JOIN practice_profile pp USING (user_id)
      LEFT JOIN reminder_setting rs USING (user_id) WHERE p.user_id = ?`).bind(uid),
    readRows(db, uid),
  ]);
  const policy = owner.results[0];
  if (!policy) return null;
  const rows = reminders.results;
  // Lịch từ schema cũ có thể chỉ lưu Tịnh khẩu trên từng dòng.
  if (!policy.write_id) policy.paused_until = Math.max(0, ...rows.map((r) => r.paused_until ?? 0)) || null;
  return { policy, rows };
}

export function reminderView(env, state, now) {
  const available = pushAvailable(env);
  return {
    reminders: state.rows.map((row) => ({ ...row, active: Boolean(row.active) })),
    paused_until: state.policy.paused_until > now ? state.policy.paused_until : null,
    subscribed: Boolean(state.policy.subscribed),
    push_available: available,
    vapid_public_key: available ? env.VAPID_PUBLIC_KEY : null,
  };
}

const clockFor = (env, uid) => env.REMINDER_CLOCK?.getByName(`rc-${shardOf(uid)}`);
async function notifyClock(env, uid, rows, removed, subscribed) {
  if (!env.REMINDER_CLOCK) return;
  try {
    const clock = clockFor(env, uid);
    const results = await Promise.allSettled([
      ...removed.map(async (id) => clock.cancel({ reminder_id: id })),
      ...rows.map(async (row) => clock.schedule({
        user_id: uid, reminder_id: row.id, next_at: subscribed ? row.next_at : null,
      })),
    ]);
    const errors = results.filter((r) => r.status === 'rejected' || r.value?.ok !== true).length;
    if (errors) console.warn('[reminders-rpc]', errors);
  } catch {
    console.warn('[reminders-rpc]', 1);
  }
}

export async function replaceReminders(env, uid, snapshot, choices, pausedUntil, now) {
  const db = env.DB;
  const { policy, rows } = snapshot;
  const token = crypto.randomUUID();
  const chosen = choices.map((r) => ({
    ...r, id: rows.find((old) => old.kind === r.kind)?.id ?? crypto.randomUUID(),
    next_at: nextReminderAt({ ...r, channel: PUSH_CHANNEL, paused_until: pausedUntil },
      { tz: policy.tz, uposatha: policy.uposatha, now }),
  }));
  const owned = `EXISTS (SELECT 1 FROM reminder_setting WHERE user_id = ? AND write_id = ?)`;
  const results = await db.batch([
    db.prepare(`INSERT INTO reminder_setting (user_id, paused_until, write_id)
      SELECT ?1, ?2, ?3 FROM profile p LEFT JOIN practice_profile pp USING (user_id)
      LEFT JOIN reminder_setting rs USING (user_id)
      WHERE p.user_id = ?1 AND p.tz = ?4 AND COALESCE(pp.uposatha, 'vn_4') = ?5 AND rs.write_id IS ?6
      ON CONFLICT(user_id) DO UPDATE SET paused_until = excluded.paused_until, write_id = excluded.write_id
      RETURNING write_id`).bind(uid, pausedUntil, token, policy.tz, policy.uposatha, policy.write_id ?? null),
    db.prepare(`DELETE FROM reminder WHERE ${managed} AND ${owned}
      AND id NOT IN (SELECT value FROM json_each(?))`).bind(uid, uid, token, JSON.stringify(chosen.map((r) => r.id))),
    ...chosen.map((r) => db.prepare(`INSERT INTO reminder (id, user_id, kind, local_hm, days_mask, channel, active, next_at, paused_until, created_at)
      SELECT ?, ?, ?, ?, ?, '${PUSH_CHANNEL}', ?, ?, ?, ? WHERE ${owned}
      ON CONFLICT(id) DO UPDATE SET local_hm = excluded.local_hm, days_mask = excluded.days_mask,
        active = excluded.active, next_at = excluded.next_at, paused_until = excluded.paused_until`)
      .bind(r.id, uid, r.kind, r.local_hm, r.days_mask, Number(r.active), r.next_at, pausedUntil, now, uid, token)),
  ]);
  if (!results[0].results.length) return null;
  const latest = await readReminders(db, uid);
  if (!latest) return null;
  const activeIds = new Set(latest.rows.map((r) => r.id));
  await notifyClock(env, uid, latest.rows, rows.map((r) => r.id).filter((id) => !activeIds.has(id)), latest.policy.subscribed);
  return latest;
}

export async function refreshReminders(env, uid, now) {
  // Lịch và hồ sơ có thể vừa được cập nhật trên thiết bị khác. Tính lại trên bản mới thay vì ghi đè.
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const snapshot = await readReminders(env.DB, uid);
      if (!snapshot?.rows.length) return;
      const choices = snapshot.rows.map(({ kind, local_hm, days_mask, active }) =>
        ({ kind, local_hm, days_mask, active: Boolean(active) }));
      const saved = await replaceReminders(env, uid, snapshot, choices, snapshot.policy.paused_until, now);
      if (saved) return;
    }
  } catch {
    console.warn('[reminders-refresh]', 1);
  }
}

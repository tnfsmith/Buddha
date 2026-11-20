import { LATE_MS, nextReminderAt, REMINDER_KINDS, shardOf } from '@vandao/shared/reminder.js';
import { pushAvailable } from './reminder-data.js';

const RECONCILE_KEY = 'reminder-reconcile:v1';
// Một lượt có thể vừa sửa D1 vừa gọi RPC. Chừa ngân sách cho dọn tối đa hai lô người dùng trong cron.
const MAX_RECONCILE = 250;
const REPAIR_BATCH = 25;
const WINDOW = 26 * 60 * 60 * 1000;
const kinds = REMINDER_KINDS.map((kind) => `'${kind}'`).join(',');

export async function cancelRemovedUsers(env, ids) {
  if (!env?.REMINDER_CLOCK) return;
  for (let i = 0; i < ids.length; i += 5) {
    const results = await Promise.allSettled(ids.slice(i, i + 5).map(async (uid) =>
      env.REMINDER_CLOCK.getByName(`rc-${shardOf(uid)}`).cancelUser({ user_id: uid })));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) console.warn('[reminder-cancel-users]', failed);
  }
}

async function repairLateReminders(db, late, now) {
  const repaired = new Map();
  let failures = 0;
  // D1 Free tính mỗi batch là một truy vấn, kể cả sau khi cron đã dọn tài khoản.
  for (let i = 0; i < late.length; i += REPAIR_BATCH) {
    const batch = late.slice(i, i + REPAIR_BATCH);
    try {
      const results = await db.batch(batch.map((row) => {
        const at = nextReminderAt(row, { tz: row.tz, uposatha: row.uposatha, now });
        return db.prepare(`UPDATE reminder SET next_at = ?1 WHERE id = ?2 AND next_at = ?3 AND active = 1
          AND local_hm = ?4 AND days_mask = ?5 AND paused_until IS ?6
          AND EXISTS (SELECT 1 FROM push_subscription s WHERE s.user_id = reminder.user_id)
          AND EXISTS (SELECT 1 FROM profile p LEFT JOIN practice_profile pp USING (user_id)
            WHERE p.user_id = reminder.user_id AND p.tz = ?7 AND COALESCE(pp.uposatha, 'vn_4') = ?8)
          RETURNING id, next_at`).bind(at, row.id, row.next_at, row.local_hm, row.days_mask, row.paused_until, row.tz, row.uposatha);
      }));
      for (const { results: [row] } of results) {
        if (row) repaired.set(row.id, row.next_at);
      }
    } catch {
      failures += batch.length;
    }
  }
  return { repaired, failures };
}

export async function reconcileReminders(env, now) {
  const out = { scheduled: 0, failures: 0 };
  if (!pushAvailable(env)) return out;
  const db = env.DB;
  let cursor = '';
  try { cursor = (await env.CONFIG?.get(RECONCILE_KEY)) || ''; } catch { /* tiếp tục đối soát */ }
  const select = (after, before, max) => db.prepare(`SELECT r.*, p.tz, COALESCE(pp.uposatha, 'vn_4') AS uposatha
    FROM reminder r JOIN profile p ON p.user_id = r.user_id
    LEFT JOIN practice_profile pp ON pp.user_id = r.user_id
    WHERE r.channel = 'push' AND r.kind IN (${kinds}) AND r.active = 1 AND r.next_at IS NOT NULL AND r.next_at <= ?1
      AND EXISTS (SELECT 1 FROM push_subscription s WHERE s.user_id = r.user_id)
      AND r.id > ?2 AND (?3 = '' OR r.id <= ?3) ORDER BY r.id LIMIT ?4`)
    .bind(now + WINDOW, after, before, max).all();
  const { results: rows } = await select(cursor, '', MAX_RECONCILE);
  if (cursor && rows.length < MAX_RECONCILE) rows.push(...(await select('', cursor, MAX_RECONCILE - rows.length)).results);
  const lateBefore = now - LATE_MS;
  const { repaired, failures } = await repairLateReminders(db, rows.filter((row) => row.next_at < lateBefore), now);
  out.failures = failures;
  const clocks = new Map();
  for (let i = 0; i < rows.length; i += 5) {
    const results = await Promise.allSettled(rows.slice(i, i + 5).map(async (row) => {
      let at = row.next_at;
      if (at < lateBefore) {
        if (!repaired.has(row.id)) return null;
        at = repaired.get(row.id);
      }
      const shard = shardOf(row.user_id);
      if (!clocks.has(shard)) clocks.set(shard, env.REMINDER_CLOCK.getByName(`rc-${shard}`));
      return clocks.get(shard).schedule({ user_id: row.user_id, reminder_id: row.id, next_at: at });
    }));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value?.ok) out.scheduled++;
      else if (r.status === 'rejected' || r.value?.ok === false) out.failures++;
    }
  }
  try { await env.CONFIG?.put(RECONCILE_KEY, rows.length === MAX_RECONCILE ? rows.at(-1).id : '', { expirationTtl: 259_200 }); }
  catch { /* lần tới quét lại */ }
  return out;
}

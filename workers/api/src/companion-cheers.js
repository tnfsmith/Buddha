import { accepted, blocked } from './companions-data.js';
import { getLocalDate } from './utils/time.js';

export const CHEER_TTL_MS = 7 * 86_400_000;

const eligible = `${accepted('?1', '?2')} AND NOT ${blocked('?1', '?2')}`;
const received = `c.to_id = ?1 AND c.at > ?2 AND NOT ${blocked('?1', 'c.from_id')}`;
const progress = (day, done) => day === null ? {} : { day, completed: Boolean(done) };

export async function sendCheer(db, uid, to, line, now) {
  const sender = await db.prepare('SELECT tz FROM profile WHERE user_id = ?').bind(uid).first();
  if (!sender) return 'not_found';
  const day = getLocalDate(now, sender.tz);
  const [write, state] = await db.batch([
    db.prepare(`INSERT INTO cheer (from_id, to_id, day, line, j_day, j_done, at)
      SELECT p.user_id, ?2, ?3, ?4, j.day,
        CASE WHEN j.day IS NOT NULL THEN j.completed_at IS NOT NULL END, ?5
      FROM profile p LEFT JOIN journey j ON ?4 = 'tien_trinh' AND j.user_id = p.user_id AND j.is_current = 1
      WHERE p.user_id = ?1 AND ${eligible}
      ON CONFLICT(from_id, to_id, day) DO NOTHING`).bind(uid, to, day, line, now),
    db.prepare(`SELECT ${eligible} AS allowed`).bind(uid, to),
  ]);
  if (write.meta.changes) return null;
  return state.results[0].allowed ? 'cheer_today' : 'not_found';
}

export async function listCheers(db, uid, now) {
  const { results } = await db.prepare(`SELECT c.from_id, p.tinh_danh, p.tag, c.line, c.j_day, c.j_done, c.at
    FROM cheer c JOIN profile p ON p.user_id = c.from_id
    WHERE ${received} ORDER BY c.at DESC, c.from_id, c.day`).bind(uid, now - CHEER_TTL_MS).all();
  return results.map(({ from_id, tinh_danh, tag, line, j_day, j_done, at }) => ({
    from: { id: from_id, tinh_danh, tag }, line, ...progress(j_day, j_done), at,
  }));
}

export async function countUnreadCheers(db, uid, now) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM cheer c JOIN profile p ON p.user_id = c.from_id
    WHERE ${received} AND c.at > COALESCE((SELECT seen_at FROM cheer_seen WHERE user_id = ?1), 0)`)
    .bind(uid, now - CHEER_TTL_MS).first();
  return row.n;
}

export function markCheersSeen(db, uid, until, now) {
  return db.prepare(`INSERT INTO cheer_seen (user_id, seen_at) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET seen_at = MAX(cheer_seen.seen_at, excluded.seen_at)`)
    .bind(uid, Math.min(until, now)).run();
}

export async function exportCheers(db, uid, now) {
  const [rows, seen] = await db.batch([
    db.prepare(`SELECT c.from_id = ?1 AS sent, p.tinh_danh, p.tag, c.line, c.day AS local_date, c.j_day, c.j_done, c.at
      FROM cheer c JOIN profile p ON p.user_id = CASE WHEN c.from_id = ?1 THEN c.to_id ELSE c.from_id END
      WHERE (c.from_id = ?1 OR c.to_id = ?1) AND c.at > ?2 ORDER BY c.at DESC, c.from_id, c.to_id`)
      .bind(uid, now - CHEER_TTL_MS),
    db.prepare('SELECT seen_at FROM cheer_seen WHERE user_id = ?').bind(uid),
  ]);
  return {
    entries: rows.results.map(({ sent, tinh_danh, tag, j_day, j_done, ...rest }) => ({
      direction: sent ? 'sent' : 'received', companion: { tinh_danh, tag }, ...rest, ...progress(j_day, j_done),
    })),
    seen_at: seen.results[0]?.seen_at ?? null,
  };
}

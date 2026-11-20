import { INVITE_TTL_MS, MAX_COMPANIONS, REASON_TEXT, closenessOf, meetPhase, presenceOf, seenBucket } from '@vandao/shared/dong-tu.js';
import { clientIp } from './guard.js';
import { currentJourney, bad } from './lib.js';
import { getLocalDate } from './utils/time.js';

export const blocked = (a, b) => `EXISTS (
  SELECT 1 FROM user_block WHERE (blocker_id = ${a} AND blocked_id = ${b}) OR (blocker_id = ${b} AND blocked_id = ${a})
)`;
export const pair = (a, b) => `a = min(${a}, ${b}) AND b = max(${a}, ${b})`;
export const accepted = (a, b) => `EXISTS (SELECT 1 FROM companion WHERE ${pair(a, b)} AND status = 'dong_y')`;
export const underCap = (uid) => `(SELECT COUNT(*) FROM companion WHERE status = 'dong_y' AND (a = ${uid} OR b = ${uid})) < ${MAX_COMPANIONS}`;
export const openIsland = (column) => `json_type(${column}, '$.open') = 'true'`;
export const userIdOk = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(id);
export const savedCharacter = (uid) => `EXISTS (
  SELECT 1 FROM profile AS character WHERE character.user_id = ${uid} AND trim(character.tinh_danh) <> ''
    AND CASE WHEN json_valid(character.look_json) THEN json_type(character.look_json) = 'object'
      AND json(character.look_json) <> '{}' ELSE 0 END
)`;
export const needCharacter = (c) => bad(c, 'need_character', REASON_TEXT.need_character, 409);
export const hasCharacter = (db, uid) => db.prepare(`SELECT 1 WHERE ${savedCharacter('?')}`).bind(uid).first();
export const inviteRow = "id, from_id AS 'from', to_id AS 'to', kind, place, status, created_at, responded_at, start_at";
export const cancelPending = `UPDATE meet_invite SET status = 'huy'
  WHERE status IN ('cho','dong_y') AND ((from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1))`;

export async function relationship(db, me, them) {
  const row = await db.prepare(`SELECT
    EXISTS (SELECT 1 FROM user_block WHERE blocker_id = ?1 AND blocked_id = ?2) AS blocked,
    (SELECT json_object('a',c.a,'than_a',than_a,'than_b',than_b,'away_a',away_a,'away_b',away_b)
     FROM companion c WHERE ${pair('?1', '?2')} AND status = 'dong_y') AS link`)
    .bind(me, them).first();
  const link = row.link ? JSON.parse(row.link) : null;
  return {
    accepted: Boolean(link), blocked: Boolean(row.blocked),
    closeness: closenessOf(link?.than_a, link?.than_b),
    allowAway: Boolean(link && (link.a === me ? link.away_b : link.away_a)),
  };
}

function prefs(row) {
  const s = JSON.parse(row.settings_json || '{}').dong_tu;
  return { showPresence: row.visibility !== 'an' && s?.hien_trang_thai !== false, showDay: s?.hien_ngay !== false };
}

export async function participant(db, uid, now) {
  const row = await db.prepare(`SELECT p.tz, p.island_json, p.visibility, p.settings_json, n.state, n.updated_at
    FROM profile p LEFT JOIN presence n USING (user_id) WHERE p.user_id = ?`).bind(uid).first();
  if (!row) return null;
  const date = getLocalDate(now, row.tz);
  const journey = await currentJourney(db, uid, date, now);
  return {
    date, day: journey?.day ?? 1, completed: Boolean(journey?.completed_at),
    open: JSON.parse(row.island_json || '{}').open === true,
    presence: prefs(row).showPresence ? presenceOf(row, now) : 'online',
  };
}

export async function socialCounts(db, uid, now) {
  const r = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM companion_request WHERE to_id = ?1 AND declined_at IS NULL AND expires_at > ?2) AS requests,
    (SELECT COUNT(*) FROM meet_invite WHERE to_id = ?1 AND status = 'cho' AND created_at >= ?3) AS invites`)
    .bind(uid, now, now - INVITE_TTL_MS).first();
  return { requests: r.requests, invites: r.invites };
}
// Phép chiếu phía người gửi dùng cùng dạng với GET /companions.outgoing (§4, §6.8).
export const companionOutgoing = (db, uid, now) => db.prepare(
  `SELECT id, tinh_danh, tag, created_at AS at, expires_at FROM companion_request
   WHERE from_id = ? AND expires_at > ? ORDER BY created_at, id`,
).bind(uid, now);

export async function exportCompanions(db, uid, now) {
  const [companions, outgoing, incoming, meets, presence, visits, blocks] = await db.batch([
    db.prepare(
      `SELECT a, b, requested_by, created_at, accepted_at, source, than_a, than_b, away_a, away_b
       FROM companion WHERE status = 'dong_y' AND (a = ?1 OR b = ?1) ORDER BY accepted_at, a, b`,
    ).bind(uid),
    companionOutgoing(db, uid, now),
    db.prepare(
      `SELECT r.id, p.tinh_danh, p.tag, r.created_at AS at, r.declined_at
       FROM companion_request r LEFT JOIN profile p ON p.user_id = r.from_id
       WHERE r.to_id = ? ORDER BY r.created_at, r.id`,
    ).bind(uid),
    db.prepare(
      `SELECT id, from_id, to_id, kind, place, status, created_at, responded_at, start_at
       FROM meet_invite WHERE from_id = ?1 OR to_id = ?1 ORDER BY created_at, id`,
    ).bind(uid),
    db.prepare('SELECT state, updated_at FROM presence WHERE user_id = ?').bind(uid),
    db.prepare('SELECT guest_id, day, at FROM island_visit WHERE host_id = ? ORDER BY at, guest_id').bind(uid),
    db.prepare('SELECT blocked_id, created_at FROM user_block WHERE blocker_id = ? ORDER BY created_at, blocked_id').bind(uid),
  ]);
  return {
    companions: companions.results,
    companion_requests: {
      outgoing: outgoing.results,
      incoming: incoming.results.map(({ tinh_danh, tag, ...r }) => ({ ...r, from: { tinh_danh, tag } })),
    },
    meet_invites: meets.results,
    presence: presence.results[0] ?? null,
    island_visits: visits.results,
    blocks: blocks.results,
  };
}

const listSql = `SELECT c.*, p.user_id AS id, p.tinh_danh, p.tag, p.look_json, p.visibility,
  p.settings_json, p.island_json, n.state, n.updated_at, j.day, j.completed_at
  FROM companion c JOIN profile p ON p.user_id = CASE WHEN c.a = ?1 THEN c.b ELSE c.a END
  LEFT JOIN presence n ON n.user_id = p.user_id
  LEFT JOIN journey j ON j.user_id = p.user_id AND j.is_current = 1
  WHERE (c.a = ?1 OR c.b = ?1) AND c.status = 'dong_y'
  ORDER BY (c.than_a AND c.than_b) DESC, COALESCE(c.accepted_at, c.created_at), p.user_id`;

export async function listCompanions(db, uid, now) {
  const [list, incoming, outgoing, invites, visits] = await db.batch([
    db.prepare(listSql).bind(uid),
    db.prepare(`SELECT r.id, p.tinh_danh, p.tag, r.created_at AS at
      FROM companion_request r JOIN profile p ON p.user_id = r.from_id
      WHERE r.to_id = ? AND r.declined_at IS NULL AND r.expires_at > ? ORDER BY r.created_at, r.id`).bind(uid, now),
    companionOutgoing(db, uid, now),
    db.prepare(`SELECT ${inviteRow} FROM meet_invite WHERE (from_id = ?1 OR to_id = ?1)
      AND status IN ('cho','dong_y') AND created_at >= ?2 ORDER BY created_at, id`).bind(uid, now - 7 * 86_400_000),
    db.prepare('SELECT guest_id AS guest, day FROM island_visit WHERE host_id = ? AND at >= ? ORDER BY at DESC, guest_id')
      .bind(uid, now - 7 * 86_400_000),
  ]);
  return {
    companions: list.results.map((r) => {
      const a = r.a === uid, pref = prefs(r);
      const me = { than: Boolean(a ? r.than_a : r.than_b), away: Boolean(a ? r.away_a : r.away_b) };
      const them = { than: Boolean(a ? r.than_b : r.than_a), away: Boolean(a ? r.away_b : r.away_a) };
      return {
        id: r.id, tinh_danh: r.tinh_danh, tag: r.tag, look: JSON.parse(r.look_json || '{}'),
        closeness: closenessOf(me.than, them.than), me, them,
        presence: pref.showPresence ? presenceOf(r, now) : null,
        seen: pref.showPresence ? seenBucket(r.updated_at, now) : null,
        day: pref.showDay ? r.day ?? 1 : null, completed: pref.showDay ? Boolean(r.completed_at) : null,
        open: JSON.parse(r.island_json || '{}').open === true, accepted_at: r.accepted_at ?? r.created_at,
      };
    }),
    incoming: incoming.results.map(({ tinh_danh, tag, ...r }) => ({ ...r, from: { tinh_danh, tag } })),
    outgoing: outgoing.results,
    invites: invites.results.filter((r) => ['cho','sap','dang'].includes(meetPhase(r, now).phase)),
    visits: visits.results,
    server_now: now,
  };
}

/** Một lần tăng có điều kiện để các yêu cầu đồng thời không vượt số lượt. */
export const socialQuota = (scope, max, duration) => async (c, next) => {
  const uid = c.get('user')?.id ?? null;
  const start = Math.floor(Date.now() / duration) * duration;
  // Đổi dấu IP theo cửa sổ. Giữ IP và bí mật ngoài D1.
  const seed = `${c.env.BETTER_AUTH_SECRET ?? ''}|${scope}|${start}|${clientIp(c)}`;
  const actor = uid ?? new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed))).toHex();
  const row = await c.env.DB.prepare(`INSERT INTO companion_quota (scope, actor, user_id, window_start, expires_at, n)
    VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(scope, actor, window_start) DO UPDATE SET n = n + 1
    WHERE n < ? RETURNING n`).bind(scope, actor, uid, start, start + duration, max).first();
  if (!row) {
    c.header('Retry-After', String(Math.max(1, Math.ceil((start + duration - Date.now()) / 1000))));
    return bad(c, 'rate_limited', 'Đã dùng hết lượt trong khoảng thời gian này.', 429);
  }
  await next();
};

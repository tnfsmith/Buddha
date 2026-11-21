import { SESSION_AHEAD_MS, SESSION_MAX, SESSION_MIN_LEAD_MS, SESSION_OPEN_MAX, SESSION_STEP_MS, presenceOf } from '@vandao/shared/dong-tu.js';
import { accepted, blocked, savedCharacter, userIdOk } from './companions-data.js';

const DURATION_MS = 15 * 60_000;
const hostBlocked = blocked('?1', 's.host_id');
const visible = `
  FROM dong_tu_session s WHERE s.status = 'hen' AND s.start_at > ?2
    AND (s.host_id = ?1 OR EXISTS (SELECT 1 FROM dong_tu_seat t WHERE t.session_id = s.id AND t.user_id = ?1))
    AND NOT ${hostBlocked} AND (?3 IS NULL OR s.id = ?3)`;
const person = ({ user_id: id, tinh_danh, tag, look_json }) => ({ id, tinh_danh, tag, look: JSON.parse(look_json || '{}') });

export function parseSession(body, uid, now) {
  if (!body || Object.keys(body).length !== 2 || !Array.isArray(body.invitees)
      || !body.invitees.length || body.invitees.length >= SESSION_MAX
      || !body.invitees.every((id) => userIdOk(id) && id !== uid)
      || new Set(body.invitees).size !== body.invitees.length) return null;
  const immediate = body.start_at === 'ngay';
  const start_at = immediate ? now + SESSION_MIN_LEAD_MS : body.start_at;
  if (!Number.isSafeInteger(start_at) || start_at < now + SESSION_MIN_LEAD_MS || start_at > now + SESSION_AHEAD_MS
      || (!immediate && start_at % SESSION_STEP_MS !== 0)) return null;
  return { start_at, immediate, invitees: body.invitees };
}

export async function listSessions(db, uid, now, id = null) {
  const args = [uid, now - DURATION_MS, id];
  const [sessions, seats] = await db.batch([
    db.prepare(`WITH allowed AS (SELECT s.* ${visible})
      SELECT s.id, s.kind, s.place, s.start_at, s.created_at, p.user_id, p.tinh_danh, p.tag, p.look_json
      FROM allowed s JOIN profile p ON p.user_id = s.host_id ORDER BY s.start_at, s.id`).bind(...args),
    db.prepare(`WITH allowed AS (SELECT s.id ${visible})
      SELECT t.session_id, t.status, p.user_id, p.tinh_danh, p.tag, p.look_json
      FROM allowed s JOIN dong_tu_seat t ON t.session_id = s.id JOIN profile p ON p.user_id = t.user_id
      WHERE NOT ${blocked('?1', 't.user_id')} ORDER BY t.session_id, t.user_id`).bind(...args),
  ]);
  const grouped = new Map();
  for (const seat of seats.results) {
    const list = grouped.get(seat.session_id) || [];
    list.push({ ...person(seat), status: seat.status });
    grouped.set(seat.session_id, list);
  }
  return sessions.results.map((r) => ({
    id: r.id, host: person(r), kind: r.kind, place: r.place, start_at: r.start_at, created_at: r.created_at,
    seats: grouped.get(r.id) || [],
  }));
}

export async function countPendingSessions(db, uid, now) {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM dong_tu_seat t JOIN dong_tu_session s ON s.id = t.session_id
    WHERE t.user_id = ?1 AND t.status = 'moi' AND s.status = 'hen' AND s.start_at > ?2 AND NOT ${hostBlocked}`)
    .bind(uid, now).first();
  return row.n;
}

async function availableNow(db, invitees, now) {
  const { results } = await db.prepare(`SELECT p.user_id, p.visibility, p.settings_json, n.state, n.updated_at
    FROM json_each(?) i JOIN profile p ON p.user_id = i.value LEFT JOIN presence n USING(user_id)`).bind(JSON.stringify(invitees)).all();
  return new Set(results.filter((r) => {
    // Cùng nguyên tắc với participant: trạng thái bị ẩn được coi là online cho quyết định, không lộ việc vắng.
    const settings = JSON.parse(r.settings_json || '{}').dong_tu;
    return r.visibility === 'an' || settings?.hien_trang_thai === false || presenceOf(r, now) !== 'vang';
  }).map((r) => r.user_id));
}

const eligible = `NOT EXISTS (SELECT 1 FROM json_each(?5) i
  WHERE NOT ${accepted('?2','i.value')} OR ${blocked('?2','i.value')})`;
const openCount = `(SELECT COUNT(*) FROM dong_tu_session WHERE host_id = ?2 AND status = 'hen' AND start_at > ?4)`;

export async function createSession(db, uid, input, now) {
  const id = crypto.randomUUID(), ids = JSON.stringify(input.invitees);
  const available = input.immediate ? await availableNow(db, input.invitees, now) : new Set(input.invitees);
  const invited = input.invitees.filter((friend) => available.has(friend));
  const [created] = await db.batch([
    db.prepare(`INSERT INTO dong_tu_session (id, host_id, start_at, created_at)
      SELECT ?1, ?2, ?3, ?4 WHERE ${savedCharacter('?2')} AND ${eligible} AND ${openCount} < ?6`)
      .bind(id, uid, input.start_at, now, ids, SESSION_OPEN_MAX),
    db.prepare(`INSERT INTO dong_tu_seat (session_id, user_id)
      SELECT s.id, i.value FROM dong_tu_session s, json_each(?2) i WHERE s.id = ?1`).bind(id, JSON.stringify(invited)),
  ]);
  if (!created.meta.changes) {
    const row = await db.prepare(`SELECT ${savedCharacter('?1')} AS character,
      NOT EXISTS (SELECT 1 FROM json_each(?2) i WHERE NOT ${accepted('?1','i.value')} OR ${blocked('?1','i.value')}) AS allowed`)
      .bind(uid, ids).first();
    return { code: !row.character ? 'need_character' : !row.allowed ? 'not_found' : 'session_limit' };
  }
  const [session] = await listSessions(db, uid, now, id);
  return { session, skipped: input.invitees.filter((friend) => !available.has(friend)) };
}

export async function respondSession(db, uid, id, accept, now) {
  const [write, read] = await db.batch([
    db.prepare(`UPDATE dong_tu_seat SET status = CASE WHEN ?3 = 1 THEN 'nhan'
      WHEN status = 'moi' THEN 'tu_choi' ELSE 'roi' END, responded_at = ?4
      WHERE user_id = ?1 AND session_id = ?2 AND (status = 'moi' OR (status = 'nhan' AND ?3 = 0))
        AND EXISTS (SELECT 1 FROM dong_tu_session s WHERE s.id = ?2 AND s.status = 'hen'
          AND s.start_at > ?5 AND NOT ${hostBlocked}) RETURNING status`)
      .bind(uid, id, Number(accept), now, now - DURATION_MS),
    db.prepare(`SELECT t.status, s.status AS session_status, s.start_at
      FROM dong_tu_seat t JOIN dong_tu_session s ON s.id = t.session_id
      WHERE t.user_id = ?1 AND s.id = ?2 AND NOT ${hostBlocked}`).bind(uid, id),
  ]);
  const updated = write.results[0], current = read.results[0];
  if (updated) return updated;
  if (!current) return { code: 'not_found' };
  if (current.session_status === 'huy' || current.start_at <= now - DURATION_MS) return { code: 'session_closed' };
  const valid = accept ? current.status === 'nhan' : ['tu_choi', 'roi'].includes(current.status);
  return valid ? { status: current.status } : { code: 'session_response_conflict' };
}

export async function cancelSession(db, uid, id) {
  const row = await db.prepare("UPDATE dong_tu_session SET status = 'huy' WHERE host_id = ? AND id = ? RETURNING id").bind(uid, id).first();
  return Boolean(row);
}

export async function exportSessions(db, uid) {
  const [hosted, seats] = await db.batch([
    db.prepare(`SELECT id, kind, place, start_at, status, created_at,
      (SELECT json_group_object(status, n)
       FROM (SELECT status, COUNT(*) AS n FROM dong_tu_seat WHERE session_id = s.id GROUP BY status)) AS seat_counts
      FROM dong_tu_session s WHERE host_id = ? ORDER BY start_at, id`).bind(uid),
    db.prepare(`SELECT t.session_id, s.kind, s.place, s.start_at, s.status AS session_status, t.status, t.responded_at
      FROM dong_tu_seat t JOIN dong_tu_session s ON s.id = t.session_id WHERE t.user_id = ?
      ORDER BY s.start_at, s.id`).bind(uid),
  ]);
  return { hosted: hosted.results.map((r) => ({ ...r, seat_counts: JSON.parse(r.seat_counts || '{}') })), seats: seats.results };
}

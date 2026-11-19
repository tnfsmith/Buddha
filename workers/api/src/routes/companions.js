import { Hono } from 'hono';
import {
  LINK_TTL_MS, LINK_USES, REQUEST_TTL_MS, REQUESTS_PER_DAY, makeInviteCode, normInviteCode, parseFriendQuery,
} from '@vandao/shared/dong-tu.js';
import { getAuth } from '../auth/index.js';
import { authMiddleware, nameKey } from '../auth/session.js';
import { byIp, byUser } from '../guard.js';
import { bad, readJson } from '../lib.js';
import {
  accepted, blocked, cancelPending, listCompanions, pair, socialQuota, underCap, userIdOk,
} from '../companions-data.js';

const app = new Hono();
const MINUTE = 60_000, HOUR = 60 * MINUTE, DAY = 24 * HOUR;
const noStore = async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); };
const quota = (name, max, period = HOUR) => [noStore, authMiddleware, socialQuota(name, max, period)];
const fail = (c, code, status = 400) => bad(c, code, 'Không thể thực hiện thao tác Bạn đồng tu.', status);
const who = (c) => c.get('user').id;
const missing = (c) => fail(c, 'not_found', 404);
const empty = (c) => c.body(null, 204);
const readBool = (v) => v === true || v === false;
const codeOf = (c) => normInviteCode(c.req.param('code'));
const idOf = (c) => c.req.param('id');

app.onError((error, c) => {
  console.error('[Bạn đồng tu]', c.req.method, error?.name);
  return fail(c, 'internal_error', 500);
});

app.get('/companions', noStore, authMiddleware, byUser('RL_API'), async (c) =>
  c.json(await listCompanions(c.env.DB, who(c), Date.now())));

app.get('/companions/link/:code', noStore, byIp('RL_POLL'), socialQuota('link_view', 30, HOUR), async (c) => {
  const code = codeOf(c);
  if (!code) return fail(c, 'link_invalid');
  // Tự nhìn từ phiên nếu có, nhưng người chưa đăng nhập cũng được xem tên người mời.
  const db = c.env.DB, auth = getAuth(c);
  const viewer = auth ? (await auth.api.getSession({ headers: c.req.raw.headers }))?.user?.id : null;
  const owner = await db.prepare(`SELECT p.tinh_danh, p.tag FROM invite i JOIN profile p ON p.user_id = i.owner_id
    WHERE i.code = ?1 AND i.uses_left > 0 AND i.expires_at > ?2 AND NOT ${blocked('i.owner_id', '?3')}`)
    .bind(code, Date.now(), viewer ?? null).first();
  return owner ? c.json({ owner, valid: true }) : fail(c, 'link_invalid', 404);
});

const linkFields = 'code, uses_left, expires_at';
app.post('/companions/link', ...quota('link_create', 10, DAY), async (c) => {
  const body = await readJson(c);
  if (!body || (body.renew !== undefined && !readBool(body.renew))) return fail(c, 'invalid_payload');
  const db = c.env.DB, uid = who(c), now = Date.now();
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = makeInviteCode(crypto.getRandomValues(new Uint8Array(8)));
    // Xóa mã cũ và cấp mã trong cùng batch. Va chạm code làm rollback cả batch.
    try {
      const [, , result] = await db.batch([
        db.prepare('DELETE FROM invite WHERE owner_id = ? AND (? = 1 OR expires_at <= ? OR uses_left = 0)')
          .bind(uid, Number(body.renew === true), now),
        db.prepare(`INSERT INTO invite (code, owner_id, uses_left, expires_at, created_at)
          SELECT ?1, ?2, ?3, ?4, ?5 WHERE NOT EXISTS (SELECT 1 FROM invite WHERE owner_id = ?2)`)
          .bind(code, uid, LINK_USES, now + LINK_TTL_MS, now),
        db.prepare(`SELECT ${linkFields} FROM invite WHERE owner_id = ? ORDER BY created_at DESC, code LIMIT 1`).bind(uid),
      ]);
      return c.json(result.results[0]);
    } catch (error) {
      if (!error.message?.includes('UNIQUE constraint failed: invite.code') || attempt === 3) throw error;
    }
  }
});

const makePair = (source) => `INSERT INTO companion(a, b, status, requested_by, created_at, accepted_at, source)
  SELECT min(?1, ?2), max(?1, ?2), 'dong_y', ?2, ?3, ?3, '${source}'`;
const finalizePair = `ON CONFLICT(a,b) DO UPDATE SET status = 'dong_y', requested_by = excluded.requested_by,
  created_at = excluded.created_at, accepted_at = excluded.accepted_at, source = excluded.source,
  than_a = 0, than_b = 0, away_a = 0, away_b = 0 WHERE companion.status = 'cho'`;

app.post('/companions/link/:code/accept', ...quota('link_accept', 20, DAY), async (c) => {
  const code = codeOf(c);
  if (!code) return fail(c, 'link_invalid');
  const db = c.env.DB, uid = who(c), now = Date.now();
  const link = await db.prepare(`SELECT owner_id, uses_left, expires_at FROM invite i
    WHERE code = ?1 AND NOT ${blocked('i.owner_id', '?2')}`).bind(code, uid).first();
  if (!link) return fail(c, 'link_invalid', 404);
  if (uid === link.owner_id) return fail(c, 'self');
  if (link.expires_at <= now) return fail(c, 'link_expired', 409);
  if (link.uses_left <= 0) return fail(c, 'link_used_up', 409);
  const other = link.owner_id;
  const [write] = await db.batch([
    db.prepare(`${makePair('ma_moi')} WHERE NOT ${blocked('?1', '?2')}
      AND ${underCap('?1')} AND ${underCap('?2')}
      AND EXISTS (SELECT 1 FROM invite WHERE code = ?4 AND owner_id = ?2 AND uses_left > 0 AND expires_at > ?3)
      ${finalizePair}`).bind(uid, other, now, code),
    db.prepare('UPDATE invite SET uses_left = uses_left - 1 WHERE code = ? AND changes() > 0').bind(code),
    db.prepare(`INSERT OR IGNORE INTO guidance (newcomer_id, guide_id, invite_code, accepted_at)
      SELECT ?1, ?2, ?3, ?4 FROM user WHERE id = ?1 AND createdAt >= ?5 AND createdAt <= ?4 AND changes() > 0`)
      .bind(uid, other, code, now, now - LINK_TTL_MS),
  ]);
  if (write.meta.changes) return c.json({ companion: { id: other } }, 201);
  const state = await db.prepare(`SELECT ${blocked('?1','?2')} AS denied, ${accepted('?1','?2')} AS joined,
    ${underCap('?1')} AND ${underCap('?2')} AS room, (SELECT uses_left FROM invite WHERE code = ?3) AS uses`)
    .bind(uid, other, code).first();
  if (state.denied || state.uses === null) return fail(c, 'link_invalid', 404);
  if (state.joined) return fail(c, 'already_companion', 409);
  return fail(c, state.uses <= 0 ? 'link_used_up' : (state.room ? 'link_invalid' : 'limit_companions'), 409);
});

const requestFields = 'id, tinh_danh, tag, created_at AS at, expires_at';
async function readFriendQuery(c, next) {
  const body = await readJson(c);
  const query = typeof body?.query === 'string' && body.query.length <= 80 ? parseFriendQuery(body.query) : null;
  if (!query) return fail(c, 'invalid_payload');
  c.set('friendQuery', query);
  await next();
}

app.post('/companions/request', noStore, authMiddleware, byUser('RL_API'),
  readFriendQuery, socialQuota('request', REQUESTS_PER_DAY, DAY), async (c) => {
  const q = c.get('friendQuery');
  const db = c.env.DB, uid = who(c), now = Date.now();
  const request = await db.prepare(`INSERT INTO companion_request (id, from_id, tinh_danh, tag, to_id, created_at, expires_at)
    VALUES (?1, ?2, ?3, ?4, (SELECT p.user_id FROM profile p WHERE p.tinh_danh_key = ?5 AND p.tag = ?4
      AND p.user_id <> ?2 AND p.visibility <> 'an' AND json_type(p.settings_json,'$.dong_tu.cho_tim') IS NOT 'false'
      AND NOT ${blocked('?2','p.user_id')} AND NOT ${accepted('?2','p.user_id')}), ?6, ?7)
    ON CONFLICT(from_id, tinh_danh, tag) DO UPDATE SET
      id = CASE WHEN expires_at <= excluded.created_at THEN excluded.id ELSE companion_request.id END,
      to_id = CASE WHEN expires_at <= excluded.created_at THEN excluded.to_id ELSE companion_request.to_id END,
      created_at = CASE WHEN expires_at <= excluded.created_at THEN excluded.created_at ELSE companion_request.created_at END,
      expires_at = CASE WHEN expires_at <= excluded.created_at THEN excluded.expires_at ELSE companion_request.expires_at END,
      declined_at = CASE WHEN expires_at <= excluded.created_at THEN NULL ELSE companion_request.declined_at END
    RETURNING ${requestFields}`).bind(crypto.randomUUID(), uid, q.tinh_danh, q.tag, nameKey(q.tinh_danh), now, now + REQUEST_TTL_MS).first();
  return c.json({ request }, 202);
});

app.delete('/companions/requests/:id', ...quota('request_manage', 60), async (c) => {
  await c.env.DB.prepare('DELETE FROM companion_request WHERE id = ? AND from_id = ?').bind(idOf(c), who(c)).run();
  return empty(c);
});
app.post('/companions/requests/:id/respond', ...quota('request_manage', 60), async (c) => {
  const body = await readJson(c);
  if (!readBool(body?.accept)) return fail(c, 'invalid_payload');
  const db = c.env.DB, uid = who(c), now = Date.now(), id = idOf(c);
  const pending = await db.prepare(`SELECT from_id FROM companion_request r WHERE id = ?1 AND to_id = ?2
    AND declined_at IS NULL AND expires_at > ?3 AND NOT ${blocked('r.from_id','?2')}`).bind(id, uid, now).first();
  if (!pending) return missing(c);
  const other = pending.from_id;
  const condition = `id = ?4 AND to_id = ?1 AND from_id = ?2 AND declined_at IS NULL AND expires_at > ?3
    AND NOT ${blocked('?1','?2')}`;
  if (!body.accept) {
    const out = await db.prepare(`UPDATE companion_request SET declined_at = ?3 WHERE ${condition}`).bind(uid, other, now, id).run();
    return out.meta.changes ? empty(c) : missing(c);
  }
  const [, removed] = await db.batch([
    db.prepare(`${makePair('tim')} WHERE ${underCap('?1')} AND ${underCap('?2')}
      AND EXISTS (SELECT 1 FROM companion_request WHERE ${condition}) ${finalizePair}`).bind(uid, other, now, id),
    db.prepare(`DELETE FROM companion_request WHERE ${condition} AND ${accepted('?1','?2')}`).bind(uid, other, now, id),
  ]);
  if (removed.meta.changes) return c.json({ companion: { id: other } }, 201);
  const stillPending = await db.prepare(`SELECT 1 FROM companion_request WHERE ${condition}`).bind(uid, other, now, id).first();
  return stillPending ? fail(c, 'limit_companions', 409) : missing(c);
});

app.patch('/companions/:id', ...quota('companion_manage', 60), async (c) => {
  const body = await readJson(c), me = who(c), other = idOf(c);
  if (!userIdOk(other) || !body || !Object.keys(body).length ||
    !Object.entries(body).every(([k, v]) => ['than','away'].includes(k) && readBool(v))) return fail(c, 'invalid_payload');
  const col = me < other ? 'a' : 'b';
  const out = await c.env.DB.prepare(`UPDATE companion SET than_${col} = COALESCE(?3, than_${col}), away_${col} = COALESCE(?4, away_${col})
    WHERE ${pair('?1','?2')} AND status = 'dong_y'`).bind(me, other, body.than === undefined ? null : Number(body.than),
    body.away === undefined ? null : Number(body.away)).run();
  return out.meta.changes ? empty(c) : missing(c);
});

app.delete('/companions/:id', ...quota('companion_manage', 60), async (c) => {
  const db = c.env.DB, me = who(c), other = idOf(c);
  if (!userIdOk(other)) return fail(c, 'invalid_payload');
  await db.batch([db.prepare(`DELETE FROM companion WHERE ${pair('?1','?2')}`).bind(me, other),
    db.prepare(cancelPending).bind(me, other)]);
  return empty(c);
});

app.get('/blocks', ...quota('block_read', 20, DAY), async (c) => {
  const rows = await c.env.DB.prepare(`SELECT b.blocked_id AS id, p.tinh_danh, p.tag, b.created_at
    FROM user_block b LEFT JOIN profile p ON p.user_id = b.blocked_id WHERE b.blocker_id = ? ORDER BY b.created_at DESC`).bind(who(c)).all();
  return c.json({ blocks: rows.results });
});
app.post('/blocks', ...quota('block_write', 20, DAY), async (c) => {
  const p = await readJson(c), db = c.env.DB, me = who(c);
  if (!userIdOk(p?.user) || p.user === me) return fail(c, 'invalid_payload');
  const other = p.user, now = Date.now();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO user_block(blocker_id, blocked_id, created_at) SELECT ?1, id, ?3 FROM user WHERE id = ?2')
      .bind(me, other, now),
    db.prepare(`DELETE FROM companion WHERE ${pair('?1','?2')}`).bind(me, other),
    db.prepare(cancelPending).bind(me, other),
    db.prepare(`UPDATE companion_request SET to_id = NULL WHERE expires_at > ?3
      AND ((from_id = ?1 AND to_id = ?2) OR (from_id = ?2 AND to_id = ?1))`).bind(me, other, now),
  ]);
  return empty(c);
});
app.delete('/blocks/:id', ...quota('block_write', 20, DAY), async (c) => {
  await c.env.DB.prepare('DELETE FROM user_block WHERE blocker_id = ? AND blocked_id = ?').bind(who(c), idOf(c)).run();
  return empty(c);
});
app.post('/reports', ...quota('report', 10, DAY), async (c) => {
  const body = await readJson(c), me = who(c);
  if (!userIdOk(body?.target) || body.target === me || body.context !== 'island' ||
    (body.reason !== undefined && (typeof body.reason !== 'string' || [...body.reason].length > 500))) return fail(c, 'invalid_payload');
  const id = crypto.randomUUID();
  const out = await c.env.DB.prepare(`INSERT INTO report(id, reporter_id, target_id, context, reason, created_at)
    SELECT ?, ?, id, 'island', ?, ? FROM user WHERE id = ?`).bind(id, me, body.reason ?? null, Date.now(), body.target).run();
  return out.meta.changes ? c.json({ id }, 201) : missing(c);
});

export default app;

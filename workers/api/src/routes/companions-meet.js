import { INVITE_TTL_MS, MEET_KINDS, PRESENCE, canMeet, canVisitAway, checkMeetPayload, meetStartAt } from '@vandao/shared/dong-tu.js';
import { readJson } from '../lib.js';
import { accepted, blocked, hasCharacter, inviteRow, needCharacter, openIsland, pair, participant, relationship, savedCharacter, userIdOk } from '../companions-data.js';

const DAY = 86_400_000;

export function mountCompanionMeet(app, { quota, fail, who, missing, empty }) {
  app.post('/presence', ...quota('presence', 90), async (c) => {
    const body = await readJson(c);
    if (!PRESENCE.includes(body?.state)) return fail(c, 'invalid_payload');
    const now = Date.now();
    await c.env.DB.prepare(`INSERT INTO presence(user_id, state, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at
      WHERE presence.state <> excluded.state OR presence.updated_at <= excluded.updated_at - 60000`)
      .bind(who(c), body.state, now).run();
    return empty(c);
  });

  app.post('/meet', ...quota('meet_send', 20), async (c) => {
    const checked = checkMeetPayload(await readJson(c));
    if (!checked.ok) return fail(c, checked.code);
    const db = c.env.DB, me = who(c), now = Date.now(), { to, kind, place } = checked.v;
    if (!await hasCharacter(db, me)) return needCharacter(c);
    if (to === me) return fail(c, 'self');
    const rel = await relationship(db, me, to);
    if (!rel.accepted || rel.blocked) return fail(c, rel.blocked ? 'blocked' : 'not_companion', 409);
    const [from, friend] = await Promise.all([participant(db, me, now), participant(db, to, now)]);
    if (!from || !friend) return missing(c);
    const allowed = canMeet(kind, from, friend, rel, place);
    if (!allowed.ok) return fail(c, allowed.code, 409);
    const host = allowed.host === 'from' ? me : to;
    const stillAllowed = `${savedCharacter('?1')} AND ${accepted('?1','?2')} AND NOT ${blocked('?1','?2')} AND
      (?3 = 'dtd' OR EXISTS (SELECT 1 FROM profile WHERE user_id = ?4 AND ${openIsland('island_json')}))`;
    const [, result] = await db.batch([
      db.prepare(`UPDATE meet_invite SET status = 'huy' WHERE from_id = ?1 AND to_id = ?2 AND status = 'cho'
        AND ${stillAllowed}`).bind(me, to, allowed.place, host),
      db.prepare(`INSERT INTO meet_invite (id, from_id, to_id, kind, place, created_at)
        SELECT ?5, ?1, ?2, ?6, ?3, ?7 WHERE ${stillAllowed} RETURNING ${inviteRow}`)
        .bind(me, to, allowed.place, host, crypto.randomUUID(), kind, now),
    ]);
    if (result.results[0]) return c.json({ invite: result.results[0] }, 201);
    if (!await hasCharacter(db, me)) return needCharacter(c);
    const latest = await relationship(db, me, to);
    return fail(c, latest.blocked ? 'blocked' : latest.accepted ? 'host_doc_cu' : 'not_companion', 409);
  });

  app.post('/meet/:id/respond', ...quota('meet_manage', 60), async (c) => {
    const body = await readJson(c);
    if (typeof body?.accept !== 'boolean') return fail(c, 'invalid_payload');
    const id = c.req.param('id'), me = who(c), now = Date.now(), db = c.env.DB;
    const current = await db.prepare('SELECT from_id, to_id, kind, place, status, created_at FROM meet_invite WHERE id = ? AND to_id = ?')
      .bind(id, me).first();
    if (!current) return missing(c);
    if (current.status !== 'cho') return fail(c, 'invite_not_pending', 409);
    if (now - current.created_at > INVITE_TTL_MS) return fail(c, 'invite_expired', 409);
    const host = MEET_KINDS[current.kind].host === 'from' ? current.from_id : current.to_id;
    // Kiểm cổng tại lúc ghi để một lần chuyển sang Độc cư không bị bản đọc trước đó bỏ qua.
    const result = await db.prepare(`UPDATE meet_invite SET status = ?3, responded_at = ?4, start_at = ?5
      WHERE id = ?1 AND to_id = ?2 AND status = 'cho' AND ${accepted('from_id','to_id')}
      AND NOT ${blocked('from_id','to_id')}
      AND (?3 = 'tu_choi' OR place = 'dtd' OR EXISTS (SELECT 1 FROM profile WHERE user_id = ?6 AND ${openIsland('island_json')}))
      RETURNING ${inviteRow}`)
      .bind(id, me, body.accept ? 'dong_y' : 'tu_choi', now, body.accept ? meetStartAt(current.kind, now) : null, host).first();
    if (result) return c.json({ invite: result });
    if (body.accept && current.place !== 'dtd') {
      const open = await db.prepare(`SELECT 1 FROM profile WHERE user_id = ? AND ${openIsland('island_json')}`).bind(host).first();
      if (!open) return fail(c, 'host_doc_cu', 409);
    }
    return fail(c, 'invite_not_pending', 409);
  });

  app.post('/meet/:id/cancel', ...quota('meet_manage', 60), async (c) => {
    const out = await c.env.DB.prepare(`UPDATE meet_invite SET status = 'huy'
      WHERE id = ? AND (from_id = ?2 OR to_id = ?2) AND status IN ('cho','dong_y','huy') RETURNING id`)
      .bind(c.req.param('id'), who(c)).first();
    return out ? empty(c) : missing(c);
  });

  app.post('/visits/away', ...quota('visit_away', 20, DAY), async (c) => {
    const body = await readJson(c), me = who(c);
    if (!userIdOk(body?.host) || body.host === me) return fail(c, 'invalid_payload');
    const host = body.host, db = c.env.DB, now = Date.now();
    const rel = await relationship(db, me, host);
    if (!rel.accepted || rel.blocked) return fail(c, rel.blocked ? 'blocked' : 'not_companion', 409);
    const [guestView, hostView] = await Promise.all([participant(db, me, now), participant(db, host, now)]);
    const allowed = canVisitAway(guestView, hostView, rel);
    if (!allowed.ok) return fail(c, allowed.code, 409);
    // Quyền đã đọc có thể đổi trước lúc ghi. Cổng và cờ hai chiều được kiểm lại ngay trong INSERT.
    const row = await db.prepare(`INSERT INTO island_visit(host_id, guest_id, day, at)
      SELECT ?1, ?2, ?3, ?4 WHERE EXISTS (SELECT 1 FROM profile WHERE user_id = ?1 AND ${openIsland('island_json')})
        AND EXISTS (SELECT 1 FROM companion WHERE ${pair('?1','?2')} AND status = 'dong_y' AND than_a = 1 AND than_b = 1
          AND (CASE WHEN a = ?1 THEN away_a ELSE away_b END) = 1)
        AND NOT ${blocked('?1','?2')}
      ON CONFLICT(host_id,guest_id,day) DO UPDATE SET at = island_visit.at RETURNING day`)
      .bind(host, me, hostView.date, now).first();
    if (row) return c.json({ ok: true });
    const latest = await relationship(db, me, host);
    return fail(c, canVisitAway(guestView, await participant(db, host, now), latest).code || 'host_doc_cu', 409);
  });
}

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

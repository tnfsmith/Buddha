// workers/api/src/cron.js
// Việc định kỳ của Worker vandao (PROJECT_ROADMAP.md §3, §6.3; cron "17 19 * * *" UTC = 02:17 giờ Việt Nam):
//  1. Thực thi yêu cầu xóa tài khoản đã qua 7 ngày ân hạn (xóa user → CASCADE mọi bảng; dọn bảng không có khóa ngoại).
//  2. Xóa tài khoản KHÁCH (isAnonymous = 1, chưa gắn passkey/mã khôi phục/Google) không hoạt động quá 90 ngày.
//     /api/v1/me trả `guest_purge_after` để app báo trước (§6.3).
//  3. Dọn sync_op quá 30 ngày, phiên hết hạn, mã dùng một lần (verification) hết hạn và dữ liệu Bạn đồng tu tới hạn.
// Mỗi lần chạy xử lý tối đa BATCH tài khoản để giữ trong giới hạn CPU/ghi D1 của gói Free; phần còn lại chạy đêm sau.
// Log chỉ ghi số lượng, không ghi định danh (AGENTS.md §5).

export const DAY = 24 * 60 * 60 * 1000;
export const GUEST_IDLE_DAYS = 90, SYNC_OP_DAYS = 30, BATCH = 200;

/** Lần hoạt động gần nhất của người dùng: hồ sơ, phiên (Better Auth gia hạn mỗi ngày dùng), đồng bộ, tu tập */
export const LAST_SEEN_SQL = `MAX(u.updatedAt,
  COALESCE((SELECT MAX(s.updatedAt) FROM session s WHERE s.userId = u.id), 0),
  COALESCE((SELECT MAX(d.last_sync_at) FROM device d WHERE d.user_id = u.id), 0),
  COALESCE((SELECT MAX(k.server_at) FROM kusala_entry k WHERE k.user_id = u.id), 0),
  COALESCE((SELECT MAX(p.server_at) FROM practice_session p WHERE p.user_id = u.id), 0))`;

async function deleteUsers(db, ids) {
  if (!ids.length) return 0;
  const q = ids.map(() => '?').join(',');
  await db.batch([
    db.prepare(`DELETE FROM sync_op WHERE user_id IN (${q})`).bind(...ids),
    db.prepare(`DELETE FROM deletion_request WHERE user_id IN (${q})`).bind(...ids),
    db.prepare(`DELETE FROM user WHERE id IN (${q})`).bind(...ids),   // CASCADE: session, account, passkey, profile, journey…
  ]);
  return ids.length;
}

export async function runCron(env, now = Date.now()) {
  const db = env.DB, out = {};
  const due = (await db.prepare('SELECT user_id FROM deletion_request WHERE execute_after <= ? LIMIT ?').bind(now, BATCH).all()).results || [];
  out.deleted_requested = await deleteUsers(db, due.map((r) => r.user_id));

  const idle = (await db.prepare(
    `SELECT u.id FROM user u WHERE u.isAnonymous = 1 AND ${LAST_SEEN_SQL} < ? LIMIT ?`,
  ).bind(now - GUEST_IDLE_DAYS * DAY, BATCH).all()).results || [];
  out.deleted_idle_guests = await deleteUsers(db, idle.map((r) => r.id));

  const [ops, sess, ver, requests, meets, visits] = await db.batch([
    db.prepare('DELETE FROM sync_op WHERE applied_at < ?').bind(now - SYNC_OP_DAYS * DAY),
    db.prepare('DELETE FROM session WHERE expiresAt < ?').bind(now),
    db.prepare('DELETE FROM verification WHERE expiresAt < ?').bind(now),
    db.prepare('DELETE FROM companion_request WHERE expires_at <= ?').bind(now),
    db.prepare('DELETE FROM meet_invite WHERE created_at < ?').bind(now - 7 * DAY),
    db.prepare('DELETE FROM island_visit WHERE at < ?').bind(now - 30 * DAY),
  ]);
  out.sync_ops = ops.meta?.changes ?? 0; out.sessions = sess.meta?.changes ?? 0; out.verifications = ver.meta?.changes ?? 0;
  out.companion_requests = requests.meta?.changes ?? 0;
  out.meet_invites = meets.meta?.changes ?? 0;
  out.island_visits = visits.meta?.changes ?? 0;
  console.log('[cron]', JSON.stringify(out));
  return out;
}

/** Ngày khách sẽ bị dọn nếu không hoạt động (null với tài khoản đã gắn cách đăng nhập lại) */
export async function guestPurgeAfter(db, uid) {
  const r = await db.prepare(`SELECT u.isAnonymous AS anon, ${LAST_SEEN_SQL} AS seen FROM user u WHERE u.id = ?`).bind(uid).first();
  return r && r.anon ? r.seen + GUEST_IDLE_DAYS * DAY : null;
}

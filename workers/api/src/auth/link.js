// workers/api/src/auth/link.js
// Gộp dữ liệu khi một khách ẩn danh đăng nhập vào tài khoản đã có (passkey, Google, mã khôi phục, QR liên kết).
// Better Auth gọi hàm này qua `onLinkAccount` của plugin anonymous, TRƯỚC khi xóa tài khoản khách (PROJECT_ROADMAP.md §6.1 bước 5):
// - Tài khoản đích chưa có tiến trình → chuyển nguyên hành trình của khách sang (máy mới không mất gì).
// - Tài khoản đích đã có tiến trình → giữ bản đã lưu; các hành trình của khách thành chu kỳ cũ (is_current = 0),
//   đánh số tiếp sau chu kỳ lớn nhất của đích. Không mất dữ liệu. (T2.3 có thể hỏi người dùng muốn giữ bản nào.)
// Mọi câu lệnh chạy trong một db.batch (giao dịch D1).

import { archiveOpenedTier } from '../tier-progress.js';

const MOVE = ['practice_session', 'device', 'deed_log'];

/** Có tiến trình: đã đặt Tịnh danh, đã xác nhận Kusala, đã ngồi thiền hoặc đã qua ngày 1 / chu kỳ 1 */
export async function hasProgress(db, uid) {
  const r = await db.prepare(
    `SELECT (SELECT COUNT(*) FROM kusala_entry WHERE user_id = ?1) + (SELECT COUNT(*) FROM practice_session WHERE user_id = ?1)
          + (SELECT COUNT(*) FROM practice_event WHERE user_id = ?1)
          + (SELECT COUNT(*) FROM journey WHERE user_id = ?1 AND (day > 1 OR cycle > 1)) + (SELECT COUNT(*) FROM profile WHERE user_id = ?1 AND tinh_danh IS NOT NULL) AS n`,
  ).bind(uid).first();
  return (r?.n || 0) > 0;
}

export async function linkGuest(db, guest, target) {
  if (!guest?.id || !target?.id || guest.id === target.id) return { moved: 'none' };
  const g = guest.id, t = target.id, now = Date.now();
  const moveAll = MOVE.map((tb) => db.prepare(`UPDATE ${tb} SET user_id = ? WHERE user_id = ?`).bind(t, g));
  // ID do thiết bị đặt. Khi hai sổ có cùng ID, giữ dấu của đích và dọn dấu còn lại của khách.
  moveAll.push(db.prepare('UPDATE OR IGNORE sync_op SET user_id = ? WHERE user_id = ?').bind(t, g),
    db.prepare('DELETE FROM sync_op WHERE user_id = ?').bind(g));
  // Hồ sơ Duyên khởi theo tài khoản và không phụ thuộc chế độ gộp hành trình.
  moveAll.push(db.prepare(`UPDATE practice_profile SET user_id = ?1 WHERE user_id = ?2
    AND NOT EXISTS (SELECT 1 FROM practice_profile WHERE user_id = ?1)`).bind(t, g));
  let mode;
  if (!(await hasProgress(db, t))) {
    mode = 'guest';
    await db.batch([
      ...['kusala_entry', 'practice_event', 'journey', 'profile', 'tier_progress'].map((tb) => db.prepare(`DELETE FROM ${tb} WHERE user_id = ?`).bind(t)),
      ...['profile', 'journey', 'kusala_entry', 'practice_event', 'tier_progress'].map((tb) => db.prepare(`UPDATE ${tb} SET user_id = ? WHERE user_id = ?`).bind(t, g)),
      ...moveAll,
    ]);
  } else {
    mode = 'archive';
    const js = (await db.prepare(
      `SELECT program, cycle FROM journey j WHERE user_id = ? AND (day > 1 OR EXISTS (SELECT 1 FROM kusala_entry k WHERE k.user_id = j.user_id AND k.program = j.program AND k.cycle = j.cycle)
       OR EXISTS (SELECT 1 FROM practice_event e WHERE e.user_id = j.user_id AND e.program = j.program AND e.cycle = j.cycle)) ORDER BY program, cycle`,
    ).bind(g).all()).results || [];
    const top = {};
    for (const r of (await db.prepare('SELECT program, MAX(cycle) AS c FROM journey WHERE user_id = ? GROUP BY program').bind(t).all()).results || []) top[r.program] = r.c;
    const stmts = [], remapped = [];
    for (const j of js) {
      const nc = (top[j.program] = (top[j.program] || 0) + 1);
      remapped.push({ program: j.program, old: j.cycle, next: nc });
      stmts.push(
        db.prepare('UPDATE kusala_entry SET user_id = ?, cycle = ? WHERE user_id = ? AND program = ? AND cycle = ?').bind(t, nc, g, j.program, j.cycle),
        db.prepare('UPDATE practice_event SET user_id = ?, cycle = ? WHERE user_id = ? AND program = ? AND cycle = ?').bind(t, nc, g, j.program, j.cycle),
        db.prepare('UPDATE journey SET user_id = ?, cycle = ?, is_current = 0, updated_at = ? WHERE user_id = ? AND program = ? AND cycle = ?').bind(t, nc, now, g, j.program, j.cycle),
      );
    }
    if (remapped.length) stmts.push(archiveOpenedTier(db, g, t, remapped));
    await db.batch([...stmts, ...moveAll]);
  }
  // Đích vẫn là tài khoản khách (chưa gắn passkey/Google/mã khôi phục): plugin không tự xóa khách cũ → xóa ở đây
  if (target.isAnonymous) await db.prepare('DELETE FROM user WHERE id = ?').bind(g).run();
  return { moved: mode };
}

// Hồ sơ Duyên khởi (#105): rev lưu ở updated_at, độc lập với rev hành trình và Tịnh danh.
const COLUMNS = 'level, minutes, time_window, familiarity, precepts_json, uposatha, no_money, at_home, updated_at';

function snapshot(row) {
  if (!row) return { profile: null, rev: 0 };
  return {
    profile: {
      level: row.level, minutes: row.minutes, time_window: row.time_window, familiarity: row.familiarity,
      precepts: JSON.parse(row.precepts_json).sort((a, b) => a - b), uposatha: row.uposatha,
      no_money: Boolean(row.no_money), at_home: Boolean(row.at_home),
    },
    rev: row.updated_at,
  };
}

export async function getPracticeProfile(db, userId) {
  const row = await db.prepare(`SELECT ${COLUMNS} FROM practice_profile WHERE user_id = ?`).bind(userId).first();
  return snapshot(row);
}

/** Ghi có điều kiện và trả đúng bản vừa ghi. null khi thiết bị khác đã ghi trước. */
export async function writePracticeProfile(db, userId, profile, rev) {
  const nextRev = Math.max(Date.now(), rev + 1);
  const values = [profile.level, profile.minutes, profile.time_window, profile.familiarity, JSON.stringify(profile.precepts),
    profile.uposatha, Number(profile.no_money), Number(profile.at_home), nextRev];
  const row = rev === 0
    ? await db.prepare(`INSERT INTO practice_profile (user_id, ${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO NOTHING RETURNING ${COLUMNS}`).bind(userId, ...values).first()
    : await db.prepare(`UPDATE practice_profile
        SET level = ?, minutes = ?, time_window = ?, familiarity = ?, precepts_json = ?, uposatha = ?,
            no_money = ?, at_home = ?, updated_at = ?
        WHERE user_id = ? AND updated_at = ? RETURNING ${COLUMNS}`).bind(...values, userId, rev).first();
  return row ? snapshot(row) : null;
}

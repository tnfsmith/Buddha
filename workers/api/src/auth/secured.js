// Tài khoản đã có cách đăng nhập lại (passkey, mã khôi phục…) thì không còn là "khách": không bị cron dọn khách 90 ngày
export const markSecured = (db, uid) => db.prepare('UPDATE user SET isAnonymous = 0, updatedAt = ? WHERE id = ? AND isAnonymous = 1').bind(Date.now(), uid).run();

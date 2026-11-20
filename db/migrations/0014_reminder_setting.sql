-- Tịnh khẩu là lựa chọn của tài khoản, kể cả khi chưa có lịch (#105).
CREATE TABLE reminder_setting (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  paused_until INTEGER,
  write_id TEXT NOT NULL
);

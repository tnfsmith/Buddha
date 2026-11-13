-- 0007_recovery_code.sql
-- Mã khôi phục (PROJECT_ROADMAP.md §6.4): 26 ký tự Base32, 128 bit ngẫu nhiên, hiện một lần cho người dùng;
-- máy chủ chỉ lưu SHA-256 (đủ an toàn vì mã có độ ngẫu nhiên cao). Mỗi tài khoản một mã; tạo lại thì mã cũ hết hiệu lực.
CREATE TABLE recovery_code (
  user_id      TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  code_hash    TEXT NOT NULL UNIQUE,
  created_at   INTEGER NOT NULL,
  last_used_at INTEGER
);

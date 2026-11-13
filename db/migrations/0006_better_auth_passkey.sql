-- 0006_better_auth_passkey.sql
-- Better Auth 1.7 (T2.1, ADR 0001): bảng passkey cần thêm credentialID (định danh khóa trên thiết bị) và aaguid
-- (loại trình xác thực). Bảng passkey đang trống ở mọi môi trường nên thêm cột không cần dữ liệu mặc định;
-- ràng buộc bắt buộc của credentialID do Better Auth kiểm ở tầng ứng dụng (SQLite không thêm được cột NOT NULL
-- không có mặc định bằng ALTER TABLE).
ALTER TABLE passkey ADD COLUMN credentialID TEXT;
ALTER TABLE passkey ADD COLUMN aaguid TEXT;
CREATE INDEX passkey_credential_id ON passkey(credentialID);

-- Mã dùng một lần (QR liên kết thiết bị, OTP) tra theo identifier; phiên tra theo userId đã có chỉ mục ở 0001.
CREATE INDEX verification_identifier ON verification(identifier);

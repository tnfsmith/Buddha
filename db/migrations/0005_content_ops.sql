-- 0005_content_ops.sql
-- Quản trị nội dung, đồng bộ thiết bị, đồng thuận pháp lý và yêu cầu xóa (PROJECT_ROADMAP.md §4.3)
CREATE TABLE content_item (
  id          TEXT NOT NULL,
  version     INTEGER NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('bai_giang','bai_thien','nhiem_vu','kinh_van','chuong_trinh')),
  tier        INTEGER NOT NULL DEFAULT 0,
  lang        TEXT NOT NULL DEFAULT 'vi',
  title       TEXT NOT NULL,
  body_inline TEXT,
  body_r2_key TEXT,
  source_ref  TEXT NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('nhap','cho_duyet','da_duyet','ngung')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  PRIMARY KEY (id, version)
);

CREATE TABLE community_day (
  local_date    TEXT PRIMARY KEY,
  sessions      INTEGER NOT NULL DEFAULT 0,
  dedications   INTEGER NOT NULL DEFAULT 0,
  practitioners INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE device (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL CHECK (platform IN ('web','pwa','android')),
  app_version  TEXT,
  last_sync_at INTEGER,
  created_at   INTEGER NOT NULL
);

CREATE TABLE sync_op (
  user_id    TEXT NOT NULL,
  op_id      TEXT NOT NULL,
  applied_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, op_id)
);

CREATE TABLE consent (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind    TEXT NOT NULL CHECK (kind IN ('dieu_khoan','dong_bo_nhat_ky','thu_dien_tu')),
  version TEXT NOT NULL,
  granted INTEGER NOT NULL CHECK (granted IN (0,1)),
  at      INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, version)
);

CREATE TABLE deletion_request (
  user_id       TEXT PRIMARY KEY,
  requested_at  INTEGER NOT NULL,
  execute_after INTEGER NOT NULL
);

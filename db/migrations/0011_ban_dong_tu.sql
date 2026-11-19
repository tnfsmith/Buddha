-- 0011_ban_dong_tu.sql — hợp đồng Bạn đồng tu §2 (#121, #122).
-- Giữ tương thích với các cặp trong 0004, kể cả cặp cũ ở trạng thái "cho".
ALTER TABLE companion ADD COLUMN accepted_at INTEGER;
ALTER TABLE companion ADD COLUMN source TEXT NOT NULL DEFAULT 'tim' CHECK (source IN ('ma_moi','tim'));
ALTER TABLE companion ADD COLUMN than_a INTEGER NOT NULL DEFAULT 0 CHECK (than_a IN (0,1));
ALTER TABLE companion ADD COLUMN than_b INTEGER NOT NULL DEFAULT 0 CHECK (than_b IN (0,1));
ALTER TABLE companion ADD COLUMN away_a INTEGER NOT NULL DEFAULT 0 CHECK (away_a IN (0,1));
ALTER TABLE companion ADD COLUMN away_b INTEGER NOT NULL DEFAULT 0 CHECK (away_b IN (0,1));

CREATE TABLE companion_request (
  id          TEXT PRIMARY KEY,
  from_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  tinh_danh   TEXT NOT NULL,
  tag         TEXT NOT NULL,
  -- NULL khi không thể chuyển lời kết nối. Không đưa to_id vào bản xem của người gửi.
  to_id       TEXT REFERENCES user(id) ON DELETE SET NULL,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  declined_at INTEGER
);
CREATE UNIQUE INDEX companion_request_once ON companion_request(from_id, tinh_danh, tag);
CREATE INDEX companion_request_to ON companion_request(to_id, declined_at, expires_at);

CREATE TABLE presence (
  user_id    TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  state      TEXT NOT NULL CHECK (state IN ('online','thien','tham','tra')),
  updated_at INTEGER NOT NULL
);

CREATE TABLE meet_invite (
  id           TEXT PRIMARY KEY,
  from_id      TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  to_id        TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('tham','xin_tham','thien','tra','tham_quan')),
  place        TEXT NOT NULL CHECK (place IN ('dao','dtd')),
  status       TEXT NOT NULL DEFAULT 'cho' CHECK (status IN ('cho','dong_y','tu_choi','huy')),
  created_at   INTEGER NOT NULL,
  responded_at INTEGER,
  start_at     INTEGER,
  CHECK (from_id <> to_id)
);
CREATE INDEX meet_invite_to ON meet_invite(to_id, status, created_at);
CREATE INDEX meet_invite_from ON meet_invite(from_id, status, created_at);

CREATE TABLE island_visit (
  host_id  TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  day      TEXT NOT NULL, -- ngày địa phương của chủ đảo
  at       INTEGER NOT NULL,
  PRIMARY KEY (host_id, guest_id, day)
);

-- Cửa sổ giới hạn lượt của API. Chỉ ghi băm cho lượt xem liên kết công khai.
CREATE TABLE companion_quota (
  scope        TEXT NOT NULL,
  actor        TEXT NOT NULL,
  user_id      TEXT REFERENCES user(id) ON DELETE CASCADE,
  window_start INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL,
  n            INTEGER NOT NULL CHECK (n > 0),
  PRIMARY KEY (scope, actor, window_start)
);
CREATE INDEX companion_quota_expiry ON companion_quota(expires_at);

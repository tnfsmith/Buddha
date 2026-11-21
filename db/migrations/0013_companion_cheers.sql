-- Lời khích lệ giữa bạn đồng tu theo hợp đồng #151 §10.3.
CREATE TABLE cheer (
  from_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  line TEXT NOT NULL CHECK (line IN ('tuy_hy','cung_giu','nho_ban','cam_on','tien_trinh')),
  j_day INTEGER,
  j_done INTEGER,
  at INTEGER NOT NULL,
  PRIMARY KEY (from_id, to_id, day)
);
CREATE INDEX cheer_received ON cheer(to_id, at DESC);
CREATE INDEX cheer_expiry ON cheer(at);

CREATE TABLE cheer_seen (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  seen_at INTEGER NOT NULL
);

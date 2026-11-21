-- Phiên đồng tu nhóm theo hợp đồng #151 §9.2.
CREATE TABLE dong_tu_session (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'thien' CHECK (kind = 'thien'),
  place TEXT NOT NULL DEFAULT 'dtd' CHECK (place = 'dtd'),
  start_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'hen' CHECK (status IN ('hen','huy')),
  created_at INTEGER NOT NULL
);
CREATE INDEX dong_tu_session_host ON dong_tu_session(host_id, status, start_at);
CREATE INDEX dong_tu_session_expiry ON dong_tu_session(start_at);
CREATE TABLE dong_tu_seat (
  session_id TEXT NOT NULL REFERENCES dong_tu_session(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'moi' CHECK (status IN ('moi','nhan','tu_choi','roi')),
  responded_at INTEGER,
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX dong_tu_seat_user ON dong_tu_seat(user_id, status);

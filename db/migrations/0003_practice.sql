-- 0003_practice.sql
-- Nhật ký Kusala, thời thiền và tiến trình mở tầng (PROJECT_ROADMAP.md §4.3)
CREATE TABLE kusala_entry (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  program     TEXT NOT NULL,
  cycle       INTEGER NOT NULL,
  day         INTEGER NOT NULL,
  pillar      TEXT NOT NULL CHECK (pillar IN ('duc','thien','tue')),
  local_date  TEXT NOT NULL,
  base        REAL NOT NULL DEFAULT 10,
  pre         REAL NOT NULL CHECK (pre    BETWEEN 0.5 AND 1.2),
  during      REAL NOT NULL CHECK (during BETWEEN 0.5 AND 1.2),
  post        REAL NOT NULL CHECK (post   BETWEEN 0.5 AND 1.2),
  wise        INTEGER NOT NULL CHECK (wise IN (0,1)),
  self        INTEGER NOT NULL CHECK (self IN (0,1)),
  e_score     REAL NOT NULL,
  variant_id  TEXT,
  punna       TEXT,
  parami_json TEXT NOT NULL DEFAULT '[]',
  scope       TEXT CHECK (scope IS NULL OR scope IN ('doi_thuc','dong_tu')),
  note        TEXT CHECK (note IS NULL OR length(note) <= 1000),
  at          INTEGER NOT NULL,
  server_at   INTEGER NOT NULL,
  UNIQUE (user_id, program, cycle, day, pillar)
);
CREATE INDEX kusala_user_date ON kusala_entry(user_id, local_date);

CREATE TABLE practice_session (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('thien15','thien_tu_do','nghe_giang','kinh_hanh','tra_dao','thien_duong')),
  ref         TEXT,
  place       TEXT,
  started_at  INTEGER NOT NULL,
  duration_s  INTEGER NOT NULL CHECK (duration_s BETWEEN 0 AND 14400),
  completed   INTEGER NOT NULL CHECK (completed IN (0,1)),
  server_at   INTEGER NOT NULL
);
CREATE INDEX session_user_time ON practice_session(user_id, started_at);

CREATE TABLE tier_progress (
  user_id       TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  tier          INTEGER NOT NULL CHECK (tier BETWEEN 0 AND 4),
  status        TEXT NOT NULL CHECK (status IN ('dang_tu','du_dieu_kien','da_mo')),
  criteria_json TEXT NOT NULL DEFAULT '{}',
  opened_at     INTEGER,
  confirmed_by  TEXT REFERENCES user(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, tier)
);

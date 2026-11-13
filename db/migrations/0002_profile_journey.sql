-- 0002_profile_journey.sql
-- Hồ sơ hành giả và hành trình tu tập (PROJECT_ROADMAP.md §4.3)
CREATE TABLE profile (
  user_id         TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  -- NULL cho tới khi người dùng tự chọn Tịnh danh (AGENTS.md §1.4); máy chủ không tự đặt tên thay
  tinh_danh       TEXT CHECK (tinh_danh IS NULL OR length(tinh_danh) BETWEEN 2 AND 16),
  tinh_danh_key   TEXT,
  tag             TEXT NOT NULL,
  look_json       TEXT NOT NULL,
  settings_json   TEXT NOT NULL DEFAULT '{}',
  island_json     TEXT NOT NULL DEFAULT '{}',
  tz              TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  tz_changed_at   INTEGER,
  name_changed_at INTEGER,
  visibility      TEXT NOT NULL DEFAULT 'dong_tu' CHECK (visibility IN ('an','dong_tu','cong_khai')),
  pref_seat       INTEGER,
  rev             INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  UNIQUE (tinh_danh_key, tag)
);

CREATE TABLE journey (
  user_id        TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  program        TEXT NOT NULL DEFAULT 'so-nhap-49',
  cycle          INTEGER NOT NULL DEFAULT 1,
  day            INTEGER NOT NULL DEFAULT 1 CHECK (day >= 1),
  started_on     TEXT NOT NULL,
  last_done_on   TEXT,
  completed_at   INTEGER,
  sacca_count    INTEGER NOT NULL DEFAULT 0,
  sessions_done  INTEGER NOT NULL DEFAULT 0,
  sermons_done   INTEGER NOT NULL DEFAULT 0,
  is_current     INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
  rev            INTEGER NOT NULL DEFAULT 1,
  updated_at     INTEGER NOT NULL,
  PRIMARY KEY (user_id, program, cycle)
);
CREATE UNIQUE INDEX journey_current ON journey(user_id) WHERE is_current = 1;

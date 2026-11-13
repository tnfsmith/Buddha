-- 0004_social.sql
-- Đồng tu, mã mời sơ nhập, nhóm và an toàn cộng đồng (PROJECT_ROADMAP.md §4.3)
CREATE TABLE companion (
  a            TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  b            TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  status       TEXT NOT NULL CHECK (status IN ('cho','dong_y')),
  requested_by TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (a, b),
  CHECK (a < b)
);
CREATE INDEX companion_b ON companion(b);

CREATE TABLE invite (
  code        TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  uses_left   INTEGER NOT NULL DEFAULT 5,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE TABLE guidance (
  newcomer_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  guide_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  invite_code TEXT,
  accepted_at INTEGER NOT NULL
);
CREATE INDEX guidance_guide ON guidance(guide_id);

CREATE TABLE sangha_group (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL CHECK (length(name) BETWEEN 3 AND 40),
  founder_id  TEXT REFERENCES user(id) ON DELETE SET NULL,
  goal        TEXT CHECK (goal IS NULL OR length(goal) <= 300),
  min_tier    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE group_member (
  group_id   TEXT NOT NULL REFERENCES sangha_group(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'thanh_vien' CHECK (role IN ('thanh_vien','dieu_phoi')),
  joined_at  INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_member_user ON group_member(user_id);

CREATE TABLE user_block (
  blocker_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE TABLE report (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  target_id   TEXT REFERENCES user(id) ON DELETE SET NULL,
  context     TEXT NOT NULL CHECK (context IN ('hall','island','group','name')),
  reason      TEXT CHECK (reason IS NULL OR length(reason) <= 500),
  status      TEXT NOT NULL DEFAULT 'mo' CHECK (status IN ('mo','da_xu_ly','bo_qua')),
  created_at  INTEGER NOT NULL
);

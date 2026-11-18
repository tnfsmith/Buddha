-- Nền T3.3 (#102), theo ROADMAP §4.6. Chỉ thêm bảng; chưa bật API/scheduler.
CREATE TABLE practice_profile (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  level TEXT NOT NULL DEFAULT 'vua' CHECK (level IN ('nhe','vua','sau')),
  minutes INTEGER NOT NULL DEFAULT 15 CHECK (typeof(minutes) = 'integer' AND minutes BETWEEN 5 AND 120),
  time_window TEXT NOT NULL DEFAULT 'linh_hoat' CHECK (time_window IN ('sang','trua','toi','linh_hoat')),
  familiarity TEXT CHECK (familiarity IN ('moi','da_quy_y','tu_lau')),
  precepts_json TEXT NOT NULL DEFAULT '[1,2,3,4,5]' CHECK (json_valid(precepts_json) AND json_type(precepts_json) = 'array' AND json_array_length(precepts_json) <= 5),
  uposatha TEXT NOT NULL DEFAULT 'vn_4' CHECK (uposatha IN ('vn_2','vn_4','vn_6','vn_10','khong')),
  no_money INTEGER NOT NULL DEFAULT 0 CHECK (no_money IN (0,1)),
  at_home INTEGER NOT NULL DEFAULT 0 CHECK (at_home IN (0,1)),
  updated_at INTEGER NOT NULL
);
CREATE TABLE deed_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  local_date TEXT NOT NULL,
  punna TEXT NOT NULL CHECK (punna IN ('dana','sila','bhavana','apacayana','veyyavacca','pattidana','pattanumodana','dhammassavana','dhammadesana','ditthujukamma')),
  parami_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(parami_json) AND json_type(parami_json) = 'array' AND json_array_length(parami_json) <= 10),
  scope TEXT NOT NULL CHECK (scope IN ('doi_thuc','dong_tu')),
  shared INTEGER NOT NULL DEFAULT 0 CHECK (shared IN (0,1)),
  at INTEGER NOT NULL
);
CREATE INDEX deed_user_date ON deed_log(user_id, local_date);
CREATE TABLE reminder (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('thien','nhiem_vu','ghi_nhan','uposatha','tong_ket_tuan','nhom')),
  local_hm TEXT NOT NULL CHECK (local_hm GLOB '[0-2][0-9]:[0-5][0-9]' AND local_hm < '24:00'),
  days_mask INTEGER NOT NULL DEFAULT 127 CHECK (typeof(days_mask) = 'integer' AND days_mask BETWEEN 0 AND 127),
  channel TEXT NOT NULL CHECK (channel IN ('push','email','local')),
  next_at INTEGER,
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  paused_until INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX reminder_due ON reminder(next_at) WHERE active = 1;
CREATE TABLE push_subscription (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE CHECK (endpoint LIKE 'https://%' AND length(endpoint) <= 2048),
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  fail_count INTEGER NOT NULL DEFAULT 0 CHECK (fail_count >= 0),
  created_at INTEGER NOT NULL,
  last_ok_at INTEGER
);
CREATE TABLE attestation (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  cycle INTEGER NOT NULL CHECK (typeof(cycle) = 'integer' AND cycle >= 1),
  week INTEGER NOT NULL CHECK (typeof(week) = 'integer' AND week BETWEEN 1 AND 7),
  attester_id TEXT REFERENCES user(id) ON DELETE SET NULL,
  attester_label TEXT CHECK (attester_label IN ('nguoi_than','dong_tu','ban_be')),
  token_hash TEXT UNIQUE,
  note TEXT CHECK (note IS NULL OR length(note) <= 300),
  status TEXT NOT NULL DEFAULT 'cho' CHECK (status IN ('cho','da_xac_nhan','tu_choi','het_han')),
  created_at INTEGER NOT NULL,
  confirmed_at INTEGER
);

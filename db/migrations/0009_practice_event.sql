-- Sự kiện tu tập chỉ thêm (#93/#94); value_json chỉ chứa mã theo shared/practice.js.
CREATE TABLE practice_event (
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  id          TEXT NOT NULL,
  program     TEXT NOT NULL,
  cycle       INTEGER NOT NULL,
  local_date  TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('viec','vow','tu')),
  slot        TEXT NOT NULL,
  value_json  TEXT CHECK (value_json IS NULL OR length(value_json) <= 1024),
  at          INTEGER NOT NULL,
  server_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, id)
);
CREATE INDEX practice_event_cycle ON practice_event(user_id, program, cycle, local_date);

-- Cùng MAX_EVENTS_PER_DAY=60: chặn cả hai thiết bị cùng đọc số lượng 59 rồi cùng ghi.
-- RAISE làm thất bại batch, nên không tăng rev hoặc ghi sync_op cho sự kiện bị chặn.
CREATE TRIGGER practice_event_day_limit BEFORE INSERT ON practice_event
WHEN (SELECT COUNT(*) FROM practice_event
      WHERE user_id = NEW.user_id AND program = NEW.program
        AND cycle = NEW.cycle AND local_date = NEW.local_date) >= 60
BEGIN
  SELECT RAISE(ABORT, 'too_many_events');
END;

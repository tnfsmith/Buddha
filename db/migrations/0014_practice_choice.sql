-- Gợi ý theo ngày địa phương của từng chu kỳ (#105).
CREATE TABLE practice_choice (
  user_id TEXT NOT NULL,
  program TEXT NOT NULL,
  cycle INTEGER NOT NULL,
  day INTEGER NOT NULL CHECK (day BETWEEN 1 AND 49),
  local_date TEXT NOT NULL,
  pillar TEXT NOT NULL CHECK (pillar IN ('duc', 'thien', 'tue')),
  variant_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  snap TEXT NOT NULL,
  profile_rev INTEGER NOT NULL CHECK (profile_rev > 0),
  chosen_at INTEGER NOT NULL,
  swapped_at INTEGER,
  swap_op_id TEXT,
  swap_from_id TEXT,
  swap_from_version INTEGER,
  PRIMARY KEY (user_id, program, cycle, local_date, pillar),
  FOREIGN KEY (user_id, program, cycle) REFERENCES journey (user_id, program, cycle)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CHECK ((swapped_at IS NULL AND swap_op_id IS NULL AND swap_from_id IS NULL AND swap_from_version IS NULL)
    OR (swapped_at IS NOT NULL AND swap_op_id IS NOT NULL AND swap_from_id IS NOT NULL
      AND swap_from_version IS NOT NULL AND swap_from_version > 0))
);

CREATE INDEX practice_choice_swap_op ON practice_choice (user_id, swap_op_id)
  WHERE swap_op_id IS NOT NULL;

-- Dùng chung sổ ID của /sync, cùng giao dịch với câu UPDATE đổi gợi ý.
CREATE TRIGGER practice_choice_record_swap
AFTER UPDATE OF swap_op_id ON practice_choice
WHEN OLD.swap_op_id IS NULL AND NEW.swap_op_id IS NOT NULL
BEGIN
  INSERT INTO sync_op (user_id, op_id, applied_at) VALUES (NEW.user_id, NEW.swap_op_id, NEW.swapped_at);
END;

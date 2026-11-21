import rule from '../../../content/program/so-nhap-49/tier-unlock.js';

// Cùng điều kiện dùng cho đọc và ghi. Mỗi lệnh ghi đối chiếu chu kỳ, cờ và số thời thiền trong D1.
const FACTS = `
  WITH journey_state AS (
    SELECT j.cycle, j.day, j.completed_at, t.status,
      CASE WHEN json_valid(t.criteria_json) THEN t.criteria_json ELSE '{}' END AS evidence,
      t.opened_at,
      (j.day >= ?4 AND j.completed_at IS NOT NULL) AS journey_completed,
      (SELECT COUNT(*) FROM practice_event e
       WHERE e.user_id = j.user_id AND e.program = j.program AND e.cycle = j.cycle
         AND e.kind = 'tu' AND e.slot = 'thoi_thien'
         AND CASE WHEN json_valid(e.value_json) THEN
           json_type(e.value_json, '$.n') = 'integer' AND json_extract(e.value_json, '$.n') = 1
           AND json_type(e.value_json, '$.min') = 'integer' AND json_extract(e.value_json, '$.min') >= ?5
         ELSE 0 END) AS full_sessions
    FROM journey j LEFT JOIN tier_progress t ON t.user_id = j.user_id AND t.tier = ?3
    WHERE j.user_id = ?1 AND j.program = ?2 AND j.is_current = 1
  ), facts AS (
    SELECT *, COALESCE(json_extract(evidence, '$.program') = ?2 AND json_extract(evidence, '$.cycle') = cycle
      AND json_extract(evidence, '$.reflection_week') = ?6 AND json_type(evidence, '$.week_7_reflected') = 'true', 0)
      AS week_reflected
    FROM journey_state
  )
`;

const bindFacts = (uid) => [uid, rule.program, rule.tier, rule.day, rule.minSessionMinutes, rule.reflectionWeek];
const read = (db, uid) => db.prepare(FACTS + 'SELECT * FROM facts').bind(...bindFacts(uid));

function view(row) {
  const opened = row.status === 'da_mo';
  const saved = opened ? JSON.parse(row.evidence) : null;
  return {
    tier: rule.tier,
    cycle: row.cycle,
    status: opened ? 'da_mo' : row.journey_completed && row.full_sessions >= rule.minFullSessions && row.week_reflected
      ? 'du_dieu_kien' : 'dang_tu',
    criteria: {
      journey_completed: opened ? saved?.journey_completed === true : Boolean(row.journey_completed),
      full_sessions: opened ? saved?.full_sessions ?? 0 : row.full_sessions,
      min_full_sessions: opened ? saved?.min_full_sessions ?? rule.minFullSessions : rule.minFullSessions,
      week_7_reflected: opened ? saved?.week_7_reflected === true : Boolean(row.week_reflected),
    },
    opened_at: opened ? row.opened_at : null,
  };
}

export async function getTierProgress(db, uid) {
  const row = await read(db, uid).first();
  return row ? view(row) : null;
}

const UPSERT = `
  ON CONFLICT(user_id, tier) DO UPDATE SET status = excluded.status,
    criteria_json = excluded.criteria_json, opened_at = excluded.opened_at
  WHERE tier_progress.status <> 'da_mo'
`;

export async function updateTierProgress(db, uid, cycle, action, now) {
  const opening = action === 'open';
  const body = opening ? `
    SELECT ?1, ?3, 'da_mo',
      json_object('program', ?2, 'cycle', cycle, 'criteria_version', ?8, 'reflection_week', ?6,
        'week_7_reflected', json('true'), 'journey_completed', json('true'),
        'full_sessions', full_sessions, 'min_full_sessions', ?9), ?10
    FROM facts WHERE cycle = ?7 AND journey_completed AND full_sessions >= ?9 AND week_reflected
  ` : `
    SELECT ?1, ?3, 'dang_tu',
      json_object('program', ?2, 'cycle', cycle, 'criteria_version', ?8, 'reflection_week', ?6,
        'week_7_reflected', json('true')), NULL
    FROM facts WHERE cycle = ?7 AND (day >= ?4 OR completed_at IS NOT NULL) AND NOT week_reflected
  `;
  const params = [...bindFacts(uid), cycle, rule.version];
  if (opening) params.push(rule.minFullSessions, now);
  const write = db.prepare(FACTS + 'INSERT INTO tier_progress (user_id, tier, status, criteria_json, opened_at) ' + body + UPSERT)
    .bind(...params);

  // D1 thực hiện ghi và đọc kết quả trong cùng giao dịch, kể cả khi thiết bị khác đổi chu kỳ.
  const [, result] = await db.batch([write, read(db, uid)]);
  const row = result.results[0];
  if (!row || row.cycle !== cycle) return { code: row ? 'cycle_conflict' : 'journey_not_found' };
  if (row.status !== 'da_mo') {
    if (opening) return { code: 'tier_not_ready' };
    if (!row.week_reflected) return { code: 'reflection_too_early' };
  }
  return { value: view(row) };
}

export function archiveOpenedTier(db, guest, target, cycles) {
  return db.prepare(`
    INSERT INTO tier_progress (user_id, tier, status, criteria_json, opened_at)
    SELECT ?1, t.tier, t.status, json_set(t.criteria_json, '$.cycle', json_extract(c.value, '$.next')), t.opened_at
    FROM tier_progress t JOIN json_each(?2) c ON CASE WHEN json_valid(t.criteria_json) THEN
      json_extract(t.criteria_json, '$.program') = json_extract(c.value, '$.program')
      AND json_extract(t.criteria_json, '$.cycle') = json_extract(c.value, '$.old')
    ELSE 0 END
    WHERE t.user_id = ?3 AND t.tier = ?4 AND t.status = 'da_mo'
    ` + UPSERT).bind(target, JSON.stringify(cycles), guest, rule.tier);
}

export async function exportTierProgress(db, uid) {
  const { results } = await db.prepare(`
    SELECT tier, status, opened_at, CASE WHEN json_valid(criteria_json) THEN
      json_object('program', json_extract(criteria_json, '$.program'),
        'cycle', json_extract(criteria_json, '$.cycle'), 'criteria_version', json_extract(criteria_json, '$.criteria_version'),
        'reflection_week', json_extract(criteria_json, '$.reflection_week'),
        'week_7_reflected', criteria_json -> '$.week_7_reflected',
        'journey_completed', criteria_json -> '$.journey_completed',
        'full_sessions', json_extract(criteria_json, '$.full_sessions'),
        'min_full_sessions', json_extract(criteria_json, '$.min_full_sessions'))
    ELSE '{}' END AS criteria FROM tier_progress WHERE user_id = ? ORDER BY tier
  `).bind(uid).all();
  return results.map(({ criteria, ...row }) => ({ ...row, criteria: JSON.parse(criteria) }));
}

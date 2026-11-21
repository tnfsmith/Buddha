import { lotus, PASSIVE } from '@vandao/shared/missions.js';
import { isPunna } from '@vandao/shared/parami.js';
import { foldPractice } from '@vandao/shared/practice.js';
import { publicContent } from './content-public.js';
import { getLocalDate } from './utils/time.js';

const shift = (date, days) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
const round = (n) => Math.round(n * 100) / 100;

async function sourceCodes(db, ids) {
  if (!ids.size) return new Map();
  const { results } = await db.prepare(`SELECT id,
    CASE WHEN json_valid(meta) THEN json_extract(meta, '$.punna') END AS punna
    FROM content_item AS item
    WHERE item.kind IN ('chuong_trinh', 'nhiem_vu') AND item.tier = 0 AND ${publicContent}
      AND item.id IN (SELECT value FROM json_each(?)) ORDER BY id, version DESC`)
    .bind(JSON.stringify([...ids])).all();
  const codes = new Map();
  for (const row of results) {
    if (!codes.has(row.id)) codes.set(row.id, row.punna);
    else if (codes.get(row.id) !== row.punna) codes.set(row.id, null);
  }
  return codes;
}

export async function practiceSummary(db, userId, range, now) {
  const journey = await db.prepare(`SELECT j.program, j.cycle, j.started_on, j.completed_at, j.sacca_count, p.tz
    FROM journey j LEFT JOIN profile p ON p.user_id = j.user_id WHERE j.user_id = ? AND j.is_current = 1`).bind(userId).first();
  if (!journey) return null;
  const { program, cycle, started_on, completed_at, sacca_count, tz } = journey;
  const today = getLocalDate(now, tz);
  const finished = completed_at ? getLocalDate(completed_at, tz) : today;
  const to = finished < today ? finished : today;
  const weekStart = shift(to, -6);
  const from = range === 'week' && weekStart > started_on ? weekStart : started_on;
  const scope = [userId, program, cycle, from, to];
  const [entries, events] = await db.batch([
    db.prepare(`SELECT day, pillar, e_score, punna, variant_id FROM kusala_entry
      WHERE user_id = ? AND program = ? AND cycle = ? AND local_date BETWEEN ? AND ?`).bind(...scope),
    db.prepare(`SELECT id, local_date AS date, kind, slot, value_json, at FROM practice_event
      WHERE user_id = ? AND program = ? AND cycle = ? AND local_date BETWEEN ? AND ?
        AND (value_json IS NULL OR json_valid(value_json))`).bind(...scope),
  ]);
  const { tu, viec } = foldPractice(events.results.map(({ value_json, ...event }) => ({
    ...event, value: value_json === null ? null : JSON.parse(value_json),
  })));
  const activeIds = Object.values(viec).flatMap((day) => [
    ...Object.values(day.gioi || {}), day.nguyen, day.trai, day.hanh?.done ? day.hanh : null,
  ].map((item) => item?.id).filter(Boolean));
  const unlabelled = entries.results.filter((entry) => !isPunna(entry.punna)).map((entry) => entry.variant_id).filter(Boolean);
  const codes = await sourceCodes(db, new Set([...activeIds, ...unlabelled]));

  const done = {};
  const pillars = { duc: 0, thien: 0, tue: 0, all: 0 };
  const punna = {};
  const addPunna = (code, n) => { if (isPunna(code)) punna[code] = (punna[code] || 0) + n; };
  for (const row of entries.results) {
    (done[row.day] ??= {})[row.pillar] = true;
    pillars[row.pillar] += row.e_score;
    pillars.all += row.e_score;
    addPunna(isPunna(row.punna) ? row.punna : codes.get(row.variant_id), 1);
  }
  for (const id of activeIds) addPunna(codes.get(id), 1);
  let minutes = 0;
  for (const day of Object.values(tu)) {
    minutes += day.thoi_thien?.min ?? 0;
    for (const [code, record] of Object.entries(day)) addPunna(PASSIVE[code]?.punna, record.n);
  }
  // Sám hối cũ chỉ có tổng theo chu kỳ; không gán tổng đó cho một tuần cắt giữa chu kỳ.
  const { counts, norm } = lotus(tu, done, from === started_on && from <= to ? sacca_count : 0, viec);
  for (const key of Object.keys(pillars)) pillars[key] = round(pillars[key]);
  return { program, cycle, range, from, to, pillars, lotus: { counts, norm }, punna, meditation_minutes: round(minutes) };
}

import { isPillar, swapVariant, weekOfDay } from '@vandao/shared/variant.js';
import { choiceScope, listedChoice, loadChoicesCatalog, practiceDay, publicChoice, stillCurrent } from './practice-choices.js';
import { getPracticeProfile } from './practice-profile.js';

const ok = { ok: true };
const error = (code, status = 409) => ({ ok: false, code, status });
const dateOk = (date) => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const ms = Date.parse(date);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === date;
};

function valid(body) {
  const { op_id, cycle, day, date, pillar, current } = body ?? {};
  return typeof op_id === 'string' && op_id.length > 0 && op_id.length <= 64 &&
    Number.isSafeInteger(cycle) && cycle > 0 && weekOfDay(day) !== null && dateOk(date) && isPillar(pillar) &&
    typeof current?.id === 'string' && current.id.length <= 100 && /^sn49-[a-z0-9-]+$/.test(current.id) &&
    Number.isSafeInteger(current.version) && current.version > 0;
}

async function previous(db, userId, input) {
  const { op_id, cycle, day, date, pillar, current } = input;
  const [choices, stamp] = await db.batch([
    db.prepare('SELECT cycle, day, local_date, pillar, swap_from_id, swap_from_version FROM practice_choice WHERE user_id = ? AND swap_op_id = ?').bind(userId, op_id),
    db.prepare(`SELECT 1 FROM sync_op WHERE user_id = ?1 AND op_id = ?2 UNION ALL
      SELECT 1 FROM practice_event WHERE user_id = ?1 AND id = ?2 LIMIT 1`).bind(userId, op_id),
  ]);
  if (choices.results.some((row) => row.cycle === cycle && row.day === day && row.local_date === date &&
      row.pillar === pillar && row.swap_from_id === current.id && row.swap_from_version === current.version)) return ok;
  return choices.results.length || stamp.results.length ? error('practice_swap_id_conflict') : null;
}

function dayError(context, input) {
  const { journey, date } = context;
  if (!journey) return error('journey_not_found', 404);
  if (journey.cycle !== input.cycle) return error('stale_cycle');
  if (journey.day !== input.day || date !== input.date || journey.completed_at) return error('stale_day');
  return null;
}

const confirmed = `EXISTS (SELECT 1 FROM kusala_entry
  WHERE user_id = ?1 AND program = ?2 AND cycle = ?3 AND day = ?5 AND pillar = ?7)`;
const choice = (db, scope, input) => db.prepare(`SELECT day, variant_id, version, swapped_at, ${confirmed} AS is_confirmed
  FROM practice_choice WHERE user_id = ?1 AND program = ?2 AND cycle = ?3 AND local_date = ?4 AND day = ?5 AND pillar = ?7`)
  .bind(...scope, input.day, null, input.pillar).first();

function choiceError(row, current) {
  if (row?.is_confirmed) return error('practice_pillar_confirmed');
  if (row?.swapped_at != null) return error('practice_swap_used');
  if (row?.variant_id !== current.id || row.version !== current.version) return error('practice_choice_changed');
  return null;
}

export async function changePracticeChoice(db, userId, input, now, getContext, timingError) {
  if (!valid(input)) return error('invalid_practice_swap', 400);
  const replay = await previous(db, userId, input);
  if (replay) return replay;
  if (timingError) return error(timingError);
  const context = await (getContext ? getContext() : practiceDay(db, userId, now));
  const invalidDay = dayError(context, input);
  if (invalidDay) return invalidDay;

  const scope = choiceScope(userId, context.journey, context.date);
  const row = await choice(db, scope, input);
  const invalidChoice = choiceError(row, input.current);
  if (invalidChoice) return invalidChoice;
  const [{ profile, rev }, variants] = await Promise.all([
    getPracticeProfile(db, userId), loadChoicesCatalog(db),
  ]);
  if (!listedChoice(variants, row, profile, input.day, input.pillar)) return error('practice_choice_changed');
  const next = swapVariant(variants.catalog, profile, { userId, cycle: input.cycle, day: input.day, pillar: input.pillar }, input.current.id);
  if (!variants.ready || next.same || !next.variant) return error('practice_no_alternative');

  const updated = await db.prepare(`UPDATE practice_choice SET variant_id = ?10, version = ?11,
    profile_rev = ?6, snap = ?12, swapped_at = ?13, swap_op_id = ?14, swap_from_id = ?8, swap_from_version = ?9
    WHERE user_id = ?1 AND program = ?2 AND cycle = ?3 AND local_date = ?4 AND day = ?5 AND pillar = ?7
      AND variant_id = ?8 AND version = ?9 AND swapped_at IS NULL AND ${stillCurrent} AND NOT ${confirmed}
      AND EXISTS (SELECT 1 FROM profile WHERE user_id = ?1 AND COALESCE(tz, 'Asia/Ho_Chi_Minh') = ?15)
      AND NOT EXISTS (SELECT 1 FROM practice_choice AS other WHERE other.user_id = ?1 AND other.swap_op_id = ?14)
      AND NOT EXISTS (SELECT 1 FROM sync_op WHERE user_id = ?1 AND op_id = ?14)
      AND NOT EXISTS (SELECT 1 FROM practice_event WHERE user_id = ?1 AND id = ?14)
      AND EXISTS (SELECT 1 FROM content_item AS item WHERE item.id = ?8 AND item.version = ?9 AND ${publicChoice})
      AND EXISTS (SELECT 1 FROM content_item AS item WHERE item.id = ?10 AND item.version = ?11 AND ${publicChoice})
    RETURNING 1 AS changed`).bind(...scope, input.day, rev, input.pillar, input.current.id, input.current.version,
    next.variant.id, next.variant.version, variants.snap, now, input.op_id, context.tz).first();
  if (updated) return ok;
  return await previous(db, userId, input) ?? dayError(await practiceDay(db, userId, now), input) ??
    choiceError(await choice(db, scope, input), input.current) ?? error('practice_choice_changed');
}

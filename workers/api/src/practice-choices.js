import { fitsProfile, pickVariant, PILLARS, snapHash, toVariant, variantCatalog, variantCoverage, weekOfDay } from '@vandao/shared/variant.js';
import { publicContent } from './content-public.js';
import { currentJourney, dayPillars } from './lib.js';
import { getPracticeProfile } from './practice-profile.js';
import { getLocalDate } from './utils/time.js';

export const publicChoice = `item.kind = 'chuong_trinh' AND item.tier = 0 AND ${publicContent}`;

export async function practiceDay(db, userId, now) {
  const row = await db.prepare('SELECT tz FROM profile WHERE user_id = ?').bind(userId).first();
  const tz = row?.tz || 'Asia/Ho_Chi_Minh';
  const date = getLocalDate(now, tz);
  const journey = await currentJourney(db, userId, date, now);
  return { date, journey, tz };
}

export async function loadChoicesCatalog(db) {
  const { results } = await db.prepare(`SELECT id, version, kind, title, body_inline, source_ref, meta
    FROM content_item AS item WHERE ${publicChoice}`).all();
  const catalog = variantCatalog(results);
  const versions = new Map();
  for (const row of results) {
    const variant = toVariant(row);
    if (variant) versions.set(`${variant.id}@${variant.version}`, variant);
  }
  return { catalog, versions, snap: snapHash(catalog), ready: variantCoverage(catalog).ready };
}

const pick = ({ id, version, title, text, source_ref }) => ({ id, version, title, text, source_ref });
export const choiceScope = (userId, journey, date) => [userId, journey.program, journey.cycle, date];
export const stillCurrent = `EXISTS (
  SELECT 1 FROM journey WHERE user_id = ?1 AND program = ?2 AND cycle = ?3
    AND day = ?5 AND is_current = 1 AND completed_at IS NULL
  ) AND EXISTS (SELECT 1 FROM practice_profile WHERE user_id = ?1 AND updated_at = ?6)`;

export function listedChoice(variants, row, profile, day, pillar) {
  const variant = row && variants.versions.get(`${row.variant_id}@${row.version}`);
  return variant && variant.week === weekOfDay(day) && variant.pillar === pillar && fitsProfile(variant, profile)
    ? variant : null;
}

export async function getToday(db, userId, now, dayContext) {
  const { date, journey } = dayContext ?? await practiceDay(db, userId, now);
  if (!journey) return null;
  const { program, cycle, day } = journey;
  const [{ profile, rev }, variants, confirmed] = await Promise.all([
    getPracticeProfile(db, userId), loadChoicesCatalog(db), dayPillars(db, userId, journey),
  ]);
  const scope = choiceScope(userId, journey, date);
  const read = db.prepare(`SELECT pillar, variant_id, version, swapped_at
    FROM practice_choice WHERE user_id = ?1 AND program = ?2 AND cycle = ?3 AND local_date = ?4`).bind(...scope);
  const seeds = [];
  if (profile && variants.ready && !journey.completed_at) {
    for (const pillar of PILLARS) {
      const variant = pickVariant(variants.catalog, profile, { userId, cycle, day, pillar });
      if (!variant) continue;
      seeds.push(db.prepare(`INSERT INTO practice_choice
        (user_id, program, cycle, local_date, day, profile_rev, pillar, variant_id, version, snap, chosen_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
        WHERE ${stillCurrent}
          AND EXISTS (SELECT 1 FROM content_item AS item WHERE item.id = ?8 AND item.version = ?9 AND ${publicChoice})
        ON CONFLICT (user_id, program, cycle, local_date, pillar) DO NOTHING`)
        .bind(...scope, day, rev, pillar, variant.id, variant.version, variants.snap, now));
    }
  }
  const result = seeds.length ? (await db.batch([...seeds, read])).at(-1) : await read.all();
  const byPillar = new Map(result.results.map((row) => [row.pillar, row]));
  const suggestions = Object.fromEntries(PILLARS.map((pillar) => {
    const row = byPillar.get(pillar);
    const variant = !journey.completed_at && listedChoice(variants, row, profile, day, pillar);
    return [pillar, { variant: variant ? pick(variant) : null, swapped: row?.swapped_at != null, confirmed: Boolean(confirmed[pillar]) }];
  }));
  return {
    program, cycle, day, date, profile_rev: rev, snap: variants.snap, suggestions,
    meditation: profile ? { time_window: profile.time_window, standard_minutes: 15, suggested_minutes: profile.minutes } : null,
  };
}

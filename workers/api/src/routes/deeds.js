import { Hono } from 'hono';
import { isParami, isPunna } from '@vandao/shared/parami.js';
import { authMiddleware } from '../auth/session.js';
import { byUser } from '../guard.js';
import { bad, readJson } from '../lib.js';
import { getLocalDate } from '../utils/time.js';

const deedsApp = new Hono();
const CAP = 5;
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = ['op_id', 'punna', 'parami', 'scope', 'shared'];
const columns = 'id, local_date AS date, punna, parami_json, scope, shared, at';
export const deedView = ({ parami_json, ...row }) => ({ ...row, parami: JSON.parse(parami_json), shared: Boolean(row.shared) });

function check(body) {
  if (!body || Object.keys(body).some((key) => !fields.includes(key))) return null;
  const { op_id, punna, parami, scope, shared = false } = body;
  if (typeof op_id !== 'string' || !UUID4.test(op_id) || typeof punna !== 'string' || !isPunna(punna) ||
      !Array.isArray(parami) || parami.length > 10 || new Set(parami).size !== parami.length ||
      !parami.every((code) => typeof code === 'string' && isParami(code)) ||
      !['doi_thuc', 'dong_tu'].includes(scope) || typeof shared !== 'boolean') return null;
  return { id: op_id.toLowerCase(), punna, paramiJson: JSON.stringify([...parami].sort()), scope, shared: Number(shared) };
}

deedsApp.post('/', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); },
  authMiddleware, byUser('RL_API'), async (c) => {
    const deed = check(await readJson(c));
    if (!deed) return bad(c, 'invalid_deed', 'Thông tin việc thiện không hợp lệ.');
    const db = c.env.DB, userId = c.get('user').id, now = Date.now();
    const { id, punna, paramiJson, scope, shared } = deed;
    const profile = await db.prepare('SELECT tz FROM profile WHERE user_id = ?').bind(userId).first();
    if (!profile) return bad(c, 'profile_not_found', 'Hồ sơ không tồn tại.', 404);
    const date = getLocalDate(now, profile.tz);
    const created = await db.prepare(`INSERT INTO deed_log
      (id, user_id, local_date, punna, parami_json, scope, shared, at)
      SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
      WHERE (SELECT COUNT(*) FROM deed_log WHERE user_id = ?2 AND local_date = ?3) < ?9
      ON CONFLICT(id) DO NOTHING RETURNING ${columns}`)
      .bind(id, userId, date, punna, paramiJson, scope, shared, now, CAP).first();
    if (created) return c.json({ deed: deedView(created) }, 201);
    const previous = await db.prepare(`SELECT ${columns} FROM deed_log WHERE id = ? AND user_id = ?`).bind(id, userId).first();
    if (previous) {
      if (previous.punna === punna && previous.parami_json === paramiJson && previous.scope === scope && previous.shared === shared) {
        return c.json({ deed: deedView(previous) });
      }
      return bad(c, 'deed_id_conflict', 'Mã thao tác đã dùng cho việc thiện khác.', 409);
    }
    const used = await db.prepare('SELECT COUNT(*) AS n FROM deed_log WHERE user_id = ? AND local_date = ?').bind(userId, date).first();
    return used.n >= CAP ? bad(c, 'deed_daily_limit', 'Mỗi ngày ghi tối đa 5 việc thiện.', 429)
      : bad(c, 'deed_id_conflict', 'Hãy tạo mã thao tác mới.', 409);
  });

export default deedsApp;

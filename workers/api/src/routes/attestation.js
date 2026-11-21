import { Hono } from 'hono';
import { VARIANT_PROGRAM } from '@vandao/shared/variant.js';
import { getAuth } from '../auth/index.js';
import { authMiddleware } from '../auth/session.js';
import { byIp, byUser } from '../guard.js';
import { bad, readJson } from '../lib.js';
import { practiceDay } from '../practice-choices.js';

const attestationApp = new Hono();
export const INVITE_MS = 7 * 86_400_000;
const encoder = new TextEncoder();
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const labelOk = (label) => [null, 'nguoi_than', 'dong_tu', 'ban_be'].includes(label);
const noteOk = (text) => [...text].length <= 300 && ![...text].some((ch) => ch < ' ' && !'\t\n\r'.includes(ch));
const currentCycle = `EXISTS (SELECT 1 FROM journey
  WHERE journey.user_id = attestation.user_id AND journey.cycle = attestation.cycle
    AND journey.program = '${VARIANT_PROGRAM}' AND journey.is_current = 1)`;

const encodeToken = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const digest = async (token) => encodeToken(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
async function inviteToken(secret, uid, cycle, week, opId) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const message = JSON.stringify(['vandao-attestation-v1', uid, cycle, week, opId.toLowerCase()]);
  return encodeToken(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

attestationApp.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  c.header('Referrer-Policy', 'no-referrer');
  await next();
});

attestationApp.get('/', authMiddleware, byUser('RL_API'), async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT j.cycle, a.week, a.status, a.created_at,
    a.attester_label, a.note, a.confirmed_at
    FROM journey j LEFT JOIN attestation a ON a.user_id = j.user_id AND a.cycle = j.cycle
    WHERE j.user_id = ? AND j.program = ? AND j.is_current = 1
    ORDER BY a.week`).bind(c.get('user').id, VARIANT_PROGRAM).all();
  if (!results.length) return bad(c, 'journey_not_found', 'Chưa có hành trình.', 404);
  const now = Date.now();
  const weeks = results.filter((row) => row.week !== null).map((row) => {
    const expiresAt = row.created_at + INVITE_MS;
    return {
      week: row.week,
      status: row.status === 'cho' && expiresAt <= now ? 'het_han' : row.status,
      expires_at: expiresAt,
      attester_label: row.attester_label,
      note: row.note,
      confirmed_at: row.confirmed_at,
    };
  });
  return c.json({ cycle: results[0].cycle, weeks });
});

attestationApp.post('/invite', authMiddleware, byUser('RL_API'), async (c) => {
  const input = await readJson(c);
  const { week, op_id } = input ?? {};
  if (!input || Object.keys(input).length !== 2 || !Number.isInteger(week) || week < 1 || week > 7 ||
      typeof op_id !== 'string' || !UUID4.test(op_id)) return bad(c, 'invalid_attestation', 'Lời mời không hợp lệ.');
  const db = c.env.DB, userId = c.get('user').id, now = Date.now();
  const { journey } = await practiceDay(db, userId, now);
  if (journey?.program !== VARIANT_PROGRAM) return bad(c, 'journey_not_found', 'Chưa có hành trình.', 404);
  const secret = c.env.BETTER_AUTH_SECRET;
  if (!secret) return bad(c, 'attest_unavailable', 'Chứng thực chưa sẵn sàng.', 503);
  const token = await inviteToken(secret, userId, journey.cycle, week, op_id);
  const hash = await digest(token);
  const existing = () => db.prepare(`SELECT token_hash, status, created_at FROM attestation
    WHERE user_id = ? AND cycle = ? AND week = ?`).bind(userId, journey.cycle, week).first();
  let row = await existing();
  if (!row && journey.day !== week * 7) return bad(c, 'attest_week_not_due', 'Chỉ mời vào ngày cuối tuần hành trình.', 409);
  const created = !row && await db.prepare(`INSERT INTO attestation (id, user_id, cycle, week, token_hash, created_at)
    SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE EXISTS (
      SELECT 1 FROM journey WHERE user_id = ?2 AND cycle = ?3 AND program = '${VARIANT_PROGRAM}' AND is_current = 1 AND day = ?4 * 7
    ) AND NOT EXISTS (SELECT 1 FROM attestation WHERE user_id = ?2 AND cycle = ?3 AND week = ?4)
    RETURNING token_hash, status, created_at`).bind(crypto.randomUUID(), userId, journey.cycle, week, hash, now).first();
  row = row || created || await existing();
  if (!row || row.token_hash !== hash || row.status !== 'cho' || row.created_at + INVITE_MS <= now) {
    return bad(c, 'attest_already_invited', 'Tuần này đã có lời mời chứng thực.', 409);
  }
  return c.json({ week, expires_at: row.created_at + INVITE_MS, link: `/#attest=${token}` }, created ? 201 : 200);
});

const tokenHeader = (c) => /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(c.req.header('Authorization') ?? '')?.[1];
const notFound = (c) => bad(c, 'attest_not_found', 'Liên kết chứng thực không còn hiệu lực.', 404);

attestationApp.get('/link', byIp('RL_POLL'), async (c) => {
  const token = tokenHeader(c);
  if (!token) return notFound(c);
  const row = await c.env.DB.prepare(`SELECT week, created_at FROM attestation
    WHERE token_hash = ? AND status = 'cho' AND created_at > ? AND ${currentCycle}`)
    .bind(await digest(token), Date.now() - INVITE_MS).first();
  return row ? c.json({ week: row.week, expires_at: row.created_at + INVITE_MS }) : notFound(c);
});

attestationApp.post('/link', byIp('RL_POLL'), async (c) => {
  const token = tokenHeader(c);
  if (!token) return notFound(c);
  const input = await readJson(c);
  const { accept, attester_label = null, note = null } = input ?? {};
  const text = typeof note === 'string' ? note.normalize('NFC').trim() : null;
  if (!input || Object.keys(input).some((key) => !['accept', 'attester_label', 'note'].includes(key)) ||
      typeof accept !== 'boolean' || !labelOk(attester_label) || (note !== null && text === null) ||
      (text && (!noteOk(text) || !accept))) {
    return bad(c, 'invalid_attestation', 'Nội dung chứng thực không hợp lệ.');
  }
  const cookie = c.req.header('Cookie');
  const session = cookie ? await getAuth(c)?.api.getSession({ headers: new Headers({ cookie }) }) : null;
  const witness = session?.user?.id ?? null, now = Date.now();
  const state = accept ? 'da_xac_nhan' : 'tu_choi';
  const row = await c.env.DB.prepare(`UPDATE attestation SET status = ?1, attester_id = ?2, attester_label = ?3,
    note = ?4, confirmed_at = ?5, token_hash = NULL
    WHERE token_hash = ?6 AND status = 'cho' AND created_at > ?7 AND ${currentCycle}
      AND (?2 IS NULL OR user_id <> ?2) RETURNING status`)
    .bind(state, witness, attester_label, text || null, now, await digest(token), now - INVITE_MS).first();
  return row ? c.json({ status: row.status }) : notFound(c);
});

export default attestationApp;

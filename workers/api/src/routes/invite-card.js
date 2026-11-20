// #160: metadata thẻ mời, đọc từ D1 của chính môi trường đang phục vụ.
import { Hono } from 'hono';
import { normInviteCode } from '@vandao/shared/dong-tu.js';
import { byIp } from '../guard.js';
import { INVITE_IMAGE_KEY } from './media.js';

const inviteCard = new Hono();
const title = 'Mời bạn tu cùng trên Vân Đạo';
const description = 'Không gian tu tập 49 ngày: thiền 15 phút, nghe giảng, cùng bạn đồng tu.';
const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeAttr = (str) => str.replace(/[&<>"']/g, (char) => entities[char]);
const privacy = {
  'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex',
  // Service worker cũ chép mọi trang điều hướng vào cache '/'. Cache.put từ chối Vary: *.
  Vary: '*',
};

function inviteCode(path) {
  try { return normInviteCode(decodeURIComponent(path.slice('/moi/'.length))); }
  catch { return null; }
}

async function publicInvite(db, code, includeDay) {
  if (!db || !code) return null;
  try {
    // CASE bảo đảm chỉ đọc ngày ra khỏi D1 khi cả yêu cầu và quyền hiện tại cho phép.
    return await db.prepare(`SELECT p.tinh_danh, p.tag,
      CASE WHEN ?3 = 1 AND json_valid(p.settings_json) THEN
        CASE WHEN json_type(p.settings_json, '$.dong_tu.chia_se_tien_trinh') = 'true' THEN j.day END
      END AS day
      FROM invite i JOIN profile p ON p.user_id = i.owner_id
      LEFT JOIN journey j ON j.user_id = p.user_id AND j.is_current = 1 AND j.program = 'so-nhap-49'
      WHERE i.code = ?1 AND i.expires_at > ?2 AND i.uses_left > 0 AND p.visibility <> 'an'
        AND trim(p.tinh_danh) <> '' AND p.tag GLOB '[0-9][0-9][0-9][0-9]'`)
      .bind(code, Date.now(), Number(includeDay)).first();
  } catch {
    console.error('[Thẻ mời] D1');
    return null;
  }
}

inviteCard.use('*', async (c, next) => {
  await next();
  for (const [name, value] of Object.entries(privacy)) c.header(name, value);
});

inviteCard.get('*', byIp('RL_POLL'), async (c) => {
  const url = new URL(c.req.url);
  const asset = await c.env.ASSETS?.fetch(new Request(new URL('/', url)));
  if (!asset?.ok || !asset.headers.get('Content-Type')?.includes('text/html')) return c.text('Vân Đạo đang tạm bận.', 503);

  const code = inviteCode(url.pathname);
  const dayParams = url.searchParams.getAll('d');
  const includeDay = dayParams.length === 1 && dayParams[0] === '1';
  const owner = await publicInvite(c.env.DB, code, includeDay);
  const meta = {
    'og:title': owner ? `${owner.tinh_danh} · ${owner.tag} mời bạn tu cùng trên Vân Đạo` : title,
    'og:description': owner?.day ? `${description} Ngày ${owner.day} của hành trình Sơ nhập.` : description,
    'og:url': owner ? new URL(`/moi/${code}${includeDay ? '?d=1' : ''}`, url).href : new URL('/', url).href,
    'og:image': new URL(`/media/${INVITE_IMAGE_KEY}`, url).href,
  };
  const tags = Object.entries(meta).map(([property, value]) => `<meta property="${property}" content="${escapeAttr(value)}">`);
  const rewriter = new globalThis.HTMLRewriter().on('head', {
    element(element) { element.prepend(`<meta name="robots" content="noindex">${tags.join('')}`, { html: true }); },
  });
  for (const property of Object.keys(meta)) rewriter.on(`meta[property="${property}"]`, { element(element) { element.remove(); } });
  rewriter.on('meta[name="robots"]', { element(element) { element.remove(); } });
  const headers = new Headers(asset.headers);
  for (const name of ['ETag', 'Last-Modified', 'Content-Length', 'Expires', 'CDN-Cache-Control', 'Cloudflare-CDN-Cache-Control']) headers.delete(name);
  return rewriter.transform(new Response(asset.body, { headers }));
});

inviteCard.all('*', c => c.body(null, 405, { Allow: 'GET, HEAD' }));
inviteCard.onError((_error, c) => {
  console.error('[Thẻ mời] Worker');
  return c.text('Vân Đạo đang tạm bận.', 503, privacy);
});
export default inviteCard;

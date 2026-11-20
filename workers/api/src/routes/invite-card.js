// #160: metadata thẻ mời, đọc từ D1 của chính môi trường đang phục vụ.
import { Hono } from 'hono';
import { normInviteCode } from '@vandao/shared/dong-tu.js';
import { clientIp } from '../guard.js';
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

async function mayReadInvite(c) {
  const limiter = c.env.RL_POLL;
  if (typeof limiter?.limit !== 'function') return true;
  try {
    return (await limiter.limit({ key: `RL_POLL:${clientIp(c)}` })).success;
  } catch {
    console.error('[Thẻ mời] rate limit');
    return false;
  }
}

async function publicInvite(db, code, includeDay) {
  if (!db || !code) return null;
  try {
    // Chỉ trả tiến trình từ D1 khi cả yêu cầu và quyền hiện tại cho phép.
    return await db.prepare(`SELECT p.tinh_danh, p.tag,
      CASE WHEN ?3 = 1 AND j.day IS NOT NULL AND json_valid(p.settings_json) THEN
        CASE WHEN json_type(p.settings_json, '$.dong_tu.chia_se_tien_trinh') = 'true'
          THEN json_object('day', j.day, 'completed', j.completed_at IS NOT NULL) END
      END AS progress
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

inviteCard.get('*', async (c) => {
  const url = new URL(c.req.url);
  const asset = await c.env.ASSETS?.fetch(new Request(new URL('/', url)));
  if (!asset?.ok || !asset.headers.get('Content-Type')?.includes('text/html')) return c.text('Vân Đạo đang tạm bận.', 503);

  const code = inviteCode(url.pathname);
  const dayParams = url.searchParams.getAll('d');
  const includeDay = dayParams.length === 1 && dayParams[0] === '1';
  // Trình cào nhận thẻ chung nếu vượt giới hạn. Không truy vấn D1 cho lượt đã bị giới hạn.
  const owner = code && await mayReadInvite(c) ? await publicInvite(c.env.DB, code, includeDay) : null;
  let summary = description;
  if (owner?.progress) {
    const progress = JSON.parse(owner.progress);
    summary += progress.completed ? ' Đã hoàn thành chương trình Sơ nhập.' : ` Ngày ${progress.day} của hành trình Sơ nhập.`;
  }
  const meta = {
    'og:type': 'website',
    'og:site_name': 'Vân Đạo',
    'og:title': owner ? `${owner.tinh_danh} · ${owner.tag} mời bạn tu cùng trên Vân Đạo` : title,
    'og:description': summary,
    'og:url': owner ? new URL(`/moi/${code}${includeDay ? '?d=1' : ''}`, url).href : new URL('/', url).href,
    'og:image': new URL(`/media/${INVITE_IMAGE_KEY}`, url).href,
    'og:image:width': '1200',
    'og:image:height': '630',
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

const HOSTS = new Set(['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'push.services.mozilla.com']);

export function pushEndpoint(raw) {
  if (typeof raw !== 'string' || raw.length > 2048 || raw.trim() !== raw) return null;
  try {
    const url = new URL(raw);
    const hostAllowed = HOSTS.has(url.hostname) || url.hostname.endsWith('.push.apple.com');
    if (!hostAllowed || url.protocol !== 'https:' || url.port || url.username || url.password ||
        url.hash || url.pathname === '/' || url.href.length > 2048) return null;
    return url.href;
  } catch {
    return null;
  }
}

const put = (bytes) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
function webPushBytes(value, length) {
  if (typeof value !== 'string' || value.length > 88 || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return null;
  const raw = value.replace(/=+$/, '');
  try {
    const bytes = Uint8Array.from(atob(raw.replaceAll('-', '+').replaceAll('_', '/')), (ch) => ch.charCodeAt(0));
    return bytes.length === length && put(bytes) === raw ? bytes : null;
  } catch { return null; }
}

export async function parsePushSubscription(body, now) {
  if (!body || Object.keys(body).some((k) => !['endpoint', 'keys', 'expirationTime'].includes(k))) return null;
  const endpoint = pushEndpoint(body.endpoint);
  const { keys, expirationTime } = body;
  if (!endpoint || !keys || typeof keys !== 'object' || Object.keys(keys).length !== 2 ||
      (expirationTime != null && (!Number.isSafeInteger(expirationTime) || expirationTime <= now))) return null;
  const key = webPushBytes(keys.p256dh, 65), auth = webPushBytes(keys.auth, 16);
  if (!key || key[0] !== 4 || !auth) return null;
  try {
    await crypto.subtle.importKey('raw', key, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  } catch { return null; }
  return { endpoint, p256dh: put(key), auth: put(auth) };
}

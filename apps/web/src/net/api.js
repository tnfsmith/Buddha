// apps/web/src/net/api.js
// Client gọi máy chủ Vân Đạo (PROJECT_ROADMAP.md §5, §6). Phiên là cookie HttpOnly `vd.session_token` cùng nguồn gốc
// (Better Auth), nên JavaScript không giữ token; mọi lệnh gọi dùng đường dẫn tương đối.

export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

/** Gọi API JSON. Lỗi của API Vân Đạo ({error:{code,message}}) và của Better Auth ({code,message}) đều thành ApiError. */
export async function api(path, { method = 'GET', body, turnstile } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (turnstile) headers['cf-turnstile-response'] = turnstile;
  let res;
  try { res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' }); } catch { throw new ApiError(0, 'offline', 'Không kết nối được máy chủ'); }
  let data = null; try { data = await res.json(); } catch { /* thân rỗng */ }
  if (!res.ok) { const e = (data && data.error) || data || {}; throw new ApiError(res.status, String(e.code || 'http_' + res.status).toLowerCase(), e.message || `Lỗi ${res.status}`); }
  return data;
}
const post = (path, body = {}, turnstile) => api(path, { method: 'POST', body, turnstile });

// ───────── Phiên ─────────
export const getSession = () => api('/api/auth/get-session');
export const signInAnonymous = () => post('/api/auth/sign-in/anonymous');
export const signOut = () => post('/api/auth/sign-out');
export const listSessions = () => api('/api/auth/list-sessions');
export const revokeOtherSessions = () => post('/api/auth/revoke-other-sessions');

// ───────── Mã khôi phục, liên kết thiết bị (§6.4) ─────────
export const recoveryStatus = () => api('/api/auth/recovery-code/status');
export const generateRecoveryCode = () => post('/api/auth/recovery-code/generate');
export const signInRecoveryCode = (code, turnstile) => post('/api/auth/sign-in/recovery-code', { code }, turnstile);
export const linkStart = (turnstile) => post('/api/auth/device-link/start', {}, turnstile);
export const linkPoll = (code, secret) => post('/api/auth/sign-in/device-link', { code, secret });
export const linkInfo = (code) => api('/api/auth/device-link/info?code=' + encodeURIComponent(code));
export const linkApprove = (code) => post('/api/auth/device-link/approve', { code });

// ───────── Passkey (WebAuthn) ─────────
const b64d = (s) => Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const b64e = (buf) => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const ids = (list) => (list || []).map((c) => ({ ...c, id: b64d(c.id) }));
export const passkeySupported = () => typeof window !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;
const credJSON = (c, fields) => ({
  id: c.id, rawId: b64e(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment || undefined,
  clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {},
  response: Object.fromEntries(fields.map(([k, v]) => [k, v])),
});
/** Gắn passkey (vân tay/Face ID/PIN máy) vào tài khoản đang đăng nhập */
export async function passkeyRegister(name) {
  const o = await api('/api/auth/passkey/generate-register-options');
  const cred = await navigator.credentials.create({ publicKey: { ...o, challenge: b64d(o.challenge), user: { ...o.user, id: b64d(o.user.id) }, excludeCredentials: ids(o.excludeCredentials) } });
  const r = cred.response;
  return post('/api/auth/passkey/verify-registration', { name, response: credJSON(cred, [['clientDataJSON', b64e(r.clientDataJSON)], ['attestationObject', b64e(r.attestationObject)], ['transports', r.getTransports ? r.getTransports() : []]]) });
}
/** Đăng nhập bằng passkey đã gắn */
export async function passkeySignIn() {
  const o = await api('/api/auth/passkey/generate-authenticate-options');
  const cred = await navigator.credentials.get({ publicKey: { ...o, challenge: b64d(o.challenge), allowCredentials: ids(o.allowCredentials) } });
  const r = cred.response;
  return post('/api/auth/passkey/verify-authentication', { response: credJSON(cred, [['clientDataJSON', b64e(r.clientDataJSON)], ['authenticatorData', b64e(r.authenticatorData)], ['signature', b64e(r.signature)], ['userHandle', r.userHandle ? b64e(r.userHandle) : undefined]]) });
}
export const listPasskeys = () => api('/api/auth/passkey/list-user-passkeys');

// ───────── Dữ liệu tu tập ─────────
export const getMe = (entries = false) => api('/api/v1/me' + (entries ? '?entries=1' : ''));
export const updateProfile = (fields) => api('/api/v1/profile', { method: 'PATCH', body: fields });
export const postSync = (payload) => post('/api/v1/sync', payload);
export const exportData = () => api('/api/v1/export');
export const requestDelete = () => post('/api/v1/account/delete');
export const cancelDelete = () => api('/api/v1/account/delete', { method: 'DELETE' });
export const getRtTicket = (room) => post('/api/v1/rt/ticket', { room });

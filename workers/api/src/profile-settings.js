import { jsonCapped } from './lib.js';

const DONG_TU_KEYS = ['hien_trang_thai', 'cho_tim', 'hien_ngay', 'chia_se_tien_trinh'];
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function mergeProfileSettings(saved, patch) {
  if (patch === undefined) return { json: saved };
  if (!record(patch)) return { error: 'invalid_settings' };
  const previous = JSON.parse(saved || '{}');
  const settings = { ...previous, ...patch };
  if (Object.hasOwn(patch, 'dong_tu')) {
    const social = patch.dong_tu;
    if (!record(social) || Object.entries(social).some(([key, value]) => !DONG_TU_KEYS.includes(key) || typeof value !== 'boolean')) {
      return { error: 'invalid_payload' };
    }
    settings.dong_tu = { ...(record(previous?.dong_tu) ? previous.dong_tu : {}), ...social };
  }
  const json = jsonCapped(settings);
  return json === null ? { error: 'invalid_settings' } : { json };
}

export function profileSettingsView(saved, visibility) {
  const settings = JSON.parse(saved || '{}');
  if (visibility === 'an' && settings?.dong_tu?.chia_se_tien_trinh === true) {
    settings.dong_tu.chia_se_tien_trinh = false;
  }
  return settings;
}

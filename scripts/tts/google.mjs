// Cloud Text-to-Speech v1; không ghi khóa, JWT hay phản hồi xác thực vào log.
import { readFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';

let access;
export async function googleHeaders() {
  // ADC ưu tiên: người vận hành có thể giữ API key web trong cùng file nhưng dùng SA cho máy chủ.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    if (!access || access.until < Date.now()) {
      if (!existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) throw new Error('GOOGLE_APPLICATION_CREDENTIALS phải là đường dẫn tới tệp JSON Service Account/ADC có thật');
      const credential = JSON.parse(readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
      let body;
      if (credential.type === 'service_account') {
        const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
        const now = Math.floor(Date.now() / 1000);
        const jwt = encode({ alg: 'RS256', typ: 'JWT' }) + '.' + encode({ iss: credential.client_email,
          scope: 'https://www.googleapis.com/auth/cloud-platform', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
        const signature = createSign('RSA-SHA256').update(jwt).end().sign(credential.private_key).toString('base64url');
        body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt + '.' + signature });
      } else if (credential.type === 'authorized_user') {
        body = new URLSearchParams({ grant_type: 'refresh_token', client_id: credential.client_id, client_secret: credential.client_secret, refresh_token: credential.refresh_token });
      } else throw new Error('Loại ADC chưa được hỗ trợ; dùng Service Account, gcloud ADC hoặc API key máy chủ');
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body, signal: AbortSignal.timeout(30000) });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error(`Google OAuth HTTP ${response.status}`);
      access = { token: data.access_token, until: Date.now() + (Number(data.expires_in || 3600) - 90) * 1000 };
    }
    return { Authorization: 'Bearer ' + access.token, ...(process.env.GOOGLE_CLOUD_PROJECT ? { 'x-goog-user-project': process.env.GOOGLE_CLOUD_PROJECT } : {}) };
  }
  const key = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('Thiếu cấu hình Google TTS API key hoặc ADC');
  return { 'x-goog-api-key': key };
}

export async function googleRequest(path, payload) {
  const response = await fetch('https://texttospeech.googleapis.com/v1/' + path, {
    method: payload ? 'POST' : 'GET', headers: { ...await googleHeaders(), 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.timeout(90000),
  });
  const data = await response.json();
  if (!response.ok) {
    const reason = data.error?.details?.find(x => typeof x.reason === 'string')?.reason;
    throw new Error(`Google TTS HTTP ${response.status}${/^[A-Z_]+$/.test(reason || '') ? ': ' + reason : ''}`);
  }
  return data;
}

export async function maleVoices() {
  const data = await googleRequest('voices?languageCode=vi-VN');
  return (data.voices || []).filter(v => v.ssmlGender === 'MALE' && /^vi-VN-Chirp3-HD-/.test(v.name));
}

export async function synthesize(text, voice, speed = 0.9) {
  if (!/^vi-VN-Chirp3-HD-[A-Za-z]+$/.test(voice) || !text.trim()) throw new Error('Thiếu giọng Chirp3-HD vi-VN hoặc lời đọc');
  const data = await googleRequest('text:synthesize', { input: { text }, voice: { languageCode: 'vi-VN', name: voice, ssmlGender: 'MALE' },
    audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000, speakingRate: speed } });
  const wav = Buffer.from(data.audioContent || '', 'base64');
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Google không trả WAV hợp lệ');
  return wav;
}

// Chủ dự án đã cho phép gửi âm thanh bài giảng sang Google STT để đo lỗi (15/11/2026).
export async function recognize(wav) {
  const response = await fetch('https://speech.googleapis.com/v1/speech:recognize', { method: 'POST',
    headers: { ...await googleHeaders(), 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000),
    body: JSON.stringify({ config: { encoding: 'LINEAR16', sampleRateHertz: 24000, languageCode: 'vi-VN', model: 'latest_long' }, audio: { content: wav.toString('base64') } }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Google STT HTTP ${response.status}`);
  return (data.results || []).map(x => x.alternatives?.[0]?.transcript || '').join(' ');
}

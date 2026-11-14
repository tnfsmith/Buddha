import { afterEach, it, expect, vi } from 'vitest';
import { maleVoices, synthesize, recognize, googleHeaders } from '../tts/google.mjs';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('lọc đúng giọng nam vi-VN Chirp3-HD từ Google', async () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', ''); vi.stubEnv('GOOGLE_TTS_API_KEY', 'test-not-real');
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ voices: [{ name: 'vi-VN-Chirp3-HD-Charon', ssmlGender: 'MALE' }, { name: 'en-US-Chirp3-HD-Charon', ssmlGender: 'MALE' }, { name: 'vi-VN-Chirp3-HD-Kore', ssmlGender: 'FEMALE' }] })));
  vi.stubGlobal('fetch', fetch);
  expect((await maleVoices()).map(x => x.name)).toEqual(['vi-VN-Chirp3-HD-Charon']);
  expect(fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('test-not-real');
});
it('LINEAR16 24kHz, speakingRate; không gửi instructions kiểu OpenAI', async () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', ''); vi.stubEnv('GOOGLE_TTS_API_KEY', 'test-not-real');
  const wav = Buffer.from('RIFF0000WAVEtest');
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ audioContent: wav.toString('base64') })));
  vi.stubGlobal('fetch', fetch);
  expect(await synthesize('Lời thử.', 'vi-VN-Chirp3-HD-Charon')).toEqual(wav);
  const payload = JSON.parse(fetch.mock.calls[0][1].body);
  expect(payload.audioConfig).toEqual({ audioEncoding: 'LINEAR16', sampleRateHertz: 24000, speakingRate: 0.9 });
  expect(payload).not.toHaveProperty('instructions');
});
it('ADC lỗi không in giá trị cấu hình giả dạng đường dẫn', async () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', 'secret-not-a-file');
  await expect(googleHeaders()).rejects.toThrow('phải là đường dẫn');
  await expect(googleHeaders()).rejects.not.toThrow('secret-not-a-file');
});
it('STT chỉ gửi WAV bài giảng, nhận transcript; lỗi không in thông báo có thể chứa khóa', async () => {
  vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', ''); vi.stubEnv('GOOGLE_TTS_API_KEY', 'test-not-real');
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ alternatives: [{ transcript: 'Lời thử.' }] }] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'test-not-real' } }), { status: 403 }));
  vi.stubGlobal('fetch', fetch);
  expect(await recognize(Buffer.from('WAV'))).toBe('Lời thử.');
  expect(JSON.parse(fetch.mock.calls[0][1].body).config.languageCode).toBe('vi-VN');
  await expect(recognize(Buffer.from('WAV'))).rejects.toThrow('Google STT HTTP 403');
});

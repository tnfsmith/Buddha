import { it, expect } from 'vitest';
import { audioProfile, asrText, AI_DISCLOSURE } from '../tts/profile.mjs';
import { spokenLines, fingerprint, cuePoints, audioKey } from '../tts/core.mjs';
import { displayBody } from '../content-data.mjs';
import { addAiMetadata, audioPayload } from '../tts/id3.mjs';
import { validateCues, validateAudioLock } from '../tts/lock.mjs';

const config = { voice: 'vi-VN-Chirp3-HD-Sadaltager', provider: 'google', model: 'Chirp3-HD', speed: 0.85 };
const ritual = { id: 'nghi-thuc-ket-thuc', version: 1, meta: { loat: 'nghi-thuc', vai: 'ket-thuc' },
  body: '[[Sādhu! Sādhu! Sādhu!|Sa đu! [pause long] Sa đu! [pause long] Sa đu!]]\n> Lành thay!\nLời kết.' };

it('thẻ pause chỉ ở cách đọc, không lọt vào chữ hiển thị hoặc lời đối chiếu ASR', () => {
  const lines = spokenLines(ritual.body);
  expect(lines).toEqual(['Sa đu! [pause long] Sa đu! [pause long] Sa đu!', 'Lời kết.']);
  expect(asrText(lines[0])).toBe('Sa đu! Sa đu! Sa đu!');
  expect(displayBody(ritual.body)).toBe('Sādhu! Sādhu! Sādhu!\n> Lành thay!\nLời kết.');
  expect(() => spokenLines('[[Sādhu|Sa đu [pause evil]]]')).toThrow();
  expect(() => displayBody('[[Sādhu|Sa đu [[lồng]]]]')).toThrow();
});
it('khóa Lời Phật dạy không đổi; ID3 và hai tốc độ nghi thức có khóa riêng', () => {
  const plain = { meta: { loat: 'loi-phat-day' } }, lines = ['Lời thử.'];
  expect(fingerprint(lines, audioProfile(plain, config))).toBe(fingerprint(lines, config));
  expect(fingerprint(lines, audioProfile({ meta: { loat: 'duong-xua' } }, config))).not.toBe(fingerprint(lines, config));
  const a = audioProfile(ritual, config), b = audioProfile({ ...ritual, meta: { ...ritual.meta, audio: { speed: 0.8 } } }, config);
  expect(a).toMatchObject({ speed: 0.85, gap: 1.2, lastGap: 1.2, aiId3: true, markup: true });
  expect(fingerprint(lines, a)).not.toBe(fingerprint(lines, b));
  expect(() => audioProfile({ meta: { loat: 'nghi-thuc', vai: 'sai' } }, config)).toThrow();
  expect(() => audioProfile({ ...ritual, meta: { ...ritual.meta, audio: { speed: 0.9 } } }, config)).toThrow();
});
it('cues nghi thức giữ đúng 1,2 giây, không nới quy tắc bài giảng cũ', () => {
  const cues = { v: 1, id: ritual.id, version: 1, dur: 5.2, cues: cuePoints([2, 2], { gap: 1.2, lastGap: 1.2 }) };
  expect(validateCues(ritual, cues)).toBe(2);
  expect(() => validateCues({ ...ritual, meta: { loat: 'loi-phat-day' } }, cues)).toThrow();
  expect(() => cuePoints([2], { gap: -1 })).toThrow();
});
it('gắn ID3 UTF-8 idempotent và giữ nguyên toàn bộ payload MPEG/gapless', () => {
  const payload = Buffer.concat([Buffer.from([255, 251, 144, 192]), Buffer.from('LAME/audio-payload-test')]);
  const tagged = addAiMetadata(payload);
  expect(tagged.subarray(0, 4)).toEqual(Buffer.from([73, 68, 51, 4]));
  expect(tagged.includes(Buffer.from(AI_DISCLOSURE))).toBe(true);
  expect(tagged.includes(Buffer.from('AI_GENERATED\0'))).toBe(true);
  expect(audioPayload(tagged).equals(payload)).toBe(true);
  expect(addAiMetadata(tagged).equals(tagged)).toBe(true);
  expect(() => addAiMetadata(Buffer.from('RIFF-not-mp3'))).toThrow();
  expect(() => audioPayload(Buffer.from([73, 68, 51, 4, 0, 0, 127, 127, 127, 127]))).toThrow();
});
it('sổ ràng buộc tốc độ và nguồn AI của nghi thức với khóa được chọn', () => {
  const p = audioProfile(ritual, config), hash = fingerprint(spokenLines(ritual.body), p), key = audioKey(ritual, hash, p.voice);
  const row = { ...config, id: ritual.id, version: 1, key, hash: hash.slice(0, 8), fingerprint: hash,
    dur: 5, wer: 0, sha256: 'a'.repeat(64), generated_at: '2026-11-15T00:00:00Z', ai_disclosure: AI_DISCLOSURE };
  expect(validateAudioLock([{ ...ritual, body_r2_key: key }], { v: 1, items: [row] }, config)).toBe(1);
  expect(() => validateAudioLock([{ ...ritual, body_r2_key: key }], { v: 1, items: [{ ...row, speed: 0.8 }] }, config)).toThrow();
});

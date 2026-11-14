import { it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { parseContent } from '../content-data.mjs';
import { fingerprint, audioKey } from '../tts/core.mjs';
import { validateAudioLock, validateCues } from '../tts/lock.mjs';

const config = { provider: 'google', voice: 'vi-VN-Chirp3-HD-Sadaltager', model: 'Chirp3-HD', speed: 0.85 };
const article = { id: 'bai-thu', version: 2, body: 'Một ý.\n> Pāli\nÝ cuối.' }, hash = fingerprint(['Một ý.', 'Ý cuối.'], config);
const key = audioKey(article, hash, config.voice);
const row = { id: article.id, version: 2, key, hash: hash.slice(0, 8), dur: 5, ...config, generated_at: '2026-11-15T00:00:00Z', wer: 0.01, sha256: 'a'.repeat(64) };
it('chặn lời sửa nhưng giữ khóa cũ, thiếu dòng, trộn giọng và trùng dòng', () => {
  const a = { ...article, body_r2_key: key }, lock = { v: 1, items: [row] };
  expect(validateAudioLock([a], lock, config)).toBe(1);
  expect(() => validateAudioLock([{ ...a, body: 'Đã sửa.' }], lock, config)).toThrow('không khớp');
  expect(() => validateAudioLock([a], { v: 1, items: [] }, config)).toThrow();
  expect(() => validateAudioLock([a], { v: 1, items: [{ ...row, voice: 'khác' }] }, config)).toThrow('trộn giọng');
  expect(() => validateAudioLock([a], { v: 1, items: [row, row] }, config)).toThrow('Trùng');
});
it('cues bỏ Pāli, đủ ý và đúng khoảng nghỉ cuối, phát hiện cắt đuôi', () => {
  const cues = { v: 1, id: article.id, version: 2, dur: 5, cues: [{ i: 0, t: 0, e: 1 }, { i: 1, t: 2.5, e: 5 }] };
  expect(validateCues(article, cues)).toBe(2);
  expect(() => validateCues(article, { ...cues, dur: 4 })).toThrow();
  expect(() => validateCues(article, { ...cues, cues: cues.cues.slice(1) })).toThrow();
});
it('kiểm sổ thật trong repo: bài có khóa phải có dòng và băm khớp', () => {
  const dir = new URL('../../content/bai-giang/', import.meta.url);
  const articles = readdirSync(dir).filter(x => x.endsWith('.md') && x.toLowerCase() !== 'readme.md').map(x => parseContent(readFileSync(new URL(x, dir), 'utf8')));
  const file = new URL('_audio.lock.json', dir);
  const lock = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { v: 1, items: [] };
  const dict = new URL('../../content/tu-dien-doc.yml', import.meta.url);
  const dictionary = existsSync(dict) ? parseDocument(readFileSync(dict, 'utf8')).toJS() : {};
  const selected = JSON.parse(readFileSync(new URL('../tts/giong.json', import.meta.url), 'utf8'));
  expect(validateAudioLock(articles, lock, selected, dictionary)).toBe(articles.filter(x => x.body_r2_key).length);
});

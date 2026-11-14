import { it, expect } from 'vitest';
import { spokenLines, fingerprint, audioKey, cuePoints, gradeClip, wordErrorRate } from '../tts/core.mjs';

it('bỏ Pāli, đọc cách đọc và áp từ điển có biên tiếng Việt', () => {
  expect(spokenLines('Ý [[129|một trăm hai mươi chín]].\n> Pāli\nTất Đạt Đa nói về tâm.', { 'Tất Đạt Đa': 'Tất Đạt Đa', 'tâm': 'tâm an' })).toEqual(['Ý một trăm hai mươi chín.', 'Tất Đạt Đa nói về tâm an.']);
  expect(() => spokenLines('[[chưa đóng')).toThrow();
});
it('băm ổn định, đổi lời đọc/giọng/mô hình/tốc độ thì đổi băm', () => {
  const config = { provider: 'google', voice: 'vi-VN-Chirp3-HD-Charon', model: 'Chirp3-HD', speed: 0.9 };
  const hash = fingerprint(['Lời thử.'], config);
  expect(fingerprint(['Lời thử.'], config)).toBe(hash);
  for (const [key, value] of [['voice', 'vi-VN-Chirp3-HD-Orus'], ['model', 'khác'], ['speed', 1], ['instructions', 'khác']]) expect(fingerprint(['Lời thử.'], { ...config, [key]: value })).not.toBe(hash);
  expect(fingerprint(['Lời đã sửa.'], config)).not.toBe(hash);
});
it('khóa riêng theo loạt, version, hash và giọng; chặn đường dẫn lạ', () => {
  expect(audioKey({ id: 'con-thien-nga', version: 2, meta: { loat: 'duong-xua' } }, '12345678abcdef00', 'vi-VN-Chirp3-HD-Charon')).toBe('bai-giang/duong-xua/con-thien-nga/v2-12345678/vi-charon.mp3');
  expect(() => audioKey({ id: '../x', version: 2 }, '12345678', 'Charon')).toThrow();
});
it('cues đủ số ý; khoảng lặng 0,9 và 1,5 giây trước ý cuối', () => {
  expect(cuePoints([2, 3, 4])).toEqual([{ i: 0, t: 0, e: 2 }, { i: 1, t: 2.9, e: 5.9 }, { i: 2, t: 7.4, e: 11.4 }]);
  expect(() => cuePoints([0])).toThrow();
});
it('WER theo tiếng giữ dấu Việt, bỏ dấu câu/hoa thường, phát hiện mất đuôi', () => {
  expect(wordErrorRate('Tâm từ, nhẹ nhàng.', 'tâm từ nhẹ nhàng')).toBe(0);
  expect(wordErrorRate('Tâm từ nhẹ nhàng', 'tâm nhẹ nhàng')).toBe(0.25);
  expect(gradeClip('Tâm từ nhẹ nhàng', 'Tâm từ nhẹ nhàng', 2)).toMatchObject({ wer: 0, tailOk: true, pass: true });
  expect(gradeClip('Tâm từ nhẹ nhàng', 'Tâm từ', 2).pass).toBe(false);
});

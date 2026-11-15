// ID3v2.4 UTF-8 (COMM + TXXX), không đụng khung MPEG/LAME hay mã hóa lại âm thanh.
import { AI_DISCLOSURE } from './profile.mjs';

function syncSafe(n) {
  if (!Number.isSafeInteger(n) || n < 0 || n > 0x0fffffff) throw new Error('Kích thước ID3 không hợp lệ');
  return Buffer.from([(n >>> 21) & 127, (n >>> 14) & 127, (n >>> 7) & 127, n & 127]);
}

export function audioPayload(mp3) {
  let offset = 0;
  while (mp3.toString('ascii', offset, offset + 3) === 'ID3') {
    if (offset + 10 > mp3.length || ![3, 4].includes(mp3[offset + 3])) throw new Error('ID3 không được hỗ trợ');
    const size = [...mp3.subarray(offset + 6, offset + 10)];
    if (size.some(x => x > 127)) throw new Error('Kích thước ID3 lỗi');
    const length = size.reduce((n, x) => n * 128 + x, 0);
    offset += 10 + length + (mp3[offset + 3] === 4 && (mp3[offset + 5] & 16) ? 10 : 0);
    if (offset >= mp3.length) throw new Error('ID3 vượt phần âm thanh');
  }
  if (mp3[offset] !== 255 || (mp3[offset + 1] & 224) !== 224) throw new Error('Không có khung MP3 sau ID3');
  return mp3.subarray(offset);
}

export function addAiMetadata(mp3) {
  const payload = audioPayload(mp3), text = Buffer.from(AI_DISCLOSURE, 'utf8');
  const frame = (name, body) => Buffer.concat([Buffer.from(name), syncSafe(body.length), Buffer.alloc(2), body]);
  const frames = Buffer.concat([
    frame('COMM', Buffer.concat([Buffer.from([3]), Buffer.from('vie'), Buffer.from([0]), text])),
    frame('TXXX', Buffer.concat([Buffer.from([3]), Buffer.from('AI_GENERATED\0'), text])),
  ]);
  return Buffer.concat([Buffer.from([73, 68, 51, 4, 0, 0]), syncSafe(frames.length), frames, payload]);
}

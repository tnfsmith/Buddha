import { createHash } from 'node:crypto';

const readingMarkup = /\[\[([^|[\]\n]+)\|([^|[\]\n]+)\]\]/g;
export function spokenLines(body, dictionary = {}) {
  const pairs = Object.entries(dictionary).sort((a, b) => b[0].length - a[0].length);
  return body.replace(/\r\n/g, '\n').split('\n').map(x => x.trim()).filter(x => x && !x.startsWith('>')).map(line => {
    let text = line.replace(readingMarkup, '$2');
    if (/\[\[|\]\]/.test(text)) throw new Error('Cú pháp cách đọc chưa hợp lệ');
    for (const [from, to] of pairs) {
      if (!from || typeof to !== 'string' || !to.trim()) throw new Error('Từ điển đọc không hợp lệ');
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      text = text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu'), () => to);
    }
    return text.normalize('NFC');
  });
}

export function fingerprint(lines, config) {
  return createHash('sha256').update(JSON.stringify({ lines, provider: config.provider, voice: config.voice, model: config.model,
    instructions: config.instructions || '', speed: config.speed, format: 'mono24k-96k-lufs16-tp1.5-gap0.9-last1.5-verified-v2' })).digest('hex');
}

export function audioKey(article, hash, voice) {
  const series = article.meta?.loat || 'loi-phat-day', slug = voice.replace(/^vi-VN-Chirp3-HD-/, '').toLowerCase();
  if (![series, article.id, slug].every(x => typeof x === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(x)) || !Number.isSafeInteger(article.version) || article.version < 1 || !/^[a-f0-9]{8,64}$/.test(hash)) throw new Error('Khóa âm thanh không hợp lệ');
  return `bai-giang/${series}/${article.id}/v${article.version}-${hash.slice(0, 8)}/vi-${slug}.mp3`;
}

export function cuePoints(durations) {
  let at = 0;
  return durations.map((duration, i) => {
    if (!Number.isFinite(duration) || duration <= 0) throw new Error('Độ dài đoạn âm thanh không hợp lệ');
    if (i) at += i === durations.length - 1 ? 1.5 : 0.9;
    const cue = { i, t: Number(at.toFixed(4)), e: Number((at + duration).toFixed(4)) };
    at += duration; return cue;
  });
}

export const words = text => text.normalize('NFC').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
export function wordErrorRate(reference, hypothesis) {
  const a = words(reference), b = words(hypothesis);
  if (!a.length) throw new Error('Không có lời đọc để đối chiếu');
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length] / a.length;
}

export function gradeClip(reference, hypothesis, duration, names = []) {
  const tokens = words(reference), heard = words(hypothesis).join(' '), wer = wordErrorRate(reference, hypothesis);
  const tail = tokens.slice(-3).join(' '), secondsPerWord = duration / tokens.length;
  const namesOk = names.filter(name => words(reference).join(' ').includes(words(name).join(' '))).every(name => heard.includes(words(name).join(' ')));
  return { wer, tailOk: heard.includes(tail), namesOk, secondsPerWord,
    pass: wer <= 0.05 && heard.includes(tail) && namesOk && secondsPerWord >= 0.3 && secondsPerWord <= 0.75 };
}

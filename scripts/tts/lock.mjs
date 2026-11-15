import { spokenLines, fingerprint, audioKey } from './core.mjs';
import { audioProfile, AI_DISCLOSURE } from './profile.mjs';

export function validateAudioLock(articles, lock, config, dictionary = {}) {
  if (lock?.v !== 1 || !Array.isArray(lock.items)) throw new Error('Sổ âm thanh không hợp lệ');
  const seen = new Set();
  for (const row of lock.items) {
    const identity = `${row.id}:${row.version}`;
    if (seen.has(identity)) throw new Error(`Trùng sổ âm thanh: ${identity}`);
    seen.add(identity);
    const article = articles.find(x => x.id === row.id && x.version === row.version);
    const expected = article ? audioProfile(article, config) : config;
    if (row.voice !== expected.voice || row.model !== expected.model || row.provider !== expected.provider) throw new Error('Sổ âm thanh trộn giọng/mô hình');
    if (!Number.isFinite(row.dur) || row.dur <= 0 || !Number.isFinite(row.wer) || row.wer < 0
      || !Number.isFinite(Date.parse(row.generated_at)) || !/^[a-f0-9]{64}$/.test(row.sha256 || '')) throw new Error(`Sổ âm thanh thiếu số đo: ${identity}`);
    if (row.loudness && (!Number.isFinite(row.loudness.lufs) || Math.abs(row.loudness.lufs + 16) > 0.5
      || !Number.isFinite(row.loudness.peak_dbtp) || row.loudness.peak_dbtp > -1.5)) throw new Error(`Loudness chưa đạt: ${identity}`);
  }
  for (const article of articles.filter(x => x.body_r2_key)) {
    const row = lock.items.find(x => x.id === article.id && x.version === article.version);
    const profile = audioProfile(article, config), hash = fingerprint(spokenLines(article.body, dictionary), profile);
    if (!row || row.key !== article.body_r2_key || row.key !== audioKey(article, hash, profile.voice) || row.hash !== hash.slice(0, 8)
      || (row.fingerprint && row.fingerprint !== hash)) throw new Error(`Chữ/khóa/sổ âm thanh không khớp: ${article.id}`);
    if (profile.aiId3 && (row.ai_disclosure !== AI_DISCLOSURE || row.speed !== profile.speed)) throw new Error(`Sổ thiếu ID3/tốc độ: ${article.id}`);
  }
  return articles.filter(x => x.body_r2_key).length;
}

export function validateCues(article, cues, dictionary = {}) {
  const count = spokenLines(article.body, dictionary).length;
  if (cues?.v !== 1 || cues.id !== article.id || cues.version !== article.version || !Number.isFinite(cues.dur) || cues.dur <= 0
    || !Array.isArray(cues.cues) || cues.cues.length !== count) throw new Error('Cues không khớp bài/số ý');
  let end = 0;
  cues.cues.forEach((cue, i) => {
    const ritual = article.meta?.loat === 'nghi-thuc';
    const gap = i ? (ritual ? 1.2 : i === count - 1 ? 1.5 : 0.9) : 0;
    if (cue.i !== i || !Number.isFinite(cue.t) || !Number.isFinite(cue.e) || cue.e <= cue.t
      || Math.abs(cue.t - end - gap) > 0.002 || cue.e > cues.dur + 0.08) throw new Error('Mốc cues không hợp lệ');
    end = cue.e;
  });
  return count;
}

// Chấm mẫu thật, không sinh bảng điểm giả. Cache theo lời đọc/giọng/lần để tiếp tục được.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContent } from '../content-data.mjs';
import { spokenLines, fingerprint, gradeClip } from './core.mjs';
import { maleVoices, synthesize, recognize } from './google.mjs';
import { seconds, joinSpeech } from './audio.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url)), cache = join(root, '.wrangler/tts-bench');
const candidates = ['Charon', 'Orus', 'Algenib', 'Iapetus', 'Schedar', 'Sadaltager'].map(x => 'vi-VN-Chirp3-HD-' + x);
const config = { provider: 'google', model: 'Chirp3-HD', speed: 0.9, instructions: '' };
const names = ['Tất Đạt Đa', 'Đề Bà Đạt Đa', 'Ca Tỳ La Vệ', 'Đức Phật'];
const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
try {
  mkdirSync(cache, { recursive: true });
  const catalog = await maleVoices();
  const voices = candidates.filter(x => catalog.some(v => v.name === x));
  if (voices.length < 4) throw new Error('Chưa đủ bốn giọng nam Chirp3-HD được Google trả về');
  const outline = readFileSync(join(root, 'docs/noi-dung/duong-xua-may-trang.md'), 'utf8').split('## 7.')[1];
  const sample = outline?.match(/```(?:markdown|md)?\s*\r?\n([\s\S]*?)```/)?.[1];
  if (!sample) throw new Error('Không tìm thấy bài mẫu con-thien-nga');
  const bird = parseContent(sample), wheel = parseContent(readFileSync(join(root, 'content/bai-giang/chuyen-phap-luan.md'), 'utf8'));
  const sets = [{ id: 'con-thien-nga', lines: spokenLines(bird.body) }, { id: 'chuyen-y2-4', lines: spokenLines(wheel.body).slice(1, 4) }];
  const tasks = [];
  for (const voice of voices) for (let repeat = 1; repeat <= 3; repeat++) for (const set of sets) set.lines.forEach((text, i) => tasks.push({ voice, repeat, set: set.id, text, i }));
  let next = 0, completed = 0, fatal;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (!fatal && next < tasks.length) {
      const task = tasks[next++], voice = task.voice.split('-').at(-1), dir = join(cache, voice, String(task.repeat), task.set);
      mkdirSync(dir, { recursive: true });
      const base = join(dir, String(task.i)), hash = fingerprint([task.text], { ...config, voice: task.voice });
      try {
        let record = existsSync(base + '.json') ? JSON.parse(readFileSync(base + '.json', 'utf8')) : null;
        if (!record || record.hash !== hash || !existsSync(base + '.wav')) {
          const wav = await synthesize(task.text, task.voice, config.speed);
          writeFileSync(base + '.wav', wav);
          const transcript = await recognize(wav), duration = seconds(wav);
          record = { hash, voice: task.voice, repeat: task.repeat, set: task.set, i: task.i, transcript, duration, ...gradeClip(task.text, transcript, duration, names) };
          writeFileSync(base + '.json', JSON.stringify(record, null, 2) + '\n');
        }
        if (++completed % 12 === 0) console.log(`bench: ${completed}/${tasks.length} đoạn đã đo thật`);
      } catch (error) { fatal = error; }
    }
  }));
  if (fatal) throw fatal;
  const scores = [];
  for (const voice of voices) {
    const rows = tasks.filter(x => x.voice === voice).map(task => JSON.parse(readFileSync(join(cache, voice.split('-').at(-1), String(task.repeat), task.set, task.i + '.json'), 'utf8')));
    const reps = [1, 2, 3].map(n => mean(rows.filter(x => x.repeat === n).map(x => x.wer)));
    const score = { voice, clips: rows.length, wer: mean(rows.map(x => x.wer)), tailErrors: rows.filter(x => !x.tailOk).length,
      nameErrors: rows.filter(x => !x.namesOk).length, secondsPerWord: mean(rows.map(x => x.secondsPerWord)), stability: Math.max(...reps) - Math.min(...reps) };
    score.pass = score.wer <= 0.05 && score.nameErrors === 0 && score.secondsPerWord >= 0.3 && score.secondsPerWord <= 0.75;
    score.rank = score.wer + score.stability + score.tailErrors / rows.length;
    scores.push(score);
    for (let repeat = 1; repeat <= 3; repeat++) {
      const set = sets[0], dir = join(cache, voice.split('-').at(-1), String(repeat), set.id);
      const result = joinSpeech(set.lines.map((_, i) => readFileSync(join(dir, i + '.wav'))), join(dir, 'sample.mp3'));
      writeFileSync(join(dir, 'sample.cues.json'), JSON.stringify(result) + '\n');
    }
  }
  scores.sort((a, b) => Number(b.pass) - Number(a.pass) || a.rank - b.rank);
  writeFileSync(join(cache, 'scores.json'), JSON.stringify({ measured_at: new Date().toISOString(), criteria: 'Google STT WER, tên riêng, đuôi câu, nhịp đọc, ổn định 3 lần; chưa chứng nhận vùng miền/độ ấm bằng tai', scores }, null, 2) + '\n');
  console.log(JSON.stringify({ scores, selected: scores[0]?.pass ? scores[0].voice : null }));
  console.log('Đã giữ bảng điểm gốc; chạy select-voice.mjs để kiểm lại tên riêng theo chính sách sinh lại từng ý trước khi chọn giọng.');
} catch (error) { console.error(error.message); process.exitCode = 1; }

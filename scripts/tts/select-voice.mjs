import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parseContent } from '../content-data.mjs';
import { spokenLines, gradeClip } from './core.mjs';
import { synthesize, recognize } from './google.mjs';
import { seconds, joinSpeech } from './audio.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { values } = parseArgs({ options: { 'bench-dir': { type: 'string' } } });
const bench = resolve(values['bench-dir'] || join(root, '.wrangler/tts-bench'));
try {
  const result = JSON.parse(readFileSync(join(bench, 'scores.json'), 'utf8'));
  const outline = readFileSync(join(root, 'docs/noi-dung/duong-xua-may-trang.md'), 'utf8').split('## 7.')[1];
  const article = parseContent(outline.match(/```(?:markdown|md)?\s*\r?\n([\s\S]*?)```/)[1]);
  const lines = spokenLines(article.body), names = ['Tất Đạt Đa', 'Ca Tỳ La Vệ', 'Đề Bà Đạt Đa', 'Đức Phật'];
  const checks = lines.map((text, i) => ({ text, i })).filter(x => names.some(name => x.text.includes(name)));
  let selected;
  for (const candidate of result.scores.filter(x => x.wer <= 0.05).sort((a, b) => a.rank - b.rank)) {
    const config = { provider: 'google', model: 'Chirp3-HD', voice: candidate.voice, speed: 0.85, instructions: '' };
    const dir = join(bench, candidate.voice.split('-').at(-1), 'name-qa-085');
    mkdirSync(dir, { recursive: true });
    const records = [], finalWavs = [];
    for (let repeat = 1; repeat <= 3; repeat++) for (const check of checks) {
      let passed = false;
      for (let attempt = 1; attempt <= 4; attempt++) {
        const base = join(dir, `${repeat}-${check.i}-${attempt}`);
        let record = existsSync(base + '.json') ? JSON.parse(readFileSync(base + '.json', 'utf8')) : null;
        let wav;
        if (record && existsSync(base + '.wav')) wav = readFileSync(base + '.wav');
        else {
          wav = await synthesize(check.text, config.voice, config.speed);
          writeFileSync(base + '.wav', wav);
          const transcript = await recognize(wav);
          record = { repeat, i: check.i, attempt, transcript, ...gradeClip(check.text, transcript, seconds(wav), names) };
          writeFileSync(base + '.json', JSON.stringify(record, null, 2) + '\n');
        }
        records.push(record);
        if (record.pass) { passed = true; finalWavs.push(wav); break; }
      }
      if (!passed) break;
    }
    const expected = checks.length * 3;
    const passes = records.filter(x => x.pass).length;
    const report = { voice: candidate.voice, speed: config.speed, raw_benchmark: candidate, named_checks: expected, passed_checks: passes, attempts: records };
    writeFileSync(join(dir, 'qa.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ voice: candidate.voice, named_checks: expected, passed: passes, attempts: records.length }));
    if (passes === expected) {
      const audio = joinSpeech(finalWavs.slice(0, checks.length), join(dir, 'name-qa.mp3'));
      writeFileSync(join(dir, 'name-qa.cues.json'), JSON.stringify(audio) + '\n');
      selected = { ...config, selected_at: new Date().toISOString(), selected_by: 'Codex: bảng điểm gốc + QA tên riêng, tối đa 3 lần sinh lại mỗi ý',
        accent_preference: 'miền Nam; Google chỉ gắn nhãn vi-VN, chưa chứng nhận vùng miền', raw_wer: candidate.wer, raw_name_errors: candidate.nameErrors,
        qa_passed: passes, qa_checks: expected, backup_voice: result.scores.find(x => x.voice !== candidate.voice)?.voice || null };
      break;
    }
  }
  if (!selected) throw new Error('Chưa có giọng đạt QA tên riêng sau chính sách sinh lại; không tự báo đạt');
  writeFileSync(join(root, 'scripts/tts/giong.json'), JSON.stringify(selected, null, 2) + '\n');
  console.log(JSON.stringify({ selected }));
} catch (error) { console.error(error.message); process.exitCode = 1; }

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { cuePoints } from './core.mjs';

function ffmpeg(args, input) {
  const result = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-hide_banner', '-nostdin', ...args], { input, maxBuffer: 64 * 1024 * 1024, timeout: 180000, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('FFmpeg không chạy được hoặc xử lý âm thanh lỗi', { cause: result.error });
  return result;
}

export const pcm24 = audio => ffmpeg(['-v', 'error', '-i', 'pipe:0', '-f', 's16le', '-ac', '1', '-ar', '24000', 'pipe:1'], audio).stdout;
export const seconds = audio => pcm24(audio).length / 48000;

function loudness(result) {
  const match = result.stderr.toString().match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error('Không đo được loudness');
  const level = JSON.parse(match[0]);
  if (['input_i', 'input_tp', 'input_lra', 'input_thresh', 'target_offset'].some(key => !Number.isFinite(Number(level[key])))) throw new Error('Âm thanh im lặng hoặc loudness không hợp lệ');
  return level;
}

export function measureAudio(output) {
  const level = loudness(ffmpeg(['-i', output, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-']));
  return { lufs: Number(level.input_i), peak_dbtp: Number(level.input_tp) };
}

export function joinSpeech(wavs, output) {
  if (!wavs.length) throw new Error('Không có đoạn âm thanh');
  const pcm = wavs.map(pcm24), durations = pcm.map(x => x.length / 48000), parts = [];
  pcm.forEach((part, i) => {
    if (i) parts.push(Buffer.alloc(Math.round(48000 * (i === pcm.length - 1 ? 1.5 : 0.9))));
    parts.push(part);
  });
  const joined = Buffer.concat(parts), input = ['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0'];
  // Đo lại MP3 sau resample/mã hóa: đỉnh và LUFS có thể khác PCM trước mã hóa.
  let targetI = -16, targetTP = -1.8, actual;
  for (let attempt = 0; attempt < 4; attempt++) {
    const level = loudness(ffmpeg([...input, '-af', `loudnorm=I=${targetI}:TP=${targetTP}:LRA=11:print_format=json`, '-f', 'null', '-'], joined));
    const filter = `loudnorm=I=${targetI}:TP=${targetTP}:LRA=11:measured_I=${level.input_i}:measured_TP=${level.input_tp}:measured_LRA=${level.input_lra}:measured_thresh=${level.input_thresh}:offset=${level.target_offset}:linear=true`;
    ffmpeg(['-y', ...input, '-af', filter, '-ac', '1', '-ar', '24000', '-c:a', 'libmp3lame', '-b:a', '64k', output], joined);
    actual = measureAudio(output);
    if (Math.abs(actual.lufs + 16) <= 0.2 && actual.peak_dbtp <= -1.5) break;
    targetI = Math.max(-20, Math.min(-12, targetI - 16 - actual.lufs));
    if (actual.peak_dbtp > -1.5) targetTP -= actual.peak_dbtp + 1.65;
  }
  if (Math.abs(actual.lufs + 16) > 0.5 || actual.peak_dbtp > -1.5) throw new Error(`MP3 chưa đạt loudness: ${actual.lufs} LUFS, ${actual.peak_dbtp} dBTP`);
  const dur = seconds(readFileSync(output)), cues = cuePoints(durations);
  if (cues.at(-1).e > dur + 0.08) throw new Error('Âm thanh sau mã hóa bị mất đuôi');
  return { dur, cues, loudness: { target_lufs: -16, target_peak_dbtp: -1.5, ...actual }, format: { sample_rate: 24000, channels: 1, bit_rate: 64000 } };
}

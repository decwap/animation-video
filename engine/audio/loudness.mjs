// Loudness by EBU R128, measured with ffmpeg's ebur128 filter: integrated loudness (LUFS),
// true peak (dBTP) and loudness range (LU). Silence reads as -70 LUFS and -Infinity dBTP.
// Part of animation-video (by Web Asamoah).
import { spawnSync } from 'node:child_process';

const num = (s) => (s === undefined ? NaN : /^-?inf$/i.test(s) ? (s.startsWith('-') ? -Infinity : Infinity) : +s);

export function measureLoudness(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg could not measure ${file}: ${(r.stderr || '').trim().split('\n').slice(-3).join(' ')}`);
  const summary = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const pick = (re) => num((re.exec(summary) || [])[1]);
  const lufs = pick(/I:\s+(-?[\d.]+|-?inf) LUFS/);
  return { lufs: Number.isFinite(lufs) ? Math.max(-70, lufs) : -70, tp: pick(/Peak:\s+(-?[\d.]+|-?inf) dBFS/), lra: pick(/LRA:\s+(-?[\d.]+) LU/) };
}

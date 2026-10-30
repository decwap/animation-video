// Loudness levelling with ffmpeg's two-pass loudnorm (EBU R128), and the final master: a
// rendered video at -14 LUFS integrated with true peak at or below -1 dBTP (Reels, TikTok and
// Shorts all play at about -14), video stream copied untouched, audio as 48 kHz AAC 256k.
// Part of animation-video (by Web Asamoah).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { measureLoudness } from './loudness.mjs';

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').trim().split('\n').slice(-4).join(' ')}`);
  return r.stderr;
}

// Measures src, then writes out at `lufs` with true peak under `tp`. `output` holds the
// encoder arguments for out (stream maps, codec, rate).
export function loudnorm(src, out, { lufs, tp = -1.5, lra = 11, output = [] }) {
  if (!fs.existsSync(src)) throw new Error(`no media at ${src}`);
  const base = `loudnorm=I=${lufs}:TP=${tp}:LRA=${lra}`;
  const first = ffmpeg(['-i', src, '-vn', '-af', `${base}:print_format=json`, '-f', 'null', '-']);
  const json = JSON.parse(first.slice(first.lastIndexOf('{'), first.lastIndexOf('}') + 1));
  const measured = `measured_I=${json.input_i}:measured_TP=${json.input_tp}:measured_LRA=${json.input_lra}:measured_thresh=${json.input_thresh}:offset=${json.target_offset}`;
  ffmpeg(['-y', '-i', src, ...output, '-af', `${base}:${measured}:linear=true`, out]);
  return measureLoudness(out);
}

// TP sits a little under -1 because AAC adds a few tenths of a dB. -shortest keeps the file exactly
// as long as its picture when the re-encoded audio runs past it.
export function masterVideo(src, out, { lufs = -14, tp = -1.5, lra = 11 } = {}) {
  const { lufs: got, tp: peak } = loudnorm(src, out, {
    lufs, tp, lra,
    output: ['-map', '0:v:0?', '-map', '0:a:0', '-c:v', 'copy', '-ar', '48000', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart'],
  });
  return { lufs: got, tp: peak };
}

// CLI: node engine/audio/master.mjs <rendered.mp4> <final.mp4>
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) { console.error('usage: node engine/audio/master.mjs <rendered.mp4> <final.mp4>'); process.exit(1); }
  try {
    const r = masterVideo(src, out);
    console.log(`mastered ${out}: ${r.lufs.toFixed(1)} LUFS, true peak ${r.tp.toFixed(1)} dBTP`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

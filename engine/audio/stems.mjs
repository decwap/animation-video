// The edit pack's sound: voice, music and sound effects as three WAVs of exactly the video's length,
// each at the level it plays in the video, then all moved by one gain so the three together play at
// the finished MP4's loudness (-14 LUFS). Part of animation-video (by Web Asamoah).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { measureLoudness } from './loudness.mjs';

export const STEM_FILES = ['6-voice.wav', '7-music.wav', '8-sfx.wav'];

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').trim().split('\n').slice(-4).join(' ')}`);
}

// The sample peak in dB (float audio can read above 0).
function peakDb(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'astats=measure_perchannel=none', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const m = /Peak level dB:\s*(-?[\d.]+)/.exec(r.stderr || '');
  return m ? +m[1] : -Infinity;
}

// Where Studio put the clip: from mediaStart in the file, for duration seconds, starting at start.
// adelay keeps the frames' old timestamps, so they are renumbered before the closing trim.
const placed = ({ start = 0, mediaStart = 0, duration = null }) => ({
  trim: mediaStart > 0 || duration != null ? `atrim=start=${mediaStart}${duration != null ? `:duration=${duration}` : ''},asetpts=PTS-STARTPTS,` : '',
  delay: start > 0 ? `,adelay=${Math.round(start * 48000)}S:all=1,asetpts=N/SR/TB` : '',
});

const mix = (files, out, codec) => ffmpeg([...files.flatMap((f) => ['-i', f]), '-filter_complex', `amix=inputs=${files.length}:normalize=0`, '-c:a', codec, out]);

// voice and music: { file, volume, start?, mediaStart?, duration? } or null; sfx: an audio file or null.
// A missing one is silence. The gain stops short of making any one stem clip, so a quiet video with a
// loud peak comes out below -14 LUFS (the returned lufs says by how much).
export function levelStems({ voice, music, sfx, duration, outDir, lufs = -14 }) {
  fs.mkdirSync(outDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'av-stems-'));
  try {
    const d = duration.toFixed(6);
    const sources = [voice, music, sfx ? { file: sfx, volume: 1 } : null];
    const staged = sources.map((s, k) => {
      const out = path.join(tmp, `${k}.wav`);
      const { trim, delay } = s ? placed(s) : {};
      if (s) ffmpeg(['-i', s.file, '-af', `${trim}volume=${s.volume},aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo${delay},apad=whole_dur=${d},atrim=end=${d}`, '-c:a', 'pcm_f32le', out]);
      else ffmpeg(['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo', '-t', d, '-c:a', 'pcm_f32le', out]);
      return out;
    });
    const sum = path.join(tmp, 'sum.wav');
    mix(staged, sum, 'pcm_f32le');
    const measured = measureLoudness(sum).lufs;
    const peak = Math.max(...staged.map(peakDb));
    const gainDb = measured > -69 ? Math.floor(Math.min(lufs - measured, -0.3 - peak) * 100) / 100 : 0;
    const finals = staged.map((f, k) => {
      const out = path.join(outDir, STEM_FILES[k]);
      ffmpeg(['-i', f, '-af', `volume=${gainDb}dB`, '-c:a', 'pcm_s24le', out]);
      return out;
    });
    const check = path.join(tmp, 'final.wav');
    mix(finals, check, 'pcm_f32le');
    const m = measureLoudness(check);
    return { gainDb, lufs: +m.lufs.toFixed(1), tp: +m.tp.toFixed(1) };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { LOOKS, SFX_LENGTH } from '../engine/config.mjs';
import { loadLook } from '../engine/looks.mjs';
import { writeSfxBank } from '../engine/audio/bank.mjs';
import { composeMusic } from '../engine/audio/music.mjs';
import { masterVideo } from '../engine/audio/master.mjs';
import { measureLoudness } from '../engine/audio/loudness.mjs';
import { SR, writeWav } from '../engine/audio/synth.mjs';
import { wavDuration } from '../engine/audio/wav.mjs';
import { parseScript } from '../engine/script.mjs';
import { estimateWords } from '../engine/words.mjs';
import { build } from '../engine/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
const peakOf = (file) => {
  const buf = fs.readFileSync(file);
  const fmt = buf.readUInt16LE(20);
  let peak = 0;
  for (let i = 44; i + 4 <= buf.length; i += fmt === 3 ? 4 : 2) peak = Math.max(peak, Math.abs(fmt === 3 ? buf.readFloatLE(i) : buf.readInt16LE(i) / 32768));
  return peak;
};
const rms = (x, a, b) => { let s = 0; for (let i = Math.round(a * SR); i < Math.round(b * SR); i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, Math.round((b - a) * SR))); };

for (const id of LOOKS) {
  test(`${id}: the sound bank writes every sound at its length with a safe peak`, async () => {
    const look = await loadLook(id);
    const dir = tmp('av-bank-');
    const names = writeSfxBank(look, dir);
    assert.deepEqual([...names].sort(), Object.keys(look.sfxBank).sort());
    for (const n of names) {
      const f = path.join(dir, `${n}.wav`);
      assert.ok(Math.abs(wavDuration(f) - (SFX_LENGTH[n] ?? 1)) < 0.01, `${n} length`);
      const p = peakOf(f);
      assert.ok(p > 0.05 && p < 0.9, `${id}/${n} peak ${p}`);
    }
  });
}

test('music fills the video, at 48 kHz, and ducks at least 6 dB under speech', async () => {
  const look = await loadLook('paper');
  const { L, R } = composeMusic({ preset: look.music, duration: 20, hits: [0, 5, 11], speech: [[6, 9]] });
  assert.ok(Math.abs(L.length / SR - 20) < 0.05);
  assert.equal(L.length, R.length);
  const inside = rms(L, 6.5, 8.5);
  const outside = rms(L, 1.5, 3.5);
  assert.ok(20 * Math.log10(outside / inside) >= 6, `duck ${20 * Math.log10(outside / inside)} dB`);
});

test('every look has a music preset the composer understands', async () => {
  for (const id of LOOKS) {
    const look = await loadLook(id);
    const { L } = composeMusic({ preset: look.music, duration: 6, hits: [0], speech: [] });
    assert.ok(rms(L, 1, 5) > 0.005, `${id} music is silent`);
  }
});

test('masterVideo brings a video to -14 LUFS with true peak at or below -1 dBTP', () => {
  const dir = tmp('av-master-');
  const src = path.join(dir, 'in.mp4');
  // the audio runs 0.4 s past the picture, as a render's audio can
  const made = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3.4:sample_rate=48000',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-af', 'volume=-20dB', '-c:a', 'aac', src]);
  assert.equal(made.status, 0, String(made.stderr));
  const r = masterVideo(src, path.join(dir, 'out.mp4'));
  assert.ok(Math.abs(r.lufs + 14) <= 1, `lufs ${r.lufs}`);
  assert.ok(r.tp <= -1, `tp ${r.tp}`);
  // the master is exactly as long as its picture: re-encoded audio must not stretch the file
  const probe = (f, what) => +spawnSync('ffprobe', ['-v', 'error', ...what, '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim().split('\n')[0];
  const video = probe(path.join(dir, 'out.mp4'), ['-select_streams', 'v:0', '-show_entries', 'stream=duration']);
  const file = probe(path.join(dir, 'out.mp4'), ['-show_entries', 'format=duration']);
  assert.ok(file - video <= 0.025, `file ${file} s, picture ${video} s`);
});

test('after a build the voice sits 7-10 LU above the music', async () => {
  const dir = tmp('av-mix-');
  fs.cpSync(path.join(HERE, 'fixtures', 'mini-video'), dir, { recursive: true });
  const words = estimateWords(parseScript(fs.readFileSync(path.join(dir, 'script.md'), 'utf8')).words);
  fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'voice', 'words.json'), JSON.stringify(words));
  // a speech-like take: voiced buzz with syllable bursts, one per word
  const len = Math.ceil((words.at(-1).t1 + 0.5) * SR);
  const v = new Float32Array(len);
  for (const w of words) for (let i = Math.round(w.t0 * SR); i < Math.round(w.t1 * SR) && i < len; i++) {
    const t = i / SR;
    v[i] = 0.3 * Math.sin(2 * Math.PI * 160 * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 5 * t)) + 0.05 * Math.sin(2 * Math.PI * 1200 * t);
  }
  writeWav(path.join(dir, 'voice', 'vo.wav'), v, v, fs);
  await build(dir, { looks: ['paper'] });
  const vo = measureLoudness(path.join(dir, 'looks', 'paper', 'assets', 'audio', 'vo.wav'));
  const music = measureLoudness(path.join(dir, 'looks', 'paper', 'assets', 'audio', 'music.wav'));
  const gap = vo.lufs - music.lufs;
  assert.ok(gap >= 7 && gap <= 10, `voice over music by ${gap.toFixed(1)} LU`);
  for (const f of fs.readdirSync(path.join(dir, 'looks', 'paper', 'assets', 'sfx'))) assert.ok(peakOf(path.join(dir, 'looks', 'paper', 'assets', 'sfx', f)) > 0.05, `${f} is silent`);
});

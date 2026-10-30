import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { makeVoice } from '../engine/voice.mjs';
import { measureLoudness } from '../engine/audio/loudness.mjs';
import { wavDuration } from '../engine/audio/wav.mjs';

const SCRIPT = '# Voice test\n1. Pick a look for your video today.\n2. Paste your script, and Claude animates every line.\n';
const SAID = 'Pick a look for your video today. Paste your script, and Claude animates every line.';
const hasSay = spawnSync('say', ['-v', '?']).status === 0;

test('makeVoice turns a narration mp3 into a levelled mix file and per-word timings', { skip: !hasSay && 'needs macOS say' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-voice-'));
  fs.writeFileSync(path.join(dir, 'script.md'), SCRIPT);
  const aiff = path.join(dir, 'take.aiff');
  assert.equal(spawnSync('say', ['-v', 'Samantha', '-o', aiff, SAID]).status, 0);
  const mp3 = path.join(dir, 'take.mp3');
  assert.equal(spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', aiff, '-c:a', 'libmp3lame', '-b:a', '128k', mp3]).status, 0);

  const r = await makeVoice(dir, { mp3 });
  const voice = path.join(dir, 'voice');
  for (const f of ['vo.mp3', 'vo.wav', 'vo16k.wav', 'whisper.json', 'words.json']) assert.ok(fs.existsSync(path.join(voice, f)), f);
  const words = JSON.parse(fs.readFileSync(path.join(voice, 'words.json'), 'utf8'));
  assert.equal(words.length, 15);
  assert.equal(words[0].text, 'Pick');
  assert.ok(words.every((w, i) => w.t1 > w.t0 && (i === 0 || w.t0 >= words[i - 1].t0)));
  assert.ok(Math.abs(r.duration - wavDuration(path.join(voice, 'vo.wav'))) < 0.05);
  assert.ok(r.duration - words.at(-1).t1 < 0.3 && words.at(-1).t1 <= r.duration + 0.05, `last word ends ${words.at(-1).t1}, audio ${r.duration}`);
  assert.ok(r.unmatched.length <= 2, `unmatched: ${r.unmatched.join(', ')}`);
  assert.equal(r.words, 15);
  const lufs = measureLoudness(path.join(voice, 'vo.wav')).lufs;
  assert.ok(Math.abs(lufs + 16) <= 1, `voice at ${lufs} LUFS`);
});

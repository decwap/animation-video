import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseScript } from '../engine/script.mjs';
import { estimateWords } from '../engine/words.mjs';
import { PRIMITIVES } from '../engine/table.mjs';
import { build, placeholderAudio } from '../engine/build.mjs';
import { renderLook, renderFile } from '../engine/render.mjs';
import { measureLoudness } from '../engine/audio/loudness.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const stub = (id) => ({ id, label: `Look ${id}`, fonts: [], primitives: Object.fromEntries(PRIMITIVES.map((n) => [n, () => `<div>${n}</div>`])), sfxFor: () => null, sfxGain: {}, sfxBank: {}, music: {}, decor: () => '', cssText: '', motionText: '' });

// Stands in for the HyperFrames render: a 3 s clip with quiet audio at the path it was asked for.
const fakeRender = async (cwd, out) => {
  assert.ok(fs.existsSync(path.join(cwd, 'index.html')), 'renders from the look project');
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=108x192:rate=30:duration=3', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=3:sample_rate=48000',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-af', 'volume=-22dB', '-c:a', 'aac', out]);
  assert.equal(r.status, 0, String(r.stderr));
};

test('renderLook renders a look, masters it to -14 LUFS, takes a cover and names it after the video', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'av-render-')), 'my-video');
  fs.cpSync(path.join(HERE, 'fixtures', 'mini-video'), dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'voice', 'words.json'), JSON.stringify(estimateWords(parseScript(fs.readFileSync(path.join(dir, 'script.md'), 'utf8')).words)));
  await build(dir, { looks: ['a'], resolveLook: async (id) => stub(id), audio: placeholderAudio });
  const r = await renderLook(dir, 'a', { render: fakeRender });
  assert.equal(r.file, renderFile(dir, 'a'));
  assert.match(r.file, /renders\/mini-video-a\.mp4$|renders\/my-video-a\.mp4$/);
  assert.ok(fs.existsSync(r.file) && fs.existsSync(r.cover));
  assert.ok(!fs.readdirSync(path.dirname(r.file)).some((f) => /\.raw\.mp4$/.test(f)), 'no raw render left behind');
  assert.ok(Math.abs(measureLoudness(r.file).lufs + 14) <= 1);
  assert.ok(r.tp <= -1);
  await assert.rejects(() => renderLook(dir, 'b', { render: fakeRender }), /isn't built/);
});

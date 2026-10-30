// Voice: turns the narration (the vidIQ voiceover's mp3 URL, or any audio file) into what a
// build needs: voice/vo.wav (48 kHz stereo, levelled to -16 LUFS, for the mix), voice/vo16k.wav
// (for whisper), voice/whisper.json and voice/words.json (the script's own words, each with
// its spoken time). CLI: node engine/voice.mjs <videoDir> --mp3 <url|file>
// Part of animation-video (by Web Asamoah).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { WHISPER_MODEL, VOICE_LUFS, paths } from './config.mjs';
import { parseScript } from './script.mjs';
import { whisperTokens, alignWords } from './words.mjs';
import { loudnorm } from './audio/master.mjs';
import { wavDuration } from './audio/wav.mjs';

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`${cmd} is not available: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} failed: ${(r.stderr || r.stdout || '').trim().split('\n').slice(-4).join(' ')}`);
  return r;
}

async function fetchAudio(src, dest) {
  if (/^https?:\/\//i.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`could not download the voice (${res.status} ${res.statusText})`);
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  } else {
    if (!fs.existsSync(src)) throw new Error(`no audio file at ${src}`);
    if (path.resolve(src) !== path.resolve(dest)) fs.copyFileSync(src, dest);
  }
}

export async function makeVoice(videoDir, { mp3, model = WHISPER_MODEL, whisper = 'whisper-cli', lufs = VOICE_LUFS } = {}) {
  if (!mp3) throw new Error('give the narration with --mp3 <url|file>');
  const p = paths(videoDir);
  const script = parseScript(fs.readFileSync(p.script, 'utf8'));
  if (!fs.existsSync(model)) throw new Error(`no whisper model at ${model} (set AV_WHISPER_MODEL)`);
  fs.mkdirSync(p.voiceDir, { recursive: true });
  const f = (name) => path.join(p.voiceDir, name);

  await fetchAudio(mp3, f('vo.mp3'));
  loudnorm(f('vo.mp3'), f('vo.wav'), { lufs, output: ['-vn', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le'] });
  run('ffmpeg', ['-v', 'error', '-y', '-i', f('vo.mp3'), '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', f('vo16k.wav')]);
  run(whisper, ['-m', model, '-f', f('vo16k.wav'), '-l', 'en', '-ml', '1', '-sow', '-oj', '-of', f('whisper'), '-np']);

  const tokens = whisperTokens(JSON.parse(fs.readFileSync(f('whisper.json'), 'utf8')));
  const words = alignWords(script.words, tokens);
  fs.writeFileSync(p.words, `${JSON.stringify(words, null, 1)}\n`);
  const duration = +wavDuration(f('vo.wav')).toFixed(3);
  return { duration, words: words.length, unmatched: words.filter((w) => !w.heard).map((w) => `${w.text} (line ${w.line})`) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { mp3: { type: 'string' } } });
  if (!positionals[0] || !o.mp3) { console.error('usage: node engine/voice.mjs <videoDir> --mp3 <url|file>'); process.exit(1); }
  try {
    console.log(JSON.stringify(await makeVoice(positionals[0], { mp3: o.mp3 }), null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

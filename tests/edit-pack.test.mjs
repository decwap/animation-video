import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readLook, sceneName, timecode, srt, scenesText } from '../engine/pack-timeline.mjs';
import { LAYERS, layerCss, layerHtml } from '../engine/pack-layers.mjs';
import { premiereXml, fileUrl } from '../engine/premiere-xml.mjs';
import { levelStems } from '../engine/audio/stems.mjs';
import { measureLoudness } from '../engine/audio/loudness.mjs';
import crypto from 'node:crypto';
import { parseScript } from '../engine/script.mjs';
import { estimateWords } from '../engine/words.mjs';
import { PRIMITIVES } from '../engine/table.mjs';
import { build, placeholderAudio } from '../engine/build.mjs';
import { setPick } from '../engine/pick.mjs';
import { exportEditPack, packDir, howToText } from '../engine/edit-pack.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures', 'pack-look');
const tmpDir = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `av-${name}-`));
const ffmpeg = (args) => { const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
const probe = (file) => JSON.parse(spawnSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { encoding: 'utf8' }).stdout);
const audioOf = (file) => { const p = probe(file); return { ...p.streams.find((s) => s.codec_type === 'audio'), duration: p.format.duration }; };
// Loudest sample in dB; digital silence (volumedetect floors it near -91 dB) reads as -Infinity.
const maxVolume = (file) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const v = +(/max_volume: (-?[\d.]+) dB/.exec(r.stderr) || [])[1];
  return Number.isFinite(v) && v > -90 ? v : -Infinity;
};
const maxVolumeIn = (file, a, b) => {
  const out = path.join(tmpDir('window'), 'w.wav');
  ffmpeg(['-i', file, '-af', `atrim=start=${a}:end=${b}`, '-c:a', 'pcm_f32le', out]);
  return maxVolume(out);
};
const ALL_FILES = ['1-background.mp4', '2-graphics.mov', '3-text.mov', '4-captions.mov', '5-watermark.mov', '6-voice.wav', '7-music.wav', '8-sfx.wav', 'HOW TO EDIT.txt', 'captions.srt', 'premiere.xml', 'scenes.txt'];
const sumOf = (dir) => {
  const out = path.join(dir, 'sum.check.wav');
  ffmpeg(['-i', path.join(dir, '6-voice.wav'), '-i', path.join(dir, '7-music.wav'), '-i', path.join(dir, '8-sfx.wav'), '-filter_complex', 'amix=inputs=3:normalize=0', '-c:a', 'pcm_f32le', out]);
  return out;
};

test('readLook reads duration, tiling scenes, captions, audio and watermark from a built look', () => {
  const r = readLook(FIX);
  assert.equal(r.duration, 10);
  assert.deepEqual(r.scenes, [
    { id: 'hook', name: 'Hook', start: 0, end: 3.87 },
    { id: 'this-one', name: 'This one', start: 3.87, end: 5.81 },
    { id: 'cta', name: 'CTA', start: 5.81, end: 10 },
  ]);
  assert.deepEqual(r.captions.map((c) => c.text), ['Did you know Claude', 'Q&A is "free"', 'a<b']);
  assert.deepEqual([r.captions[1].t0, r.captions[1].t1], [1.06, 2.16]);
  assert.deepEqual(r.voice, { file: path.join(FIX, 'assets/audio/vo.wav'), volume: 1, start: 0, duration: 8, mediaStart: 0, effects: [] });
  assert.equal(r.music.volume, 0.8);
  assert.equal(r.watermark, '@webasamoah');
  assert.throws(() => readLook(path.join(FIX, 'compositions')), /isn't a built look/);
});

test('readLook decodes numeric entities and non-breaking spaces a Studio text edit leaves in captions', () => {
  const look = path.join(tmpDir('look-entities'), 'look');
  fs.cpSync(FIX, look, { recursive: true });
  const caps = path.join(look, 'compositions', 'captions.html');
  fs.writeFileSync(caps, fs.readFileSync(caps, 'utf8').replace('a&lt;b', 'It&#39;s&nbsp;a &#8220;test&#8221; &apos;ok&apos; &#x2014; done'));
  assert.equal(readLook(look).captions[2].text, "It's a \u201ctest\u201d 'ok' \u2014 done");
});

test('sceneName and timecode', () => {
  assert.equal(sceneName('no-stock'), 'No stock');
  assert.equal(sceneName('cta'), 'CTA');
  assert.equal(sceneName('one'), 'One');
  assert.equal(sceneName('ai-tools'), 'AI tools');
  assert.equal(timecode(3.87), '00:00:03:26');
  assert.equal(timecode(65.5), '00:01:05:15');
});

test('srt numbers each caption with comma milliseconds and real characters', () => {
  const s = srt(readLook(FIX).captions);
  assert.ok(s.startsWith('1\n00:00:00,080 --> 00:00:01,060\nDid you know Claude\n\n2\n00:00:01,060 --> 00:00:02,160\nQ&A is "free"\n\n'), s);
  assert.doesNotMatch(s, /&amp;|&quot;|&lt;/);
});

test('srt ends a caption where the next begins, so editors keep every cue on one track', () => {
  // the look's captions can overlap by a few ms ("Two:" 11.86–11.96, then 11.94); CapCut moves an
  // overlapping cue to a second caption track
  const s = srt([{ t0: 11.86, t1: 11.96, text: 'Two:' }, { t0: 11.94, t1: 13.7, text: 'pick a look.' }]);
  assert.equal(s, '1\n00:00:11,860 --> 00:00:11,940\nTwo:\n\n2\n00:00:11,940 --> 00:00:13,700\npick a look.\n\n');
});

test('scenesText lists every scene with seconds and CapCut timecode', () => {
  const t = scenesText(readLook(FIX).scenes);
  assert.match(t, /^1\. Hook +0:00\.00 → 0:03\.87 +\(00:00:00:00 → 00:00:03:26\)$/m);
  assert.match(t, /^3\. CTA +0:05\.81 → 0:10\.00/m);
});

test('layerHtml strips the voice and music, keeps the scenes and adds one layer style', () => {
  const html = fs.readFileSync(path.join(FIX, 'index.html'), 'utf8');
  assert.deepEqual(LAYERS.map((l) => l.file), ['1-background.mp4', '2-graphics.mov', '3-text.mov', '4-captions.mov', '5-watermark.mov']);
  for (const { id } of LAYERS) {
    const v = layerHtml(html, id);
    assert.doesNotMatch(v, /<audio id="(vo|music)"/);
    assert.match(v, /id="scene-hook"/);
    assert.equal(v.match(/<style id="av-layer"/g).length, 1);
    assert.match(v, new RegExp(`data-layer="${id}"[^>]*>[\\s\\S]*</style>\\s*</head>`));
  }
  assert.throws(() => layerHtml(html, 'sparkles'), /unknown layer "sparkles"/);
});

test('layerHtml takes out the voice and music however Studio writes the tag, and stops if it cannot', () => {
  const html = '<html><head></head><body>\n  <audio data-start="0.5" id="vo" src="a.wav">\n  </audio>\n  <div id="keep"></div>\n  <audio data-volume="1" id="music" src="m.wav"></audio>\n</body></html>';
  const v = layerHtml(html, 'graphics');
  assert.doesNotMatch(v, /<audio/);
  assert.match(v, /<div id="keep"><\/div>/);
  assert.throws(() => layerHtml('<html><head></head><body><audio id="vo" src="a.wav"><div id="keep"></div></body></html>', 'graphics'), /voice and music/);
});

test('each layer hides what it leaves out, and only the background keeps the page colour', () => {
  assert.doesNotMatch(layerCss('background'), /transparent/);
  assert.match(layerCss('background'), /\[data-composition-id="main"\] > :not\(#decor\) \{ visibility: hidden !important; \}/);
  for (const id of ['graphics', 'text', 'captions', 'watermark']) assert.match(layerCss(id), /\[data-composition-id="main"\] \{ background: transparent !important; \}/);
  assert.match(layerCss('graphics'), /#decor, #captions, #watermark \{ visibility: hidden !important; \}/);
  assert.match(layerCss('graphics'), /\.av-scene :is\(\.av-phone, \.av-window, \.av-chat, \.av-terminal\) :is\(\.av-kicker, \.av-headline, \.av-mark, \.av-counter, \.av-note\) \{ visibility: visible !important; \}/);
  assert.match(layerCss('text'), /\[data-composition-id="main"\] > :not\(\[id\^="scene-"\]\) \{ visibility: hidden !important; \}/);
  assert.match(layerCss('text'), /\.av-scene, \.av-scene \* \{ visibility: hidden !important; \}/);
  assert.match(layerCss('captions'), /> :not\(#captions\)/);
  assert.match(layerCss('watermark'), /> :not\(#watermark\)/);
});

const SPEC = (dir) => ({ name: 'my video', duration: 10, scenes: readLook(FIX).scenes,
  video: [{ name: '1-background.mp4', file: `${dir}/1-background.mp4` }, { name: '2-graphics.mov', file: `${dir}/2-graphics.mov` }],
  audio: [{ name: '6-voice.wav', file: `${dir}/6-voice.wav` }] });

test('premiereXml stacks the tracks and cuts each into the named scenes with markers', () => {
  const x = premiereXml(SPEC('/tmp/pack'));
  assert.match(x, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<!DOCTYPE xmeml>\n<xmeml version="4">/);
  assert.equal(x.match(/<clipitem /g).length, 9);              // 3 tracks × 3 scenes
  assert.equal(x.match(/<name>2 This one<\/name>/g).length, 4);       // 3 clips + its marker
  assert.match(x, /<start>116<\/start>\s*<end>174<\/end>/);    // 3.87 s → 5.81 s
  assert.equal(x.match(/<marker>/g).length, 3);
  assert.equal(x.match(/<alphatype>straight<\/alphatype>/g).length, 3); // only the .mov track
  assert.equal(x.match(/<pathurl>/g).length, 3);                // each file defined once
  // stereo stems: Premiere reads a single clipitem as both channels only with these
  assert.equal(x.match(/<track premiereTrackType="Stereo">/g).length, 1);
  assert.equal(x.match(/<clipitem id="clipitem-\d+" premiereChannelType="stereo">/g).length, 3);
});

test('premiereXml stays well-formed for a folder named with spaces, & and an apostrophe', () => {
  const x = premiereXml(SPEC("/Users/x/VIDEO/Ama & Kofi's reel/pack"));
  assert.match(x, /<pathurl>file:\/\/localhost\/Users\/x\/VIDEO\/Ama%20&amp;%20Kofi's%20reel\/pack\/1-background\.mp4<\/pathurl>/);
  assert.equal(fileUrl('/a/b#c?d.mov'), 'file://localhost/a/b%23c%3Fd.mov');
  assert.throws(() => fileUrl('my video/a.mov'), /absolute/);
  const lint = spawnSync('xmllint', ['--noout', '-'], { input: x, encoding: 'utf8' });
  if (!lint.error) assert.equal(lint.status, 0, lint.stderr);   // skipped where xmllint isn't installed
});

function stemSources() {
  const dir = tmpDir('stems-src');
  const v = path.join(dir, 'vo.wav');
  const m = path.join(dir, 'music.wav');
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=220:duration=2:sample_rate=48000', '-af', 'volume=-20dB', v]);
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=3:sample_rate=44100', '-af', 'volume=-26dB', m]);
  return { v, m };
}

test('levelStems writes three 48 kHz stereo stems of the exact length whose sum plays at -14 LUFS', () => {
  const { v, m } = stemSources();
  const outDir = tmpDir('stems');
  const r = levelStems({ voice: { file: v, volume: 1 }, music: { file: m, volume: 0.5 }, sfx: null, duration: 3, outDir });
  for (const f of ['6-voice.wav', '7-music.wav', '8-sfx.wav']) {
    const a = audioOf(path.join(outDir, f));
    assert.deepEqual([a.sample_rate, a.channels, a.codec_name], ['48000', 2, 'pcm_s24le'], f);
    assert.ok(Math.abs(+a.duration - 3) < 2 / 48000, `${f} is ${a.duration} s`);
  }
  assert.ok(Math.abs(measureLoudness(sumOf(outDir)).lufs + 14) <= 0.5);
  assert.ok(Math.abs(r.lufs + 14) <= 0.5, `reported ${r.lufs}`);
  assert.ok(Number.isFinite(r.gainDb));
  assert.equal(maxVolume(path.join(outDir, '8-sfx.wav')), -Infinity);
  // one gain for all: voice and music keep their 6 dB gap (−20 vs −26 −6 = −32 → 12 dB)
  assert.ok(Math.abs(maxVolume(path.join(outDir, '6-voice.wav')) - maxVolume(path.join(outDir, '7-music.wav')) - 12) < 0.3);
});

test('levelStems gives a silent music stem when the video has no music', () => {
  const { v } = stemSources();
  const other = tmpDir('stems-nomusic');
  levelStems({ voice: { file: v, volume: 1 }, music: null, sfx: null, duration: 3, outDir: other });
  assert.equal(maxVolume(path.join(other, '7-music.wav')), -Infinity);
  assert.ok(Math.abs(+audioOf(path.join(other, '7-music.wav')).duration - 3) < 2 / 48000);
});

test('levelStems places the voice where Studio moved and trimmed it', () => {
  const { v } = stemSources();                                   // 2 s tone
  const out = tmpDir('stems-moved');
  levelStems({ voice: { file: v, volume: 1, start: 0.5, mediaStart: 0.5, duration: 1 }, music: null, sfx: null, duration: 3, outDir: out });
  const voice = path.join(out, '6-voice.wav');
  assert.equal(maxVolumeIn(voice, 0, 0.45), -Infinity, 'silent before its start');
  assert.ok(maxVolumeIn(voice, 0.55, 1.45) > -60, 'plays from 0.5 s');
  assert.equal(maxVolumeIn(voice, 1.55, 3), -Infinity, 'trimmed to 1 s');
  assert.ok(Math.abs(+audioOf(voice).duration - 3) < 2 / 48000);
});

test('levelStems never lets a stem clip: a quiet voice with one loud click is levelled down, and says so', () => {
  const dir = tmpDir('stems-peaky');
  const v = path.join(dir, 'vo.wav');
  ffmpeg(['-f', 'lavfi', '-i', 'aevalsrc=0.01*sin(2*PI*220*t)+0.89*between(t\\,1\\,1.01)*sin(2*PI*1000*t):s=48000:d=3', v]);
  const out = tmpDir('stems-peaky-out');
  const r = levelStems({ voice: { file: v, volume: 1 }, music: null, sfx: null, duration: 3, outDir: out });
  assert.ok(maxVolume(path.join(out, '6-voice.wav')) <= -0.25, `voice peaks at ${maxVolume(path.join(out, '6-voice.wav'))} dB`);
  assert.ok(r.lufs < -14.5, `sum plays at ${r.lufs} LUFS`);
  assert.ok(Number.isFinite(r.tp));
});

test('the how-to says when the sound sits louder or quieter than the MP4, and names the stacking limit', () => {
  const base = { title: 'T', look: 'Bold Editorial', scenes: readLook(FIX).scenes, files: ALL_FILES };
  const plain = howToText({ ...base, sound: { lufs: -14, tp: -2 } });
  assert.doesNotMatch(plain, /louder than the MP4|quieter than the finished MP4/);
  assert.match(plain, /All text sits above all graphics/);
  assert.match(plain, /scene change[\s\S]*fades[\s\S]*graphic sits over text/);
  assert.match(plain, /keeps anything else you save in this folder/);
  assert.match(howToText({ ...base, sound: { lufs: -14, tp: -0.1 } }), /may sit a little louder than the MP4[\s\S]*limiter/);
  assert.match(howToText({ ...base, sound: { lufs: -20.2, tp: -0.4 } }), /about 6 dB quieter than the finished MP4/);
});

// A built one-look video (stub look "a"), as in render.test.mjs.
const stub = (id) => ({ id, label: `Look ${id}`, fonts: [], primitives: Object.fromEntries(PRIMITIVES.map((n) => [n, () => `<div>${n}</div>`])), sfxFor: () => null, sfxGain: {}, sfxBank: {}, music: {}, decor: () => '', cssText: '', motionText: '' });
async function miniVideo(brand) {
  const dir = path.join(tmpDir('pack-video'), 'my-video');
  fs.cpSync(path.join(HERE, 'fixtures', 'mini-video'), dir, { recursive: true });
  if (brand) fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify(brand));
  fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'voice', 'words.json'), JSON.stringify(estimateWords(parseScript(fs.readFileSync(path.join(dir, 'script.md'), 'utf8')).words)));
  await build(dir, { looks: ['a'], resolveLook: async (id) => stub(id), audio: placeholderAudio });
  return dir;
}
const hash = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
const streams = (file) => probe(file).streams;

// Stands in for the HyperFrames render: 2 s of see-through ProRes (or H.264) with or without sound,
// and a note of which layer each render was asked for.
function fakeRender({ sound = true, failOn } = {}) {
  const layers = [];
  const render = async (cwd, out, extra = []) => {
    const layer = (/data-layer="(\w+)"/.exec(fs.readFileSync(path.join(cwd, 'index.html'), 'utf8')) || [])[1];
    layers.push(layer);
    if (layer === failOn) throw new Error(`render failed on ${layer}`);
    const mov = extra.includes('mov');
    const audio = sound ? ['-f', 'lavfi', '-i', 'sine=frequency=330:duration=2:sample_rate=48000'] : [];
    ffmpeg(['-f', 'lavfi', '-i', `color=c=black@0.0:s=108x192:d=2:r=30${mov ? ',format=rgba' : ''}`, ...audio,
      ...(mov ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le'] : ['-c:v', 'libx264', '-pix_fmt', 'yuv420p']),
      ...(sound ? ['-c:a', 'aac', '-shortest'] : []), out]);
  };
  return { render, layers };
}

const dir = await miniVideo();

test('exportEditPack writes the whole pack from a scratch copy and leaves the look alone', async () => {
  const before = hash(path.join(dir, 'looks/a/index.html'));
  const fake = fakeRender();
  const r = await exportEditPack(dir, { look: 'a', render: fake.render });
  assert.equal(r.dir, packDir(dir, 'a'));
  assert.match(r.dir, /renders\/my-video-a-edit-pack$/);
  assert.deepEqual(fs.readdirSync(r.dir).sort(), [...ALL_FILES].sort());
  assert.deepEqual(fake.layers, ['background', 'graphics', 'text', 'captions', 'watermark']);
  for (const f of r.files.filter((x) => /\.(mov|mp4)$/.test(x))) assert.equal(streams(f).filter((s) => s.codec_type === 'audio').length, 0, `${f} has sound`);
  assert.equal(hash(path.join(dir, 'looks/a/index.html')), before);
  const xml = fs.readFileSync(path.join(r.dir, 'premiere.xml'), 'utf8');
  assert.ok(xml.includes(fileUrl(path.join(r.dir, '3-text.mov')).replace(/&/g, '&amp;')), 'the timeline points at the pack itself');
  assert.doesNotMatch(xml, /\.partial/);
  const howto = fs.readFileSync(path.join(r.dir, 'HOW TO EDIT.txt'), 'utf8');
  assert.match(howto, /not yet tested in Premiere/);
  assert.match(howto, /^1\. One +0:00\.00 → /m);
  assert.ok(maxVolume(path.join(r.dir, '8-sfx.wav')) > -60, 'the graphics render\'s sound became the SFX stem');
});

test('exporting again replaces the pack\'s own files and keeps anything else saved in its folder', async () => {
  const d = packDir(dir, 'a');
  fs.writeFileSync(path.join(d, 'My edit.prproj'), 'project');
  fs.mkdirSync(path.join(d, 'Adobe Premiere Pro Auto-Save'));
  fs.writeFileSync(path.join(d, 'Adobe Premiere Pro Auto-Save', 'My edit-1.prproj'), 'autosave');
  fs.writeFileSync(path.join(d, 'scenes.txt'), 'stale');
  await exportEditPack(dir, { look: 'a', render: fakeRender().render });
  assert.equal(fs.readFileSync(path.join(d, 'My edit.prproj'), 'utf8'), 'project');
  assert.equal(fs.readFileSync(path.join(d, 'Adobe Premiere Pro Auto-Save', 'My edit-1.prproj'), 'utf8'), 'autosave');
  assert.notEqual(fs.readFileSync(path.join(d, 'scenes.txt'), 'utf8'), 'stale');
  assert.ok(!fs.readdirSync(path.join(dir, 'renders')).some((f) => /\.(partial|old)$/.test(f)));
});

test('a relative video folder still gives the timeline absolute file paths', async () => {
  const r = await exportEditPack(path.relative(process.cwd(), dir), { look: 'a', render: fakeRender().render });
  assert.ok(path.isAbsolute(r.dir), r.dir);
  const urls = [...fs.readFileSync(path.join(r.dir, 'premiere.xml'), 'utf8').matchAll(/<pathurl>([^<]*)<\/pathurl>/g)].map((m) => m[1]);
  assert.equal(urls.length, 8);
  for (const u of urls) assert.match(u, /^file:\/\/localhost\//);
});

test('a voice with Studio effects the pack cannot copy exports with a warning', async () => {
  const dir3 = await miniVideo();
  const index = path.join(dir3, 'looks', 'a', 'index.html');
  fs.writeFileSync(index, fs.readFileSync(index, 'utf8').replace(/<audio([^>]*\sid="vo")/, '<audio data-automation="{}"$1'));
  const r = await exportEditPack(dir3, { look: 'a', render: fakeRender().render });
  assert.ok(r.warnings.some((w) => /voice has Studio effects.*data-automation/.test(w)), r.warnings.join(' | '));
});

test('a failed export keeps the previous pack and leaves nothing behind', async () => {
  fs.writeFileSync(path.join(packDir(dir, 'a'), 'keep.txt'), 'old');
  const tmp = tmpDir('pack-test');
  await assert.rejects(() => exportEditPack(dir, { look: 'a', render: fakeRender({ failOn: 'text' }).render, tmp }), /text/);
  assert.equal(fs.readFileSync(path.join(packDir(dir, 'a'), 'keep.txt'), 'utf8'), 'old');
  assert.ok(!fs.readdirSync(path.join(dir, 'renders')).some((f) => f.endsWith('.partial')));
  assert.deepEqual(fs.readdirSync(tmp), [], 'scratch copy removed');
});

test('a video without sound effects or a handle still exports: silent sfx, no watermark layer', async () => {
  const dir2 = await miniVideo({});
  const fake = fakeRender({ sound: false });
  const r = await exportEditPack(dir2, { look: 'a', render: fake.render });
  assert.ok(!fake.layers.includes('watermark'));
  assert.ok(!r.files.some((f) => f.endsWith('5-watermark.mov')));
  const howto = fs.readFileSync(path.join(r.dir, 'HOW TO EDIT.txt'), 'utf8');
  assert.doesNotMatch(howto, /5-watermark/);
  assert.match(howto, /then 2–4 onto tracks above it/);
  assert.equal(maxVolume(path.join(r.dir, '8-sfx.wav')), -Infinity);
});

test('without a look it packs the pick, and refuses a look that is not built', async () => {
  setPick(dir, 'a');
  assert.equal((await exportEditPack(dir, { render: fakeRender().render })).look, 'a');
  await assert.rejects(() => exportEditPack(dir, { look: 'b', render: fakeRender().render }), /isn't built yet/);
});

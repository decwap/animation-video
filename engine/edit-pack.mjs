// The edit pack: a look taken apart for Premiere Pro and CapCut. Picture layers that stack back into
// the video, voice/music/sound-effect stems that add back to its sound, captions as an SRT, a scene
// list, a Premiere timeline (not yet tested in Premiere) and a how-to. Renders from a scratch copy,
// never the look's own folder, and replaces an earlier pack only once the new one is complete.
// It renders, so only run it on the person's go (asking for "edit pack" is that go).
//   node engine/edit-pack.mjs <videoDir> [--looks editorial] [--json]
// Part of animation-video (by Web Asamoah).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { paths } from './config.mjs';
import { readPick } from './pick.mjs';
import { slugOf, hyperframesRender } from './render.mjs';
import { readLook, srt, scenesText } from './pack-timeline.mjs';
import { LAYERS, layerHtml } from './pack-layers.mjs';
import { premiereXml } from './premiere-xml.mjs';
import { levelStems, STEM_FILES } from './audio/stems.mjs';

const MIN_FREE = 5e9;
// Everything the pack writes; anything else in its folder is the person's and survives a re-export.
const PACK_FILES = [...LAYERS.map((l) => l.file), 'captions.srt', ...STEM_FILES, 'premiere.xml', 'scenes.txt', 'HOW TO EDIT.txt'];

export const packDir = (videoDir, look) => path.join(paths(videoDir).renders, `${slugOf(videoDir)}-${look}-edit-pack`);

function ffmpeg(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').trim().split('\n').slice(-4).join(' ')}`);
}
const hasAudio = (file) => spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file], { encoding: 'utf8' }).stdout.trim() !== '';

// Moves what the person saved in the earlier pack (a Premiere project, its auto-saves) into the new
// one, or puts the earlier pack back when there is no new one.
function carryOver(old, dir) {
  if (!fs.existsSync(old)) return;
  if (!fs.existsSync(dir)) { fs.renameSync(old, dir); return; }
  for (const f of fs.readdirSync(old)) {
    if (!PACK_FILES.includes(f) && !fs.existsSync(path.join(dir, f))) fs.renameSync(path.join(old, f), path.join(dir, f));
  }
  fs.rmSync(old, { recursive: true, force: true });
}

// The root's <title> is "<video title> · <look label>".
function titles(html, slug) {
  const m = /<title>([\s\S]*?)<\/title>/.exec(html);
  const parts = (m ? m[1] : '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').split(' · ');
  return { title: parts.length > 1 ? parts.slice(0, -1).join(' · ') : slug, label: parts.length > 1 ? parts.at(-1) : '' };
}

// sound: the stems' { lufs, tp } as levelStems measured them together.
export function howToText({ title, look, scenes, files, sound = { lufs: -14, tp: -2 } }) {
  const has = (f) => files.includes(f);
  const top = has('5-watermark.mov') ? 5 : 4;
  const rows = [
    ['1-background.mp4', 'the backdrop'],
    ['2-graphics.mov', 'cards, windows, icons, mascot (see-through)'],
    ['3-text.mov', 'headlines, labels, big numbers (see-through)'],
    ['4-captions.mov', 'the styled captions (see-through)'],
    ['5-watermark.mov', 'your handle (see-through)'],
    ['captions.srt', 'the same captions as editable text'],
  ].filter(([f]) => has(f)).map(([f, what]) => `${f.padEnd(18)}${what}`);
  return `How to edit "${title}"${look ? ` (${look})` : ''} in Premiere Pro or CapCut
Made by animation-video (by Web Asamoah).

THE FILES (stack them in this order, bottom to top)
${rows.join('\n')}
6-voice.wav  7-music.wav  8-sfx.wav   play all three at 0 dB to get the finished sound

PREMIERE PRO (not yet tested in Premiere; tell Web Asamoah if it doesn't open right)
1. File > Import > premiere.xml. A sequence opens with every layer stacked and cut into scenes.
2. If Premiere asks where the files are, point it at this folder.
3. For editable captions: File > Import > captions.srt, drag it onto the timeline, then hide 4-captions.mov.

CAPCUT (tested in CapCut 9.6)
1. New project > Import, and select the video and sound files.
2. Click empty space in the media panel first: a multi-selection drags every selected file together.
3. Drag 1-background.mp4 onto the main track, then 2–${top} onto tracks above it, one at a time, at 0:00.
4. Drag the three WAVs onto audio tracks at 0:00.
5. For editable captions: Text > Local captions > Import file > captions.srt, drag it onto the timeline,
   style it with "Apply to all", and hide 4-captions.mov.
6. To work per scene: select all clips and split (Cmd+B / Ctrl+B) at each time below.

SCENES
${scenesText(scenes)}
GOOD TO KNOW
- The text layer is a picture, not live type. To change words and keep the animation, ask Claude to
  change them and export the edit pack again.
- All text sits above all graphics, so the stacked layers can look slightly different from the
  finished MP4 during each short scene change (about 0.35 s), in whole-scene fades, and where a
  graphic sits over text.
${sound.lufs < -14.5 ? `- The three sounds play about ${Math.round(-14 - sound.lufs)} dB quieter than the finished MP4, so that no file clips.
  Raise all three by the same amount if you need the MP4's level.
` : ''}${sound.tp > -1.5 ? `- Played together, the three sounds may sit a little louder than the MP4 at their loudest moments
  (the MP4 has a limiter). Turn on a limiter or loudness normalisation when you export.
` : ''}- Exporting again replaces the files above and keeps anything else you save in this folder
  (a Premiere project, for example).
`;
}

export async function exportEditPack(videoDir, { look, render = hyperframesRender, tmp = os.tmpdir() } = {}) {
  const t0 = Date.now();
  videoDir = path.resolve(videoDir);
  look = look || readPick(videoDir);
  if (!look) throw new Error('no pick yet: pick a look first, or name one with --looks');
  const lookDir = path.join(paths(videoDir).looksDir, look);
  if (!fs.existsSync(path.join(lookDir, 'index.html'))) throw new Error(`${look} isn't built yet: build it first`);
  const info = readLook(lookDir);
  const original = fs.readFileSync(path.join(lookDir, 'index.html'), 'utf8');
  const { title, label } = titles(original, slugOf(videoDir));
  const dir = packDir(videoDir, look);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const old = `${dir}.old`;
  carryOver(old, dir);
  const warnings = [];
  for (const [name, a] of [['voice', info.voice], ['music', info.music]]) {
    if (a?.effects.length) warnings.push(`the ${name} has Studio effects the edit pack can't copy (${a.effects.join(', ')}); its stem plays without them`);
  }
  const free = (() => { try { const s = fs.statfsSync(path.dirname(dir)); return s.bavail * s.bsize; } catch { return Infinity; } })();
  if (free < MIN_FREE) warnings.push(`only ${(free / 1e9).toFixed(1)} GB free; a pack needs about 1 GB`);

  const scratch = fs.mkdtempSync(path.join(tmp, 'av-pack-'));
  const project = path.join(scratch, 'project');
  const partial = `${dir}.partial`;
  try {
    fs.cpSync(lookDir, project, { recursive: true, filter: (src) => !/[\\/]\.hyperframes$/.test(src) });
    fs.rmSync(partial, { recursive: true, force: true });
    fs.mkdirSync(partial);
    const layers = LAYERS.filter((l) => l.id !== 'watermark' || info.watermark);
    let sfx = null;
    for (const layer of layers) {
      fs.writeFileSync(path.join(project, 'index.html'), layerHtml(original, layer.id));
      const raw = path.join(scratch, `${layer.id}.${layer.format}`);
      await render(project, raw, layer.format === 'mov' ? ['--format', 'mov'] : []);
      ffmpeg(['-i', raw, '-map', '0:v:0', '-c:v', 'copy', '-an', ...(layer.format === 'mp4' ? ['-movflags', '+faststart'] : []), path.join(partial, layer.file)]);
      if (layer.id === 'graphics' && hasAudio(raw)) {
        sfx = path.join(scratch, 'sfx.wav');
        ffmpeg(['-i', raw, '-map', '0:a:0', '-vn', '-c:a', 'pcm_f32le', sfx]);
      }
      fs.rmSync(raw, { force: true });
    }
    const sound = levelStems({ voice: info.voice, music: info.music, sfx, duration: info.duration, outDir: partial });
    const files = PACK_FILES.filter((f) => f !== '5-watermark.mov' || layers.some((l) => l.file === f));
    fs.writeFileSync(path.join(partial, 'captions.srt'), srt(info.captions));
    fs.writeFileSync(path.join(partial, 'scenes.txt'), scenesText(info.scenes));
    fs.writeFileSync(path.join(partial, 'premiere.xml'), premiereXml({
      name: title, duration: info.duration, scenes: info.scenes,
      video: layers.map((l) => ({ name: l.file, file: path.join(dir, l.file) })),
      audio: STEM_FILES.map((f) => ({ name: f, file: path.join(dir, f) })),
    }));
    fs.writeFileSync(path.join(partial, 'HOW TO EDIT.txt'), howToText({ title, look: label, scenes: info.scenes, files, sound }));
    if (fs.existsSync(dir)) fs.renameSync(dir, old);
    try { fs.renameSync(partial, dir); } catch (e) { carryOver(old, dir); throw e; }
    carryOver(old, dir);
    return { look, dir, files: files.map((f) => path.join(dir, f)), gainDb: sound.gainDb, lufs: sound.lufs, seconds: +((Date.now() - t0) / 1000).toFixed(1), warnings };
  } catch (e) {
    fs.rmSync(partial, { recursive: true, force: true });
    throw e;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const usage = 'usage: node engine/edit-pack.mjs <videoDir> [--looks editorial] [--json]';
  let o, positionals;
  try {
    ({ values: o, positionals } = parseArgs({ allowPositionals: true, options: { looks: { type: 'string' }, json: { type: 'boolean' } } }));
  } catch (e) { console.error(`${e.message}\n${usage}`); process.exit(1); }
  if (!positionals[0]) { console.error(usage); process.exit(1); }
  try {
    const looks = o.looks ? o.looks.split(',').map((x) => x.trim()).filter(Boolean) : [undefined];
    const packed = [];
    for (const look of looks) {
      const r = await exportEditPack(positionals[0], { look });
      packed.push(r);
      if (!o.json) {
        for (const w of r.warnings) console.error(`warning: ${w}`);
        console.log(`edit pack for ${r.look}: ${r.dir} (${r.files.length} files, ${r.seconds} s)`);
      }
    }
    if (o.json) console.log(JSON.stringify({ packed }));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

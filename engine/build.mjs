// Build one video folder into one HyperFrames project per look, plus the Look Picker.
//   node engine/build.mjs <videoDir> [--looks paper,glow] [--force] [--draft] [--silent] [--kit]
// --draft  times scenes from the script at a steady pace when there is no voice yet.
// --force  rebuilds a look that was picked (.av-master) or edited since its build; the old project
//          is kept as looks/<look>.bak-<n>/.
// --kit    only refreshes each look's kit files (assets/kit), leaving compositions and audio alone.
// --all    every look at once, as the Look Picker's Build all looks button does: picked or edited
//          looks only take kit fixes, the rest are rebuilt (draft timing until there is a voice).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { HF_PIN, KIT_DIR, LOOKS, SFX_LENGTH, VOICE_LUFS, MUSIC_UNDER_VOICE, paths } from './config.mjs';
import { parseScript } from './script.mjs';
import { estimateWords } from './words.mjs';
import { planTimeline } from './timeline.mjs';
import { groupCaptions, captionsHtml } from './captions.mjs';
import { compileScene } from './compile-scene.mjs';
import { rootHtml, decorHtml } from './root.mjs';
import { pickerHtml } from './picker.mjs';
import { loadLook } from './looks.mjs';
import { readPick } from './pick.mjs';
import { writeSilentWav, wavDuration } from './audio/wav.mjs';
import { writeSfxBank } from './audio/bank.mjs';
import { writeMusic } from './audio/music.mjs';
import { measureLoudness } from './audio/loudness.mjs';

export class MasterLockedError extends Error {
  constructor(dir, edited = []) {
    const why = edited.length ? `was edited since it was built (${edited.slice(0, 6).join(', ')}${edited.length > 6 ? ', …' : ''})` : 'was picked (.av-master)';
    super(`${dir} ${why}, so it may hold Studio edits. To take kit fixes without touching them, build with --kit; to rebuild it anyway, use --force (the current project is kept as ${dir}.bak-<n>).`);
    this.name = 'MasterLockedError';
    this.edited = edited;
  }
}

const RESERVED = new Set(['main', 'decor', 'captions', 'watermark', 'vo', 'music']);
const CORE_FILES = ['table.js', 'refs.js', 'av.js', 'broll.js', 'base.css'];
const MANIFEST = '.av-build.json';
const r3 = (t) => +t.toFixed(3);

// The voice as recorded (engine/voice.mjs levels it to -16 LUFS), silence until there is one.
async function copyVoice({ videoDir, out, duration }) {
  const src = path.join(videoDir, 'voice', 'vo.wav');
  if (fs.existsSync(src)) { fs.copyFileSync(src, out); return wavDuration(out); }
  writeSilentWav(out, duration);
  return duration;
}

// Default audio: the voice, the look's music bed 8.5 LU under it, and the look's sound bank.
export const lookAudio = {
  voice: copyVoice,
  async music({ look, out, duration, hits, speech, vo }) {
    const voice = vo && fs.existsSync(vo) ? measureLoudness(vo).lufs : -70;
    writeMusic(out, { preset: look.music, duration, hits, speech, lufs: (voice > -60 ? voice : VOICE_LUFS) - MUSIC_UNDER_VOICE });
  },
  async sfx({ look, dir, names }) { writeSfxBank(look, dir, names); },
};

// Silence of the right length everywhere but the voice: for fast visual iterations (--silent).
export const placeholderAudio = {
  voice: copyVoice,
  async music({ out, duration }) { writeSilentWav(out, duration); },
  async sfx({ dir, names }) { for (const n of names) writeSilentWav(path.join(dir, `${n}.wav`), SFX_LENGTH[n] ?? 1); },
};

function readJson(file, fallback) {
  if (!fs.existsSync(file)) { if (fallback !== undefined) return fallback; throw new Error(`missing ${file}`); }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function loadWords(p, script, draftTiming, warnings) {
  if (!fs.existsSync(p.words)) {
    if (!draftTiming) throw new Error('no voice/words.json yet: make the voice (engine/voice.mjs), or build with --draft for estimated timing');
    warnings.push('draft timing: scenes are timed from the script at 150 words a minute, not from a voice');
    return estimateWords(script.words);
  }
  const words = readJson(p.words);
  const same = words.length === script.words.length && words.every((w, i) => w.norm === script.words[i].norm);
  if (!same) throw new Error('the script changed since the voice was made: re-run engine/voice.mjs (or delete voice/words.json and build with --draft)');
  // Times from the voice; spelling, case and punctuation from the script as it is now.
  return words.map((w, i) => ({ ...w, text: script.words[i].text, emph: script.words[i].emph, line: script.words[i].line }));
}

// Files a build wrote, relative to the look; dot-entries (.av-master, .hyperframes, .DS_Store) aren't ours.
function listFiles(dir, rel = '') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.')) return [];
    const r = rel ? `${rel}/${e.name}` : e.name;
    return e.isDirectory() ? listFiles(path.join(dir, e.name), r) : [r];
  });
}
const sha1 = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
const writeManifest = (dir, files) => fs.writeFileSync(path.join(dir, MANIFEST), `${JSON.stringify({ files }, null, 1)}\n`);
const readManifest = (dir) => (fs.existsSync(path.join(dir, MANIFEST)) ? JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), 'utf8')).files : null);

// Files changed, added or removed since the last build (Studio edits); [] when there is no record.
export function editedFiles(dir) {
  const files = readManifest(dir);
  if (!files) return [];
  const now = listFiles(dir);
  const changed = now.filter((f) => files[f] !== sha1(path.join(dir, f)));
  return [...new Set([...changed, ...Object.keys(files).filter((f) => !now.includes(f))])].sort();
}

// Make room for a fresh build of a look: a picked or edited project moves to <dir>.bak-<n>
// (its master marker comes back), anything else is emptied.
function clearProject(dir, keep) {
  if (!fs.existsSync(dir)) return null;
  if (keep) {
    let n = 1;
    while (fs.existsSync(`${dir}.bak-${n}`)) n++;
    fs.renameSync(dir, `${dir}.bak-${n}`);
    fs.mkdirSync(dir);
    if (fs.existsSync(path.join(`${dir}.bak-${n}`, '.av-master'))) fs.copyFileSync(path.join(`${dir}.bak-${n}`, '.av-master'), path.join(dir, '.av-master'));
    return `${dir}.bak-${n}`;
  }
  for (const entry of fs.readdirSync(dir)) if (entry !== '.av-master') fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  return null;
}

// The kit files a look's project carries (everything under assets/kit but av-data.js).
async function writeKit(dir, look) {
  fs.mkdirSync(path.join(dir, 'assets', 'kit', 'fonts'), { recursive: true });
  for (const f of CORE_FILES) fs.copyFileSync(path.join(KIT_DIR, 'core', f), path.join(dir, 'assets', 'kit', f));
  fs.cpSync(path.join(KIT_DIR, 'fonts'), path.join(dir, 'assets', 'kit', 'fonts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'kit', 'look.css'), look.cssText ?? fs.readFileSync(path.join(look.dir, 'look.css'), 'utf8'));
  fs.writeFileSync(path.join(dir, 'assets', 'kit', 'motion.js'), look.motionText ?? fs.readFileSync(path.join(look.dir, 'motion.js'), 'utf8'));
}

// Refresh only the kit in built looks (picked or not): bug fixes reach a master without touching
// its compositions, audio or Studio edits.
export async function refreshKit(videoDir, { looks = LOOKS, resolveLook = loadLook } = {}) {
  const done = [];
  for (const id of looks) {
    const dir = path.join(paths(videoDir).looksDir, id);
    if (!fs.existsSync(path.join(dir, 'index.html'))) continue;
    await writeKit(dir, await resolveLook(id));
    const files = readManifest(dir);
    if (files) {
      for (const f of listFiles(path.join(dir, 'assets', 'kit')).map((k) => `assets/kit/${k}`)) if (f !== 'assets/kit/av-data.js') files[f] = sha1(path.join(dir, f));
      writeManifest(dir, files);
    }
    done.push(id);
  }
  return { looks: done };
}

// Every look at once (the picker's Build all looks button, the --all flag): a look that was picked
// or edited keeps its project and only takes kit fixes; the others are rebuilt.
export async function buildAll(videoDir, { looks = LOOKS, resolveLook = loadLook, audio, draftTiming } = {}) {
  const p = paths(videoDir);
  const kept = looks.filter((id) => fs.existsSync(path.join(p.looksDir, id, '.av-master')) || editedFiles(path.join(p.looksDir, id)).length > 0);
  const free = looks.filter((id) => !kept.includes(id));
  const draft = draftTiming ?? !fs.existsSync(p.words);
  const r = free.length ? await build(videoDir, { looks: free, resolveLook, audio, draftTiming: draft }) : { warnings: [], duration: null };
  const kit = kept.length ? await refreshKit(videoDir, { looks: kept, resolveLook }) : { looks: [] };
  return { built: free, kept: kit.looks, warnings: r.warnings, duration: r.duration };
}

// Every look in the folder that has a built project, in the usual order.
async function builtLooks(looksDir, resolveLook) {
  if (!fs.existsSync(looksDir)) return [];
  const ids = fs.readdirSync(looksDir).filter((d) => !d.includes('.bak-') && fs.existsSync(path.join(looksDir, d, 'index.html')));
  ids.sort((a, b) => ((LOOKS.indexOf(a) + 1 || 99) - (LOOKS.indexOf(b) + 1 || 99)) || a.localeCompare(b));
  const pick = readPick(path.dirname(looksDir), ids);
  const out = [];
  for (const id of ids) {
    let label = id;
    try { label = (await resolveLook(id)).label || id; } catch { /* a look this skill no longer has */ }
    const dir = path.join(looksDir, id);
    const locked = fs.existsSync(path.join(dir, '.av-master')) || editedFiles(dir).length > 0;
    out.push({ id, label, builtAt: fs.statSync(path.join(dir, 'index.html')).mtime.toISOString(), picked: id === pick, locked });
  }
  return out;
}

// (Re)write the Look Picker from what is built now (after a build, or when the pick changes).
export async function writePicker(videoDir, { resolveLook = loadLook, title, duration } = {}) {
  const p = paths(videoDir);
  const storyboard = readJson(p.storyboard, {});
  const looks = await builtLooks(p.looksDir, resolveLook);
  if (duration === undefined) {
    try {
      const js = fs.readFileSync(path.join(p.looksDir, looks[0].id, 'assets', 'kit', 'av-data.js'), 'utf8');
      duration = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1)).duration;
    } catch { duration = 0; }
  }
  if (title === undefined) title = storyboard.title || (fs.existsSync(p.script) ? parseScript(fs.readFileSync(p.script, 'utf8')).title : '') || 'Animation video';
  const slug = (storyboard.slug || path.basename(path.resolve(videoDir))).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  fs.writeFileSync(p.picker, pickerHtml({ title, duration, looks, slug }));
}

export async function build(videoDir, opts = {}) {
  const { looks = LOOKS, force = false, draftTiming = false, resolveLook = loadLook } = opts;
  const audio = { ...lookAudio, ...(opts.audio || {}) };
  const p = paths(videoDir);
  const warnings = [];
  const script = parseScript(fs.readFileSync(p.script, 'utf8'));
  const storyboard = readJson(p.storyboard);
  const brand = readJson(p.brand, {});
  if (brand.accent !== undefined && !/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(brand.accent)) throw new Error(`brand.json accent "${brand.accent}" must be a hex colour like #C32126`);
  const words = loadWords(p, script, draftTiming, warnings);

  for (const sc of storyboard.scenes || []) {
    if (!/^[a-z][a-z0-9-]*$/.test(sc.id) || RESERVED.has(sc.id)) throw new Error(`scene id "${sc.id}" must be lowercase letters, digits and dashes, and not one of ${[...RESERVED].join(', ')}`);
    if (!fs.existsSync(path.join(videoDir, sc.src))) throw new Error(`scene file ${sc.src} is missing`);
  }
  const plan = planTimeline(storyboard, words);
  warnings.push(...plan.warnings);
  const caps = captionsHtml(groupCaptions(words), { duration: plan.duration });

  const locks = {};
  for (const id of looks) {
    const dir = path.join(p.looksDir, id);
    const edited = editedFiles(dir);
    locks[id] = fs.existsSync(path.join(dir, '.av-master')) || edited.length > 0;
    if (locks[id] && !force) throw new MasterLockedError(path.relative(videoDir, dir) || dir, edited);
  }

  const data = {
    duration: plan.duration,
    words: words.map(({ i, text, norm, emph, line, t0, t1 }) => ({ i, text, norm, emph, line, t0, t1 })),
    scenes: Object.fromEntries(plan.scenes.map((s) => [s.id, { start: s.start, end: s.end, wordRange: s.wordRange }])),
    brand,
  };
  const speech = words.map((w) => [w.t0, w.t1]);
  const projects = {};
  const backups = [];

  // Compile every scene for every look first, so a bad scene leaves all built looks as they were.
  const prepared = [];
  for (const id of looks) {
    const look = await resolveLook(id);
    const scenes = plan.scenes.map((scene, k) => ({ scene, ...compileScene(fs.readFileSync(path.join(videoDir, scene.src), 'utf8'), { scene, look, words, brand, trackBase: k % 2 ? 13 : 9, last: k === plan.scenes.length - 1 }) }));
    prepared.push({ id, look, scenes });
  }

  for (const { id, look, scenes } of prepared) {
    const dir = path.join(p.looksDir, id);
    const backup = clearProject(dir, locks[id]);
    if (backup) backups.push(backup);
    for (const sub of ['compositions', 'assets/kit/fonts', 'assets/audio', 'assets/sfx', 'assets/media']) fs.mkdirSync(path.join(dir, sub), { recursive: true });

    const cues = [];
    for (const { scene, html, cues: c, warnings: w } of scenes) {
      fs.writeFileSync(path.join(dir, 'compositions', `${scene.id}.html`), html);
      cues.push(...c);
      warnings.push(...w.map((x) => `${id}: ${x}`));
    }
    fs.writeFileSync(path.join(dir, 'compositions', 'captions.html'), caps);
    fs.writeFileSync(path.join(dir, 'compositions', 'decor.html'), decorHtml({ look, brand, duration: plan.duration }));

    await writeKit(dir, look);
    fs.writeFileSync(path.join(dir, 'assets', 'kit', 'av-data.js'), `window.AV_DATA = ${JSON.stringify({ look: id, ...data })};\n`);
    if (fs.existsSync(p.assetsDir)) fs.cpSync(p.assetsDir, path.join(dir, 'assets', 'media'), { recursive: true });

    const vo = path.join(dir, 'assets', 'audio', 'vo.wav');
    const voDuration = await audio.voice({ videoDir, out: vo, duration: r3(words.at(-1).t1 + 0.3) });
    await audio.music({ look, out: path.join(dir, 'assets', 'audio', 'music.wav'), duration: plan.duration, hits: plan.scenes.map((s) => s.start), speech, vo });
    await audio.sfx({ look, dir: path.join(dir, 'assets', 'sfx'), names: [...new Set([...Object.keys(look.sfxBank || {}), ...cues.map((c) => c.sfx)])] });

    fs.writeFileSync(path.join(dir, 'index.html'), rootHtml({ look, plan, brand, durations: { vo: voDuration }, title: storyboard.title || script.title }));
    const hf = `npx --yes hyperframes@${HF_PIN}`;
    fs.writeFileSync(path.join(dir, 'package.json'), `${JSON.stringify({
      name: `${(storyboard.slug || path.basename(path.resolve(videoDir))).toLowerCase().replace(/[^a-z0-9-]+/g, '-')}-${id}`,
      private: true,
      type: 'module',
      scripts: { dev: `${hf} preview`, check: `${hf} check`, render: `${hf} render` },
    }, null, 2)}\n`);
    writeManifest(dir, Object.fromEntries(listFiles(dir).map((f) => [f, sha1(path.join(dir, f))])));
    projects[id] = dir;
  }
  for (const b of backups) warnings.push(`kept the previous project as ${path.relative(videoDir, b)}`);

  await writePicker(videoDir, { resolveLook, title: storyboard.title || script.title || 'Animation video', duration: plan.duration });
  return { projects, duration: plan.duration, warnings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const usage = 'usage: node engine/build.mjs <videoDir> [--looks paper,glow] [--force] [--draft] [--silent] [--kit] [--all]';
  let o, positionals;
  try {
    ({ values: o, positionals } = parseArgs({ allowPositionals: true, options: { looks: { type: 'string' }, force: { type: 'boolean' }, draft: { type: 'boolean' }, silent: { type: 'boolean' }, kit: { type: 'boolean' }, all: { type: 'boolean' } } }));
  } catch (e) { console.error(`${e.message}\n${usage}`); process.exit(1); }
  if (!positionals[0]) { console.error(usage); process.exit(1); }
  const looks = o.looks?.split(',').map((x) => x.trim()).filter(Boolean);
  if (o.all) {
    try {
      const r = await buildAll(positionals[0], { looks, audio: o.silent ? placeholderAudio : undefined, draftTiming: o.draft || undefined });
      console.log(`built ${r.built.length} look(s)${r.built.length ? `: ${r.built.join(', ')}` : ''}${r.kept.length ? `; kept ${r.kept.join(', ')} (picked or edited) and refreshed its kit` : ''}`);
      for (const w of r.warnings) console.log(`  ! ${w}`);
      process.exit(0);
    } catch (e) { console.error(e.message); process.exit(1); }
  }
  if (o.kit) {
    const r = await refreshKit(positionals[0], { looks });
    console.log(`refreshed the kit in ${r.looks.length} look(s): ${r.looks.join(', ') || 'none built'}`);
    process.exit(0);
  }
  try {
    const r = await build(positionals[0], { looks, force: o.force, draftTiming: o.draft, audio: o.silent ? placeholderAudio : undefined });
    console.log(`built ${Object.keys(r.projects).length} look(s), ${r.duration.toFixed(2)} s`);
    for (const [look, d] of Object.entries(r.projects)) console.log(`  ${look}: ${d}`);
    for (const w of r.warnings) console.log(`  ! ${w}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

// Render a look to a finished video: HyperFrames render at delivery quality, the -14 LUFS master,
// and a cover still from the end of the hook. Writes renders/<slug>-<look>.mp4 and -cover.jpg.
// Only run it on the person's go (the Look Picker's Render buttons are that go).
//   node engine/render.mjs <videoDir> [--looks doodle,glow] [--json]
// Part of animation-video (by Web Asamoah).
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { HF, LOOKS, paths } from './config.mjs';
import { masterVideo } from './audio/master.mjs';

export function slugOf(videoDir) {
  const p = paths(videoDir);
  let slug;
  try { slug = JSON.parse(fs.readFileSync(p.storyboard, 'utf8')).slug; } catch { /* no storyboard slug */ }
  return (slug || path.basename(path.resolve(videoDir))).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

export const renderFile = (videoDir, look) => path.join(paths(videoDir).renders, `${slugOf(videoDir)}-${look}.mp4`);

// The HyperFrames CLI, run without blocking (a long render must not freeze the picker server).
function hyperframesRender(cwd, out) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', [...HF, 'render', '--quality', 'delivery', '-o', out], { cwd });
    let log = '';
    child.stdout.on('data', (d) => { log = (log + d).slice(-4000); });
    child.stderr.on('data', (d) => { log = (log + d).slice(-4000); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`render failed: ${log.trim().split('\n').slice(-3).join(' ')}`))));
  });
}

// When the hook is fully on screen: just before the first scene ends.
function coverTime(lookDir) {
  try {
    const js = fs.readFileSync(path.join(lookDir, 'assets', 'kit', 'av-data.js'), 'utf8');
    const data = JSON.parse(js.slice(js.indexOf('{'), js.lastIndexOf('}') + 1));
    const first = Object.values(data.scenes || {})[0];
    if (first) return Math.max(0.5, Math.min(first.end - 0.6, data.duration / 2));
  } catch { /* fall back */ }
  return 1.5;
}

export async function renderLook(videoDir, look, { render = hyperframesRender } = {}) {
  const lookDir = path.join(paths(videoDir).looksDir, look);
  if (!fs.existsSync(path.join(lookDir, 'index.html'))) throw new Error(`${look} isn't built yet: build it first`);
  const file = renderFile(videoDir, look);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = file.replace(/\.mp4$/, '.raw.mp4');
  const t0 = Date.now();
  await render(lookDir, raw);
  const m = masterVideo(raw, file);
  fs.rmSync(raw, { force: true });
  const cover = file.replace(/\.mp4$/, '-cover.jpg');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(coverTime(lookDir)), '-i', file, '-frames:v', '1', '-q:v', '2', cover]);
  return { look, file, cover, lufs: +m.lufs.toFixed(1), tp: +m.tp.toFixed(1), seconds: +((Date.now() - t0) / 1000).toFixed(1) };
}

export async function renderLooks(videoDir, { looks = LOOKS, render } = {}) {
  const rendered = [];
  for (const look of looks) if (fs.existsSync(path.join(paths(videoDir).looksDir, look, 'index.html'))) rendered.push(await renderLook(videoDir, look, { render }));
  return { rendered };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const usage = 'usage: node engine/render.mjs <videoDir> [--looks doodle,glow] [--json]';
  let o, positionals;
  try {
    ({ values: o, positionals } = parseArgs({ allowPositionals: true, options: { looks: { type: 'string' }, json: { type: 'boolean' } } }));
  } catch (e) { console.error(`${e.message}\n${usage}`); process.exit(1); }
  if (!positionals[0]) { console.error(usage); process.exit(1); }
  try {
    const r = await renderLooks(positionals[0], { looks: o.looks?.split(',').map((x) => x.trim()).filter(Boolean) });
    if (o.json) console.log(JSON.stringify(r));
    else for (const x of r.rendered) console.log(`rendered ${x.look}: ${x.file} (${x.lufs} LUFS, true peak ${x.tp} dBTP, ${x.seconds} s)`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

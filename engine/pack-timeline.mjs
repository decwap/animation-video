// Reads a built look's own project (so Studio edits count): its length, its scenes cut end to end,
// its captions, its voice and music and its watermark. Also writes them out as an SRT and a scene
// list for the edit pack. Part of animation-video (by Web Asamoah).
import fs from 'node:fs';
import path from 'node:path';
import { FPS } from './config.mjs';

const attr = (tag, name) => (new RegExp(`\\s${name}="([^"]*)"`).exec(tag) || [])[1];
// Named entities the engine and Studio write, plus any numeric one (&#39;, &#8217;, &#x2014;).
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
  const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1);
  return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
});
const plain = (html) => decode(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
const r3 = (t) => +t.toFixed(3);

// "no-stock" → "No stock"; short forms stay capitals ("cta" → "CTA", "ai-tools" → "AI tools").
const SHORT_FORMS = new Set(['ai', 'api', 'cta', 'faq', 'roi', 'seo', 'tv', 'ui', 'ux']);
export function sceneName(id) {
  const words = id.split('-').map((w) => (SHORT_FORMS.has(w) ? w.toUpperCase() : w));
  const name = words.join(' ');
  return name[0].toUpperCase() + name.slice(1);
}

// Studio audio edits the stems can't copy: they get a warning instead.
const AUDIO_EFFECTS = ['data-fx-chain', 'data-automation', 'data-fx-carve', 'data-playback-rate'];

// Scenes overlap for their transitions; here each one runs until the next starts, so they tile the
// video and cutting at every start keeps all layers in step.
export function readLook(lookDir) {
  const index = path.join(lookDir, 'index.html');
  if (!fs.existsSync(index)) throw new Error(`${lookDir} isn't a built look (no index.html)`);
  const html = fs.readFileSync(index, 'utf8');
  const duration = +attr(/<div[^>]*data-composition-id="main"[^>]*>/.exec(html)[0], 'data-duration');
  const hosts = [...html.matchAll(/<div[^>]*\sid="scene-([^"]+)"[^>]*>/g)]
    .map((m) => ({ id: m[1], start: +attr(m[0], 'data-start') }))
    .sort((a, b) => a.start - b.start);
  const scenes = hosts.map((s, k) => ({ id: s.id, name: sceneName(s.id), start: k ? s.start : 0, end: k + 1 < hosts.length ? hosts[k + 1].start : duration }));
  // where Studio placed the clip (data-start), its trim (data-duration) and its source offset
  const audio = (id) => {
    const m = new RegExp(`<audio[^>]*\\sid="${id}"[^>]*>`).exec(html);
    if (!m) return null;
    const num = (name, missing) => { const v = attr(m[0], name); return v === undefined || v === '' ? missing : +v; };
    return {
      file: path.join(lookDir, attr(m[0], 'src')), volume: num('data-volume', 1),
      start: num('data-start', 0), duration: num('data-duration', null), mediaStart: num('data-media-start', 0),
      effects: AUDIO_EFFECTS.filter((a) => attr(m[0], a) !== undefined),
    };
  };
  const capsFile = path.join(lookDir, 'compositions', 'captions.html');
  const caps = fs.existsSync(capsFile) ? fs.readFileSync(capsFile, 'utf8') : '';
  const captions = [...caps.matchAll(/(<div[^>]*class="av-cap"[^>]*>)([\s\S]*?)<\/div>/g)].map((m) => {
    const t0 = +attr(m[1], 'data-t');
    return { t0, t1: r3(t0 + +attr(m[1], 'data-dur')), text: plain(m[2]) };
  });
  const wm = /<div[^>]*\sid="watermark"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  return { duration, scenes, captions, voice: audio('vo'), music: audio('music'), watermark: wm ? plain(wm[1]) : '' };
}

export function timecode(t, fps = FPS) {
  const f = Math.round(t * fps);
  const two = (n) => String(n).padStart(2, '0');
  return `${two(Math.floor(f / (3600 * fps)))}:${two(Math.floor(f / (60 * fps)) % 60)}:${two(Math.floor(f / fps) % 60)}:${two(f % fps)}`;
}

const srtTime = (t) => {
  const ms = Math.round(t * 1000);
  const two = (n) => String(n).padStart(2, '0');
  return `${two(Math.floor(ms / 3600000))}:${two(Math.floor(ms / 60000) % 60)}:${two(Math.floor(ms / 1000) % 60)},${String(ms % 1000).padStart(3, '0')}`;
};

// A caption ends where the next one begins: the look's captions may overlap by a few ms, and editors
// put an overlapping cue on a second caption track.
export const srt = (captions) => captions.map((c, k) => {
  const end = k + 1 < captions.length ? Math.min(c.t1, captions[k + 1].t0) : c.t1;
  return `${k + 1}\n${srtTime(c.t0)} --> ${srtTime(end)}\n${c.text}\n\n`;
}).join('');

const clock = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;

export function scenesText(scenes, fps = FPS) {
  const width = Math.max(...scenes.map((s, k) => `${k + 1}. ${s.name}`.length)) + 2;
  return scenes.map((s, k) => `${`${k + 1}. ${s.name}`.padEnd(width)}${clock(s.start)} → ${clock(s.end)}   (${timecode(s.start, fps)} → ${timecode(s.end, fps)})`).join('\n') + '\n';
}

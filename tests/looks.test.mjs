import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRIMITIVES } from '../engine/table.mjs';
import { loadLook } from '../engine/looks.mjs';
import { icon } from '../engine/compile-scene.mjs';

// Add each look here as it is built.
const LOOKS = ['paper', 'glow', 'doodle', 'editorial'];

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fontsCss = fs.readFileSync(path.join(ROOT, 'kit', 'fonts', 'fonts.css'), 'utf8');
const helpers = { esc: (s) => String(s), icon, split: (s) => String(s ?? '').split('|').map((x) => x.trim()).filter(Boolean), brand: { handle: '@x' }, look: 'x' };
const SAMPLE = {
  kicker: [{}, 'Did you know?'], headline: [{}, 'Claude can turn any <em>script</em> into an <mark>explainer</mark>.'],
  mark: [{}, 'marked'], chip: [{ icon: 'sparkles' }, '1 script → 4 looks'], note: [{}, 'obviously.'], stamp: [{}, 'NEW'],
  counter: [{ to: '5942', label: 'US stocks' }, ''], doc: [{ title: 'script.txt', lines: '6', hl: '2' }, ''],
  video: [{ label: 'explainer.mp4', title: 'Fresh coffee' }, ''], phone: [{}, '<p>screen</p>'], window: [{ title: 'Claude' }, '<p>app</p>'],
  chat: [{ messages: 'user: Make a reel|ai: Writing reel.html' }, ''], terminal: [{ lines: '$ claude|> make a reel' }, ''],
  image: [{ src: 'assets/media/x.jpg', caption: 'A photo' }, ''], chart: [{ type: 'line', values: '3,5,4,8,12', labels: 'M,T,W,T,F' }, ''],
  arrow: [{ dir: 'right' }, ''], track: [{ clips: 'Hook:3|Steps:4|CTA:2' }, ''], progress: [{ step: '2', total: '7' }, ''],
  icon: [{ name: 'rocket' }, ''], item: [{ icon: 'check', title: 'Scans charts', text: 'Thousands at once' }, ''],
  split: [{ 'a-title': 'Before', 'a-text': 'Hours of editing', 'b-title': 'After', 'b-text': 'One prompt' }, ''],
  mascot: [{ pose: 'hop' }, ''], broll: [{ name: 'city' }, ''], cta: [{ keyword: 'ANIMATE', line: "and I'll send you the skill", handle: '@x' }, ''],
};

for (const id of LOOKS) {
  test(`${id}: renders every primitive with its av-p class`, async () => {
    const look = await loadLook(id);
    assert.deepEqual(Object.keys(SAMPLE).sort(), [...PRIMITIVES].sort());
    for (const name of PRIMITIVES) {
      const [attrs, inner] = SAMPLE[name];
      const html = look.primitives[name](attrs, inner, helpers);
      assert.equal(typeof html, 'string', name);
      assert.match(html, new RegExp(`class="[^"]*av-p av-${name}\\b`), `${id}/${name}`);
    }
  });

  test(`${id}: headlines split into words, accent words marked, and fit to width`, async () => {
    const look = await loadLook(id);
    const html = look.primitives.headline({}, 'Any <em>script</em> works<br>today.', helpers);
    assert.equal((html.match(/class="av-w[ "]/g) || []).length, 4);
    assert.match(html, /class="av-w av-accent">script</);
    assert.match(html, /<br>/);
    assert.match(html, /data-fit="\d+"/);
  });

  test(`${id}: tokens, fonts, sounds and decor are in place`, async () => {
    const look = await loadLook(id);
    const css = fs.readFileSync(path.join(look.dir, 'look.css'), 'utf8');
    for (const v of ['--av-bg', '--av-ink', '--av-accent', '--av-accent2', '--av-glow']) assert.match(css, new RegExp(`${v}:`), `${id} look.css lacks ${v}`);
    assert.ok(look.fonts.length >= 2);
    for (const f of look.fonts) assert.match(fontsCss, new RegExp(`font-family: '${f}'`), `${id}: font ${f} is not bundled`);
    assert.ok(look.sfxFor('stamp', 'stamp') in look.sfxBank);
    assert.ok(look.sfxFor('objectIn', 'doc') in look.sfxBank);
    assert.equal(look.sfxFor('wordsIn', 'headline'), null);
    assert.ok(look.decor({ handle: '@x' }).length > 0);
    assert.ok(look.music && look.music.bpm > 0 && look.music.progression.length >= 4);
    assert.ok(fs.readFileSync(path.join(look.dir, 'motion.js'), 'utf8').includes('AV.defineVerbs'));
  });

  test(`${id}: no SVG filters inside CSS images (the renderer paints them as solid boxes)`, async () => {
    const look = await loadLook(id);
    const css = fs.readFileSync(path.join(look.dir, 'look.css'), 'utf8');
    assert.doesNotMatch(css, /url\(["']?data:image\/svg\+xml[^)]*<filter/i);
  });
}

// CSS rules as [selector, body] pairs.
const rules = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => [m[1].trim(), m[2]]);
const BASE_CSS = fs.readFileSync(path.join(ROOT, 'kit', 'core', 'base.css'), 'utf8');
const LOOK_CSS = Object.fromEntries(LOOKS.map((id) => [id, fs.readFileSync(path.join(ROOT, 'kit', 'looks', id, 'look.css'), 'utf8')]));
const DECOR = /^\.(pp|gl|dd|ed)-(g\d|a\d|half|h\d|tick|rules|margin|grid|pt)\b/;

test('content and captions stay inside x 60–960, clear of the platform buttons on the right', () => {
  const px = (body, prop) => +(new RegExp(`(?:^|;)\\s*${prop}:\\s*(\\d+)px`).exec(body) || [])[1];
  const rule = (sel) => rules(BASE_CSS).find(([s]) => s === sel)[1];
  for (const sel of ['.av-stage', '.av-cap']) {
    assert.ok(px(rule(sel), 'left') >= 60, `${sel} left`);
    assert.ok(px(rule(sel), 'right') >= 120, `${sel} right edge past x 960`);
  }
  for (const [where, css] of [['base', BASE_CSS], ...Object.entries(LOOK_CSS)]) {
    for (const [sel, body] of rules(css)) {
      if (DECOR.test(sel)) continue;
      for (const m of body.matchAll(/(?:^|;)\s*(?:max-)?width:\s*(\d+)px/g)) assert.ok(+m[1] <= 900, `${where}: ${sel} is ${m[1]} px wide`);
    }
  }
});

test('content text is at least 36 px; only title bars, file tabs, the watermark and the masthead are smaller', () => {
  const CHROME = /^(\.av-watermark|\.av-window__bar|\.av-terminal__bar|\.av-doc__head|\.ed-mast|\.ed-clip__k)$/;
  for (const [where, css] of [['base', BASE_CSS], ...Object.entries(LOOK_CSS)]) {
    for (const [sel, body] of rules(css)) {
      const size = /font:\s*(?:italic\s+)?(?:\d{3}\s+)?(\d+)px|font-size:\s*(\d+)px/.exec(body);
      const n = size && +(size[1] || size[2]);
      if (!n || n >= 36) continue;
      assert.ok(sel.split(',').every((s) => CHROME.test(s.trim())), `${where}: ${sel} is ${n} px`);
    }
  }
});

test('punctuation after an accent word stays on that word, with no space before it', async () => {
  const look = await loadLook('paper');
  const html = look.primitives.headline({}, 'Drawn in <em>code</em>. Free, <mark>unlimited</mark>!', helpers);
  assert.match(html, /<span class="av-w av-accent">code\.<\/span> <span class="av-w">Free,<\/span> <span class="av-w av-hl">unlimited!<\/span>/);
  assert.doesNotMatch(html, /<span class="av-w">[.!]<\/span>/);
});

test('editorial marks its full-bleed halftone corners as intentional overflow and has no scrolling ticker', async () => {
  const decor = (await loadLook('editorial')).decor({ name: 'Web Asamoah', handle: '@x' });
  for (const cls of ['ed-half ed-h1', 'ed-half ed-h2']) assert.match(decor, new RegExp(`class="${cls}" data-layout-allow-overflow`), cls);
  assert.doesNotMatch(decor, /ed-tick/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, 'kit', 'looks', 'editorial', 'motion.js'), 'utf8'), /ed-tick/);
});

test('charts draw from comma-separated values and labels (and pipes for labels with commas)', async () => {
  const { chartSvg } = await import('../kit/looks/shared.mjs');
  const line = chartSvg({ type: 'line', values: '3,5,4,8,12', labels: 'M,T,W,T,F', highlight: '4' });
  assert.equal((line.match(/class="av-chart__dot/g) || []).length, 5);
  assert.match(line, /<path class="av-chart__line" d="M40\.0 /);
  assert.equal((line.match(/class="av-chart__label"/g) || []).length, 5);
  const bars = chartSvg({ type: 'bar', values: '10, 20, 30', labels: 'Jan 1, 2026|Feb|Mar' });
  assert.equal((bars.match(/class="av-chart__bar/g) || []).length, 3);
  assert.match(bars, />Jan 1, 2026</);
  const donut = chartSvg({ type: 'donut', values: '29.4,25.5,45.1', highlight: '2', unit: '%' });
  assert.equal((donut.match(/class="av-chart__line av-chart__seg/g) || []).length, 3);
  assert.match(donut, />45\.1%</);
});

test('counters ask the kit to fit them to their width', async () => {
  const look = await loadLook('paper');
  assert.match(look.primitives.counter({ to: '1284', currency: 'GHS' }, '', helpers), /class="av-counter__num" data-fit /);
});

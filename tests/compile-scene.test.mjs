import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../engine/script.mjs';
import { estimateWords } from '../engine/words.mjs';
import { resolveRef } from '../engine/refs.mjs';
import { compileScene, PRIMITIVES } from '../engine/compile-scene.mjs';

const s = parseScript('1. Pick a look today.\n2. Paste your script here.');
const words = estimateWords(s.words);
const scene = { id: 'hook', src: 'scenes/hook.html', start: 0, end: +(words.at(-1).t1 + 1).toFixed(3), lines: [1, 2], wordRange: [0, words.length - 1] };
const ctx = { words, sceneStart: scene.start, sceneEnd: scene.end, wordRange: scene.wordRange };
const fakeLook = {
  id: 'fake',
  label: 'Fake',
  primitives: Object.fromEntries(PRIMITIVES.map((n) => [n, (attrs, inner) => `<div>${n}:${inner}</div>`])),
  sfxFor: (verb, name) => (name === 'chip' ? 'pop' : null),
  sfxGain: { pop: 0.7 },
  sfxBank: { pop: {}, stamp: {} },
};
const wrap = (body, id = 'hook') => `<!doctype html><html><body><template>
  <style>#root { position: absolute; inset: 0; }</style>
  <div id="root" data-composition-id="${id}" data-width="1080" data-height="1920">
${body}
  </div>
</template></body></html>`;
const compile = (body, opts = {}) => compileScene(wrap(body, opts.id), { scene, look: fakeLook, words, brand: {} });

test('a primitive or timing the compiler cannot read fails the build and quotes it', () => {
  for (const [body, what] of [
    ["<av-chip id='a' data-at=\"look\">x</av-chip>", /<av-chip id='a'/],
    ['<av-item id="i" title="T"><av-icon name="rocket"></av-item>', /<av-(item|icon)/],
    ['<av-chip id="a">x</av-chp>', /<av-chip id="a"/],
    ["<div id=\"d\" data-at='look'>x</div>", /data-at='look'/],
  ]) {
    assert.throws(() => compile(body), (e) => /scene "hook"/.test(e.message) && what.test(e.message) && /double quotes/.test(e.message), body);
  }
});

test('comments neither expand primitives nor stop the scene from registering', () => {
  const { html } = compile('<!-- AV.scene("hook") runs for you; <av-chip>old</av-chip> --><av-chip id="a">new</av-chip>');
  assert.doesNotMatch(html, /old/);
  assert.match(html, /<script>AV\.scene\("hook"\);/);
});

test('the last scene is marked, so the film ends on its final frame', () => {
  const last = compileScene(wrap('<av-chip id="a"></av-chip>'), { scene, look: fakeLook, words, brand: {}, last: true }).html;
  assert.match(last, /data-composition-id="hook"[^>]*data-av-last="1"/);
  assert.doesNotMatch(compile('<av-chip id="a"></av-chip>').html, /data-av-last/);
});

test('the 24 primitive names are fixed', () => {
  assert.equal(PRIMITIVES.length, 24);
  for (const n of ['kicker', 'headline', 'doc', 'video', 'chart', 'mascot', 'broll', 'cta']) assert.ok(PRIMITIVES.includes(n));
});

test('nested primitives expand innermost first and keep their id, data and classes', () => {
  const { html } = compile('<av-phone id="ph"><av-chat id="c" data-x="1"></av-chat></av-phone>');
  assert.match(html, /<div id="hook--ph" class="av-p av-phone"[^>]*>phone:<div id="hook--c" class="av-p av-chat" data-x="1"[^>]*>chat:<\/div><\/div>/);
});

test('data-at becomes a scene-local data-t and keeps the ref', () => {
  const { html } = compile('<av-doc id="d" data-at="script"></av-doc>');
  const t = resolveRef('script', ctx).toFixed(3);
  assert.match(html, new RegExp(`id="hook--d"[^>]*data-at="script"[^>]*data-t="${t}"`));
});

test('ids inside a scene get the scene prefix, in markup, styles and svg references', () => {
  const body = '<style>#a { color: red } #ab { color: blue }</style><av-chip id="a"></av-chip><span id="ab"></span>'
    + '<svg><linearGradient id="g"></linearGradient><rect fill="url(#g)"></rect><use href="#g"></use></svg>';
  const { html } = compile(body);
  assert.match(html, /id="hook--a"/);
  assert.match(html, /#hook--a \{ color: red \}/);
  assert.match(html, /#hook--ab \{ color: blue \}/);
  assert.match(html, /id="hook--g"/);
  assert.match(html, /fill="url\(#hook--g\)"/);
  assert.match(html, /href="#hook--g"/);
  assert.match(html, /<div id="root" data-composition-id="hook"/);
});

test('the compiled scene registers its timeline exactly once', () => {
  const { html } = compile('<av-chip id="a"></av-chip>');
  assert.equal((html.match(/window\.__timelines\["hook"\] = AV\.timelines\["hook"\];/g) || []).length, 1);
});

test('an explicit data-sfx adds a local-time audio clip inside the scene root', () => {
  const { html, cues } = compile('<av-stamp id="st" data-at="look" data-sfx="stamp"></av-stamp>');
  const t = resolveRef('look', ctx).toFixed(3);
  assert.equal(cues.length, 1);
  assert.match(html, new RegExp(`<audio id="sfx-hook-1" src="assets/sfx/stamp.wav" data-start="${t}" data-duration="1.000" data-track-index="9" data-volume="0.8" data-hf-media-start-basis="local"></audio>`));
});

test('the look picks default sounds, and data-sfx="none" silences one', () => {
  const { cues } = compile('<av-chip id="a" data-at="look"></av-chip><av-chip id="b" data-at="today" data-sfx="none"></av-chip>');
  assert.deepEqual(cues.map((c) => [c.id, c.sfx]), [['a', 'pop']]);
});

test('an unknown primitive throws and lists the known ones', () => {
  assert.throws(() => compile('<av-zzz id="z"></av-zzz>'), /unknown primitive zzz.*kicker/);
});

test('a time past the scene end is clamped and reported', () => {
  const { html, warnings } = compile('<av-chip id="late" data-at="end+5" data-sfx="none"></av-chip>');
  assert.match(html, new RegExp(`data-t="${(scene.end - scene.start - 0.05).toFixed(3)}"`));
  assert.ok(warnings.some((w) => /late/.test(w) && /clamped/.test(w)));
});

test('the root gets the scene start and duration, and AV.scene is added once', () => {
  const { html } = compile('<av-chip id="a"></av-chip>');
  assert.match(html, /data-composition-id="hook"[^>]*data-av-start="0\.000" data-av-dur="[\d.]+"/);
  assert.equal((html.match(/AV\.scene\("hook"\)/g) || []).length, 1);
  const custom = compileScene(wrap('<av-chip id="a"></av-chip>').replace('</template>', '<script>AV.scene("hook", (tl) => {})</script></template>'), { scene, look: fakeLook, words, brand: {} });
  assert.equal((custom.html.match(/AV\.scene\(/g) || []).length, 1);
});

test('a scene whose root id differs from its storyboard id throws', () => {
  assert.throws(() => compile('<av-chip id="a"></av-chip>', { id: 'other' }), /composition id "other".*"hook"/);
});

test('rewritten tags keep their self-closing slash, so SVG nesting survives', () => {
  const { html } = compile('<svg><linearGradient id="g"></linearGradient><rect fill="url(#g)" /><circle data-at="look" r="4" /></svg>');
  assert.match(html, /<rect fill="url\(#hook--g\)" \/>/);
  assert.match(html, /<circle data-at="look" data-t="[\d.]+" r="4" \/>/);
});

test('scene content is wrapped in .av-scene (transitions animate it, not the HyperFrames root)', () => {
  const { html } = compile('<av-chip id="a" data-at="look" data-sfx="pop"></av-chip>');
  const inner = html.slice(html.indexOf('data-composition-id="hook"'));
  assert.match(inner, /data-av-dur="[\d.]+">\s*<audio [^>]+><\/audio>\s*<div class="av-scene">/);
  assert.match(html, /<div class="av-scene">[\s\S]*id="hook--a"[\s\S]*<\/div>\s*<\/div>\s*(<script|<\/template>)/);
});

test('the scene root carries a data-av-scene marker the kit can always find', () => {
  const { html } = compile('<av-chip id="a"></av-chip>');
  assert.match(html, /data-composition-id="hook"[^>]*data-av-scene="hook"/);
});

test('sound clips get their length and a free track, and odd scenes use another block of tracks', () => {
  const body = '<av-chip id="a" data-at="look" data-sfx="pop"></av-chip><av-chip id="b" data-at="look+0.1" data-sfx="pop"></av-chip><av-chip id="c" data-at="today" data-sfx="pop"></av-chip>';
  const { html } = compile(body);
  const tracks = [...html.matchAll(/<audio id="sfx-hook-\d+"[^>]*data-duration="0\.400" data-track-index="(\d+)"/g)].map((m) => +m[1]);
  assert.equal(tracks.length, 3);
  assert.notEqual(tracks[0], tracks[1], 'overlapping sounds share a track');
  assert.ok(tracks.every((k) => k >= 9 && k <= 12));
  const odd = compileScene(wrap(body), { scene, look: fakeLook, words, brand: {}, trackBase: 13 });
  assert.ok([...odd.html.matchAll(/data-track-index="(\d+)"/g)].every((m) => +m[1] >= 13 && +m[1] <= 16));
});

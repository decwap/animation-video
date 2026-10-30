import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScript } from '../engine/script.mjs';
import { estimateWords } from '../engine/words.mjs';
import { planTimeline } from '../engine/timeline.mjs';
import { PRIMITIVES } from '../engine/table.mjs';
import { build, buildAll, refreshKit, MasterLockedError } from '../engine/build.mjs';
import { KIT_DIR } from '../engine/config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixtures', 'mini-video');

const stubLook = (id) => ({
  id,
  label: `Look ${id.toUpperCase()}`,
  fonts: [],
  primitives: Object.fromEntries(PRIMITIVES.map((n) => [n, () => `<div>${n}</div>`])),
  sfxFor: () => null,
  sfxGain: {},
  sfxBank: { pop: {}, whoosh: {} },
  music: {},
  decor: () => '<div class="stub-decor"></div>',
  cssText: `/* look ${id} */`,
  motionText: `/* motion ${id} */`,
});

function freshVideo({ withWords = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-build-'));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  const script = parseScript(fs.readFileSync(path.join(dir, 'script.md'), 'utf8'));
  const words = estimateWords(script.words);
  if (withWords) {
    fs.mkdirSync(path.join(dir, 'voice'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'voice', 'words.json'), JSON.stringify(words));
  }
  const plan = planTimeline(JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8')), words);
  return { dir, words, plan };
}
const opts = { looks: ['a', 'b'], resolveLook: async (id) => stubLook(id) };
const read = (f) => fs.readFileSync(f, 'utf8');
const hostsOf = (html) => [...html.matchAll(/<div id="scene-[^"]+" data-composition-id="([^"]+)" data-composition-src="([^"]+)" data-start="([\d.]+)" data-duration="([\d.]+)"/g)]
  .map(([, id, src, start, dur]) => ({ id, src, start: +start, dur: +dur }));

test('build writes one complete HyperFrames project per look', async () => {
  const { dir } = freshVideo();
  const out = await build(dir, opts);
  for (const look of ['a', 'b']) {
    const p = path.join(dir, 'looks', look);
    assert.equal(out.projects[look], p);
    for (const f of ['index.html', 'package.json', 'compositions/one.html', 'compositions/two.html', 'compositions/captions.html',
      'assets/kit/av.js', 'assets/kit/refs.js', 'assets/kit/table.js', 'assets/kit/broll.js', 'assets/kit/base.css',
      'assets/kit/look.css', 'assets/kit/motion.js', 'assets/kit/av-data.js', 'assets/kit/fonts/fonts.css',
      'assets/audio/vo.wav', 'assets/audio/music.wav', 'assets/media/dot.svg']) {
      assert.ok(fs.existsSync(path.join(p, f)), `${look}: missing ${f}`);
    }
    assert.equal(read(path.join(p, 'assets/kit/look.css')), `/* look ${look} */`);
    assert.match(read(path.join(p, 'index.html')), new RegExp(`<html lang="en" data-av-look="${look}">`));
    assert.match(read(path.join(p, 'package.json')), /hyperframes@0\.8\.216 preview/);
  }
});

test('hosts match the compiled scenes and the planned timing, and the root lasts the whole video', async () => {
  const { dir, plan } = freshVideo();
  const out = await build(dir, opts);
  const index = read(path.join(dir, 'looks', 'a', 'index.html'));
  const hosts = hostsOf(index);
  assert.deepEqual(hosts.map((h) => h.id), ['one', 'two']);
  hosts.forEach((h, k) => {
    assert.match(read(path.join(dir, 'looks', 'a', h.src)), new RegExp(`data-composition-id="${h.id}"`));
    assert.equal(h.start, plan.scenes[k].start);
    assert.equal(h.dur, +(plan.scenes[k].end - plan.scenes[k].start).toFixed(3));
  });
  assert.equal(out.duration, plan.duration);
  assert.match(index, new RegExp(`data-composition-id="main" data-start="0" data-width="1080" data-height="1920" data-duration="${plan.duration}"`));
  assert.match(index, /data-track-index="1" data-track-kind="graphics"[\s\S]*data-track-index="2" data-track-kind="graphics"/);
  assert.match(index, /<div id="captions" data-composition-id="captions" data-composition-src="compositions\/captions\.html" data-start="0"[^>]*data-track-index="5" data-track-kind="captions"/);
  assert.match(index, /<audio id="vo" src="assets\/audio\/vo\.wav"[^>]*data-track-index="6"/);
  assert.match(index, /<audio id="music" src="assets\/audio\/music\.wav"[^>]*data-track-index="7"/);
  assert.match(index, /class="clip av-watermark"[^>]*>@test</);
  assert.match(index, /<div id="decor" data-composition-id="decor" data-composition-src="compositions\/decor\.html" data-start="0"[^>]*data-track-index="0"/);
  const decor = read(path.join(dir, 'looks', 'a', 'compositions', 'decor.html'));
  assert.match(decor, /<div class="stub-decor"><\/div>/);
  assert.match(decor, /data-av-scene="decor"/);
  assert.match(decor, /window\.__timelines\["decor"\] = AV\.timelines\["decor"\];/);
  assert.match(index, /window\.__timelines = window\.__timelines \|\| \{\};\s*window\.__timelines\["main"\] = tl;/);
});

test('every sound a scene asks for exists in the project', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  const p = path.join(dir, 'looks', 'a');
  const srcs = fs.readdirSync(path.join(p, 'compositions')).flatMap((f) => [...read(path.join(p, 'compositions', f)).matchAll(/src="(assets\/sfx\/[^"]+)"/g)].map((m) => m[1]));
  assert.ok(srcs.length >= 1);
  for (const s of srcs) assert.ok(fs.existsSync(path.join(p, s)), `missing ${s}`);
});

test('av-data.js carries the words, the scene spans and the brand for the browser kit', async () => {
  const { dir, words } = freshVideo();
  await build(dir, opts);
  const data = read(path.join(dir, 'looks', 'a', 'assets', 'kit', 'av-data.js'));
  const json = JSON.parse(data.replace(/^window\.AV_DATA = /, '').replace(/;\s*$/, ''));
  assert.equal(json.words.length, words.length);
  assert.deepEqual(Object.keys(json.scenes), ['one', 'two']);
  assert.deepEqual(json.scenes.two.wordRange, [4, 7]);
  assert.equal(json.brand.handle, '@test');
});

test('a brand accent colour overrides every look accent, after the look styles', async () => {
  const { dir } = freshVideo();
  fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify({ name: 'Example Shop', handle: '@exampleshop', accent: '#C32126' }));
  await build(dir, opts);
  const index = read(path.join(dir, 'looks', 'a', 'index.html'));
  assert.match(index, /<link rel="stylesheet" href="assets\/kit\/look\.css" \/>[\s\S]*<style>:root \{ --av-accent: #C32126; \}<\/style>/);
  fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify({ handle: '@x', accent: 'red; } body { display: none' }));
  await assert.rejects(() => build(dir, opts), /accent/);
});

test('the watermark shows the handle, or the brand name when there is no handle', async () => {
  const { dir } = freshVideo();
  fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify({ name: 'Example Shop' }));
  await build(dir, opts);
  assert.match(read(path.join(dir, 'looks', 'a', 'index.html')), /<div id="watermark"[^>]*>Example Shop<\/div>/);
});

test('buildAll rebuilds every look but a picked one, which only takes kit fixes', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  const a = path.join(dir, 'looks', 'a');
  fs.writeFileSync(path.join(a, '.av-master'), 'picked\n');
  fs.appendFileSync(path.join(a, 'compositions', 'one.html'), '<!-- studio edit -->');
  fs.writeFileSync(path.join(a, 'assets', 'kit', 'av.js'), '/* an older kit */');
  const bIndex = path.join(dir, 'looks', 'b', 'index.html');
  const bBefore = fs.statSync(bIndex).mtimeMs;
  await new Promise((r) => setTimeout(r, 20));
  const r = await buildAll(dir, { looks: ['a', 'b'], resolveLook: opts.resolveLook });
  assert.deepEqual(r.built, ['b']);
  assert.deepEqual(r.kept, ['a']);
  assert.match(read(path.join(a, 'compositions', 'one.html')), /studio edit/);
  assert.equal(read(path.join(a, 'assets', 'kit', 'av.js')), read(path.join(KIT_DIR, 'core', 'av.js')));
  assert.ok(fs.statSync(bIndex).mtimeMs > bBefore, 'look b was rebuilt');
});

test('the picker marks the picked look and when each look was built', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  fs.writeFileSync(path.join(dir, 'looks', 'a', '.av-master'), 'picked\n');
  await buildAll(dir, { looks: ['a', 'b'], resolveLook: opts.resolveLook });
  const picker = read(path.join(dir, 'picker.html'));
  assert.match(picker, /<figure class="look picked" data-look="a"/);
  assert.match(picker, /<figure class="look" data-look="b"/);
  assert.equal((picker.match(/data-built="\d{4}-\d\d-\d\dT[\d:.]+Z"/g) || []).length, 2);
});

test('rebuilding one look keeps every built look in the picker', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  await build(dir, { ...opts, looks: ['b'] });
  const picker = read(path.join(dir, 'picker.html'));
  for (const label of ['Look A', 'Look B']) assert.match(picker, new RegExp(label));
});

test('a look edited since it was built is protected even without a marker, and the error names the files', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  const f = path.join(dir, 'looks', 'a', 'compositions', 'one.html');
  fs.appendFileSync(f, '<!-- edited in Studio -->');
  fs.writeFileSync(path.join(dir, 'looks', 'a', '.DS_Store'), 'finder');
  await assert.rejects(() => build(dir, opts), (e) => e instanceof MasterLockedError && /compositions\/one\.html/.test(e.message) && !/DS_Store/.test(e.message));
  assert.match(read(f), /edited in Studio/);
  await build(dir, { ...opts, looks: ['b'] });
});

test('--force keeps the old project as a backup next to the rebuilt one', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  const p = path.join(dir, 'looks', 'a');
  fs.writeFileSync(path.join(p, '.av-master'), 'picked\n');
  fs.appendFileSync(path.join(p, 'compositions', 'one.html'), '<!-- studio edit -->');
  await build(dir, { ...opts, force: true });
  assert.match(read(path.join(dir, 'looks', 'a.bak-1', 'compositions', 'one.html')), /studio edit/);
  assert.doesNotMatch(read(path.join(p, 'compositions', 'one.html')), /studio edit/);
  assert.ok(fs.existsSync(path.join(p, '.av-master')));
});

test('a scene that fails to compile leaves every built look as it was', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  const index = path.join(dir, 'looks', 'a', 'index.html');
  const before = fs.statSync(index).mtimeMs;
  const scene = path.join(dir, 'scenes', 'two.html');
  fs.writeFileSync(scene, read(scene).replace('data-at="script"', 'data-at="nosuchword"'));
  await assert.rejects(() => build(dir, { ...opts, force: true }), /nosuchword/);
  assert.equal(fs.statSync(index).mtimeMs, before);
  assert.ok(!fs.existsSync(path.join(dir, 'looks', 'a.bak-1')));
});

test('refreshKit updates a picked look\'s kit files and leaves its compositions alone', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  const p = path.join(dir, 'looks', 'a');
  fs.writeFileSync(path.join(p, '.av-master'), 'picked\n');
  fs.appendFileSync(path.join(p, 'compositions', 'one.html'), '<!-- studio edit -->');
  fs.writeFileSync(path.join(p, 'assets', 'kit', 'av.js'), '/* an older kit */');
  const r = await refreshKit(dir, { looks: ['a'], resolveLook: opts.resolveLook });
  assert.deepEqual(r.looks, ['a']);
  assert.equal(read(path.join(p, 'assets', 'kit', 'av.js')), read(path.join(KIT_DIR, 'core', 'av.js')));
  assert.match(read(path.join(p, 'compositions', 'one.html')), /studio edit/);
  await assert.rejects(() => build(dir, { ...opts, looks: ['a'] }), (e) => e instanceof MasterLockedError);
});

test('a picked look is locked: rebuilding it throws MasterLockedError and changes nothing', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  const p = path.join(dir, 'looks', 'a');
  fs.writeFileSync(path.join(p, '.av-master'), 'picked\n');
  const before = Object.fromEntries(['index.html', 'compositions/one.html'].map((f) => [f, fs.statSync(path.join(p, f)).mtimeMs]));
  await assert.rejects(() => build(dir, opts), (e) => e instanceof MasterLockedError && /looks\/a/.test(e.message));
  for (const [f, t] of Object.entries(before)) assert.equal(fs.statSync(path.join(p, f)).mtimeMs, t, `${f} changed`);
  const forced = await build(dir, { ...opts, force: true });
  assert.ok(forced.projects.a);
  assert.ok(fs.existsSync(path.join(p, '.av-master')), 'force keeps the master marker');
});

test('without a voice, build needs draftTiming and then uses estimated words', async () => {
  const { dir } = freshVideo({ withWords: false });
  await assert.rejects(() => build(dir, opts), /no voice\/words\.json/);
  const out = await build(dir, { ...opts, draftTiming: true });
  assert.ok(out.duration > 2);
  assert.ok(out.warnings.some((w) => /draft timing/.test(w)));
});

test('captions take spelling, case and punctuation from script.md, even when the voice is older', async () => {
  const { dir } = freshVideo();
  fs.writeFileSync(path.join(dir, 'script.md'), '# Mini video\n1. PICK a *look*, today!\n2. Paste your script here.\n');
  await build(dir, opts);
  const caps = read(path.join(dir, 'looks', 'a', 'compositions', 'captions.html'));
  const words = [...caps.matchAll(/<span class="av-cap__w[^"]*"[^>]*>([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(words.slice(0, 4), ['PICK', 'a', 'look,', 'today!']);
});

test('a voice recorded for a different script is refused', async () => {
  const { dir, words } = freshVideo();
  fs.writeFileSync(path.join(dir, 'voice', 'words.json'), JSON.stringify(words.slice(0, 3)));
  await assert.rejects(() => build(dir, opts), /script changed since the voice/);
});

test('build writes the Look Picker next to the looks', async () => {
  const { dir } = freshVideo();
  await build(dir, opts);
  const picker = read(path.join(dir, 'picker.html'));
  assert.equal((picker.match(/<hyperframes-player /g) || []).length, 2);
  assert.match(picker, /src="looks\/a\/index\.html"/);
  assert.match(picker, /Look A/);
});

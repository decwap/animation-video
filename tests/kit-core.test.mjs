import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KIT = ['table.js', 'refs.js', 'av.js', 'broll.js'].map((f) => fs.readFileSync(path.join(ROOT, 'kit', 'core', f), 'utf8'));

// A fake element with just what the kit reads.
function el({ id = '', cls = [], attrs = {} } = {}) {
  const a = { ...attrs };
  const dataset = {};
  for (const [k, v] of Object.entries(a)) if (k.startsWith('data-')) dataset[k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = v;
  return {
    id, dataset, classList: { contains: (c) => cls.includes(c), [Symbol.iterator]: function* () { yield* cls; } },
    hasAttribute: (n) => n in a, getAttribute: (n) => (n in a ? a[n] : null),
    querySelector: () => null, querySelectorAll: () => [],
  };
}

function loadKit({ doc = {}, data } = {}) {
  const record = [];
  const tl = { calls: [], to() { return tl; }, fromTo() { return tl; }, set() { return tl; } };
  const context = vm.createContext({
    console,
    document: { documentElement: { getAttribute: () => 'paper' }, querySelector: () => null, ...doc },
    gsap: { timeline: () => tl },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    AV_DATA: data,
  });
  context.window = context;
  for (const code of KIT) vm.runInContext(code, context);
  return { AV: context.AV, tl, record };
}

test('defaultVerb maps each primitive to its verb, captions to captionIn and the rest to objectIn', () => {
  const { AV } = loadKit();
  const v = (name) => AV.defaultVerb(el({ cls: ['av-p', `av-${name}`] }));
  assert.equal(v('headline'), 'wordsIn');
  assert.equal(v('kicker'), 'textIn');
  assert.equal(v('counter'), 'countUp');
  assert.equal(v('chart'), 'drawChart');
  assert.equal(v('stamp'), 'stamp');
  assert.equal(v('arrow'), 'drawPath');
  assert.equal(v('chat'), 'typeText');
  assert.equal(v('terminal'), 'typeText');
  assert.equal(v('mark'), 'highlight');
  assert.equal(v('broll'), 'broll');
  assert.equal(v('image'), 'kenBurns');
  assert.equal(v('progress'), 'progress');
  assert.equal(v('doc'), 'objectIn');
  assert.equal(AV.defaultVerb(el({ cls: ['av-cap'], attrs: { 'data-cap': '' } })), 'captionIn');
  assert.equal(AV.defaultVerb(el({ cls: ['plain'] })), 'objectIn');
});

test('fmt writes cedis as GH¢ and dollars as $', () => {
  const { AV } = loadKit();
  assert.equal(AV.fmt(1234, { currency: 'GHS' }), 'GH¢ 1,234');
  assert.equal(AV.fmt(1234, { currency: 'USD' }), '$1,234');
  assert.equal(AV.fmt(29.44, { dec: 1, suffix: '%' }), '29.4%');
  assert.equal(AV.fmt(-40, { currency: 'USD' }), '−$40');
});

test('rng is seeded and repeatable', () => {
  const { AV } = loadKit();
  const a = AV.rng(7); const b = AV.rng(7); const c = AV.rng(8);
  const sa = [a(), a(), a()]; const sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, [c(), c(), c()]);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
});

test('AV.scene runs sceneIn, each timed element verb at its data-t, outs and captions, then sceneOut', () => {
  const head = el({ id: 'hook--h', cls: ['av-p', 'av-headline'], attrs: { 'data-t': '0.500' } });
  const chip = el({ id: 'hook--c', cls: ['av-p', 'av-chip'], attrs: { 'data-t': '2.000', 'data-tout': '3.000' } });
  const stamp = el({ id: 'hook--s', cls: ['av-p', 'av-doc'], attrs: { 'data-t': '1.000', 'data-verb': 'stamp' } });
  const sceneRoot = el({ id: 'root', attrs: { 'data-composition-id': 'hook', 'data-av-dur': '4.000', 'data-av-start': '1.000' } });
  sceneRoot.querySelectorAll = (sel) => (sel === '[data-t]' ? [head, chip, stamp] : sel === '[data-tout]' ? [chip] : []);
  let asked = '';
  sceneRoot.querySelector = (sel) => { asked = sel; return null; };
  const { AV } = loadKit({ doc: { querySelector: (sel) => (sel === '[data-composition-id="hook"]:not([data-composition-src])' ? sceneRoot : null) } });
  const calls = [];
  const rec = (name) => (tl, target, t) => calls.push([name, target.id, t]);
  AV.defineVerbs(Object.fromEntries(['sceneIn', 'sceneOut', 'wordsIn', 'objectIn', 'objectOut', 'stamp'].map((n) => [n, rec(n)])));
  AV.setPreset({ outDur: 0.4 });
  let extraArgs = null;
  const tl = AV.scene('hook', (t, q, ctx) => { extraArgs = { q, ctx }; q('#c'); });
  assert.deepEqual(calls, [
    ['sceneIn', 'root', 0], ['wordsIn', 'hook--h', 0.5], ['objectIn', 'hook--c', 2], ['stamp', 'hook--s', 1],
    ['objectOut', 'hook--c', 3], ['sceneOut', 'root', 3.6],
  ]);
  assert.equal(AV.timelines.hook, tl);
  assert.equal(asked, '#hook--c');
  assert.equal(extraArgs.ctx.dur, 4);
  assert.equal(extraArgs.ctx.start, 1);
});

test('the captions scene gets no scene transitions and each group leaves after its data-dur', () => {
  const g = el({ id: 'c1', cls: ['av-cap'], attrs: { 'data-cap': '', 'data-t': '1.000', 'data-dur': '0.800' } });
  const capRoot = el({ id: 'root', attrs: { 'data-composition-id': 'captions', 'data-av-dur': '9' } });
  capRoot.querySelectorAll = (sel) => (sel === '[data-t]' ? [g] : []);
  const { AV } = loadKit({ doc: { querySelector: () => capRoot } });
  const calls = [];
  const rec = (name) => (tl, target, t) => calls.push([name, target.id, t]);
  AV.defineVerbs(Object.fromEntries(['sceneIn', 'sceneOut', 'captionIn', 'captionOut'].map((n) => [n, rec(n)])));
  AV.scene('captions');
  assert.deepEqual(calls, [['captionIn', 'c1', 1], ['captionOut', 'c1', 1.8]]);
});

test('every b-roll scene draws on a 2D context at any time without throwing', () => {
  const { AV } = loadKit();
  const ctx2d = new Proxy({}, {
    get: (t, p) => (p in t ? t[p] : /^create(Linear|Radial)Gradient$/.test(p) ? () => ({ addColorStop() {} }) : p === 'measureText' ? () => ({ width: 10 }) : () => {}),
    set: (t, p, v) => { t[p] = v; return true; },
  });
  assert.deepEqual([...AV.broll.names()], ['city', 'money', 'network', 'globe', 'ticker', 'burst', 'docs']);
  for (const name of AV.broll.names()) {
    for (const t of [0, 1.5, 4, 37.2]) AV.broll.render(name, ctx2d, t, 960, 800, { seed: 3 });
  }
  assert.throws(() => AV.broll.render('nope', ctx2d, 0, 10, 10), /unknown b-roll "nope"/);
});

test('AV.scene finds a scene the HyperFrames player mounted (host keeps the id, inner root is marked)', () => {
  const head = el({ id: 'hook--h', cls: ['av-p', 'av-headline'], attrs: { 'data-t': '0.500' } });
  const inner = el({ attrs: { 'data-hf-inner-root': 'true', 'data-av-dur': '3.000', 'data-av-start': '0.000' } });
  inner.querySelectorAll = (sel) => (sel === '[data-t]' ? [head] : []);
  const host = el({ id: 'hook', attrs: { 'data-composition-id': 'hook', 'data-composition-src': 'compositions/hook.html' } });
  host.querySelector = (sel) => (sel === ':scope > [data-hf-inner-root]' ? inner : null);
  const { AV } = loadKit({ doc: { querySelector: (sel) => (sel === '[data-composition-id="hook"]' ? host : null) } });
  const calls = [];
  AV.defineVerbs({ sceneIn() {}, sceneOut: (tl, t, at) => calls.push(['sceneOut', at]), wordsIn: (tl, e, t) => calls.push(['wordsIn', e.id, t]) });
  AV.scene('hook');
  assert.deepEqual(calls, [['wordsIn', 'hook--h', 0.5], ['sceneOut', 2.6]]);
});

test('AV.scene uses the data-av-scene marker when the CLI inlined the scene (host lost data-composition-src)', () => {
  const head = el({ id: 'hook--h', cls: ['av-p', 'av-headline'], attrs: { 'data-t': '0.500' } });
  const inner = el({ attrs: { 'data-av-scene': 'hook', 'data-av-dur': '3.000', 'data-av-start': '0.000' } });
  inner.querySelectorAll = (sel) => (sel === '[data-t]' ? [head] : []);
  const host = el({ id: 'hook', attrs: { 'data-composition-id': 'hook', 'data-composition-file': 'compositions/hook.html' } });
  const { AV } = loadKit({ doc: { querySelector: (sel) => (sel === '[data-av-scene="hook"]' ? inner : sel.startsWith('[data-composition-id="hook"]') ? host : null) } });
  const calls = [];
  AV.defineVerbs({ sceneIn() {}, sceneOut: (tl, t, at) => calls.push(['sceneOut', at]), wordsIn: (tl, e, t) => calls.push(['wordsIn', e.id, t]) });
  AV.scene('hook');
  assert.deepEqual(calls, [['wordsIn', 'hook--h', 0.5], ['sceneOut', 2.6]]);
});

test('objectIn runs the primitive detail animation registered for that primitive', () => {
  const { AV, tl } = loadKit();
  const seen = [];
  AV.defineDetails({ doc: (t, e, at) => seen.push([e.id, at]) });
  AV.verbs.objectIn(tl, el({ id: 'd1', cls: ['av-p', 'av-doc'] }), 1.25, {});
  AV.verbs.objectIn(tl, el({ id: 'c1', cls: ['av-p', 'av-chip'] }), 2, {});
  assert.deepEqual(seen, [['d1', 1.25]]);
  assert.equal(typeof AV.detail, 'function');
});

test('captionOut finishes by the given time, so the next caption never overlaps it', () => {
  const { AV } = loadKit();
  const rec = [];
  const tl = { to: (target, vars, at) => { rec.push([at, vars.duration, vars.opacity]); return tl; } };
  AV.verbs.captionOut(tl, el({ id: 'c1' }), 2.0, {});
  assert.equal(rec.length, 1);
  assert.ok(Math.abs(rec[0][0] + rec[0][1] - 2.0) < 1e-9, `ends at ${rec[0][0] + rec[0][1]}`);
  assert.equal(rec[0][2], 0);
});

test('wordTimes lands each headline word on its spoken time, finding the scene by its data-av-scene marker', () => {
  const data = { words: [{ norm: 'pick', t0: 10.2 }, { norm: 'a', t0: 10.5 }, { norm: 'look', t0: 11.0 }, { norm: 'today', t0: 11.4 }], scenes: { hook: { wordRange: [0, 3] } } };
  const { AV } = loadKit({ data });
  // HyperFrames strips data-composition-id from a mounted scene root; the compiler's marker stays
  const sceneRoot = el({ attrs: { 'data-av-scene': 'hook', 'data-av-start': '10.000' } });
  const span = (text) => ({ textContent: text });
  const times = AV.wordTimes([span('Pick'), span('a'), span('look'), span('now')], sceneRoot, 0.1, 0.08);
  assert.deepEqual(times.map((t) => +t.toFixed(3)), [0.2, 0.5, 1, 1.08]);
});

test('fitText measures words by layout, so a word scaled mid-animation never shrinks the headline', () => {
  const { AV } = loadKit();
  let size = 0;
  const style = { set fontSize(v) { size = parseFloat(v); }, get fontSize() { return `${size}px`; } };
  const words = [0, 1, 2].map((k) => ({ get offsetLeft() { return k * 0.3 * size; }, get offsetWidth() { return 0.25 * size; } }));
  // the words reach 0.85 × font size; scrollWidth also counts their 1.6× entrance scale
  assert.equal(AV.fitText({ children: words, clientWidth: 900, scrollWidth: 2000, style }, { max: 148 }), 148);
  const fitted = AV.fitText({ children: words, clientWidth: 100, scrollWidth: 100, style }, { max: 148 });
  assert.ok(fitted < 148 && 0.85 * fitted <= 101, `fitted at ${fitted}`);
  let plain = 0;
  const text = { children: [], clientWidth: 300, get scrollWidth() { return plain * 4; }, style: { set fontSize(v) { plain = parseFloat(v); } } };
  assert.ok(AV.fitText(text, { max: 120 }) <= 76, 'plain text still fits by scrollWidth');
});

test('the last scene skips sceneOut, so the film ends on its final frame', () => {
  const ctaRoot = el({ id: 'root', attrs: { 'data-av-scene': 'cta', 'data-av-dur': '4.000', 'data-av-start': '8.000', 'data-av-last': '1' } });
  ctaRoot.querySelectorAll = () => [];
  const { AV } = loadKit({ doc: { querySelector: (sel) => (sel === '[data-av-scene="cta"]' ? ctaRoot : null) } });
  const calls = [];
  AV.defineVerbs({ sceneIn: () => calls.push('sceneIn'), sceneOut: () => calls.push('sceneOut') });
  AV.scene('cta');
  assert.deepEqual(calls, ['sceneIn']);
});

test('the scene wrapper fills the canvas, so clip, scale and rotate transitions have a real box', () => {
  const css = fs.readFileSync(path.join(ROOT, 'kit', 'core', 'base.css'), 'utf8');
  assert.match(css, /\.av-scene\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0/);
});

test('the decor scene gets no transitions and runs the look decor timeline on its own root', () => {
  const decorRoot = el({ id: 'root', attrs: { 'data-av-scene': 'decor', 'data-av-dur': '12' } });
  decorRoot.querySelectorAll = () => [];
  const { AV } = loadKit({ doc: { querySelector: (sel) => (sel === '[data-av-scene="decor"]' ? decorRoot : null) } });
  const calls = [];
  AV.defineVerbs({ sceneIn: () => calls.push('sceneIn'), sceneOut: () => calls.push('sceneOut'), decorTimeline: (tl, D, root) => calls.push(['decor', D, root.id]) });
  AV.scene('decor');
  assert.deepEqual(calls, [['decor', 12, 'root']]);
});

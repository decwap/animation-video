import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScript } from '../engine/script.mjs';
import { estimateWords } from '../engine/words.mjs';
import { compileScene } from '../engine/compile-scene.mjs';
import { loadLook } from '../engine/looks.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'blueprints');
const NAMES = ['hook', 'step', 'list', 'big-number', 'compare', 'chart', 'flow', 'timeline', 'definition',
  'ui-chat', 'ui-terminal', 'phone', 'broll', 'grid-focus', 'quiz', 'recap', 'cta'];
const words = estimateWords(parseScript('1. One two three four five six seven eight nine ten.').words);

test('there are 17 blueprints, one per scene type', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.html')).map((f) => f.replace(/\.html$/, '')).sort();
  assert.deepEqual(files, [...NAMES].sort());
});

for (const name of NAMES) {
  test(`blueprint ${name}: header, primitives only, and it compiles for a 3.4 s scene`, async () => {
    const src = fs.readFileSync(path.join(DIR, `${name}.html`), 'utf8');
    assert.match(src, new RegExp(`<!--\\s*blueprint: ${name}\\s*\\n[\\s\\S]*purpose:[\\s\\S]*slots:[\\s\\S]*when:[\\s\\S]*-->`), 'comment header');
    assert.match(src, /<av-[a-z]/, 'uses a primitive');
    assert.match(src, new RegExp(`data-composition-id="${name}"`));
    assert.doesNotMatch(src, /getElementById|document\.querySelector/, 'scene scripts must use q() from AV.scene');
    const look = await loadLook('paper');
    const scene = { id: name, src: `blueprints/${name}.html`, start: 0, end: 3.4, lines: [1, 1], wordRange: [0, words.length - 1] };
    const out = compileScene(src, { scene, look, words, brand: { handle: '@x' } });
    assert.match(out.html, /data-av-scene=/);
    assert.doesNotMatch(out.html, /<av-[a-z]/, 'every primitive expanded');
  });
}

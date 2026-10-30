import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../engine/script.mjs';
import { estimateWords } from '../engine/words.mjs';
import { resolveRef, RefError } from '../engine/refs.mjs';

const s = parseScript('1. Pick a look.\n2. Paste your script, then the script renders.\n3. Done.');
const words = estimateWords(s.words, { wpm: 150, gap: 0.25 });
// scene covers line 2 (words 3..9)
const ctx = { words, sceneStart: words[3].t0 - 0.15, sceneEnd: words[9].t1 + 0.3, wordRange: [3, 9] };
const local = (t) => +(t - ctx.sceneStart).toFixed(3);

test('a word ref resolves to its first occurrence inside the scene, in scene-local seconds', () => {
  assert.equal(resolveRef('script', ctx), local(words[5].t0));
});

test('#n picks a later occurrence and $ picks the word end', () => {
  assert.equal(resolveRef('script#2', ctx), local(words[8].t0));
  assert.equal(resolveRef('script$', ctx), local(words[5].t1));
});

test('line, word-index, seconds, start and end refs resolve', () => {
  assert.equal(resolveRef('L2', ctx), local(words[3].t0));
  assert.equal(resolveRef('w4', ctx), local(words[4].t0));
  assert.equal(resolveRef('0.8s', ctx), 0.8);
  assert.equal(resolveRef('start', ctx), 0);
  assert.equal(resolveRef('end', ctx), local(ctx.sceneEnd));
});

test('offsets add to any ref', () => {
  assert.equal(resolveRef('L2+0.2', ctx), +(local(words[3].t0) + 0.2).toFixed(3));
  assert.equal(resolveRef('script-0.1', ctx), +(local(words[5].t0) - 0.1).toFixed(3));
});

test('refs are matched by norm, so punctuation and case do not matter', () => {
  assert.equal(resolveRef('Script,', ctx), local(words[5].t0));
});

test('a word outside the scene throws a RefError that lists the scene words', () => {
  assert.throws(() => resolveRef('look', ctx), (e) => e instanceof RefError && /scene words: paste your script then the script renders/.test(e.message));
  assert.throws(() => resolveRef('script#3', ctx), RefError);
});

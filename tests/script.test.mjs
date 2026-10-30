import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../engine/script.mjs';

test('parseScript reads the title, numbered lines and multi-word emphasis', () => {
  const s = parseScript('# T\n1. Did you know *any script* works?\n2. Yes.');
  assert.equal(s.title, 'T');
  assert.deepEqual(s.lines.map((l) => l.n), [1, 2]);
  assert.equal(s.lines[0].text, 'Did you know any script works?');
  assert.equal(s.words.length, 7);
  assert.deepEqual(s.words.map((w) => w.emph), [false, false, false, true, true, false, false]);
  assert.equal(s.words[5].text, 'works?');
  assert.equal(s.words[5].norm, 'works');
  assert.equal(s.words[6].line, 2);
  assert.deepEqual(s.words.map((w) => w.i), [0, 1, 2, 3, 4, 5, 6]);
});

test('parseScript keeps digits and drops apostrophes and hyphens in norms', () => {
  const s = parseScript("1. Here's 10,000 b-roll clips.");
  assert.deepEqual(s.words.map((w) => w.norm), ['heres', '10000', 'broll', 'clips']);
});

test('parseScript skips blank lines and notes that are not numbered', () => {
  const s = parseScript('# Title\n\n> note to self\n1. One line.\n\nsome prose\n2. Two.');
  assert.equal(s.lines.length, 2);
  assert.equal(s.words.length, 3);
});

test('parseScript rejects a script with no numbered lines', () => {
  assert.throws(() => parseScript('# Only a title'), /no numbered lines/);
});

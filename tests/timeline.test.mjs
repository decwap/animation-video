import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../engine/script.mjs';
import { estimateWords } from '../engine/words.mjs';
import { planTimeline } from '../engine/timeline.mjs';

const r3 = (t) => +t.toFixed(3);
const s = parseScript('1. Did you know this works?\n2. Here is how it works in three steps.\n3. Comment now.');
const words = estimateWords(s.words);
const sb = {
  scenes: [
    { id: 'a', src: 'scenes/a.html', lines: [1, 1] },
    { id: 'b', src: 'scenes/b.html', lines: [2, 2] },
    { id: 'c', src: 'scenes/c.html', lines: [3, 3] },
  ],
};

test('scenes run in order from 0, overlap by 0.35 s, and the video ends 2.5 s after the last word', () => {
  const p = planTimeline(sb, words);
  assert.equal(p.scenes[0].start, 0);
  assert.equal(p.scenes[1].start, r3(words[5].t0 - 0.15));
  assert.ok(p.scenes[2].start > p.scenes[1].start);
  assert.equal(p.scenes[0].end, r3(p.scenes[1].start + 0.35));
  assert.equal(p.duration, r3(words.at(-1).t1 + 2.5));
  assert.equal(p.scenes.at(-1).end, p.duration);
  assert.deepEqual(p.scenes[1].wordRange, [5, 12]);
  assert.deepEqual(p.scenes[1].lines, [2, 2]);
  assert.equal(p.scenes[1].src, 'scenes/b.html');
});

test('lead, overlap and tail can be changed, and hold lengthens the last scene', () => {
  const p = planTimeline({ ...sb, lead: 0.3, overlap: 0.5, tail: 1, scenes: sb.scenes.map((x, q) => (q === 2 ? { ...x, hold: 4 } : x)) }, words);
  assert.equal(p.scenes[1].start, r3(words[5].t0 - 0.3));
  assert.equal(p.scenes[0].end, r3(p.scenes[1].start + 0.5));
  assert.equal(p.duration, r3(words.at(-1).t1 + 4));
});

test('a line in two scenes throws', () => {
  assert.throws(() => planTimeline({ scenes: [{ id: 'a', lines: [1, 2] }, { id: 'b', lines: [2, 3] }] }, words), /line 2 is in scenes a and b/);
});

test('a line no scene covers is a warning', () => {
  const p = planTimeline({ scenes: [{ id: 'a', lines: [1, 1] }, { id: 'b', lines: [2, 2] }] }, words);
  assert.ok(p.warnings.some((w) => /line 3 is not in any scene/.test(w)));
});

test('a scene shorter than 0.8 s is flagged', () => {
  const quick = [
    { i: 0, text: 'Hello', norm: 'hello', emph: false, line: 1, t0: 0, t1: 0.5 },
    { i: 1, text: 'Go.', norm: 'go', emph: false, line: 2, t0: 0.55, t1: 0.75 },
    { i: 2, text: 'Bye.', norm: 'bye', emph: false, line: 3, t0: 0.8, t1: 1.2 },
  ];
  const p = planTimeline({ scenes: [{ id: 'a', lines: [1, 1] }, { id: 'b', lines: [2, 2] }, { id: 'c', lines: [3, 3] }] }, quick);
  assert.ok(p.warnings.some((w) => /scene b is under 0\.8 s/.test(w)), p.warnings.join('; '));
});

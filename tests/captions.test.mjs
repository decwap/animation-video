import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseScript } from '../engine/script.mjs';
import { estimateWords } from '../engine/words.mjs';
import { groupCaptions, captionsHtml } from '../engine/captions.mjs';

const s = parseScript('1. Did you know? Claude can turn *any script* into an animated explainer.\n2. Here is how.');
const words = estimateWords(s.words);
const text = (g) => g.words.map((w) => w.text).join(' ');

test('groups hold at most 4 words, break after punctuation and never cross lines', () => {
  const groups = groupCaptions(words);
  assert.equal(text(groups[0]), 'Did you know?');
  assert.ok(groups.every((g) => g.words.length <= 4));
  assert.ok(groups.every((g) => g.words.map((w) => w.text).join(' ').length <= 22 || g.words.length === 1));
  assert.equal(text(groups.at(-1)), 'Here is how.');
  const joined = groups.map(text).join(' ');
  assert.equal(joined, words.map((w) => w.text).join(' '));
});

test('accent words keep their emphasis', () => {
  const all = groupCaptions(words).flatMap((g) => g.words);
  assert.deepEqual(all.filter((w) => w.emph).map((w) => w.text), ['any', 'script']);
});

test('a group stays up until the next one starts, at most 0.6 s past its last word, and never overlaps', () => {
  const groups = groupCaptions(words);
  groups.forEach((g, q) => {
    assert.ok(g.t1 > g.t0);
    assert.ok(g.t1 <= g.words.at(-1).t1 + 0.6 + 1e-9);
    if (groups[q + 1]) assert.ok(g.t1 <= groups[q + 1].t0 + 1e-9);
  });
  assert.deepEqual(groups.map((g) => g.id).slice(0, 2), ['c1', 'c2']);
});

test('captionsHtml writes a captions sub-composition with one data-cap block per group', () => {
  const groups = groupCaptions(words);
  const html = captionsHtml(groups);
  assert.match(html, /<template>/);
  assert.match(html, /data-composition-id="captions"/);
  assert.equal((html.match(/ data-cap /g) || []).length, groups.length);
  assert.match(html, /class="av-cap__w is-emph"[^>]*>script</);
  assert.match(html, /AV\.scene\("captions"\)/);
  assert.match(html, /data-t="0\.000" data-dur="[\d.]+"/);
});

test('captionsHtml escapes markup in words', () => {
  const html = captionsHtml([{ id: 'c1', t0: 0, t1: 1, words: [{ text: '<b>&', emph: false, t0: 0, t1: 1 }] }]);
  assert.match(html, /&lt;b&gt;&amp;/);
});

test('the captions root carries the data-av-scene marker, start 0 and the video duration', () => {
  const html = captionsHtml(groupCaptions(words), { duration: 9 });
  assert.match(html, /data-composition-id="captions"[^>]*data-av-scene="captions" data-av-start="0\.000" data-av-dur="9\.000"/);
  assert.match(html, /window\.__timelines\["captions"\] = AV\.timelines\["captions"\];/);
});

test('caption groups ask the kit to fit them to the band, so a very long word shrinks instead of overflowing', () => {
  const html = captionsHtml(groupCaptions(words), { duration: 9 });
  const groups = html.match(/<div class="av-cap"[^>]*>/g);
  assert.ok(groups.length > 0);
  for (const g of groups) assert.match(g, / data-fit /);
});

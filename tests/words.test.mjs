import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScript } from '../engine/script.mjs';
import { whisperTokens, alignWords, estimateWords, numberWords } from '../engine/words.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'whisper-sample.json'), 'utf8'));
const SCRIPT = '1. Did you know Claude can turn 10,000 scripts into b-roll?';
const tok = (text, t0, t1) => ({ text, norm: text.toLowerCase().replace(/[^a-z0-9]/g, ''), t0, t1 });

const monotonic = (words) => words.every((w, i) => w.t1 > w.t0 && (i === 0 || w.t0 >= words[i - 1].t0 - 1e-9));

test('whisperTokens turns whisper-cli JSON into timed tokens and drops empty ones', () => {
  const t = whisperTokens(fixture);
  assert.equal(t.length, 10);
  assert.deepEqual(t[0], { text: 'Did', norm: 'did', t0: 0.02, t1: 0.17 });
  assert.equal(t[9].norm, 'broll');
});

test('alignWords times every script word from the real whisper fixture', () => {
  const words = alignWords(parseScript(SCRIPT).words, whisperTokens(fixture));
  assert.equal(words.length, 10);
  assert.ok(monotonic(words));
  assert.equal(words[6].text, '10,000');
  assert.equal(words[6].t0, 1.14);
  assert.equal(words[6].t1, 1.96);
});

test('alignWords keeps the script spelling when whisper mishears a word', () => {
  const tokens = [tok('Did', 0, 0.2), tok('you', 0.2, 0.3), tok('know', 0.3, 0.6), tok('Cloud', 0.6, 0.8),
    tok('can', 0.8, 0.95), tok('turn', 0.95, 1.1), tok('10,000', 1.1, 1.9), tok('scripts', 1.9, 2.3),
    tok('into', 2.3, 2.5), tok('b-roll?', 2.5, 3)];
  const words = alignWords(parseScript(SCRIPT).words, tokens);
  assert.equal(words[3].text, 'Claude');
  assert.equal(words[3].t0, 0.6);
  assert.equal(words[3].t1, 0.8);
});

test('alignWords spans a number written as words, and a split word', () => {
  const tokens = [tok('Did', 0, 0.2), tok('you', 0.2, 0.3), tok('know', 0.3, 0.6), tok('Claude', 0.6, 0.8),
    tok('can', 0.8, 0.95), tok('turn', 0.95, 1.1), tok('ten', 1.1, 1.5), tok('thousand', 1.5, 1.9),
    tok('scripts', 1.9, 2.3), tok('into', 2.3, 2.5), tok('B', 2.5, 2.7), tok('roll?', 2.7, 3)];
  const words = alignWords(parseScript(SCRIPT).words, tokens);
  assert.equal(words[6].t0, 1.1);
  assert.equal(words[6].t1, 1.9);
  assert.equal(words[9].t0, 2.5);
  assert.equal(words[9].t1, 3);
});

test('alignWords interpolates a word whisper dropped, keeping times in order', () => {
  const tokens = [tok('Did', 0, 0.2), tok('you', 0.2, 0.3), tok('know', 0.3, 0.6), tok('Claude', 0.6, 0.8),
    tok('turn', 0.95, 1.1), tok('10,000', 1.1, 1.9), tok('scripts', 1.9, 2.3), tok('into', 2.3, 2.5), tok('b-roll', 2.5, 3)];
  const words = alignWords(parseScript(SCRIPT).words, tokens);
  assert.equal(words[4].text, 'can');
  assert.ok(words[4].t0 >= 0.8 && words[4].t1 <= 0.95 + 1e-9, `can at ${words[4].t0}–${words[4].t1}`);
  assert.ok(monotonic(words));
});

test('alignWords marks which script words whisper actually heard', () => {
  const tokens = [tok('Did', 0, 0.2), tok('you', 0.2, 0.3), tok('know', 0.3, 0.6), tok('Cloud', 0.6, 0.8),
    tok('turn', 0.95, 1.1), tok('ten', 1.1, 1.5), tok('thousand', 1.5, 1.9), tok('scripts', 1.9, 2.3), tok('into', 2.3, 2.5), tok('b-roll', 2.5, 3)];
  const words = alignWords(parseScript(SCRIPT).words, tokens);
  assert.deepEqual(words.filter((w) => !w.heard).map((w) => w.text), ['Claude', 'can']);
  assert.ok(words.find((w) => w.text === '10,000').heard);
});

test('numberWords spells integers, decimals, percents and years', () => {
  assert.ok(numberWords('10,000').includes('tenthousand'));
  assert.ok(numberWords('29.4%').includes('twentyninepointfourpercent'));
  assert.ok(numberWords('2026').includes('twentytwentysix'));
  assert.ok(numberWords('2026').includes('twothousandtwentysix'));
  assert.ok(numberWords('$40').includes('fortydollars'));
});

test('estimateWords gives draft timing at the requested pace with gaps between lines', () => {
  const s = parseScript('1. One two three four five.\n2. Six seven eight nine ten.');
  const words = estimateWords(s.words, { wpm: 150, gap: 0.25 });
  assert.ok(monotonic(words));
  const lineOneEnd = words[4].t1;
  assert.ok(words[5].t0 - lineOneEnd >= 0.25 - 1e-9);
  const total = words[9].t1;
  assert.ok(total > 3.8 && total < 4.8, `total ${total}`);
});

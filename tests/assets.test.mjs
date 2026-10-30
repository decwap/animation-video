import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = path.join(ROOT, 'kit', 'fonts');
const ICONS = path.join(ROOT, 'kit', 'icons');
const FAMILIES = ['Inter', 'Instrument Serif', 'JetBrains Mono', 'Outfit', 'Nunito', 'Caveat',
  'League Gothic', 'Archivo Black', 'Playfair Display', 'IBM Plex Mono'];
const CORE_ICONS = ['play', 'sparkles', 'chart-line', 'coins', 'brain', 'check', 'x', 'clock',
  'message-circle', 'terminal', 'smartphone', 'globe', 'trending-up', 'shield-check'];

const fontsCss = () => fs.readFileSync(path.join(FONTS, 'fonts.css'), 'utf8');

test('fonts.css declares every family the looks use', () => {
  const css = fontsCss();
  for (const family of FAMILIES) {
    assert.match(css, new RegExp(`font-family:\\s*'${family}'`), `missing @font-face for ${family}`);
  }
});

test('every font file fonts.css points at exists', () => {
  const urls = [...fontsCss().matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(urls.length >= FAMILIES.length, 'expected at least one file per family');
  for (const u of urls) assert.ok(fs.existsSync(path.join(FONTS, u)), `missing font file ${u}`);
});

test('each font family ships its OFL licence', () => {
  for (const family of FAMILIES) {
    const file = path.join(FONTS, `OFL-${family.replace(/ /g, '')}.txt`);
    assert.ok(fs.existsSync(file), `missing ${path.basename(file)}`);
    assert.match(fs.readFileSync(file, 'utf8'), /SIL OPEN FONT LICENSE/i);
  }
});

test('icon set has at least 120 icons, the core ones, and the Lucide licence', () => {
  const svgs = fs.readdirSync(ICONS).filter((f) => f.endsWith('.svg'));
  assert.ok(svgs.length >= 120, `only ${svgs.length} icons`);
  for (const name of CORE_ICONS) assert.ok(svgs.includes(`${name}.svg`), `missing icon ${name}`);
  assert.ok(fs.existsSync(path.join(ICONS, 'LICENSE-lucide.txt')));
});

test('config pins HyperFrames and exports the video constants', async () => {
  const c = await import('../engine/config.mjs');
  assert.equal(c.HF_PIN, '0.8.216');
  assert.equal(c.W, 1080);
  assert.equal(c.H, 1920);
  assert.equal(c.FPS, 30);
  assert.deepEqual(c.LOOKS, ['paper', 'glow', 'doodle', 'editorial']);
  assert.deepEqual(c.SAFE, { x0: 60, x1: 960, y0: 220, y1: 1520 });
  assert.deepEqual(c.CAPTION_BAND, { y0: 1400, y1: 1540 });
  const p = c.paths('/v');
  assert.equal(p.script, '/v/script.md');
  assert.equal(p.words, '/v/voice/words.json');
  assert.equal(p.looksDir, '/v/looks');
  assert.equal(p.picker, '/v/picker.html');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build, placeholderAudio } from '../engine/build.mjs';
import { PRIMITIVES } from '../engine/table.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const node = (script, args) => spawnSync('node', [path.join(ROOT, script), ...args], { encoding: 'utf8' });

test('SKILL.md names the skill and describes it in at most 1024 characters', () => {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(read('SKILL.md'));
  assert.ok(fm, 'frontmatter');
  assert.match(fm[1], /^name: animation-video$/m);
  const desc = (/^description: (.+)$/m.exec(fm[1]) || [])[1] || '';
  assert.ok(desc.length > 100 && desc.length <= 1024, `description is ${desc.length} characters`);
  assert.match(desc, /explainer/i);
});

test('every skill path that SKILL.md and the references mention exists', () => {
  const refs = ['story', 'research', 'looks', 'scenes', 'audio', 'assets', 'qa'].map((n) => `references/${n}.md`);
  for (const r of refs) assert.ok(fs.existsSync(path.join(ROOT, r)), r);
  const docs = [read('SKILL.md'), read('README.md'), ...refs.map((r) => read(r))].join('\n');
  const mentioned = new Set([...docs.matchAll(/(?<![\w./~-])((?:engine|kit|references|blueprints|scripts|brands)\/[A-Za-z0-9_./-]*[A-Za-z0-9_])/g)].map((m) => m[1]));
  assert.ok(mentioned.size > 15, `only ${mentioned.size} paths mentioned`);
  for (const p of mentioned) assert.ok(fs.existsSync(path.join(ROOT, p)), `${p} is mentioned but missing`);
});

test('scenes.md documents every primitive and every verb', () => {
  const doc = read('references', 'scenes.md');
  assert.equal(PRIMITIVES.length, 24);
  for (const p of PRIMITIVES) assert.match(doc, new RegExp(`<av-${p}\\b`), p);
  const verbs = [...read('kit', 'core', 'av.js').matchAll(/^ {4}([a-zA-Z]+)\(tl, el, t/gm)].map((m) => m[1]).filter((v) => !['doc', 'video', 'track', 'item', 'split', 'cta'].includes(v));
  assert.ok(verbs.length >= 18, `found ${verbs.length} verbs`);
  for (const v of verbs) assert.match(doc, new RegExp(`\`${v}\``), v);
});

test('new-video makes the eight entries of a video folder, copies the brand kit, and the folder builds as it is', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'av-new-')), 'my-video');
  const r = node('scripts/new-video.mjs', [dir, '--brand', path.join(ROOT, 'brands', 'example.json')]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(fs.readdirSync(dir).sort(), ['assets', 'brand.json', 'brief.md', 'research.md', 'scenes', 'script.md', 'storyboard.json', 'voice']);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8')), JSON.parse(read('brands', 'example.json')));
  const out = await build(dir, { draftTiming: true, audio: placeholderAudio });
  assert.equal(Object.keys(out.projects).length, 4);
  assert.notEqual(node('scripts/new-video.mjs', [dir]).status, 0, 'refuses to overwrite a folder that has files');
});

test('README credits Web Asamoah and says how to install', () => {
  const readme = read('README.md');
  assert.match(readme, /Web Asamoah/);
  assert.match(readme, /~\/\.claude\/skills\/animation-video/);
});

test('SKILL.md and README explain the edit pack and say Premiere is not yet tested', () => {
  for (const doc of ['SKILL.md', 'README.md']) {
    assert.match(read(doc), /edit pack/i, doc);
    assert.match(read(doc), /not yet tested in Premiere/, doc);
  }
  assert.match(read('SKILL.md'), /keeps anything else the person saved in its folder/);
  assert.match(read('SKILL.md'), /relay any `warning:` line/);
});

test('installing over the skill\'s own source folder is refused', () => {
  // run a copy, so a broken guard could only ever delete the copy
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'av-selfinstall-'));
  const copy = path.join(tmpRoot, 'animation-video');
  fs.mkdirSync(copy);
  for (const f of ['SKILL.md', 'LICENSE', 'package.json']) fs.copyFileSync(path.join(ROOT, f), path.join(copy, f));
  fs.cpSync(path.join(ROOT, 'scripts'), path.join(copy, 'scripts'), { recursive: true });
  const r = spawnSync('node', [path.join(copy, 'scripts', 'package.mjs'), '--out', path.join(tmpRoot, 'x.skill'), '--install', tmpRoot], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /source/);
  assert.ok(fs.existsSync(path.join(copy, 'SKILL.md')), 'the source survived');
});

test('the package holds the skill and none of the build outputs', () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'av-pkg-')), 'animation-video.skill');
  const r = node('scripts/package.mjs', ['--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const list = spawnSync('unzip', ['-Z1', out], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
  for (const f of ['SKILL.md', 'README.md', 'LICENSE', 'engine/build.mjs', 'engine/edit-pack.mjs', 'kit/core/av.js', 'kit/fonts/fonts.css', 'blueprints/hook.html', 'references/scenes.md']) assert.ok(list.includes(`animation-video/${f}`), f);
  for (const f of list) assert.doesNotMatch(f, /\.superpowers|tests\/gallery\/looks|tests\/kitcheck\/project|\.mp4$|\.DS_Store|node_modules|^animation-video\/docs\/|^animation-video\/\.git(\/|ignore$|hub\/)/, f);
});

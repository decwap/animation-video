// Package the skill as animation-video.skill (a zip whose root is the animation-video/ folder),
// leaving out build outputs and dev notes, and optionally install a copy for Claude Code.
// Part of animation-video (by Web Asamoah).
// CLI: node scripts/package.mjs [--out <file.skill>] [--install <skills dir>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NAME = path.basename(SKILL);
const LEAVE_OUT = [/^\.git(\/|ignore$|$)/, /^\.github(\/|$)/, /(^|\/)\.superpowers(\/|$)/, /(^|\/)\.DS_Store$/, /(^|\/)node_modules(\/|$)/, /\.mp4$/i, /^docs(\/|$)/,
  /^tests\/gallery\/(looks|picker\.html|summary\.json)/, /^tests\/kitcheck\/(project|debug\.html)/, /(^|\/)\.hyperframes(\/|$)/, /\.skill$/];

function files(dir, rel = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (LEAVE_OUT.some((re) => re.test(r))) return [];
    return e.isDirectory() ? files(path.join(dir, e.name), r) : [r];
  });
}

const { values: o } = parseArgs({ options: { out: { type: 'string' }, install: { type: 'string' } } });
const list = files(SKILL);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'av-package-'));
for (const f of list) {
  fs.mkdirSync(path.dirname(path.join(stage, NAME, f)), { recursive: true });
  fs.copyFileSync(path.join(SKILL, f), path.join(stage, NAME, f));
}
const out = path.resolve(o.out || path.join(SKILL, '..', `${NAME}.skill`));
fs.rmSync(out, { force: true });
const zip = spawnSync('zip', ['-qrX', out, NAME], { cwd: stage, encoding: 'utf8' });
if (zip.status !== 0) { console.error(`zip failed: ${zip.stderr || zip.error}`); process.exit(1); }
console.log(`packaged ${list.length} files → ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
if (o.install) {
  const dest = path.join(path.resolve(o.install.replace(/^~(?=\/|$)/, os.homedir())), NAME);
  const real = (p) => (fs.existsSync(p) ? fs.realpathSync(p) : path.resolve(p));
  if (real(dest) === real(SKILL)) { console.error(`${dest} is this skill's source folder; install somewhere else (e.g. ~/.claude/skills)`); process.exit(1); }
  if (fs.existsSync(dest)) {
    const mine = fs.existsSync(path.join(dest, 'SKILL.md')) && /^name: animation-video$/m.test(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8'));
    if (!mine) { console.error(`${dest} exists and is not an animation-video install; move it away first`); process.exit(1); }
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(path.join(stage, NAME), dest, { recursive: true });
  console.log(`installed → ${dest}`);
}
fs.rmSync(stage, { recursive: true, force: true });

// The blueprint gallery: every blueprint, one per line of script.md, built in each look with draft
// timing, then HyperFrames check and a review snapshot per look. Read the sheets it prints.
//   node tests/gallery/run.mjs [--looks paper,glow] [--no-snap]
// Line 3 carries a very long word so headline and caption fitting get tested in every look.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HF, LOOKS, SKILL_ROOT } from '../../engine/config.mjs';
import { build } from '../../engine/build.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const looks = args.includes('--looks') ? args[args.indexOf('--looks') + 1].split(',') : LOOKS;
const snap = !args.includes('--no-snap');

fs.rmSync(path.join(HERE, 'scenes'), { recursive: true, force: true });
fs.cpSync(path.join(SKILL_ROOT, 'blueprints'), path.join(HERE, 'scenes'), { recursive: true });
const listFile = path.join(HERE, 'scenes', 'list.html');
fs.writeFileSync(listFile, fs.readFileSync(listFile, 'utf8').replace('Three things it <em>does</em>', 'Three <em>Unbelievably-long-compound-wordsmithery</em> things'));
for (const l of looks) fs.rmSync(path.join(HERE, 'looks', l), { recursive: true, force: true });

const out = await build(HERE, { looks, draftTiming: true });
console.log(`built ${looks.join(', ')} · ${out.duration} s`);
for (const w of out.warnings.filter((x) => !/draft timing/.test(x))) console.log(`  ! ${w}`);

const summary = [];
for (const look of looks) {
  const dir = out.projects[look];
  const run = (a) => spawnSync('npx', [...HF, ...a], { cwd: dir, encoding: 'utf8', maxBuffer: 1 << 28 });
  const check = run(['check', '--json']);
  let report = {};
  try { report = JSON.parse(check.stdout); } catch { console.error(check.stdout.slice(0, 1500), check.stderr.slice(-1500)); }
  const findings = ['lint', 'runtime', 'layout', 'motion', 'contrast', 'craft'].flatMap((k) => (report[k]?.findings || []).map((f) => ({ area: k, ...f })));
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const snapshots = [];
  if (snap) {
    const s = run(['snapshot', '--review', '--json']);
    try {
      const j = JSON.parse(s.stdout);
      const walk = (v) => { if (typeof v === 'string' && /\.(png|jpe?g)$/.test(v)) snapshots.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
      walk(j);
    } catch { snapshots.push(...(s.stdout.match(/\/[^\s"]+\.(?:png|jpe?g)/g) || [])); }
  }
  summary.push({ look, ok: report.ok, errors: errors.length, warnings: warnings.length, snapshots });
  console.log(`\n${look}: check ok=${report.ok} errors=${errors.length} warnings=${warnings.length}`);
  for (const f of [...errors, ...warnings].slice(0, 40)) console.log(`  ${f.area}:${f.severity}:${f.code} ${f.selector || ''} @${f.time ?? ''} ${(f.message || '').slice(0, 160)}`);
  for (const p of snapshots) console.log(`  sheet: ${p}`);
}
fs.writeFileSync(path.join(HERE, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.exit(summary.every((s) => s.ok !== false && s.errors === 0) ? 0 : 1);

// Scaffold a video folder: brief, a starter script (a hook and the brand's call to action), an
// empty fact-check, a storyboard and two scenes copied from the hook and cta blueprints, so it
// builds at once with --draft. Part of animation-video (by Web Asamoah).
// CLI: node scripts/new-video.mjs <dir> [--brand <brand.json>]
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { brand: { type: 'string' } } });
const dir = positionals[0];
if (!dir) { console.error('usage: node scripts/new-video.mjs <dir> [--brand <brand.json>]'); process.exit(1); }
if (fs.existsSync(dir) && fs.readdirSync(dir).length) { console.error(`${dir} already has files; pick a new folder`); process.exit(1); }

const brandFile = o.brand || path.join(SKILL, 'brands', 'example.json');
const brand = JSON.parse(fs.readFileSync(brandFile, 'utf8'));
const slug = path.basename(path.resolve(dir)).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
const title = slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
const cta = brand.cta || { keyword: 'MORE', line: 'and I will send you more' };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

fs.mkdirSync(path.join(dir, 'scenes'), { recursive: true });
for (const d of ['voice', 'assets']) fs.mkdirSync(path.join(dir, d), { recursive: true });
const write = (f, text) => fs.writeFileSync(path.join(dir, f), text);

write('brief.md', `# Brief: ${title}

- Topic:
- Audience:
- Length: 30-60 s (about 150 words a minute)
- Brand kit: ${path.basename(brandFile)}
- Call to action: Comment ${cta.keyword} ${cta.line}
- Must include:
- Avoid:
`);
write('script.md', `# ${title}
1. Did you know your *script* can become an animated explainer?
2. Comment ${cta.keyword} ${cta.line}.
`);
write('research.md', `# Fact-check: ${title}

| # | Claim as scripted | Verdict | Source (URL, accessed) | Rewrite |
|---|---|---|---|---|
`);
write('storyboard.json', `${JSON.stringify({
  title,
  slug,
  scenes: [
    { id: 'hook', src: 'scenes/hook.html', lines: [1, 1] },
    { id: 'cta', src: 'scenes/cta.html', lines: [2, 2], hold: 3 },
  ],
}, null, 2)}\n`);
fs.copyFileSync(path.join(SKILL, 'blueprints', 'hook.html'), path.join(dir, 'scenes', 'hook.html'));
write(path.join('scenes', 'cta.html'), fs.readFileSync(path.join(SKILL, 'blueprints', 'cta.html'), 'utf8')
  .replace('keyword="ANIMATE"', `keyword="${esc(cta.keyword)}"`)
  .replace('line="and I\'ll send you the skill, free"', `line="${esc(cta.line)}"`));
write('brand.json', fs.readFileSync(brandFile, 'utf8'));
console.log(`new video at ${dir}\nnext: write script.md, fact-check it in research.md, then node ${path.join(SKILL, 'engine', 'build.mjs')} ${dir} --draft`);

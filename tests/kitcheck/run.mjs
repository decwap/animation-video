// Real-browser check of the kit runtime: a hand-built one-scene HyperFrames project that uses
// AV.scene (word-synced headline, objectIn, countUp, a b-roll canvas). Runs hyperframes check and
// snapshot, then prints the snapshot paths to look at.   node tests/kitcheck/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HF, GSAP_URL, KIT_DIR } from '../../engine/config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const P = path.join(HERE, 'project');
fs.rmSync(P, { recursive: true, force: true });
fs.mkdirSync(path.join(P, 'compositions'), { recursive: true });
fs.cpSync(path.join(KIT_DIR, 'core'), path.join(P, 'assets', 'kit'), { recursive: true });
fs.cpSync(path.join(KIT_DIR, 'fonts'), path.join(P, 'assets', 'kit', 'fonts'), { recursive: true });

fs.writeFileSync(path.join(P, 'index.html'), `<!doctype html>
<html lang="en" data-av-look="paper">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1080, height=1920" />
<script src="${GSAP_URL}"></script>
<link rel="stylesheet" href="assets/kit/fonts/fonts.css" />
<link rel="stylesheet" href="assets/kit/base.css" />
<script src="assets/kit/table.js"></script>
<script src="assets/kit/refs.js"></script>
<script src="assets/kit/av.js"></script>
<script src="assets/kit/broll.js"></script>
<script>window.AV_DATA = { words: [], scenes: { s1: { start: 0, end: 4, wordRange: [0, 0] } } };</script>
<style>[data-composition-id="main"] { position: relative; width: 100%; height: 100%; overflow: hidden; background: #F3EDE4; }</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="1080" data-height="1920" data-duration="4">
  <div id="s1" data-composition-id="s1" data-composition-src="compositions/s1.html" data-start="0" data-duration="4" data-track-index="1" data-width="1080" data-height="1920"></div>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  AV.decorTimeline(tl, 4);
  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
</script>
</body>
</html>
`);

fs.writeFileSync(path.join(P, 'compositions', 's1.html'), `<!doctype html>
<html><head><meta charset="UTF-8" /></head>
<body>
<template>
  <style>
    #root { position: absolute; inset: 0; }
    #s1--h { font: 900 110px 'Inter'; color: #1B1714; letter-spacing: -0.04em; }
    #s1--b { width: 320px; height: 200px; background: #D4613A; border-radius: 28px; }
    .av-counter__num { font: 900 140px 'Inter'; color: #1B1714; }
    #s1--r { width: 960px; height: 560px; border-radius: 32px; background: #FFFFFF; }
  </style>
  <div id="root" data-composition-id="s1" data-width="1080" data-height="1920" data-av-scene="s1" data-av-start="0.000" data-av-dur="4.000">
    <div class="av-scene"><div class="av-stage">
      <h1 id="s1--h" class="av-p av-headline" data-t="0.300"><span class="av-w">Hello</span> <span class="av-w">kit</span></h1>
      <div id="s1--b" class="av-p av-doc" data-t="1.000"></div>
      <div id="s1--c" class="av-p av-counter" data-t="1.500"><span class="av-counter__num" data-to="5942">5,942</span></div>
      <div id="s1--r" class="av-p av-broll" data-broll="network" data-t="0.000"><canvas width="960" height="560"></canvas></div>
      <span id="s1--m" class="av-p av-mark" data-t="2.000" style="font: 800 70px Inter"><span class="av-mark__bg" style="background:#FFD84D"></span><span class="av-mark__t">marked</span></span>
    </div></div>
  </div>
  <script>AV.scene("s1");
  window.__timelines["s1"] = AV.timelines["s1"];</script>
</template>
</body></html>
`);

// A player page for live debugging: python3 -m http.server in project/, open debug.html.
fs.writeFileSync(path.join(P, 'debug.html'), `<!doctype html><html><head><meta charset="utf-8"><title>kit debug</title>
<script src="https://cdn.jsdelivr.net/npm/hyperframes@0.8.216/dist/hyperframes-player.global.js"></script>
<style>body{margin:10px;background:#222} hyperframes-player{width:270px;height:480px;display:block}</style></head>
<body><hyperframes-player id="p" src="index.html" muted></hyperframes-player></body></html>
`);

const run = (args) => spawnSync('npx', [...HF, ...args], { cwd: P, encoding: 'utf8', maxBuffer: 1 << 26 });
const check = run(['check', '--json']);
let report;
try { report = JSON.parse(check.stdout); } catch { console.error(check.stdout.slice(0, 2000), check.stderr.slice(-2000)); process.exit(1); }
const findings = ['lint', 'runtime', 'layout', 'motion'].flatMap((k) => (report[k]?.findings || []).map((f) => `${k}:${f.severity}:${f.code}: ${f.message}`));
console.log(`check ok=${report.ok}`);
for (const f of findings) console.log(`  ${f}`);
const snap = run(['snapshot', '--frames', '4']);
console.log(snap.stdout.split('\n').filter((l) => /\.png|\.jpg/.test(l)).join('\n'));
process.exit(report.ok ? 0 : 1);

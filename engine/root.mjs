// The root composition of one look's project: the kit in <head>, a persistent decor layer,
// one host per scene on alternating tracks, the captions host, the watermark and the audio.
import { W, H, GSAP_URL } from './config.mjs';
import { escapeHtml } from './html.mjs';

const r3 = (t) => +t.toFixed(3);

// The look's background layer as its own sub-composition (HyperFrames wants nested markup in
// a scene, not on the root); AV.scene("decor") runs the look's decorTimeline on it.
export function decorHtml({ look, brand = {}, duration }) {
  return `<!doctype html>
<html><head><meta charset="UTF-8" /></head>
<body>
<template>
  <style>#root { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }</style>
  <div id="root" data-composition-id="decor" data-width="${W}" data-height="${H}" data-av-scene="decor" data-av-start="0.000" data-av-dur="${duration.toFixed(3)}">
    ${look.decor ? look.decor(brand) : ''}
  </div>
  <script>AV.scene("decor");
  window.__timelines["decor"] = AV.timelines["decor"];</script>
</template>
</body></html>
`;
}

export function rootHtml({ look, plan, brand = {}, durations = {}, title = '' }) {
  const D = plan.duration;
  const hosts = plan.scenes.map((s, k) =>
    `  <div id="scene-${s.id}" data-composition-id="${s.id}" data-composition-src="compositions/${s.id}.html" data-start="${s.start}" data-duration="${r3(s.end - s.start)}" data-track-index="${1 + (k % 2)}" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>`);
  return `<!doctype html>
<html lang="en" data-av-look="${look.id}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<title>${escapeHtml(title || 'Animation video')} · ${escapeHtml(look.label || look.id)}</title>
<script src="${GSAP_URL}"></script>
<link rel="stylesheet" href="assets/kit/fonts/fonts.css" />
<link rel="stylesheet" href="assets/kit/base.css" />
<link rel="stylesheet" href="assets/kit/look.css" />
<script src="assets/kit/table.js"></script>
<script src="assets/kit/refs.js"></script>
<script src="assets/kit/av-data.js"></script>
<script src="assets/kit/av.js"></script>
<script src="assets/kit/broll.js"></script>
<script src="assets/kit/motion.js"></script>
<style>[data-composition-id="main"] { position: relative; width: 100%; height: 100%; overflow: hidden; background: var(--av-bg); }</style>
${brand.accent ? `<style>:root { --av-accent: ${brand.accent}; }</style>\n` : ''}</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-width="${W}" data-height="${H}" data-duration="${D}">
  <div id="decor" data-composition-id="decor" data-composition-src="compositions/decor.html" data-start="0" data-duration="${D}" data-track-index="0" data-track-kind="graphics" data-width="${W}" data-height="${H}"></div>
${hosts.join('\n')}
  <div id="watermark" class="clip av-watermark" data-start="0" data-duration="${D}" data-track-index="4">${escapeHtml(brand.handle || brand.name || '')}</div>
  <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${D}" data-track-index="5" data-track-kind="captions" data-width="${W}" data-height="${H}"></div>
  <audio id="vo" src="assets/audio/vo.wav" data-start="0" data-duration="${r3(durations.vo ?? D)}" data-track-index="6" data-volume="1"></audio>
  <audio id="music" src="assets/audio/music.wav" data-start="0" data-duration="${D}" data-track-index="7" data-volume="1"></audio>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
</script>
</body>
</html>
`;
}

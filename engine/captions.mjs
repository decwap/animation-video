// Word-timed captions: short groups cut at punctuation and line ends, written as one
// look-agnostic sub-composition. Each look styles .av-cap and animates it (captionIn/Out).
import { W, H } from './config.mjs';

const r3 = (t) => +t.toFixed(3);
export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function groupCaptions(words, { maxWords = 4, maxChars = 22, hold = 0.6 } = {}) {
  const groups = [];
  let cur = [];
  const flush = () => { if (cur.length) groups.push(cur); cur = []; };
  for (const w of words) {
    if (cur.length && cur.at(-1).line !== w.line) flush();
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    if (cur.length >= maxWords || (cur.length && chars > maxChars)) flush();
    cur.push(w);
    if (/[,.?!:;]$/.test(w.text)) flush();
  }
  flush();
  return groups.map((g, q) => {
    const next = groups[q + 1];
    const t0 = g[0].t0;
    const end = g.at(-1).t1 + hold;
    const t1 = next ? Math.min(next[0].t0, end) : end;
    return {
      id: `c${q + 1}`,
      t0: r3(t0),
      t1: r3(Math.max(t1, t0 + 0.1)),
      words: g.map((w) => ({ text: w.text, emph: w.emph, t0: w.t0, t1: w.t1 })),
    };
  });
}

export function captionsHtml(groups, { duration } = {}) {
  const dur = duration ?? (groups.length ? groups.at(-1).t1 : 0);
  const blocks = groups.map((g) => {
    const spans = g.words.map((w) => `<span class="av-cap__w${w.emph ? ' is-emph' : ''}" data-wt="${r3(w.t0).toFixed(3)}">${escapeHtml(w.text)}</span>`).join(' ');
    return `    <div class="av-cap" id="${g.id}" data-cap data-fit data-t="${g.t0.toFixed(3)}" data-dur="${r3(g.t1 - g.t0).toFixed(3)}">${spans}</div>`;
  });
  return `<!doctype html>
<html><head><meta charset="UTF-8" /></head>
<body>
<template>
  <style>#root { position: absolute; inset: 0; pointer-events: none; }</style>
  <div id="root" data-composition-id="captions" data-width="${W}" data-height="${H}" data-av-scene="captions" data-av-start="0.000" data-av-dur="${dur.toFixed(3)}">
${blocks.join('\n')}
  </div>
  <script>AV.scene("captions");
  window.__timelines["captions"] = AV.timelines["captions"];</script>
</template>
</body></html>
`;
}

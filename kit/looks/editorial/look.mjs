// Bold Editorial: magazine type, halftone, colour blocks and stamps that slam down with a camera
// shake. Best for news, stories and hot takes. Part of animation-video (by Web Asamoah).
import { base, sfxFor, esc, list, num, splitWords } from '../shared.mjs';

const B = base();
// League Gothic is very condensed, so its slabs run bigger than the other looks' headlines.
const SIZES = { xl: 176, l: 148, m: 120, s: 96 };
const BAR_W = [96, 88, 92, 70, 84, 60];

function clipping(a) {
  const hl = num(a.hl, 0);
  const items = list(a.items);
  const rows = items.length
    ? items.map((t, k) => `<div class="av-doc__line${k + 1 === hl ? ' is-hl' : ''}">${esc(t)}</div>`)
    : Array.from({ length: num(a.lines, 6) }, (_, k) => `<div class="av-doc__bar${k + 1 === hl ? ' is-hl' : ''}" style="width:${BAR_W[k % BAR_W.length]}%"></div>`);
  return `<div class="av-p av-doc ed-clip"><div class="ed-clip__k">${esc(a.dateline || 'THE EXPLAINER · AI DESK')}</div><div class="ed-clip__h">${esc(a.title || 'notes.txt')}</div><div class="ed-clip__b">${items.length ? '' : '<i class="ed-ht"></i>'}<div class="av-doc__body">${rows.join('')}</div></div></div>`;
}

const primitives = {
  ...B,
  headline: (a, inner) => {
    const size = SIZES[a.size] || num(a.px, SIZES.xl);
    return `<h1 class="av-p av-headline av-headline--${SIZES[a.size] ? a.size : 'xl'}" data-fit="${size}" style="font-size:${size}px">${splitWords(inner)}</h1>`;
  },
  doc: (a) => clipping(a),
  mascot: (a) => `<div class="av-p av-mascot av-mascot--${a.pose || 'hop'}"><svg viewBox="0 0 160 160" width="160" height="160">
<circle class="ed-seal" cx="80" cy="80" r="70"/><circle class="ed-seal__ring" cx="80" cy="80" r="56"/>
<circle class="av-mascot__eye ed-seal__eye" cx="62" cy="74" r="8"/><circle class="av-mascot__eye ed-seal__eye" cx="98" cy="74" r="8"/>
<path class="ed-seal__smile" d="M56 98 Q80 118 104 98"/></svg></div>`,
};

export default {
  id: 'editorial',
  label: 'Bold Editorial',
  fonts: ['League Gothic', 'Playfair Display', 'Archivo Black', 'IBM Plex Mono'],
  primitives,
  sfxFor,
  sfxGain: { pop: 0.6, whoosh: 0.55, swish: 0.5, tick: 0.5, type: 0.5, ding: 0.7, stamp: 0.95, draw: 0.5, riser: 0.6, impact: 0.9, click: 0.5, sparkle: 0.55 },
  // Newsroom: typewriter keys, paper flips, a heavy stamp thud.
  sfxBank: {
    pop: { make: 'tap' }, whoosh: { make: 'swipe' }, swish: { make: 'flip' }, tick: { make: 'tick' },
    type: { make: 'type', d: 0.8, n: 12 }, ding: { make: 'notify' }, stamp: { make: 'stamp' }, draw: { make: 'scribble', d: 0.4 },
    riser: { make: 'rise' }, impact: { make: 'slam' }, click: { make: 'key' }, sparkle: { make: 'appear' },
  },
  music: { bpm: 120, feel: 'news', progression: ['Dm', 'Bb', 'F', 'C'], drums: 'punchy', stings: true },
  // Static decor like the other looks (no scrolling ticker): halftone corners that bleed past the
  // frame on purpose, the masthead and its rule.
  decor: () => {
    const bleed = 'data-layout-allow-overflow';
    return `<div class="ed-half ed-h1" ${bleed}></div><div class="ed-half ed-h2" ${bleed}></div><div class="ed-mast"><span>THE EXPLAINER</span><span>VOL. 01</span></div><i class="ed-rule"></i>`;
  },
};

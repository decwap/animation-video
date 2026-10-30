// Midnight Glow: dark glass, neon gradients, glowing timelines and drifting light particles.
// Best for money, markets and AI news. Part of animation-video (by Web Asamoah).
import { base, sfxFor } from '../shared.mjs';

const B = base();
const GLASS = new Set(['doc', 'window', 'chat', 'terminal', 'chart', 'track', 'split', 'cta', 'item', 'video']);
// A light sweep inside every glass card, animated after it lands.
const sweep = (html) => html.replace(/(<\/[a-z]+>)\s*$/, '<i class="gl-sweep"></i>$1');

const primitives = Object.fromEntries(Object.entries(B).map(([name, fn]) => [name, GLASS.has(name) ? (a, i, h) => sweep(fn(a, i, h)) : fn]));
primitives.doc = (a, i, h) => sweep(B.doc(a, i, h).replace('<div class="av-doc__body">', '<i class="gl-beam"></i><div class="av-doc__body">'));
primitives.mascot = (a) => `<div class="av-p av-mascot av-mascot--${a.pose || 'hop'}"><svg viewBox="0 0 160 170" width="160" height="170">
<line class="gl-bot__line" x1="80" y1="38" x2="80" y2="16"/><circle class="gl-bot__tip" cx="80" cy="13" r="8"/>
<circle class="gl-bot__orb" cx="80" cy="96" r="58"/><rect class="gl-bot__visor" x="44" y="78" width="72" height="34" rx="17"/>
<circle class="av-mascot__eye gl-bot__eye" cx="64" cy="95" r="7"/><circle class="av-mascot__eye gl-bot__eye" cx="96" cy="95" r="7"/></svg></div>`;

// Seeded particle positions, so every render of the decor is identical.
function particles(n = 30, seed = 7) {
  let s = seed;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, () => {
    const size = 4 + r() * 9;
    return `<i class="gl-pt" style="left:${(r() * 1080).toFixed(0)}px;top:${(420 + r() * 1400).toFixed(0)}px;width:${size.toFixed(1)}px;height:${size.toFixed(1)}px"></i>`;
  }).join('');
}

export default {
  id: 'glow',
  label: 'Midnight Glow',
  fonts: ['Outfit', 'JetBrains Mono'],
  primitives,
  sfxFor,
  sfxGain: { pop: 0.6, whoosh: 0.55, swish: 0.5, tick: 0.45, type: 0.4, ding: 0.75, stamp: 0.8, draw: 0.5, riser: 0.6, impact: 0.85, click: 0.45, sparkle: 0.6 },
  // Synth blips and airy sweeps.
  sfxBank: {
    pop: { make: 'appear' }, whoosh: { make: 'swish' }, swish: { make: 'wipe' }, tick: { make: 'blink' },
    type: { make: 'typing', d: 0.8 }, ding: { make: 'shimmer' }, stamp: { make: 'slam' }, draw: { make: 'swipe' },
    riser: { make: 'rise' }, impact: { make: 'impact' }, click: { make: 'key' }, sparkle: { make: 'form' },
  },
  music: { bpm: 110, feel: 'synthwave', progression: ['Am', 'F', 'C', 'G'], lead: 'pluckSynth', pad: true },
  decor: () => `<div class="gl-aur gl-a1"></div><div class="gl-aur gl-a2"></div><div class="gl-aur gl-a3"></div><div class="gl-grid"></div><div class="gl-pts">${particles()}</div>`,
};

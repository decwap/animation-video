// Warm Paper: the reference look, upgraded. Cream paper, Claude-orange accents, floating white
// cards, an original pixel camera mascot. Best for how-tos, tech and AI tools.
// Part of animation-video (by Web Asamoah).
import { base, sfxFor } from '../shared.mjs';

// The pixel camera mascot: two film reels on a camcorder body, with eyes.
const MAP = [
  '...KKK....KKK....', '..K...K..K...K...', '..K.K.K..K.K.K...', '..K...K..K...K...', '...KKK....KKK....',
  '.OOOOOOOOOOOO....', '.OOOOOOOOOOOOLL..', '.OOEEOOOOEEOOLLL.', '.OOEEOOOOEEOOLLL.', '.OOOOOOOOOOOOLL..',
  '.OOOOOOOOOOOO....', '..O..O....O..O...', '..O..O....O..O...',
];
const COL = { K: '#3A2A22', O: '#D4613A', E: '#1E1A17', L: '#A8462B' };
const pixels = MAP.flatMap((row, y) => [...row].map((c, x) => (COL[c]
  ? `<rect x="${x * 8}" y="${y * 8}" width="8" height="8" fill="${COL[c]}"${c === 'E' ? ' class="av-mascot__eye"' : ''}/>` : ''))).join('');

const primitives = {
  ...base(),
  mascot: (a) => `<div class="av-p av-mascot av-mascot--${a.pose || 'hop'}"><svg viewBox="0 0 136 104" width="180" height="138" shape-rendering="crispEdges">${pixels}</svg></div>`,
};

export default {
  id: 'paper',
  label: 'Warm Paper',
  fonts: ['Inter', 'Instrument Serif', 'JetBrains Mono', 'Caveat'],
  primitives,
  sfxFor,
  sfxGain: { pop: 0.7, whoosh: 0.6, swish: 0.55, tick: 0.5, type: 0.45, ding: 0.8, stamp: 0.85, draw: 0.5, riser: 0.55, impact: 0.8, click: 0.5, sparkle: 0.6 },
  // Recipes for the sound bank (engine/audio/bank.mjs): soft, warm, a little woody.
  sfxBank: {
    pop: { make: 'pop', v: 0.9 }, whoosh: { make: 'whoosh', d: 0.45 }, swish: { make: 'swish' }, tick: { make: 'tick' },
    type: { make: 'type', d: 0.8, n: 14 }, ding: { make: 'ding' }, stamp: { make: 'stamp' }, draw: { make: 'scribble', d: 0.45 },
    riser: { make: 'rise' }, impact: { make: 'impact' }, click: { make: 'key' }, sparkle: { make: 'appear' },
  },
  music: { bpm: 96, feel: 'lofi', progression: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'], lead: 'pluck', drums: 'soft' },
  decor: () => '<div class="pp-glow pp-g1"></div><div class="pp-glow pp-g2"></div><div class="pp-glow pp-g3"></div><div class="pp-dots"></div>',
};

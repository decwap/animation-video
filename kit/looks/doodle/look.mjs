// Storybook Doodle: hand-drawn lines that draw themselves on notebook paper, marker highlights
// and a gentle wobble. Best for kids, beginners and simple ideas. Part of animation-video (by Web Asamoah).
import { base, sfxFor, esc, list, num } from '../shared.mjs';

const B = base();

// A sketched page with scribbled lines; text lines (items) fall back to an outlined card.
function page(a) {
  const hl = num(a.hl, 0);
  const rows = Array.from({ length: num(a.lines, 5) }, (_, k) => {
    const y = 112 + k * 52;
    return `<path class="dd-stroke dd-thin${k + 1 === hl ? ' dd-hl' : ''}" d="M46 ${y} Q 96 ${y - 9} 150 ${y + 3} T ${230 - (k % 3) * 24} ${y - 2}"/>`;
  }).join('');
  return `<div class="av-p av-doc dd-page"><svg class="dd-svg" viewBox="0 0 300 400" width="300" height="400"><path class="dd-stroke dd-fill" d="M16 22 L232 12 L286 64 L290 384 Q 150 394 20 388 Z"/><path class="dd-stroke" d="M232 12 L234 66 L286 64"/>${rows}</svg><span class="dd-page__title">${esc(a.title || 'notes.txt')}</span></div>`;
}

const primitives = {
  ...B,
  doc: (a, i, h) => (list(a.items).length ? B.doc(a, i, h) : page(a)),
  video: (a) => `<div class="av-p av-video dd-tv"><svg class="dd-svg" viewBox="0 0 300 330" width="300" height="330">
<path class="dd-stroke" d="M104 40 L 70 2"/><path class="dd-stroke" d="M190 38 L 226 2"/>
<path class="dd-stroke dd-fill" d="M22 52 Q 20 36 36 36 L 264 30 Q 280 30 280 46 L 286 250 Q 286 266 270 266 L 36 270 Q 20 270 20 254 Z"/>
<path class="dd-stroke dd-thin" d="M48 66 L 254 62 L 258 238 L 52 240 Z"/><path class="dd-tri" d="M124 104 L 204 152 L 126 200 Z"/>
<path class="dd-stroke" d="M70 270 L 58 326"/><path class="dd-stroke" d="M232 266 L 246 324"/></svg>${a.label ? `<div class="av-video__label">${esc(a.label)}</div>` : ''}</div>`,
  mascot: (a) => `<div class="av-p av-mascot av-mascot--${a.pose || 'hop'}"><svg class="dd-svg" viewBox="0 0 160 160" width="160" height="160">
<path class="dd-stroke dd-star" d="M80 10 L98 56 L148 58 L108 88 L122 138 L80 110 L38 138 L52 88 L12 58 L62 56 Z"/>
<circle class="av-mascot__eye dd-eye" cx="66" cy="76" r="6"/><circle class="av-mascot__eye dd-eye" cx="94" cy="76" r="6"/>
<path class="dd-stroke dd-thin" d="M66 94 Q 80 106 94 94"/></svg></div>`,
  note: (a, inner) => `<div class="av-p av-note"><span class="av-note__t">${inner}</span><svg class="dd-squig" viewBox="0 0 300 30" width="300" height="30"><path class="dd-stroke dd-thin dd-coral" d="M4 16 Q 24 4 44 16 T 84 16 T 124 16 T 164 16 T 204 16 T 244 16 T 296 16"/></svg></div>`,
};

export default {
  id: 'doodle',
  label: 'Storybook Doodle',
  fonts: ['Nunito', 'Caveat'],
  primitives,
  sfxFor,
  sfxGain: { pop: 0.6, whoosh: 0.5, swish: 0.5, tick: 0.5, type: 0.45, ding: 0.75, stamp: 0.8, draw: 0.55, riser: 0.55, impact: 0.75, click: 0.5, sparkle: 0.6 },
  // Gentle pops, paper flips, pencil scribbles and a two-note chime (chosen in review over the
  // first set's cartoon boings).
  sfxBank: {
    pop: { make: 'pop', v: 0.8 }, whoosh: { make: 'swish' }, swish: { make: 'flip' }, tick: { make: 'tick' },
    type: { make: 'typing', d: 0.8 }, ding: { make: 'notify' }, stamp: { make: 'drop' }, draw: { make: 'scribble', d: 0.45 },
    riser: { make: 'rise' }, impact: { make: 'thud' }, click: { make: 'key' }, sparkle: { make: 'appear' },
  },
  // Warm acoustic: soft plucked guitar over a gentle shaker and rim, chosen over playful marimba and claps.
  music: { bpm: 92, feel: 'lofi', progression: ['C', 'G', 'Am', 'F'], lead: 'pluck', drums: 'soft' },
  decor: () => '<div class="dd-rules"></div><div class="dd-margin"></div><svg class="dd-defs" width="0" height="0" aria-hidden="true"><filter id="dd-rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7"/><feDisplacementMap in="SourceGraphic" scale="2.5"/></filter></svg>',
};

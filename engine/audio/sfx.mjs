// Copied unchanged from web-asamoah-reels (MIT, by Web Asamoah) for animation-video.
// Sound effects for the reel, one function per cue type. Everything is synthesized
// (no samples), seeded, and pitched to D major where it has a pitch.
import * as S from './synth.mjs';

const { SR, n, midiHz, rng, biquad, svfBP, svfLP, softclip } = S;
const D = ['D', 'E', 'F#', 'A', 'B']; // D major pentatonic
const penta = (i, oct = 5) => n(D[((i % 5) + 5) % 5] + (oct + Math.floor(i / 5)));
const buf = (sec) => new Float32Array(Math.round(sec * SR));
const mixIn = (dst, src, at = 0, g = 1) => { const o = Math.round(at * SR); for (let i = 0; i < src.length && i + o < dst.length; i++) if (i + o >= 0) dst[i + o] += src[i] * g; return dst; };
const tone = (len, fn) => { const x = buf(len); let ph = 0; for (let i = 0; i < x.length; i++) { const t = i / SR; const [f, a] = fn(t); ph += 2 * Math.PI * f / SR; x[i] = Math.sin(ph) * a; } return x; };
const noise = (len, seed, env) => { const r = rng(seed); const x = buf(len); for (let i = 0; i < x.length; i++) x[i] = (r() * 2 - 1) * env(i / SR); return x; };

// --------------------------------------------------------------- building blocks
function shatter(seed = 3) {
  const x = buf(1.4);
  mixIn(x, biquad(noise(0.6, seed, (t) => Math.exp(-t / 0.08)), 'hp', 1800, 0.7), 0, 0.9);
  const r = rng(seed + 1);
  // shards: many short high resonances scattered over the first 0.6 s
  for (let k = 0; k < 26; k++) {
    const at = Math.pow(r(), 1.8) * 0.6;
    const f = 2500 + r() * 6000;
    const tau = 0.01 + r() * 0.05;
    mixIn(x, tone(0.25, (t) => [f * (1 + 0.02 * Math.sin(t * 90)), Math.exp(-t / tau)]), at, 0.12 + r() * 0.12);
  }
  return x;
}
function boing(f0 = 280, len = 0.45) { return tone(len, (t) => [f0 * (1 + 0.35 * Math.sin(t * 2 * Math.PI * 14) * Math.exp(-t / 0.12)) * (1 + 0.5 * Math.exp(-t / 0.03)), Math.exp(-t / 0.16) * Math.min(1, t / 0.003)]); }
function blip(f1, f2, len = 0.12, tau = 0.05) { return tone(len, (t) => [f2 + (f1 - f2) * Math.exp(-t / 0.02), Math.exp(-t / tau) * Math.min(1, t / 0.002)]); }
function chime(midis, gap = 0.08, vel = 1) { const x = buf(2.2); midis.forEach((m, i) => mixIn(x, S.bell(m, { vel, dur: 1.8, ratio: 3.01, index: 1.0 }), i * gap, 1 / Math.sqrt(midis.length))); return x; }
function knock(f = 820, seed = 5) { const x = buf(0.18); mixIn(x, tone(0.18, (t) => [f, Math.exp(-t / 0.03)]), 0, 0.6); mixIn(x, tone(0.18, (t) => [f * 2.3, Math.exp(-t / 0.012)]), 0, 0.3); mixIn(x, biquad(noise(0.02, seed, (t) => 1 - t / 0.02), 'bp', 2500, 1), 0, 0.4); return x; }
function crunch(seed = 7, len = 0.22, hi = 1) {
  const r = rng(seed);
  const x = buf(len);
  // bursts of grit: a chewy, crumbly texture
  for (let b = 0; b < 9; b++) {
    const at = r() * len * 0.7;
    mixIn(x, noise(0.03, seed * 10 + b, (t) => Math.exp(-t / 0.008)), at, 0.5 + r() * 0.5);
  }
  biquad(x, 'bp', 1600 * hi, 0.8);
  return x;
}

// --------------------------------------------------------------- the cue table
export function make(c) {
  const v = c.v ?? 1;
  const k = c.n ?? 0;
  switch (c.type) {
    case 'whoosh': return { sig: S.whoosh({ dur: c.d ?? 0.5, seed: Math.round(c.t * 100) }), g: 0.22 * v, wet: 0.25 };
    case 'swish': return { sig: S.whoosh({ dur: 0.32, from: 900, to: 6500, seed: Math.round(c.t * 100) }), g: 0.12 * v, wet: 0.2 };
    case 'swipe': return { sig: S.whoosh({ dur: 0.3, from: 700, to: 5000, seed: 91 }), g: 0.16, wet: 0.15, pan: -0.4 };
    case 'card': return { sig: S.whoosh({ dur: 0.24, from: 1200, to: 5200, seed: 90 + k + Math.round(c.t * 10) }), g: 0.1, wet: 0.15, pan: (k - 1) * 0.35 };
    case 'glitch': {
      const x = buf(0.24); const r = rng(Math.round(c.t * 100));
      for (let i = 0; i < 6; i++) mixIn(x, tone(0.03, (t) => [300 + r() * 2500, Math.sign(Math.sin(t * 900)) * 0.6]), i * 0.035, 1);
      mixIn(x, biquad(noise(0.22, 9, (t) => (Math.floor(t * 120) % 2) * 0.6), 'hp', 2000, 0.7), 0, 0.6);
      return { sig: x, g: 0.15 * v, wet: 0.05 };
    }
    case 'shatter': return { sig: shatter(13), g: 0.42, wet: 0.35 };
    case 'impact': return { sig: S.impact({ vel: 1 }), g: 0.5, wet: 0.35 };
    case 'slam': { const x = buf(1.2); mixIn(x, S.impact({ vel: 0.8, seed: 41 }), 0, 0.7); mixIn(x, S.kick({ vel: 1, tune: -6 }), 0, 0.8); return { sig: x, g: 0.45, wet: 0.3 }; }
    case 'tumble': { const x = buf(1.0); for (let i = 0; i < 6; i++) mixIn(x, knock(500 - i * 40, 20 + i), i * 0.06 + (i % 2) * 0.02, 0.6); return { sig: x, g: 0.2, wet: 0.25 }; }
    case 'coinflip': {
      // a spinning coin: a bright ring with a quickening flutter
      const x = tone(0.7, (t) => [midiHz(n('A6')), Math.exp(-t / 0.3) * (0.55 + 0.45 * Math.sin(2 * Math.PI * (18 + 30 * t) * t))]);
      mixIn(x, tone(0.7, (t) => [midiHz(n('E7')), 0.4 * Math.exp(-t / 0.2)]), 0, 1);
      return { sig: x, g: 0.12, wet: 0.35 };
    }
    case 'wipe': return { sig: S.whoosh({ dur: 0.5, from: 400, to: 3000, seed: 33 }), g: 0.16, wet: 0.3 };
    case 'tick': {
      // number scramble: a short run of soft ticks (descending if counting down)
      const cnt = c.n ?? 8, dur = c.d ?? 0.5; const x = buf(dur + 0.1);
      for (let i = 0; i < cnt; i++) { const f = c.down ? 3200 - i * 120 : 2400 + i * 90; mixIn(x, blip(f * 1.2, f, 0.03, 0.006), i * dur / cnt, 0.5); }
      return { sig: x, g: 0.12 * v, wet: 0.05 };
    }
    case 'melt': {
      // a gooey slide down: wobbling sine falling an octave and a half, plus a wet gloop
      const x = tone(1.2, (t) => [midiHz(n('A4')) * Math.pow(2, -1.5 * Math.min(1, t / 1.0)) * (1 + 0.04 * Math.sin(t * 2 * Math.PI * 7)), Math.min(1, t / 0.05) * Math.exp(-t / 0.7)]);
      mixIn(x, biquad(noise(1.0, 17, (t) => Math.exp(-t / 0.4) * 0.3), 'lp', 600, 0.7), 0, 0.5);
      return { sig: softclip(x, 1.3), g: 0.24, wet: 0.25 };
    }
    case 'drip': return { sig: blip(midiHz(penta(9 - k, 5)) * 2, midiHz(penta(9 - k, 5)), 0.2, 0.06), g: 0.18, wet: 0.3, pan: (k - 1) * 0.3 };
    case 'blink': return { sig: blip(2600, 1800, 0.06, 0.012), g: 0.1, wet: 0.1 };
    case 'gulp': return { sig: tone(0.4, (t) => [420 * Math.pow(2, -t * 4) * (1 + 0.3 * Math.exp(-t / 0.03)), Math.min(1, t / 0.01) * Math.exp(-t / 0.12)]), g: 0.28, wet: 0.15 };
    case 'hop': return { sig: boing(260 + k * 40, 0.35), g: 0.14, wet: 0.12 };
    case 'boing': return { sig: boing(330, 0.5), g: 0.16, wet: 0.15 };
    case 'bloops': {
      const cnt = c.n ?? 12, dur = c.d ?? 0.6; const x = buf(dur + 0.3);
      for (let i = 0; i < cnt; i++) { const f = midiHz(penta(i, 4)); mixIn(x, blip(f * 1.5, f, 0.15, 0.05), i * dur / cnt, 0.6); }
      return { sig: x, g: 0.17, wet: 0.2 };
    }
    case 'type': { const cnt = c.n ?? 12, dur = c.d ?? 0.6; const x = buf(dur + 0.1); const r = rng(Math.round(c.t * 10)); for (let i = 0; i < cnt; i++) mixIn(x, S.tap({ vel: 0.5, pitch: 2400 + r() * 600 }), i * dur / cnt + r() * 0.01, 0.6); return { sig: x, g: 0.08, wet: 0.05 }; }
    case 'rewind': { const x = S.whoosh({ dur: 0.35, from: 3000, to: 500, seed: 71, rev: true }); mixIn(x, tone(0.35, (t) => [300 + 1500 * t / 0.35, 0.25 * Math.min(1, t / 0.3)]), 0, 1); return { sig: x, g: 0.18, wet: 0.2 }; }
    case 'pop': { const f = midiHz(penta(k, 5)); return { sig: S.pop({ from: f * 1.6, to: f }), g: 0.16 * v, wet: 0.15, pan: (k % 2 ? 0.25 : -0.25) }; }
    case 'chomp': { const x = buf(0.6); mixIn(x, S.kick({ vel: 0.8, tune: 10 }), 0, 0.6); mixIn(x, crunch(7, 0.25, 1), 0.01, 1.2); mixIn(x, crunch(8, 0.2, 0.8), 0.17, 0.8); return { sig: x, g: 0.4, wet: 0.15 }; }
    case 'loss': {
      // a little "bwomp": two notes sliding down
      const x = buf(0.6);
      const a = midiHz(penta(7 - k, 4)), b = midiHz(penta(5 - k, 4));
      mixIn(x, tone(0.25, (t) => [a, Math.exp(-t / 0.1) * Math.min(1, t / 0.005)]), 0, 0.5);
      mixIn(x, tone(0.4, (t) => [b * Math.pow(2, -t * 1.2), Math.exp(-t / 0.18) * Math.min(1, t / 0.005)]), 0.12, 0.6);
      return { sig: softclip(x, 1.5), g: 0.2, wet: 0.2 };
    }
    case 'crackle': { const x = buf(0.9); const r = rng(5); for (let i = 0; i < 40; i++) mixIn(x, noise(0.004, 100 + i, () => 1), r() * 0.85, 0.3 + r() * 0.5); biquad(x, 'hp', 1500, 0.7); return { sig: x, g: 0.22, wet: 0.1, pan: 0.4 }; }
    case 'zap': {
      const x = buf(0.6); let ph = 0, ph2 = 0;
      for (let i = 0; i < x.length; i++) { const t = i / SR; ph2 += 2 * Math.PI * 61 / SR; ph += 2 * Math.PI * (180 + 900 * Math.exp(-t / 0.08) + 400 * Math.sin(ph2 * 3)) / SR; x[i] = Math.sign(Math.sin(ph)) * Math.exp(-t / 0.12) * 0.5; }
      mixIn(x, biquad(noise(0.3, 61, (t) => Math.exp(-t / 0.05)), 'hp', 3000, 0.7), 0, 0.8);
      biquad(x, 'lp', 7000, 0.7);
      return { sig: x, g: 0.26, wet: 0.2, pan: 0.3 };
    }
    case 'nibble': { const x = crunch(30 + k, 0.12, 1.6); mixIn(x, blip(midiHz(penta(5 + k, 5)), midiHz(penta(3 + k, 5)), 0.1, 0.03), 0, 0.3); return { sig: x, g: 0.3, wet: 0.1, pan: (k - 1) * 0.4 }; }
    case 'cascade': {
      const cnt = c.n ?? 19, dur = c.d ?? 0.42; const x = buf(dur + 1.0);
      for (let i = 0; i < cnt; i++) mixIn(x, S.coin(penta(i, 5) + 0, { vel: 0.6 }), i * dur / cnt, 0.35);
      return { sig: x, g: 0.24, wet: 0.3 };
    }
    case 'ding': return { sig: chime([n('D6'), n('A6'), n('D7')], 0.06, 1), g: 0.24, wet: 0.35 };
    case 'wave': { const x = S.whoosh({ dur: 0.7, from: 200, to: 1200, seed: 44 }); mixIn(x, biquad(noise(0.8, 45, (t) => Math.sin(Math.PI * t / 0.8) * 0.5), 'lp', 500, 0.7), 0, 1); return { sig: x, g: 0.3, wet: 0.35 }; }
    case 'flip': return { sig: biquad(noise(0.06, 200 + k, (t) => Math.exp(-t / 0.012) * (1 + Math.sin(t * 900))), 'bp', 3000 - k * 60, 0.9), g: 0.16, wet: 0.1, pan: (k % 2 ? 0.15 : -0.15) };
    case 'thud': { const x = buf(1.0); mixIn(x, S.kick({ vel: 1, tune: -8 }), 0, 1); mixIn(x, S.bell(n('D4'), { vel: 0.6, dur: 1.0, ratio: 1.41, index: 0.6 }), 0, 0.4); return { sig: x, g: 0.3, wet: 0.3 }; }
    case 'appear': { const f = midiHz(penta(3 + k * 2, 5)); const x = buf(0.3); mixIn(x, blip(f, f, 0.12, 0.05), 0, 0.6); mixIn(x, blip(f * 1.5, f * 1.5, 0.12, 0.05), 0.05, 0.5); return { sig: x, g: 0.15 * v, wet: 0.2, pan: (k - 1) * 0.3 }; }
    case 'suck': {
      const d = c.d ?? 0.78; const x = S.whoosh({ dur: d, from: 4000, to: 300, seed: 66, rev: true });
      mixIn(x, tone(d, (t) => [100 + 700 * Math.pow(t / d, 2), 0.3 * Math.pow(t / d, 2)]), 0, 1);
      return { sig: x, g: 0.3 * v, wet: 0.3 };
    }
    case 'logo': { const x = buf(2.2); mixIn(x, S.impact({ vel: 1, seed: 52 }), 0, 0.8); mixIn(x, chime([n('D5'), n('F#5'), n('A5'), n('D6')], 0.04, 1), 0, 0.8); return { sig: x, g: 0.45, wet: 0.4 }; }
    case 'shimmer': case 'logo2': {
      const x = buf(2.0); const r = rng(c.type === 'logo2' ? 9 : 8);
      for (let i = 0; i < 14; i++) mixIn(x, S.musicBox(penta(5 + Math.floor(r() * 8), 5), { vel: 0.5 }), i * 0.045, 0.3);
      if (c.type === 'logo2') mixIn(x, chime([n('A5'), n('D6'), n('F#6')], 0.05, 0.8), 0, 0.6);
      return { sig: x, g: 0.18, wet: 0.45 };
    }
    case 'merge': {
      const x = buf((c.d ?? 0.9) + 0.4); const r = rng(7);
      for (let i = 0; i < 11; i++) { const f = midiHz(penta(i, 4)); mixIn(x, blip(f * 0.7, f * 1.2, 0.18, 0.07), i * (c.d ?? 0.9) / 11 + r() * 0.02, 0.5); }
      return { sig: x, g: 0.2, wet: 0.25 };
    }
    case 'form': { const x = buf(1.6); mixIn(x, S.whoosh({ dur: 0.3, from: 300, to: 2000, seed: 12 }), 0, 0.6); mixIn(x, chime([n('D6'), n('F#6'), n('A6')], 0.05, 0.8), 0.1, 0.7); return { sig: x, g: 0.22, wet: 0.35 }; }
    case 'scribble': { const d = c.d ?? 0.42; return { sig: biquad(noise(d, 55, (t) => (0.5 + 0.5 * Math.abs(Math.sin(t * 2 * Math.PI * 9))) * Math.sin(Math.PI * t / d)), 'bp', 2400, 0.8), g: 0.16, wet: 0.08 }; }
    case 'stamp': { const x = buf(1.0); mixIn(x, S.kick({ vel: 1, tune: 4 }), 0, 0.9); mixIn(x, biquad(noise(0.08, 56, (t) => Math.exp(-t / 0.02)), 'bp', 900, 0.7), 0, 1.2); mixIn(x, S.clap({ vel: 0.8, seed: 9 }), 0, 0.4); return { sig: x, g: 0.42, wet: 0.25 }; }
    case 'tiptoe': { const m = penta(4 - (k % 3), 5); return { sig: S.pluck(m, { vel: 0.7, dur: 0.12, bright: 0.8, seed: 300 + k, mute: 0.6 }), g: 0.22, wet: 0.15, pan: 0.4 - k * 0.1 }; }
    case 'knock': return { sig: knock(760 + k * 60, 70 + k), g: 0.42, wet: 0.12 };
    case 'notify': return { sig: chime([n('A5'), n('D6')], 0.11, 1), g: 0.3, wet: 0.3 };
    case 'micOn': return { sig: blip(900, 1400, 0.15, 0.06), g: 0.16, wet: 0.15 };
    case 'voice': {
      // a soft murmur under the waveform: band-limited noise shaped into syllables
      const d = c.d ?? 0.75;
      return { sig: biquad(noise(d, 71, (t) => (0.4 + 0.6 * Math.abs(Math.sin(t * 2 * Math.PI * 4.5))) * Math.sin(Math.PI * t / d)), 'bp', 700, 1.2), g: 0.08, wet: 0.1 };
    }
    case 'success': { const x = buf(1.8); mixIn(x, chime([n('D6'), n('A6')], 0.09, 1), 0, 0.8); mixIn(x, S.pop({ from: 1400, to: 700 }), 0, 0.4); return { sig: x, g: 0.3, wet: 0.3 }; }
    case 'sunrise': { const x = buf(2.4); [n('D5'), n('F#5'), n('A5'), n('D6'), n('F#6')].forEach((m, i) => mixIn(x, S.mallet(m, { vel: 0.9, dur: 1.4 }), i * 0.09, 0.5)); mixIn(x, S.riser({ dur: 0.9, vel: 0.15, seed: 4 }), 0, 0.5); return { sig: x, g: 0.24, wet: 0.35 }; }
    case 'pour': return { sig: biquad(noise(0.6, 81, (t) => Math.sin(Math.PI * t / 0.6) * (0.5 + 0.5 * Math.sin(t * 60))), 'bp', 1100, 2.5), g: 0.08, wet: 0.2 };
    case 'buzz': { const x = buf(0.7); for (const at of [0, 0.32]) mixIn(x, tone(0.22, (t) => [165, (0.6 + 0.4 * Math.sign(Math.sin(t * 2 * Math.PI * 30))) * Math.min(1, t / 0.01) * Math.min(1, (0.22 - t) / 0.02)]), at, 0.5); biquad(x, 'lp', 900, 0.7); return { sig: x, g: 0.3, wet: 0.05 }; }
    case 'send': { const x = buf(0.5); mixIn(x, S.whoosh({ dur: 0.2, from: 800, to: 4000, seed: 3 }), 0, 0.6); mixIn(x, S.pop({ from: 900, to: 1300 }), 0.15, 0.6); return { sig: x, g: 0.2, wet: 0.15, pan: 0.3 }; }
    case 'typing': { const d = c.d ?? 0.4; const x = buf(d + 0.1); for (let i = 0; i < 6; i++) mixIn(x, S.tap({ vel: 0.4, pitch: 1800 + i * 90 }), i * d / 6, 0.5); return { sig: x, g: 0.08, wet: 0.05, pan: -0.2 }; }
    case 'receive': return { sig: S.pop({ from: 1300, to: 700 }), g: 0.22, wet: 0.2, pan: -0.3 };
    case 'night': { const [l, r] = S.pad([n('G3'), n('B3'), n('D4'), n('F#4')], { vel: 0.9, dur: 1.4, attack: 0.5, release: 1.0, cutoff: 1400 }); return { st: [l, r], g: 0.6, wet: 0.35 }; }
    case 'dream': { const x = buf(2.6); [n('F#6'), n('A6'), n('D7'), n('A6'), n('F#6'), n('E6')].forEach((m, i) => mixIn(x, S.musicBox(m, { vel: 0.8 }), i * 0.16, 0.5)); return { sig: x, g: 0.2, wet: 0.45 }; }
    case 'key': return { sig: S.tap({ vel: 0.8, pitch: 1500 + (k % 3) * 120 }), g: 0.16, wet: 0.03 };
    case 'nope': { const x = buf(0.5); mixIn(x, tone(0.14, (t) => [midiHz(n('A3')), Math.sign(Math.sin(t * 2 * Math.PI * 220)) * 0.3 * Math.min(1, t / 0.005)]), 0, 1); mixIn(x, tone(0.2, (t) => [midiHz(n('F3')), Math.sign(Math.sin(t * 2 * Math.PI * 175)) * 0.3 * Math.min(1, t / 0.005) * Math.exp(-t / 0.15)]), 0.15, 1); biquad(x, 'lp', 2500, 0.7); return { sig: x, g: 0.24, wet: 0.1 }; }
    case 'poof': return { sig: biquad(noise(0.5, 91, (t) => Math.exp(-t / 0.12) * Math.min(1, t / 0.01)), 'lp', 1400, 0.7), g: 0.3, wet: 0.3 };
    case 'rise': return { sig: S.riser({ dur: 0.5, vel: 0.6, seed: 77 }), g: 0.25, wet: 0.3 };
    case 'land': { const x = buf(0.6); mixIn(x, S.kick({ vel: 0.6, tune: 20 }), 0, 0.5); mixIn(x, boing(300, 0.4), 0.02, 0.6); return { sig: x, g: 0.24, wet: 0.15 }; }
    case 'press': { const x = buf(0.8); mixIn(x, knock(1200, 12), 0, 0.6); mixIn(x, S.kick({ vel: 1 }), 0, 0.7); return { sig: x, g: 0.36, wet: 0.2 }; }
    case 'confetti': {
      const x = buf(2.0); mixIn(x, S.impact({ vel: 0.5, seed: 61 }), 0, 0.4);
      mixIn(x, biquad(noise(0.08, 62, (t) => Math.exp(-t / 0.02)), 'hp', 1200, 0.7), 0, 1);
      const r = rng(63); for (let i = 0; i < 24; i++) mixIn(x, blip(4000 + r() * 4000, 3000 + r() * 3000, 0.04, 0.008), 0.05 + r() * 1.2, 0.2 + r() * 0.2);
      return { sig: x, g: 0.3, wet: 0.3 };
    }
    // ---------------------------------------------------------- group / social moments
    case 'msg': { const f = midiHz(penta(4 + (k % 5), 5)); const x = buf(0.25); mixIn(x, blip(f * 1.25, f, 0.1, 0.035), 0, 0.6); mixIn(x, blip(f * 1.5, f * 1.5, 0.1, 0.03), 0.05, 0.45); return { sig: x, g: 0.16 * v, wet: 0.12, pan: (k % 2 ? 0.25 : -0.25) }; }
    case 'crumple': { const x = buf(0.7); const r = rng(5); for (let i = 0; i < 26; i++) mixIn(x, biquad(noise(0.03, 300 + i, (t) => Math.exp(-t / 0.01)), 'bp', 1500 + r() * 3000, 1.2), r() * 0.55, 0.4 + r() * 0.5); return { sig: x, g: 0.32, wet: 0.12 }; }
    case 'paper': return { sig: biquad(noise(0.5, 33, (t) => Math.sin(Math.PI * t / 0.5) * 0.6), 'bp', 2400, 0.8), g: 0.16, wet: 0.15 };
    case 'flutter': { const d = c.d ?? 0.6; return { sig: biquad(noise(d, 34, (t) => (0.4 + 0.6 * Math.abs(Math.sin(t * 2 * Math.PI * 14))) * Math.sin(Math.PI * t / d)), 'bp', 2000, 0.7), g: 0.2, wet: 0.2, pan: -0.4 }; }
    case 'ring': { const d = c.d ?? 0.6; const x = buf(d + 1.2); [0, 2, 4, 5, 7].forEach((i, j) => mixIn(x, S.musicBox(penta(i, 5), { vel: 0.7 }), j * d / 5, 0.35)); return { sig: x, g: 0.2, wet: 0.4 }; }
    case 'nest': { const x = buf(0.8); mixIn(x, knock(320, 41), 0, 0.8); mixIn(x, S.kick({ vel: 0.5, tune: 30 }), 0, 0.4); return { sig: x, g: 0.3, wet: 0.2 }; }
    case 'tink': return { sig: S.coin(penta(5 + (k % 7), 5), { vel: 0.8 }), g: 0.2 * v, wet: 0.25, pan: ((k % 4) - 1.5) * 0.25 };
    case 'pour': { const x = buf(1.4); for (let i = 0; i < 8; i++) mixIn(x, S.coin(penta(9 - i, 5), { vel: 0.6 }), i * 0.05, 0.3); mixIn(x, S.whoosh({ dur: 0.35, from: 3000, to: 900, seed: 21 }), 0, 0.5); return { sig: x, g: 0.3 * v, wet: 0.3 }; }
    case 'cheer': { const x = buf(2.0); mixIn(x, chime([n('G5'), n('B5'), n('D6'), n('G6')], 0.06, 1), 0, 0.8); for (let i = 0; i < 18; i++) mixIn(x, blip(5000 + i * 120, 4000, 0.04, 0.01), 0.1 + i * 0.05, 0.15); return { sig: x, g: 0.28, wet: 0.35 }; }
    case 'check': { const f = midiHz(penta(5 + k, 5)); const x = buf(0.5); mixIn(x, blip(f, f, 0.15, 0.06), 0, 0.5); mixIn(x, blip(f * 1.5, f * 1.5, 0.2, 0.08), 0.07, 0.5); return { sig: x, g: 0.2, wet: 0.25 }; }
    case 'halo': return { sig: S.whoosh({ dur: 0.5, from: 1500, to: 7000, seed: 61 }), g: 0.14, wet: 0.35 };
    case 'spin': { const d = c.d ?? 2.0; const x = S.whoosh({ dur: d, from: 300, to: 2500, seed: 62 }); return { sig: x, g: 0.16, wet: 0.3 }; }
    case 'join': { const f = midiHz(penta(5 + k * 2, 5)); const x = buf(0.6); mixIn(x, S.pop({ from: f * 1.6, to: f }), 0, 0.5); mixIn(x, S.bell(penta(7 + k * 2, 5), { vel: 0.5, dur: 0.6, ratio: 3.01, index: 0.8 }), 0.04, 0.4); return { sig: x, g: 0.22, wet: 0.25 }; }
    case 'lift': return { sig: S.whoosh({ dur: 0.25, from: 600, to: 2500, seed: 63 }), g: 0.12, wet: 0.1 };
    case 'drag': { const d = c.d ?? 0.6; return { sig: biquad(noise(d, 64, (t) => Math.sin(Math.PI * t / d) * 0.4), 'bp', 900, 1.2), g: 0.12, wet: 0.1 }; }
    case 'drop': { const x = buf(0.3); mixIn(x, knock(700, 65), 0, 0.6); mixIn(x, S.pop({ from: 900, to: 500 }), 0, 0.4); return { sig: x, g: 0.26, wet: 0.12 }; }
    case 'paid': { const f = midiHz(penta(5 + k, 5)); const x = buf(1.0); mixIn(x, S.bell(penta(5 + k, 5), { vel: 0.8, dur: 0.8, ratio: 3.01, index: 0.9 }), 0, 0.6); mixIn(x, blip(f * 2, f * 2, 0.1, 0.03), 0.05, 0.3); return { sig: x, g: 0.24, wet: 0.3, pan: (k - 1.5) * 0.2 }; }
    case 'tap': return { sig: knock(1100, 66), g: 0.32, wet: 0.08 };
    case 'chord': { const [l, r] = S.pad([n('G3'), n('B3'), n('D4'), n('G4')], { vel: 1, dur: 1.6, attack: 0.08, release: 1.4, cutoff: 2600 }); return { st: [l, r], g: 0.7, wet: 0.4 }; }
    default: return null;
  }
}

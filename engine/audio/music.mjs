// Music beds: a small generative arrangement for each look's feel (lofi, synthwave, playful,
// news) in the look's tempo and chord progression, filled to the video's length, with a soft
// start, a faded end and the bed ducked under the voice. Seeded, so a video always gets the
// same music. Part of animation-video (by Web Asamoah).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as S from './synth.mjs';
import { measureLoudness } from './loudness.mjs';

const { SR, Bus, rng, db } = S;
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const QUALITY = { '': [0, 4, 7], m: [0, 3, 7], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], 7: [0, 4, 7, 10], sus2: [0, 2, 7], sus4: [0, 5, 7], add9: [0, 4, 7, 14] };

export function parseChord(name) {
  const m = /^([A-G](?:#|b)?)(maj7|m7|m|7|sus2|sus4|add9)?$/.exec(String(name).trim());
  if (!m) throw new Error(`music: cannot read the chord "${name}" (use names like C, Am, Fmaj7, Dm7, G7, Csus4)`);
  return { root: PC[m[1]], tones: QUALITY[m[2] || ''] };
}

// What each feel plays. Beats count from 0 within a 4-beat bar.
const FEELS = {
  lofi: { swing: 0.6, kick: [0, 1.75, 2.5], back: [1, 3], backVoice: 'rim', hats: 8, hatVoice: 'shaker', bass: 'sub', bassAt: [0, 2.5], pad: 0.9, padCut: 1000, lead: 'pluck', lp: 5200, drums: 0.45 },
  synthwave: { swing: 0.5, kick: [0, 1, 2, 3], back: [1, 3], backVoice: 'snare', hats: 8, hatVoice: 'hat', bass: '808', bassAt: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], pad: 1, padCut: 2400, lead: 'pluckSynth', lp: 0, drums: 0.55, arp: true },
  playful: { swing: 0.56, kick: [0, 2], back: [1, 3], backVoice: 'clap', hats: 8, hatVoice: 'shaker', bass: 'pluck', bassAt: [0, 1.5, 2, 3.5], pad: 0.45, padCut: 1500, lead: 'mallet', lp: 0, drums: 0.5 },
  news: { swing: 0.5, kick: [0, 1.5, 2], back: [1, 3], backVoice: 'snare', hats: 16, hatVoice: 'hat', bass: '808', bassAt: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], pad: 0.8, padCut: 1800, lead: 'bell', lp: 0, drums: 0.6 },
};

// Word timings to speech spans: words closer than `gap` seconds count as one stretch of speech,
// so the bed only lifts in real pauses and never pumps between words.
export function speechSpans(speech = [], gap = 0.9) {
  const spans = [];
  for (const [a, b] of [...speech].sort((x, y) => x[0] - y[0])) {
    const last = spans.at(-1);
    if (last && a - last[1] < gap) last[1] = Math.max(last[1], b);
    else spans.push([a, b]);
  }
  return spans;
}

// Gain curve that dips `depth` dB for each span: down over `attack` before it starts, back up
// over `release` after it ends.
export function duckUnder(len, spans, { depth = 9, attack = 0.08, release = 0.45 } = {}) {
  const g = new Float32Array(len).fill(1);
  const low = db(-depth);
  for (const [a, b] of spans) {
    const s0 = Math.round((a - attack) * SR), s1 = Math.round(a * SR), s2 = Math.round(b * SR), s3 = Math.round((b + release) * SR);
    for (let i = Math.max(0, s0); i < Math.min(len, s3); i++) {
      const v = i < s1 ? 1 - (1 - low) * (i - s0) / Math.max(1, s1 - s0) : i <= s2 ? low : low + (1 - low) * (i - s2) / Math.max(1, s3 - s2);
      if (v < g[i]) g[i] = v;
    }
  }
  return g;
}

export function composeMusic({ preset, duration, hits = [], speech = [], seed = 7 } = {}) {
  const len = Math.max(1, Math.round(duration * SR));
  if (!preset || !Array.isArray(preset.progression) || !preset.progression.length) return { L: new Float32Array(len), R: new Float32Array(len), silent: true };
  const feel = { ...(FEELS[preset.feel] || FEELS.lofi) };
  if (preset.lead) feel.lead = preset.lead;
  if (preset.drums === 'soft') feel.drums *= 0.8;
  if (preset.drums === 'punchy') feel.drums *= 1.25;
  if (preset.claps) feel.backVoice = 'clap';
  if (preset.pad === false) feel.pad = 0;
  const bpm = preset.bpm || 100;
  const beat = 60 / bpm, bar = 4 * beat;
  const chords = preset.progression.map(parseChord);
  const key = chords[0].root;
  const r = rng(seed);
  const bars = Math.ceil(duration / bar) + 1;
  const sec = duration + 3;
  const drums = new Bus(sec), bass = new Bus(sec), keys = new Bus(sec), lead = new Bus(sec), wet = new Bus(sec);
  const at = (t0, b) => t0 + b * beat + ((Math.round(b * 2) % 2) && Number.isInteger(b * 2) ? (feel.swing - 0.5) * beat : 0);
  const kickTimes = [];

  // the lead's motif repeats every two bars, so the bed sounds composed, not random
  const motif = [0, 1].map(() => Array.from({ length: 8 }, () => (r() < 0.45 ? Math.floor(r() * 4) : -1)));

  for (let k = 0; k < bars; k++) {
    const t0 = k * bar;
    const ch = chords[k % chords.length];
    const root = 48 + ch.root; // octave 3
    const tones = ch.tones.map((x) => root + x);
    const fill = k % 4 === 3;

    // drums
    for (const b of feel.kick) { drums.add(S.kick({ vel: b === 0 ? 1 : 0.8, tune: feel.lead === 'pluck' ? -3 : 0 }), at(t0, b), 0.9); kickTimes.push(at(t0, b)); }
    for (const b of feel.back) {
      const v = feel.backVoice;
      const sig = v === 'clap' ? S.clap({ vel: 0.9, seed: 3 + k }) : v === 'rim' ? S.rim({ vel: 0.8, seed: 5 + k }) : S.snare({ vel: 0.9, seed: 43 + k });
      drums.add(sig, at(t0, b), v === 'rim' ? 0.5 : 0.6);
      if (v === 'snare') wet.add(sig, at(t0, b), 0.35);
    }
    const steps = feel.hats;
    for (let i = 0; i < steps; i++) {
      const b = i * 4 / steps;
      const accent = i % (steps / 4) === 0 ? 1 : 0.6;
      const sig = feel.hatVoice === 'shaker' ? S.shaker({ vel: 0.5 * accent, seed: 9 + i }) : S.hat({ vel: 0.55 * accent, seed: 41 + (i % 3) });
      drums.add(sig, at(t0, b), 0.32, i % 2 ? 0.2 : -0.2);
    }
    if (fill) for (const b of [3.5, 3.75]) drums.add(feel.backVoice === 'clap' ? S.clap({ vel: 0.5, seed: 70 + k }) : S.snare({ vel: 0.45, seed: 80 + k }), at(t0, b), 0.4);

    // bass, an octave under the chord
    feel.bassAt.forEach((b, j) => {
      const m = root - 12 + (feel.bass === 'pluck' ? [0, 7, 12, 7][j % 4] : 0);
      const sig = feel.bass === 'sub' ? S.subBass(m, { vel: 0.9, dur: 1.4 * beat })
        : feel.bass === '808' ? S.bass808(m, { vel: 0.75, dur: 0.42 * beat })
          : S.pluck(m + 12, { vel: 0.8, dur: 0.35, bright: 0.3, seed: 200 + j, mute: 0.5 });
      bass.add(sig, at(t0, b), feel.bass === 'pluck' ? 0.5 : 0.55);
    });

    // keys: the chord held for the bar
    if (feel.pad > 0) {
      const [pl, pr] = S.pad(tones, { vel: feel.pad, dur: bar, attack: Math.min(0.4, bar * 0.15), release: 0.6, cutoff: feel.padCut, seed: 17 + (k % chords.length) });
      keys.addStereo(pl, pr, t0, 0.9);
      wet.addStereo(pl, pr, t0, 0.3);
    }

    // lead
    const hi = tones.map((m) => m + 24);
    if (feel.arp) {
      for (let i = 0; i < 16; i++) {
        const m = hi[i % hi.length] - (Math.floor(i / hi.length) % 2 ? 12 : 0);
        const sig = S.pluckSynth(m, { vel: i % 4 === 0 ? 0.7 : 0.45, dur: 0.18, cutoff: 3000, seed: 59 });
        lead.add(sig, t0 + i * beat / 4, 0.35, i % 2 ? 0.35 : -0.35);
        wet.add(sig, t0 + i * beat / 4, 0.12);
      }
    } else if (feel.lead === 'bell') {
      for (const b of [0, 1.5]) { const sig = S.bell(hi[0], { vel: 0.6, dur: 0.7, ratio: 3.01, index: 1.2 }); lead.add(sig, at(t0, b), 0.3); wet.add(sig, at(t0, b), 0.25); }
      for (let i = 0; i < 8; i++) lead.add(S.pluckSynth(root + 12, { vel: 0.35, dur: 0.12, cutoff: 2000, seed: 61 }), at(t0, i / 2), 0.22, -0.2);
    } else {
      motif[k % 2].forEach((pick, i) => {
        if (pick < 0) return;
        const m = hi[pick % hi.length] - (feel.lead === 'pluck' ? 12 : 0);
        const sig = feel.lead === 'mallet' ? S.mallet(m, { vel: 0.7, dur: 0.6, seed: 53 + i })
          : feel.lead === 'pluckSynth' ? S.pluckSynth(m, { vel: 0.55, dur: 0.3, seed: 59 + i })
            : S.pluck(m, { vel: 0.55, dur: 0.8, bright: 0.45, seed: 11 + i });
        lead.add(sig, at(t0, i / 2), 0.38, (i % 3 - 1) * 0.3);
        wet.add(sig, at(t0, i / 2), 0.3);
      });
    }
  }

  // stings on scene changes, at most one every three seconds
  if (preset.stings) {
    let lastHit = -Infinity;
    for (const h of [...hits].sort((a, b) => a - b)) {
      if (h < 0.5 || h - lastHit < 3 || h > duration - 1) continue;
      drums.add(S.impact({ vel: 0.6, seed: 37 + Math.round(h) }), h, 0.22);
      lastHit = h;
    }
  }

  // sidechain the bass to the kick for a clean low end
  const side = S.duckCurve(bass.len, kickTimes, { depth: 0.5, attack: 0.004, release: 0.16 });
  bass.apply((x) => { for (let i = 0; i < x.length; i++) x[i] *= side[i]; });

  const mix = new Bus(sec);
  drums.mixInto(mix, feel.drums);
  bass.mixInto(mix, 0.6);
  keys.mixInto(mix, 0.7);
  lead.mixInto(mix, 0.6);
  const [rl, rr] = S.reverb(wet.L, wet.R, { room: 0.84, damp: 0.4 });
  for (let i = 0; i < mix.len; i++) { mix.L[i] += rl[i] * 0.5; mix.R[i] += rr[i] * 0.5; }
  if (feel.lp) mix.apply((x) => S.biquad(x, 'lp', feel.lp, 0.7));
  S.compress(mix.L, mix.R, { threshold: -16, ratio: 2, attack: 0.02, release: 0.2 });

  const L = mix.L.slice(0, len), R = mix.R.slice(0, len);
  const duck = duckUnder(len, speechSpans(speech));
  const fadeIn = Math.round(0.25 * SR), fadeOut = Math.round(Math.min(1.5, duration / 4) * SR);
  for (let i = 0; i < len; i++) {
    let g = duck[i];
    if (i < fadeIn) g *= i / fadeIn;
    if (i > len - fadeOut) g *= (len - i) / fadeOut;
    L[i] *= g; R[i] *= g;
  }
  S.limit(L, R, { ceiling: -1 });
  return { L, R, silent: false };
}

// Composes the bed and writes it at `lufs` integrated loudness (peaks kept under -1 dBFS).
export function writeMusic(out, { preset, duration, hits, speech, lufs = -24.5, seed } = {}) {
  const { L, R, silent } = composeMusic({ preset, duration, hits, speech, seed });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (silent) { S.writeWav(out, L, R, fs); return { lufs: -70 }; }
  const probe = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'av-music-')), 'probe.wav');
  S.writeWav(probe, L, R, fs);
  const now = measureLoudness(probe).lufs;
  fs.rmSync(path.dirname(probe), { recursive: true, force: true });
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const k = Math.min(db(lufs - now), db(-1) / Math.max(peak, 1e-9));
  for (let i = 0; i < L.length; i++) { L[i] *= k; R[i] *= k; }
  S.writeWav(out, L, R, fs);
  return { lufs: now + 20 * Math.log10(k) };
}

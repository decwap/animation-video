// Sound bank: renders a look's sound recipes ({ make, d, n, v } cues for sfx.mjs) to short
// stereo WAVs, each exactly as long as the compiler schedules it (SFX_LENGTH), with a little
// room, a faded tail and a level that keeps clicks and long sweeps alike in loudness.
// Part of animation-video (by Web Asamoah).
import fs from 'node:fs';
import path from 'node:path';
import { SR, reverb, writeWav } from './synth.mjs';
import { make } from './sfx.mjs';
import { SFX_LENGTH } from '../config.mjs';

const PEAK = 0.7; // about -3 dBFS
const LOUDEST = 0.18; // cap on the loudest 50 ms RMS (about -15 dBFS), so sweeps never outshout clicks
const FADE = 0.03;

function place(L, R, sig, gain, pan) {
  const a = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
  const gl = Math.cos(a) * gain * Math.SQRT2, gr = Math.sin(a) * gain * Math.SQRT2;
  for (let i = 0; i < sig.length && i < L.length; i++) { L[i] += sig[i] * gl; R[i] += sig[i] * gr; }
}

function loudestRms(L, R) {
  const w = Math.round(0.05 * SR);
  let best = 0;
  for (let s = 0; s < L.length; s += Math.round(w / 2)) {
    let e = 0;
    for (let i = s; i < s + w && i < L.length; i++) e += (L[i] * L[i] + R[i] * R[i]) / 2;
    best = Math.max(best, Math.sqrt(e / w));
  }
  return best;
}

// One sound: the recipe's cue, mixed dry and wet, cut to its length, faded and levelled.
export function renderSfx(name, recipe = {}, { seconds = SFX_LENGTH[name] ?? 1, seed = 1 } = {}) {
  const len = Math.round(seconds * SR);
  const L = new Float32Array(len), R = new Float32Array(len);
  if (!recipe.make) return { L, R, silent: true };
  const cue = make({ type: recipe.make, t: seed, d: recipe.d, n: recipe.n, v: recipe.v ?? 1 });
  if (!cue) throw new Error(`sound "${name}": sfx.mjs has no cue "${recipe.make}"`);
  const g = cue.g ?? 0.3;
  if (cue.st) for (let i = 0; i < len && i < cue.st[0].length; i++) { L[i] += cue.st[0][i] * g; R[i] += cue.st[1][i] * g; }
  else place(L, R, cue.sig, g, cue.pan ?? 0);
  const wet = recipe.wet ?? cue.wet ?? 0;
  if (wet > 0) {
    const [wl, wr] = reverb(L, R, { room: 0.7 });
    for (let i = 0; i < len; i++) { L[i] += wl[i] * wet; R[i] += wr[i] * wet; }
  }
  const f = Math.min(len, Math.round(FADE * SR));
  for (let i = 0; i < f; i++) { const k = i / f; L[len - 1 - i] *= k; R[len - 1 - i] *= k; }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  if (peak < 1e-6) throw new Error(`sound "${name}" (${recipe.make}) is silent`);
  let k = PEAK / peak;
  const rms = loudestRms(L, R) * k;
  if (rms > LOUDEST) k *= LOUDEST / rms;
  for (let i = 0; i < len; i++) { L[i] *= k; R[i] *= k; }
  return { L, R, silent: false };
}

// Writes <dir>/<name>.wav for each name (default: every sound in the look's bank) and returns
// the names written. A name the bank lacks, or a recipe with no `make`, is written as silence.
export function writeSfxBank(look, dir, names = Object.keys(look.sfxBank || {})) {
  fs.mkdirSync(dir, { recursive: true });
  names.forEach((name, k) => {
    const { L, R } = renderSfx(name, (look.sfxBank || {})[name], { seed: k + 1 });
    writeWav(path.join(dir, `${name}.wav`), L, R, fs);
  });
  return [...names];
}

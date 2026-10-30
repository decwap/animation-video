// Copied unchanged from web-asamoah-reels (MIT, by Web Asamoah) for animation-video.
// Tiny deterministic synth toolkit for web-asamoah-reels soundtracks (by Web Asamoah).
// Everything renders offline into stereo Float32Arrays at 48 kHz; randomness is
// seeded, so the same score always renders the same file.

export const SR = 48000;

// ---------------------------------------------------------------- utilities
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const db = (d) => Math.pow(10, d / 20);
const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function n(name) {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]];
}

export class Bus {
  constructor(seconds) {
    this.len = Math.ceil(seconds * SR);
    this.L = new Float32Array(this.len);
    this.R = new Float32Array(this.len);
  }
  // Mix a mono signal in at time t (seconds) with gain and constant-power pan (-1..1).
  add(sig, t, gain = 1, pan = 0) {
    const start = Math.round(t * SR);
    const a = (pan + 1) * Math.PI / 4;
    const gl = Math.cos(a) * gain * Math.SQRT2, gr = Math.sin(a) * gain * Math.SQRT2;
    for (let i = 0; i < sig.length; i++) {
      const j = start + i;
      if (j < 0) continue;
      if (j >= this.len) break;
      this.L[j] += sig[i] * gl;
      this.R[j] += sig[i] * gr;
    }
  }
  addStereo(l, r, t, gain = 1) {
    const start = Math.round(t * SR);
    for (let i = 0; i < l.length; i++) {
      const j = start + i;
      if (j < 0) continue;
      if (j >= this.len) break;
      this.L[j] += l[i] * gain;
      this.R[j] += r[i] * gain;
    }
  }
  mixInto(dst, gain = 1) {
    for (let i = 0; i < this.len && i < dst.len; i++) { dst.L[i] += this.L[i] * gain; dst.R[i] += this.R[i] * gain; }
  }
  apply(fn) { fn(this.L); fn(this.R); return this; }
}

// ---------------------------------------------------------------- filters
// RBJ cookbook biquad, processed in place.
export function biquad(x, type, f, q = 0.707, gainDb = 0) {
  const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, cs = Math.cos(w), sn = Math.sin(w);
  const alpha = sn / (2 * q), A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
    case 'hp': b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
    case 'bp': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cs; a2 = 1 - alpha; break;
    case 'peak': b0 = 1 + alpha * A; b1 = -2 * cs; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cs; a2 = 1 - alpha / A; break;
    case 'lowshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) - (A - 1) * cs + s); b1 = 2 * A * ((A - 1) - (A + 1) * cs); b2 = A * ((A + 1) - (A - 1) * cs - s);
      a0 = (A + 1) + (A - 1) * cs + s; a1 = -2 * ((A - 1) + (A + 1) * cs); a2 = (A + 1) + (A - 1) * cs - s; break;
    }
    case 'highshelf': {
      const s = 2 * Math.sqrt(A) * alpha;
      b0 = A * ((A + 1) + (A - 1) * cs + s); b1 = -2 * A * ((A - 1) + (A + 1) * cs); b2 = A * ((A + 1) + (A - 1) * cs - s);
      a0 = (A + 1) - (A - 1) * cs + s; a1 = 2 * ((A - 1) - (A + 1) * cs); a2 = (A + 1) - (A - 1) * cs - s; break;
    }
    default: throw new Error(type);
  }
  b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    const y = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = xi; y2 = y1; y1 = y;
    x[i] = y;
  }
  return x;
}

// Time-varying 2-pole state-variable lowpass; fc(i) gives cutoff per sample.
export function svfLP(x, fc, q = 0.8) {
  let low = 0, band = 0;
  const damp = 1 / q;
  for (let i = 0; i < x.length; i++) {
    const f = 2 * Math.sin(Math.PI * Math.min(fc(i), SR / 6) / SR);
    low += f * band;
    const high = x[i] - low - damp * band;
    band += f * high;
    x[i] = low;
  }
  return x;
}
export function svfBP(x, fc, q = 2) {
  let low = 0, band = 0;
  const damp = 1 / q;
  for (let i = 0; i < x.length; i++) {
    const f = 2 * Math.sin(Math.PI * Math.min(fc(i), SR / 6) / SR);
    low += f * band;
    const high = x[i] - low - damp * band;
    band += f * high;
    x[i] = band;
  }
  return x;
}

export function softclip(x, drive = 1) {
  const k = Math.tanh(drive);
  for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * drive) / k;
  return x;
}

// ---------------------------------------------------------------- envelopes
export function env(len, { a = 0.005, d = 0.1, s = 0, r = 0.05, hold = 0 }) {
  const out = new Float32Array(len);
  const A = a * SR, D = d * SR, H = hold * SR, R = r * SR;
  for (let i = 0; i < len; i++) {
    let v;
    if (i < A) v = i / A;
    else if (i < A + D) v = 1 - (1 - s) * ((i - A) / D);
    else if (i < A + D + H) v = s;
    else v = s * Math.max(0, 1 - (i - A - D - H) / R);
    out[i] = v;
  }
  return out;
}
export function expDecay(len, tau, attack = 0.002) {
  const out = new Float32Array(len);
  const A = attack * SR;
  for (let i = 0; i < len; i++) out[i] = (i < A ? i / A : 1) * Math.exp(-(i / SR) / tau);
  return out;
}
const mul = (x, e) => { for (let i = 0; i < x.length; i++) x[i] *= e[i]; return x; };

// ---------------------------------------------------------------- drums
export function kick({ vel = 1, tune = 0 } = {}) {
  const len = Math.round(0.55 * SR);
  const x = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = (46 + tune) + 120 * Math.exp(-t / 0.035) + 30 * Math.exp(-t / 0.006);
    ph += 2 * Math.PI * f / SR;
    x[i] = Math.sin(ph) * Math.exp(-t / 0.26) * (t < 0.003 ? t / 0.003 : 1);
  }
  softclip(x, 1.6);
  // soft beater click
  const r = rng(7);
  for (let i = 0; i < 0.006 * SR; i++) x[i] += (r() * 2 - 1) * 0.18 * (1 - i / (0.006 * SR));
  return x.map((v) => v * vel);
}

export function clap({ vel = 1, seed = 3 } = {}) {
  const len = Math.round(0.35 * SR);
  const r = rng(seed);
  const x = new Float32Array(len);
  const bursts = [0, 0.009, 0.018, 0.029];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let e = 0;
    for (const b of bursts) if (t >= b) e = Math.max(e, Math.exp(-(t - b) / (b === 0.029 ? 0.11 : 0.008)));
    x[i] = (r() * 2 - 1) * e;
  }
  biquad(x, 'bp', 1250, 0.9);
  biquad(x, 'highshelf', 5000, 0.7, -4);
  return x.map((v) => v * vel * 1.6);
}

export function rim({ vel = 1, seed = 5, pitch = 1850 } = {}) {
  const len = Math.round(0.09 * SR);
  const r = rng(seed);
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    x[i] = (Math.sin(2 * Math.PI * pitch * t) * 0.8 + Math.sin(2 * Math.PI * pitch * 0.53 * t) * 0.5) * Math.exp(-t / 0.018)
      + (r() * 2 - 1) * 0.35 * Math.exp(-t / 0.004);
  }
  biquad(x, 'hp', 400, 0.7);
  return x.map((v) => v * vel * 0.8);
}

export function shaker({ vel = 1, seed = 9, len = 0.07 } = {}) {
  const N = Math.round(len * SR);
  const r = rng(seed);
  const x = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    const e = (t < 0.012 ? t / 0.012 : Math.exp(-(t - 0.012) / 0.022));
    x[i] = (r() * 2 - 1) * e;
  }
  biquad(x, 'hp', 5200, 0.7);
  biquad(x, 'peak', 8500, 1.2, 3);
  biquad(x, 'lp', 12500, 0.7);
  return x.map((v) => v * vel);
}

// A soft tom-like "log drum" body used as the bass voice (afro-pop / amapiano flavour).
export function logDrum(midi, { vel = 1, dur = 0.45, glide = 0.6 } = {}) {
  const len = Math.round((dur + 0.1) * SR);
  const f0 = midiHz(midi);
  const x = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = f0 * (1 + glide * Math.exp(-t / 0.018));
    ph += 2 * Math.PI * f / SR;
    const body = Math.sin(ph) + 0.28 * Math.sin(2 * ph) + 0.08 * Math.sin(3 * ph);
    const e = (t < 0.004 ? t / 0.004 : 1) * Math.exp(-t / (dur * 0.55));
    x[i] = body * e;
  }
  softclip(x, 1.8);
  biquad(x, 'lp', 1400, 0.7);
  return x.map((v) => v * vel);
}

export function subBass(midi, { vel = 1, dur = 0.4 } = {}) {
  const len = Math.round((dur + 0.08) * SR);
  const f = midiHz(midi);
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const e = Math.min(1, t / 0.006) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / 0.08)) * Math.exp(-t / (dur * 1.4));
    x[i] = (Math.sin(2 * Math.PI * f * t) + 0.15 * Math.sin(4 * Math.PI * f * t)) * e;
  }
  softclip(x, 1.3);
  return x.map((v) => v * vel);
}

// ---------------------------------------------------------------- pitched
// Karplus-Strong plucked string with a guitar-ish body.
export function pluck(midi, { vel = 1, dur = 0.9, bright = 0.5, seed = 11, mute = 0 } = {}) {
  const f = midiHz(midi);
  const len = Math.round((dur + 0.3) * SR);
  const period = SR / f;
  const N = Math.floor(period);
  const frac = period - N;
  const r = rng(seed);
  const buf = new Float32Array(N + 2);
  for (let i = 0; i < buf.length; i++) buf[i] = r() * 2 - 1;
  // pick position comb softens the attack
  const out = new Float32Array(len);
  let idx = 0, last = 0;
  const decay = mute > 0 ? 0.985 - mute * 0.02 : 0.9965 - (1 - bright) * 0.002;
  const lpk = 0.35 + bright * 0.5;
  for (let i = 0; i < len; i++) {
    const a = buf[idx % buf.length];
    const b = buf[(idx + 1) % buf.length];
    const s = a + (b - a) * frac;
    const y = decay * (lpk * s + (1 - lpk) * last);
    last = y;
    buf[idx % buf.length] = y;
    idx++;
    const t = i / SR;
    const release = t > dur ? Math.max(0, 1 - (t - dur) / 0.25) : 1;
    out[i] = s * release;
  }
  biquad(out, 'peak', 220, 1.1, 3);
  biquad(out, 'peak', 2600, 1.5, 2);
  biquad(out, 'hp', 110, 0.7);
  return out.map((v) => v * vel * 0.9);
}

// Gyil / balafon-like mallet voice: a few inharmonic modes plus a soft wooden knock.
export function gyil(midi, { vel = 1, dur = 1.2, seed = 13 } = {}) {
  const f = midiHz(midi);
  const len = Math.round(dur * SR);
  const modes = [[1, 1, 0.55], [3.93, 0.28, 0.12], [9.2, 0.09, 0.045], [2.01, 0.06, 0.3]];
  const out = new Float32Array(len);
  const r = rng(seed);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let s = 0;
    for (const [ratio, amp, tau] of modes) s += amp * Math.sin(2 * Math.PI * f * ratio * t) * Math.exp(-t / tau);
    // gourd buzz: slight amplitude flutter on the fundamental
    s *= 1 + 0.04 * Math.sin(2 * Math.PI * 31 * t) * Math.exp(-t / 0.2);
    const knock = t < 0.012 ? (r() * 2 - 1) * 0.25 * (1 - t / 0.012) : 0;
    out[i] = (s + knock) * Math.min(1, t / 0.0015);
  }
  biquad(out, 'lp', 7000, 0.7);
  return out.map((v) => v * vel * 0.8);
}

// Warm pad: detuned saws through a slowly breathing lowpass.
export function pad(midis, { vel = 1, dur = 2, attack = 0.6, release = 0.8, cutoff = 1300, seed = 17 } = {}) {
  const len = Math.round((dur + release) * SR);
  const outL = new Float32Array(len), outR = new Float32Array(len);
  const r = rng(seed);
  for (const m of midis) {
    const f = midiHz(m);
    for (const [det, side] of [[-0.11, -1], [0.0, 0], [0.12, 1]]) {
      const ff = f * Math.pow(2, det / 12);
      let ph = r();
      const x = new Float32Array(len);
      for (let i = 0; i < len; i++) {
        ph += ff / SR; if (ph >= 1) ph -= 1;
        x[i] = 2 * ph - 1; // naive saw is fine under a low cutoff
      }
      const g = side === 0 ? 0.5 : 0.35;
      const gl = side <= 0 ? g : g * 0.35, gr = side >= 0 ? g : g * 0.35;
      for (let i = 0; i < len; i++) { outL[i] += x[i] * gl; outR[i] += x[i] * gr; }
    }
  }
  const e = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    e[i] = Math.min(1, Math.pow(t / attack, 1.5)) * (t > dur ? Math.max(0, 1 - (t - dur) / release) : 1);
  }
  const lfo = (i) => cutoff * (1 + 0.25 * Math.sin(2 * Math.PI * 0.18 * i / SR));
  for (const ch of [outL, outR]) { svfLP(ch, lfo, 0.7); svfLP(ch, lfo, 0.7); mul(ch, e); }
  const k = vel * 0.22 / Math.sqrt(midis.length);
  for (let i = 0; i < len; i++) { outL[i] *= k; outR[i] *= k; }
  return [outL, outR];
}

// FM bell / coin chime.
export function bell(midi, { vel = 1, dur = 1.6, ratio = 3.5, index = 2.2, seed = 19 } = {}) {
  const f = midiHz(midi);
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const I = index * Math.exp(-t / 0.25);
    out[i] = Math.sin(2 * Math.PI * f * t + I * Math.sin(2 * Math.PI * f * ratio * t)) * Math.exp(-t / (dur * 0.35)) * Math.min(1, t / 0.001);
  }
  return out.map((v) => v * vel * 0.6);
}

// Two-note coin "ting" tuned to the key.
export function coin(midi, { vel = 1 } = {}) {
  const a = bell(midi, { vel, dur: 0.5, ratio: 2.76, index: 1.1 });
  const b = bell(midi + 7, { vel: vel * 0.9, dur: 0.9, ratio: 2.76, index: 1.3 });
  const out = new Float32Array(Math.round(1.0 * SR));
  for (let i = 0; i < a.length; i++) out[i] += a[i];
  const off = Math.round(0.07 * SR);
  for (let i = 0; i < b.length && i + off < out.length; i++) out[i + off] += b[i];
  biquad(out, 'hp', 600, 0.7);
  return out;
}

// ---------------------------------------------------------------- sfx
export function whoosh({ dur = 0.7, from = 350, to = 5200, vel = 1, seed = 23, rev = false } = {}) {
  const len = Math.round(dur * SR);
  const r = rng(seed);
  const x = new Float32Array(len);
  let pink = 0;
  for (let i = 0; i < len; i++) { pink = 0.97 * pink + 0.03 * (r() * 2 - 1); x[i] = pink * 6 + (r() * 2 - 1) * 0.15; }
  const fc = (i) => { const p = i / len; const q = rev ? 1 - p : p; return from * Math.pow(to / from, q * q * (3 - 2 * q)); };
  svfBP(x, fc, 1.6);
  for (let i = 0; i < len; i++) {
    const p = i / len;
    const e = rev ? Math.pow(p, 2.2) * (p > 0.96 ? (1 - p) / 0.04 : 1) : Math.sin(Math.PI * Math.pow(p, 0.7));
    x[i] *= e;
  }
  return x.map((v) => v * vel * 0.8);
}

export function tap({ vel = 1, pitch = 1400 } = {}) {
  const len = Math.round(0.05 * SR);
  const x = new Float32Array(len);
  const r = rng(29);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    x[i] = Math.sin(2 * Math.PI * pitch * t * (1 - 0.3 * t / 0.05)) * Math.exp(-t / 0.009) + (r() * 2 - 1) * 0.12 * Math.exp(-t / 0.002);
  }
  return x.map((v) => v * vel * 0.7);
}

export function pop({ vel = 1, from = 1100, to = 380 } = {}) {
  const len = Math.round(0.11 * SR);
  const x = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = to + (from - to) * Math.exp(-t / 0.018);
    ph += 2 * Math.PI * f / SR;
    x[i] = Math.sin(ph) * Math.exp(-t / 0.035) * Math.min(1, t / 0.001);
  }
  return x.map((v) => v * vel * 0.7);
}

export function riser({ dur = 2, vel = 1, seed = 31 } = {}) {
  const len = Math.round(dur * SR);
  const r = rng(seed);
  const x = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const p = i / len;
    ph += 2 * Math.PI * (180 + 900 * p * p) / SR;
    x[i] = ((r() * 2 - 1) * 0.6 + Math.sin(ph) * 0.25) * Math.pow(p, 2.4);
  }
  svfBP(x, (i) => 500 + 6000 * Math.pow(i / len, 2), 1.2);
  return x.map((v) => v * vel);
}

export function impact({ vel = 1, seed = 37 } = {}) {
  const len = Math.round(1.6 * SR);
  const r = rng(seed);
  const x = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += 2 * Math.PI * (38 + 70 * Math.exp(-t / 0.05)) / SR;
    x[i] = Math.sin(ph) * Math.exp(-t / 0.5) + (r() * 2 - 1) * 0.5 * Math.exp(-t / 0.03);
  }
  biquad(x, 'lp', 2500, 0.7);
  softclip(x, 1.4);
  return x.map((v) => v * vel);
}

// ---------------------------------------------------------------- effects
// Freeverb-style stereo reverb. Returns [wetL, wetR].
export function reverb(L, R, { room = 0.82, damp = 0.35, width = 1, predelay = 0.012 } = {}) {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((v) => Math.round(v * SR / 44100));
  const apT = [556, 441, 341, 225].map((v) => Math.round(v * SR / 44100));
  const spread = Math.round(23 * SR / 44100);
  const pd = Math.round(predelay * SR);
  const run = (inp, off) => {
    const out = new Float32Array(inp.length);
    const combs = combT.map((d) => ({ buf: new Float32Array(d + off), i: 0, store: 0 }));
    const aps = apT.map((d) => ({ buf: new Float32Array(d + off), i: 0 }));
    for (let n0 = 0; n0 < inp.length; n0++) {
      const x = (n0 >= pd ? inp[n0 - pd] : 0) * 0.015;
      let s = 0;
      for (const c of combs) {
        const y = c.buf[c.i];
        c.store = y * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * room;
        c.i = (c.i + 1) % c.buf.length;
        s += y;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        const y = -s + b;
        a.buf[a.i] = s + b * 0.5;
        a.i = (a.i + 1) % a.buf.length;
        s = y;
      }
      out[n0] = s;
    }
    return out;
  };
  const mono = new Float32Array(L.length);
  for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
  const wl = run(mono, 0), wr = run(mono, spread);
  const w1 = (1 + width) / 2, w2 = (1 - width) / 2;
  for (let i = 0; i < wl.length; i++) { const a = wl[i], b = wr[i]; wl[i] = a * w1 + b * w2; wr[i] = b * w1 + a * w2; }
  return [wl, wr];
}

// Ping-pong delay (feedback, time in seconds).
export function pingpong(L, R, { time = 0.4, fb = 0.35, mix = 0.25, lp = 4000 } = {}) {
  const d = Math.round(time * SR);
  const bl = new Float32Array(d), br = new Float32Array(d);
  const oL = new Float32Array(L.length), oR = new Float32Array(R.length);
  let i = 0, zl = 0, zr = 0;
  const a = Math.exp(-2 * Math.PI * lp / SR);
  for (let n0 = 0; n0 < L.length; n0++) {
    const dl = bl[i], dr = br[i];
    zl = (1 - a) * dl + a * zl; zr = (1 - a) * dr + a * zr;
    bl[i] = (L[n0] + R[n0]) * 0.5 + zr * fb;
    br[i] = zl * fb;
    i = (i + 1) % d;
    oL[n0] = dl * mix; oR[n0] = dr * mix;
  }
  return [oL, oR];
}

// Gain curve from trigger times (sidechain-style duck), e.g. under each kick.
export function duckCurve(len, times, { depth = 0.35, attack = 0.004, release = 0.18 } = {}) {
  const g = new Float32Array(len).fill(1);
  for (const t of times) {
    const s = Math.round(t * SR);
    const A = Math.round(attack * SR), Rl = Math.round(release * SR);
    for (let i = 0; i < A + Rl; i++) {
      const j = s + i;
      if (j < 0 || j >= len) continue;
      const v = i < A ? 1 - depth * (i / A) : 1 - depth * Math.pow(1 - (i - A) / Rl, 2);
      g[j] = Math.min(g[j], v);
    }
  }
  return g;
}

// Feed-forward compressor with lookahead-free RMS detector (gentle glue).
export function compress(L, R, { threshold = -18, ratio = 2.5, attack = 0.01, release = 0.15, makeup = 0 } = {}) {
  const aa = Math.exp(-1 / (attack * SR)), ar = Math.exp(-1 / (release * SR));
  let envv = 0;
  const mk = db(makeup);
  for (let i = 0; i < L.length; i++) {
    const lvl = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    envv = lvl > envv ? aa * envv + (1 - aa) * lvl : ar * envv + (1 - ar) * lvl;
    const ldb = 20 * Math.log10(envv + 1e-9);
    const over = ldb - threshold;
    const gdb = over > 0 ? -over * (1 - 1 / ratio) : 0;
    const g = db(gdb) * mk;
    L[i] *= g; R[i] *= g;
  }
}

// Lookahead brickwall-ish limiter.
export function limit(L, R, { ceiling = -1, lookahead = 0.005, release = 0.08 } = {}) {
  const c = db(ceiling);
  const la = Math.round(lookahead * SR);
  const n0 = L.length;
  const need = new Float32Array(n0);
  for (let i = 0; i < n0; i++) {
    const p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    need[i] = p > c ? c / p : 1;
  }
  // minimum over the lookahead window, then smooth release
  const g = new Float32Array(n0);
  const rel = Math.exp(-1 / (release * SR));
  let cur = 1;
  for (let i = n0 - 1; i >= 0; i--) {
    let m = need[i];
    for (let k = 1; k <= la && i + k < n0; k += 8) m = Math.min(m, need[i + k]);
    g[i] = m;
  }
  for (let i = 0; i < n0; i++) {
    cur = g[i] < cur ? g[i] : rel * cur + (1 - rel) * g[i];
    L[i] *= Math.min(cur, g[i] < 1 ? g[i] : cur);
    R[i] *= Math.min(cur, g[i] < 1 ? g[i] : cur);
  }
}

// ---------------------------------------------------------------- io
export function writeWav(file, L, R, fs) {
  const n0 = L.length;
  const buf = Buffer.alloc(44 + n0 * 2 * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n0 * 8, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(3, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 8, 28); buf.writeUInt16LE(8, 32); buf.writeUInt16LE(32, 34);
  buf.write('data', 36); buf.writeUInt32LE(n0 * 8, 40);
  for (let i = 0; i < n0; i++) { buf.writeFloatLE(L[i], 44 + i * 8); buf.writeFloatLE(R[i], 48 + i * 8); }
  fs.writeFileSync(file, buf);
}

// ================================================================ added for the reel
// Closed / open hi-hat: metallic noise (six detuned squares) through a high band.
export function hat({ vel = 1, open = false, seed = 41 } = {}) {
  const len = Math.round((open ? 0.42 : 0.07) * SR);
  const x = new Float32Array(len);
  const fr = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * 1.7);
  const r = rng(seed);
  const ph = fr.map(() => r());
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let s = 0;
    for (let k = 0; k < fr.length; k++) { const p = (ph[k] + fr[k] * t) % 1; s += p < 0.5 ? 1 : -1; }
    s = s / fr.length + (r() * 2 - 1) * 0.5;
    const e = open ? Math.exp(-t / 0.12) : Math.exp(-t / 0.014);
    x[i] = s * e * Math.min(1, t / 0.0008);
  }
  biquad(x, 'hp', 7000, 0.7);
  biquad(x, 'peak', 10000, 1, 3);
  return x.map((v) => v * vel * 0.55);
}

export function snare({ vel = 1, seed = 43, tone = 190 } = {}) {
  const len = Math.round(0.28 * SR);
  const r = rng(seed);
  const x = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += 2 * Math.PI * (tone * (1 + 0.5 * Math.exp(-t / 0.01))) / SR;
    x[i] = Math.sin(ph) * Math.exp(-t / 0.05) * 0.7 + (r() * 2 - 1) * Math.exp(-t / 0.075) * 0.8;
  }
  biquad(x, 'hp', 140, 0.7);
  biquad(x, 'peak', 4200, 0.9, 3);
  return x.map((v) => v * vel * 0.8);
}

export function snap({ vel = 1, seed = 47 } = {}) {
  const len = Math.round(0.12 * SR);
  const r = rng(seed);
  const x = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    x[i] = (r() * 2 - 1) * Math.exp(-t / 0.011) + Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t / 0.006) * 0.5;
  }
  biquad(x, 'bp', 2300, 1.4);
  return x.map((v) => v * vel * 2.2);
}

// Marimba: rosewood bar modes (1, 3.93, 9.2) with a soft mallet knock.
export function mallet(midi, { vel = 1, dur = 1.0, seed = 53, bright = 1 } = {}) {
  const f = midiHz(midi);
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const r = rng(seed);
  const modes = [[1, 1, 0.42], [3.93, 0.32 * bright, 0.09], [9.2, 0.08 * bright, 0.03]];
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    let s = 0;
    for (const [k, a, tau] of modes) s += a * Math.sin(2 * Math.PI * f * k * t) * Math.exp(-t / tau);
    const knock = t < 0.006 ? (r() * 2 - 1) * 0.3 * (1 - t / 0.006) : 0;
    out[i] = (s + knock) * Math.min(1, t / 0.001);
  }
  return out.map((v) => v * vel * 0.7);
}

// Saw pluck with a snappy low-pass envelope (pop lead / chord stabs).
export function pluckSynth(midi, { vel = 1, dur = 0.35, cutoff = 4200, seed = 59, detune = 0.08, square = 0 } = {}) {
  const f = midiHz(midi);
  const len = Math.round((dur + 0.2) * SR);
  const r = rng(seed);
  const out = new Float32Array(len);
  for (const d of [-detune, detune]) {
    let ph = r();
    const ff = f * Math.pow(2, d / 12);
    for (let i = 0; i < len; i++) {
      ph += ff / SR; if (ph >= 1) ph -= 1;
      out[i] += square ? (ph < 0.5 ? 0.5 : -0.5) * square + (2 * ph - 1) * (1 - square) : 2 * ph - 1;
    }
  }
  svfLP(out, (i) => 300 + cutoff * Math.exp(-(i / SR) / 0.09), 0.9);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    out[i] *= Math.min(1, t / 0.003) * Math.exp(-t / (dur * 0.6)) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.2) : 1);
  }
  return out.map((v) => v * vel * 0.35);
}

// 808-style bass: sine with a short pitch drop and gentle saturation.
export function bass808(midi, { vel = 1, dur = 0.5, slideFrom = 0 } = {}) {
  const f = midiHz(midi);
  const len = Math.round((dur + 0.12) * SR);
  const x = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const fr = f * (1 + 0.6 * Math.exp(-t / 0.012)) * (slideFrom ? Math.pow(2, (slideFrom * Math.exp(-t / 0.06)) / 12) : 1);
    ph += 2 * Math.PI * fr / SR;
    const e = Math.min(1, t / 0.004) * (t < dur ? Math.exp(-t / (dur * 0.9)) : Math.exp(-dur / (dur * 0.9)) * Math.max(0, 1 - (t - dur) / 0.08));
    x[i] = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * e;
  }
  softclip(x, 1.8);
  return x.map((v) => v * vel);
}

// Music box: bright, high, short bell.
export function musicBox(midi, { vel = 1 } = {}) {
  const f = midiHz(midi);
  const len = Math.round(1.6 * SR);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    out[i] = (Math.sin(2 * Math.PI * f * t) * 0.8 + Math.sin(2 * Math.PI * f * 2.0 * t) * 0.25 * Math.exp(-t / 0.2) + Math.sin(2 * Math.PI * f * 5.4 * t) * 0.12 * Math.exp(-t / 0.05)) * Math.exp(-t / 0.6) * Math.min(1, t / 0.001);
  }
  return out.map((v) => v * vel * 0.5);
}

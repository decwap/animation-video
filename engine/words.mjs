// Word timing: whisper tokens → the script's own words, each with t0/t1 in seconds.
// Captions and every data-at ref read these, so re-voicing re-times the whole video.
import { norm } from './refs.mjs';

export function whisperTokens(json) {
  return (json.transcription || [])
    .map((s) => ({ text: s.text.trim(), norm: norm(s.text), t0: s.offsets.from / 1000, t1: s.offsets.to / 1000 }))
    .filter((t) => t.norm);
}

// ---------------------------------------------------------------- numbers as spoken
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function under100(n) {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
}
function under1000(n, and) {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (!h) return under100(r);
  return `${ONES[h]} hundred` + (r ? `${and ? ' and' : ''} ${under100(r)}` : '');
}
function intWords(n, and = false) {
  if (n === 0) return 'zero';
  const parts = [];
  for (const [size, name] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand'], [1, '']]) {
    const chunk = Math.floor(n / size) % 1000;
    if (chunk) parts.push(under1000(chunk, and) + (name ? ` ${name}` : ''));
  }
  return parts.join(' ');
}

// Every way a written number might be spoken, as norms (no spaces).
export function numberWords(text) {
  let s = String(text).trim();
  let unit = '';
  const cur = /^(GH¢|GHS|\$|£|€|¢)/.exec(s);
  if (cur) { unit = { 'GH¢': 'cedis', GHS: 'cedis', $: 'dollars', '£': 'pounds', '€': 'euros', '¢': 'cents' }[cur[1]]; s = s.slice(cur[1].length).trim(); }
  s = s.replace(/[?!.,;:]+$/, '');
  let pct = false;
  if (s.endsWith('%')) { pct = true; s = s.slice(0, -1); }
  s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return [];
  const [whole, frac] = s.split('.');
  const n = +whole;
  const spoken = new Set([intWords(n), intWords(n, true)]);
  if (!frac && whole.length === 4 && n >= 1100 && n < 2100) {
    const hi = Math.floor(n / 100);
    const lo = n % 100;
    if (lo) spoken.add(`${under100(hi)} ${lo < 10 ? `oh ${ONES[lo]}` : under100(lo)}`);
    else spoken.add(`${under100(hi)} hundred`);
  }
  const out = new Set([norm(s)]);
  for (const base of spoken) {
    let w = base;
    if (frac) w += ` point ${[...frac].map((d) => ONES[+d]).join(' ')}`;
    if (pct) w += ' percent';
    out.add(norm(w));
    if (unit) out.add(norm(`${w} ${unit}`));
  }
  return [...out];
}

// ---------------------------------------------------------------- alignment
const candidates = (t) => new Set([norm(t), ...numberWords(t)]);
const overlaps = (a, b) => { for (const x of a) if (b.has(x)) return true; return false; };
const round = (t) => +t.toFixed(3);

// Needleman–Wunsch over the script words and whisper tokens. One word may match up to four
// tokens ("10,000" ↔ "ten thousand", "b-roll" ↔ "B roll") and up to four words one token.
export function alignWords(words, tokens) {
  const n = words.length;
  const m = tokens.length;
  const wc = words.map((w) => candidates(w.text));
  const tc = tokens.map((t) => candidates(t.text));
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(Infinity));
  const B = Array.from({ length: n + 1 }, () => new Array(m + 1));
  D[0][0] = 0;
  const relax = (i, j, d, step) => { if (d < D[i][j]) { D[i][j] = d; B[i][j] = step; } };
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= m; j++) {
      const d = D[i][j];
      if (d === Infinity) continue;
      for (let k = 2; k <= 4 && i < n && j + k <= m; k++) {
        if (wc[i].has(tokens.slice(j, j + k).map((t) => t.norm).join(''))) relax(i + 1, j + k, d, { kind: '1:k', i, j, k });
      }
      for (let k = 2; k <= 4 && i + k <= n && j < m; k++) {
        if (tc[j].has(words.slice(i, i + k).map((w) => w.norm).join(''))) relax(i + k, j + 1, d, { kind: 'k:1', i, j, k });
      }
      if (i < n && j < m) relax(i + 1, j + 1, d + (overlaps(wc[i], tc[j]) ? 0 : 1), { kind: '1:1', i, j });
      if (i < n) relax(i + 1, j, d + 1, { kind: 'skipW', i, j });
      if (j < m) relax(i, j + 1, d + 1, { kind: 'skipT', i, j });
    }
  }

  // heard: whisper matched this word (false for a mishearing or a word it dropped).
  const out = words.map((w) => ({ ...w, t0: null, t1: null, heard: false }));
  for (let i = n, j = m; i > 0 || j > 0;) {
    const s = B[i][j];
    if (s.kind === '1:1') { out[s.i].t0 = tokens[s.j].t0; out[s.i].t1 = tokens[s.j].t1; out[s.i].heard = overlaps(wc[s.i], tc[s.j]); }
    else if (s.kind === '1:k') { out[s.i].t0 = tokens[s.j].t0; out[s.i].t1 = tokens[s.j + s.k - 1].t1; out[s.i].heard = true; }
    else if (s.kind === 'k:1') {
      const t = tokens[s.j];
      const lens = words.slice(s.i, s.i + s.k).map((w) => Math.max(1, w.norm.length));
      const total = lens.reduce((a, b) => a + b, 0);
      let at = t.t0;
      lens.forEach((len, q) => {
        const dur = (t.t1 - t.t0) * len / total;
        out[s.i + q].t0 = at; out[s.i + q].t1 = at + dur; out[s.i + q].heard = true; at += dur;
      });
    }
    i = s.i;
    j = s.j;
  }

  // Words whisper never heard: share the gap between their timed neighbours.
  for (let a = 0; a < n;) {
    if (out[a].t0 !== null) { a++; continue; }
    let b = a;
    while (b < n && out[b].t0 === null) b++;
    const from = a > 0 ? out[a - 1].t1 : Math.max(0, (b < n ? out[b].t0 : 0) - 0.3 * (b - a));
    const to = b < n ? out[b].t0 : from + 0.3 * (b - a);
    const step = Math.max(0, to - from) / (b - a);
    for (let q = a; q < b; q++) { out[q].t0 = from + step * (q - a); out[q].t1 = from + step * (q - a + 1); }
    a = b;
  }

  for (let q = 0; q < n; q++) {
    if (q > 0 && out[q].t0 < out[q - 1].t0) out[q].t0 = out[q - 1].t0;
    if (out[q].t1 < out[q].t0 + 0.04) out[q].t1 = out[q].t0 + 0.04;
    out[q].t0 = round(out[q].t0);
    out[q].t1 = round(out[q].t1);
  }
  return out;
}

// Draft timing before there is a voice: a steady pace, a breath after punctuation and lines.
export function estimateWords(words, { wpm = 150, gap = 0.25 } = {}) {
  const per = 60 / wpm;
  let t = 0;
  return words.map((w, q) => {
    const next = words[q + 1];
    const out = { ...w, t0: round(t), t1: round(t + per) };
    t += per;
    if (/[.?!]$/.test(w.text)) t += 0.25;
    else if (/[,;:]$/.test(w.text)) t += 0.12;
    if (next && next.line !== w.line) t += gap;
    return out;
  });
}

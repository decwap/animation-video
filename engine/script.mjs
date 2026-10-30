// Read a script.md: a "# Title" line and numbered lines ("1. …"), with *accent words* in
// asterisks (they may span several words). Everything else is notes and is ignored.
import { norm } from './refs.mjs';

export function parseScript(text) {
  const out = { title: '', lines: [], words: [] };
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!out.title && /^#\s+/.test(line)) { out.title = line.replace(/^#\s+/, ''); continue; }
    const m = /^(\d+)\.\s+(.*)$/.exec(line);
    if (!m) continue;
    const n = +m[1];
    out.lines.push({ n, text: m[2].replace(/\*/g, '').replace(/\s+/g, ' ').trim() });
    let inside = false;
    for (const piece of m[2].split(/\s+/).filter(Boolean)) {
      let text = '';
      let emph = false;
      for (const ch of piece) {
        if (ch === '*') { inside = !inside; continue; }
        if (inside) emph = true;
        text += ch;
      }
      if (!norm(text)) continue;
      out.words.push({ i: out.words.length, text, norm: norm(text), emph, line: n });
    }
  }
  if (!out.lines.length) throw new Error('script has no numbered lines (write them as "1. …")');
  return out;
}

// Word references, shared by the build (Node loads this file through engine/refs.mjs) and the
// browser kit (window.AVRefs). A ref names a moment in a scene: a spoken word, a line, a word
// index or plain seconds, plus an optional offset. Part of animation-video (by Web Asamoah).
//
//   "script"   first "script" spoken in the scene      "script#2"  the second one
//   "script$"  the end of that word                    "L4"        the first word of line 4
//   "w12"      word 12 of the whole script             "0.8s"      0.8 s into the scene
//   "start" / "end"  the scene's edges                 any of these + "+0.2" or "-0.1"
(function (root) {
  'use strict';

  function norm(s) {
    return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  }

  class RefError extends Error {
    constructor(message) { super(message); this.name = 'RefError'; }
  }

  const round = (t) => +t.toFixed(3);

  function resolveRef(ref, ctx) {
    const raw = String(ref).trim();
    let base = raw;
    let offset = 0;
    const m = /^(.+?)([+-]\d*\.?\d+)$/.exec(raw);
    if (m) { base = m[1]; offset = parseFloat(m[2]); }

    const words = ctx.words;
    const s0 = ctx.sceneStart;
    const range = ctx.wordRange || [0, words.length - 1];
    const where = ctx.sceneId ? ` in scene "${ctx.sceneId}"` : '';
    const sceneWords = () => words.slice(range[0], range[1] + 1).map((w) => w.norm).join(' ');
    let t;

    if (base === 'start') t = s0;
    else if (base === 'end') t = ctx.sceneEnd;
    else if (/^\d*\.?\d+s$/.test(base)) t = s0 + parseFloat(base);
    else if (/^w\d+$/.test(base)) {
      const w = words[+base.slice(1)];
      if (!w) throw new RefError(`unknown ref "${raw}"${where}: there is no word ${base.slice(1)}`);
      t = w.t0;
    } else if (/^L\d+$/.test(base)) {
      const n = +base.slice(1);
      const w = words.find((x) => x.line === n);
      if (!w) throw new RefError(`unknown ref "${raw}"${where}: there is no line ${n}`);
      t = w.t0;
    } else {
      const parts = /^(.*?)(?:#(\d+))?(\$)?$/.exec(base);
      const key = norm(parts[1]);
      const nth = parts[2] ? +parts[2] : 1;
      let count = 0;
      let hit = null;
      for (let i = range[0]; i <= range[1]; i++) {
        if (words[i] && words[i].norm === key && ++count === nth) { hit = words[i]; break; }
      }
      if (!hit) throw new RefError(`unknown ref "${raw}"${where}; scene words: ${sceneWords()}`);
      t = parts[3] ? hit.t1 : hit.t0;
    }
    return round(t - s0 + offset);
  }

  root.AVRefs = { norm, resolveRef, RefError };
})(typeof window !== 'undefined' ? window : globalThis);

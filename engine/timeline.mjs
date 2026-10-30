// Scene timing from the voice: each scene starts just before its first spoken word and
// overlaps the next one slightly so transitions never leave an empty frame.
const r3 = (t) => +t.toFixed(3);

export function planTimeline(storyboard, words) {
  const { lead = 0.15, tail = 2.5, overlap = 0.35, scenes = [] } = storyboard;
  if (!scenes.length) throw new Error('storyboard has no scenes');
  const warnings = [];

  const owner = new Map();
  for (const sc of scenes) {
    const [a, b] = sc.lines;
    for (let n = a; n <= b; n++) {
      if (owner.has(n)) throw new Error(`line ${n} is in scenes ${owner.get(n)} and ${sc.id}`);
      owner.set(n, sc.id);
    }
  }
  for (const n of new Set(words.map((w) => w.line))) {
    if (!owner.has(n)) warnings.push(`line ${n} is not in any scene, so nothing new shows while it is spoken`);
  }

  const planned = scenes.map((sc) => {
    const idx = words.filter((w) => w.line >= sc.lines[0] && w.line <= sc.lines[1]).map((w) => w.i);
    if (!idx.length) throw new Error(`scene ${sc.id} covers lines ${sc.lines.join('–')}, which have no words`);
    return { id: sc.id, src: sc.src, lines: [...sc.lines], wordRange: [Math.min(...idx), Math.max(...idx)], hold: sc.hold || 0 };
  }).sort((x, y) => x.wordRange[0] - y.wordRange[0]);

  planned.forEach((p, q) => { p.start = q === 0 ? 0 : r3(Math.max(0, words[p.wordRange[0]].t0 - lead)); });
  planned.forEach((p, q) => {
    const next = planned[q + 1];
    p.end = next ? r3(next.start + overlap) : r3(words[p.wordRange[1]].t1 + Math.max(tail, p.hold));
  });
  for (const p of planned) {
    if (p.end - p.start < 0.8) warnings.push(`scene ${p.id} is under 0.8 s (${r3(p.end - p.start)} s): merge it with a neighbour`);
  }
  return { duration: planned.at(-1).end, scenes: planned.map(({ hold, ...p }) => p), warnings };
}

// The Look Picker: every look of one video playing side by side, live, with nothing rendered.
// Players stay in sync; only the selected look has sound. The person tells Claude their pick.
// Build all looks (and each card's Build this look) asks the picker's own server (engine/serve.mjs)
// to rebuild; a picked or edited look only takes kit fixes.
import { PLAYER_URL } from './config.mjs';
import { escapeHtml } from './html.mjs';

export function pickerHtml({ title, duration, looks, slug = 'video' }) {
  const letter = (k) => String.fromCharCode(65 + k);
  // A picked look's button only refreshes its kit (Studio edits stay), so it says so.
  const cards = looks.map((l, k) => `    <figure class="look${l.picked ? ' picked' : ''}" data-look="${l.id}" tabindex="0">
      <div class="frame"><hyperframes-player src="looks/${l.id}/index.html" muted></hyperframes-player><div class="busy">Building…</div></div>
      <figcaption><b>${letter(k)} · ${escapeHtml(l.label)}</b>${l.picked ? '<span class="pick">★ Your pick</span>' : l.locked ? '<span class="lock">🔒 Keeps your edits</span>' : ''}<span class="say">Tell Claude: use ${escapeHtml(l.label)}</span>
        <span class="built"${l.builtAt ? ` data-built="${escapeHtml(l.builtAt)}"` : ''}></span>
        <span class="acts"><button class="build-one" type="button" data-look="${l.id}" title="${l.picked || l.locked ? 'Keeps your Studio edits: only its kit is refreshed' : `Rebuild only ${escapeHtml(l.label)} from the current scenes`}">${l.picked || l.locked ? '⟳ Refresh kit' : '⟳ Build this look'}</button>
        <button class="render-one" type="button" data-look="${l.id}" title="Render ${escapeHtml(l.label)} to a finished MP4 in renders/">🎬 Render this look</button>${l.picked ? '' : `
        <button class="pick-one" type="button" data-look="${l.id}" title="Make ${escapeHtml(l.label)} the look you review in Studio and render; your earlier pick keeps its edits">☆ Make this my pick</button>`}</span>
        <a class="watch" href="renders/${escapeHtml(slug)}-${l.id}.mp4" target="_blank" hidden>▶ Watch the render</a></figcaption>
    </figure>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · Look Picker</title>
<script src="${PLAYER_URL}"></script>
<style>
  :root { color-scheme: dark; --bg: #111214; --panel: #1b1c20; --line: #2c2e34; --text: #f2f2f4; --muted: #9a9ca5; --accent: #f08a5d; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 15px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  header { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; gap: 10px 18px; align-items: center; padding: 14px 18px; background: rgba(17, 18, 20, 0.92); border-bottom: 1px solid var(--line); backdrop-filter: blur(8px); }
  h1 { margin: 0; font-size: 18px; }
  header p { margin: 0; color: var(--muted); }
  .controls { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; flex: 1 1 360px; }
  input[type=range] { min-width: 140px; }
  button { background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: 10px; padding: 8px 14px; font: inherit; cursor: pointer; white-space: nowrap; }
  button:hover { border-color: var(--accent); }
  input[type=range] { flex: 1; accent-color: var(--accent); }
  #time { font-variant-numeric: tabular-nums; color: var(--muted); min-width: 62px; text-align: right; }
  main { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; padding: 18px; }
  @media (max-width: 1100px) { main { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) { main { grid-template-columns: minmax(0, 1fr); } }
  .look { margin: 0; padding: 10px; border: 2px solid var(--line); border-radius: 18px; background: var(--panel); cursor: pointer; }
  .look.selected { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(240, 138, 93, 0.25); }
  .frame { position: relative; width: 100%; aspect-ratio: 9 / 16; border-radius: 12px; overflow: hidden; background: #000; }
  hyperframes-player { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  figcaption { display: flex; flex-direction: column; gap: 2px; padding: 10px 4px 2px; }
  .say { color: var(--muted); font-size: 13px; }
  .look.selected .say { color: var(--accent); font-weight: 600; }
  #pick { color: var(--accent); font-weight: 600; }
  #build { border-color: var(--accent); }
  #build:disabled, .build-one:disabled { opacity: 0.6; cursor: progress; }
  .acts { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .build-one, .render-one, .pick-one { padding: 5px 10px; font-size: 13px; }
  .pick-one { border-color: var(--accent); }
  .lock { color: var(--muted); font-weight: 600; font-size: 13px; }
  .render-one:disabled, #renderall:disabled { opacity: 0.6; cursor: progress; }
  .watch { margin-top: 6px; color: var(--accent); font-weight: 600; font-size: 14px; text-decoration: none; }
  #buildnote a { color: #fff; font-weight: 700; margin-left: 8px; }
  #buildmsg { color: var(--accent); font-weight: 600; }
  #buildnote { margin: 12px 18px 0; padding: 10px 14px; border: 1px solid #3c6e4f; border-radius: 12px; background: #16261c; color: #bfe8cc; }
  .frame .busy { display: none; position: absolute; inset: 0; z-index: 3; place-items: center; background: rgba(0, 0, 0, 0.62); color: #fff; font-weight: 700; font-size: 20px; }
  .look.busy .frame .busy { display: grid; }
  .pick { color: var(--accent); font-weight: 700; font-size: 13px; }
  .built { color: var(--muted); font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>Pick a look</h1>
  <p>${escapeHtml(title)} · ${duration.toFixed(1)} s · live previews · nothing renders until you press Render</p>
  <div class="controls">
    <button id="play" type="button">▶ Play all</button>
    <button id="pause" type="button">❚❚ Pause</button>
    <input id="scrub" type="range" min="0" max="${duration}" step="0.01" value="0" aria-label="Time" />
    <span id="time">0.0 s</span>
    <button id="build" type="button" title="Rebuild every look you haven't picked; a picked look only takes kit fixes">⟳ Build all looks</button>
    <button id="renderall" type="button" title="Render every look to a finished MP4 in renders/ (about 30 s each)">🎬 Render all looks</button>
  </div>
  <span id="buildmsg"></span>
  <span id="pick">Click a look to hear it.</span>
</header>
<div id="buildnote" hidden></div>
<main>
${cards}
</main>
<script>
  const DRIFT = 0.1;
  const figs = [...document.querySelectorAll('.look')];
  const players = figs.map((f) => f.querySelector('hyperframes-player'));
  let selected = players[0];
  let playing = false;
  const lead = () => selected || players[0];
  function select(fig) {
    figs.forEach((f) => f.classList.toggle('selected', f === fig));
    selected = fig.querySelector('hyperframes-player');
    players.forEach((p) => { p.muted = p !== selected; });
    document.getElementById('pick').textContent = fig.querySelector('.say').textContent;
  }
  figs.forEach((f) => {
    f.addEventListener('click', () => select(f));
    f.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(f); } });
  });
  function seekAll(t) { players.forEach((p) => { p.currentTime = t; }); }
  document.getElementById('play').addEventListener('click', () => {
    const t = lead().currentTime || 0;
    seekAll(t);
    players.forEach((p) => p.play());
    playing = true;
  });
  document.getElementById('pause').addEventListener('click', () => { players.forEach((p) => p.pause()); playing = false; });
  const scrub = document.getElementById('scrub');
  scrub.addEventListener('input', () => { seekAll(+scrub.value); });
  const buildMsg = document.getElementById('buildmsg');
  const buildButtons = [...document.querySelectorAll('#build, .build-one, #renderall, .render-one, .pick-one')];
  const labelOf = (id) => { const b = document.querySelector('.look[data-look="' + id + '"] b'); return b ? b.textContent.replace(/^[A-Z] · /, '') : id; };
  document.querySelectorAll('.built[data-built]').forEach((el) => {
    el.textContent = 'Built ' + new Date(el.dataset.built).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
  });
  // What the last build did, shown after the reload so a rebuild that looks the same still says so.
  try {
    const note = sessionStorage.getItem('av-build-note');
    if (note) {
      const n = document.getElementById('buildnote');
      const saved = JSON.parse(note);
      n.textContent = saved.text;
      for (const href of saved.links || []) { const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.textContent = '▶ ' + href.split('/').pop(); n.appendChild(a); }
      n.hidden = false;
      sessionStorage.removeItem('av-build-note');
    }
  } catch (e) { /* no storage: the status line still showed it */ }
  // Show "Watch the render" on every look that already has one.
  document.querySelectorAll('.watch').forEach((a) => {
    fetch(a.getAttribute('href'), { method: 'HEAD' }).then((r) => { if (r.ok) a.hidden = false; }).catch(() => {});
  });
  async function runBuild(what, request, cards) {
    buildButtons.forEach((b) => { b.disabled = true; });
    cards.forEach((c) => c.classList.add('busy'));
    buildMsg.textContent = 'Building ' + what + '…';
    try {
      const res = await request();
      const r = await res.json();
      if (!r.ok) throw new Error(r.error || res.statusText);
      const done = [];
      if (r.built.length) done.push('Rebuilt ' + r.built.map(labelOf).join(', ') + ' from the current scenes');
      if (r.kept.length) done.push(r.kept.map(labelOf).join(', ') + ' (your pick): kit refreshed, your edits and sound untouched');
      const text = '✓ ' + (done.join('. ') || 'Nothing to build') + ' · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      buildMsg.textContent = text + '. Reloading…';
      try { sessionStorage.setItem('av-build-note', JSON.stringify({ text })); } catch (e) { /* the status line has it */ }
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      buildMsg.textContent = 'Build failed: ' + e.message + ' Ask Claude to look at it.';
      cards.forEach((c) => c.classList.remove('busy'));
      buildButtons.forEach((b) => { b.disabled = false; });
    }
  }
  // Rendering makes the finished MP4 (render, master to -14 LUFS, cover) in renders/.
  async function runRender(what, request, cards) {
    buildButtons.forEach((b) => { b.disabled = true; });
    cards.forEach((c) => { c.classList.add('busy'); c.querySelector('.busy').textContent = 'Rendering…'; });
    buildMsg.textContent = 'Rendering ' + what + '… about 30 s a look; keep this page open.';
    try {
      const res = await request();
      const r = await res.json();
      if (!r.ok) throw new Error(r.error || res.statusText);
      const text = '✓ Rendered ' + r.rendered.map((x) => labelOf(x.look) + ' (' + x.lufs + ' LUFS)').join(', ') + ' into renders/ · ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      buildMsg.textContent = text + '. Reloading…';
      try { sessionStorage.setItem('av-build-note', JSON.stringify({ text, links: r.rendered.map((x) => x.file) })); } catch (e) { /* the status line has it */ }
      setTimeout(() => location.reload(), 1200);
    } catch (e) {
      buildMsg.textContent = 'Render failed: ' + e.message + ' Ask Claude to look at it.';
      cards.forEach((c) => { c.classList.remove('busy'); c.querySelector('.busy').textContent = 'Building…'; });
      buildButtons.forEach((b) => { b.disabled = false; });
    }
  }
  document.getElementById('renderall').addEventListener('click', () => runRender('every look', () => fetch('__av/render', { method: 'POST', headers: { 'x-av-build': '1' } }), figs));
  document.querySelectorAll('.render-one').forEach((btn) => {
    const id = btn.dataset.look;
    btn.addEventListener('keydown', (e) => e.stopPropagation());
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      runRender(labelOf(id), () => fetch('__av/render?looks=' + encodeURIComponent(id), { method: 'POST', headers: { 'x-av-build': '1' } }), [btn.closest('.look')]);
    });
  });
  document.querySelectorAll('.watch').forEach((a) => a.addEventListener('click', (e) => e.stopPropagation()));
  // Changing the pick: the new pick is locked too, and every look picked before keeps its edits.
  document.querySelectorAll('.pick-one').forEach((btn) => {
    const id = btn.dataset.look;
    btn.addEventListener('keydown', (e) => e.stopPropagation());
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      buildButtons.forEach((b) => { b.disabled = true; });
      buildMsg.textContent = 'Making ' + labelOf(id) + ' your pick…';
      try {
        const res = await fetch('__av/pick?looks=' + encodeURIComponent(id), { method: 'POST', headers: { 'x-av-build': '1' } });
        const r = await res.json();
        if (!r.ok) throw new Error(r.error || res.statusText);
        const kept = r.locked.filter((x) => x !== r.pick).map(labelOf);
        const text = '★ ' + labelOf(r.pick) + ' is now your pick' + (kept.length ? '. ' + kept.join(', ') + (kept.length === 1 ? ' keeps' : ' keep') + ' your edits (locked)' : '') + '.';
        buildMsg.textContent = text;
        try { sessionStorage.setItem('av-build-note', JSON.stringify({ text })); } catch (e2) { /* the status line has it */ }
        setTimeout(() => location.reload(), 700);
      } catch (err) {
        buildMsg.textContent = 'Could not change the pick: ' + err.message;
        buildButtons.forEach((b) => { b.disabled = false; });
      }
    });
  });
  document.getElementById('build').addEventListener('click', () => runBuild('every look', () => fetch('__av/build', { method: 'POST', headers: { 'x-av-build': '1' } }), figs));
  document.querySelectorAll('.build-one').forEach((btn) => {
    const id = btn.dataset.look;
    const name = btn.closest('.look').querySelector('b').textContent.replace(/^[A-Z] · /, '');
    // a press on the card's button must not also select the card
    btn.addEventListener('keydown', (e) => e.stopPropagation());
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      runBuild(name, () => fetch('__av/build?looks=' + encodeURIComponent(id), { method: 'POST', headers: { 'x-av-build': '1' } }), [btn.closest('.look')]);
    });
  });
  (function tick() {
    const t = lead().currentTime || 0;
    if (document.activeElement !== scrub) scrub.value = t;
    document.getElementById('time').textContent = t.toFixed(1) + ' s';
    if (playing) players.forEach((p) => { if (p !== lead() && Math.abs((p.currentTime || 0) - t) > DRIFT) p.currentTime = t; });
    requestAnimationFrame(tick);
  })();
</script>
</body>
</html>
`;
}

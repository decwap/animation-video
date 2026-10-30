import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { pickerHtml } from '../engine/picker.mjs';
import { serve } from '../engine/serve.mjs';

const LOOKS = [
  { id: 'paper', label: 'Warm Paper' }, { id: 'glow', label: 'Midnight Glow' },
  { id: 'doodle', label: 'Storybook Doodle' }, { id: 'editorial', label: 'Bold Editorial' },
];

test('the picker has one player per look, each pointing at its project', () => {
  const html = pickerHtml({ title: 'My video', duration: 42.5, looks: LOOKS });
  assert.equal((html.match(/<hyperframes-player /g) || []).length, 4);
  for (const l of LOOKS) {
    assert.match(html, new RegExp(`src="looks/${l.id}/index\\.html"`));
    assert.match(html, new RegExp(`Tell Claude: use ${l.label}`));
  }
  assert.match(html, /hyperframes@0\.8\.216\/dist\/hyperframes-player\.global\.js/);
  assert.match(html, /id="play"/);
  assert.match(html, /id="scrub"[^>]*max="42\.5"/);
  assert.match(html, /live previews · nothing renders until you press Render/);
  assert.match(html, /button \{[^}]*white-space: nowrap/);
});

test('the picker keeps players within 0.1 s and gives sound to the selected look only', () => {
  const html = pickerHtml({ title: 'T', duration: 10, looks: LOOKS });
  assert.match(html, /DRIFT = 0\.1/);
  assert.match(html, /muted = p !== selected/);
});

test('the picker has a Build all looks button that asks its own server to build', () => {
  const html = pickerHtml({ title: 'T', duration: 10, looks: LOOKS });
  assert.match(html, /<button id="build"[^>]*>[^<]*Build all looks/);
  assert.match(html, /fetch\('__av\/build', \{ method: 'POST', headers: \{ 'x-av-build': '1' \} \}\)/);
});

test('each look card has its own build button, which builds only that look', () => {
  const html = pickerHtml({ title: 'T', duration: 10, looks: LOOKS });
  for (const l of LOOKS) assert.match(html, new RegExp(`<button class="build-one" type="button" data-look="${l.id}"[^>]*>[^<]*Build this look`));
  assert.match(html, /fetch\('__av\/build\?looks=' \+ encodeURIComponent\(id\), \{ method: 'POST', headers: \{ 'x-av-build': '1' \} \}\)/);
  assert.match(html, /stopPropagation\(\)/, 'pressing a card button must not also select the card');
});

test('a build shows on the card, says what it did after the reload, and each card shows when it was built', () => {
  const looks = [{ id: 'paper', label: 'Warm Paper', builtAt: '2026-10-30T00:02:37.000Z' }, { id: 'doodle', label: 'Storybook Doodle', builtAt: '2026-10-29T22:53:04.000Z', picked: true }];
  const html = pickerHtml({ title: 'T', duration: 10, looks });
  assert.match(html, /<span class="built" data-built="2026-10-30T00:02:37\.000Z"><\/span>/);
  assert.match(html, /<div class="busy">Building…<\/div>/);
  assert.match(html, /<figure class="look picked" data-look="doodle"/);
  assert.match(html, /★ Your pick/);
  assert.match(html, /data-look="doodle"[^>]*>⟳ Refresh kit<\/button>/);
  assert.match(html, /data-look="paper"[^>]*>⟳ Build this look<\/button>/);
  assert.match(html, /id="buildnote"/);
  assert.match(html, /sessionStorage\.setItem\('av-build-note'/);
  assert.match(html, /try \{[^}]*sessionStorage/);
});

test('each card can render its look to an MP4 and links to the render once it exists', () => {
  const html = pickerHtml({ title: 'T', duration: 10, looks: LOOKS, slug: 'my-video' });
  for (const l of LOOKS) {
    assert.match(html, new RegExp(`<button class="render-one" type="button" data-look="${l.id}"[^>]*>[^<]*Render this look`));
    assert.match(html, new RegExp(`<a class="watch" href="renders/my-video-${l.id}\\.mp4" target="_blank" hidden>`));
  }
  assert.match(html, /<button id="renderall"[^>]*>[^<]*Render all looks/);
  assert.match(html, /fetch\('__av\/render\?looks=' \+ encodeURIComponent\(id\), \{ method: 'POST', headers: \{ 'x-av-build': '1' \} \}\)/);
  assert.match(html, /method: 'HEAD'/);
});

test('serve renders the asked looks through the same guards, one job at a time', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-serve-'));
  fs.writeFileSync(path.join(dir, 'picker.html'), '<p>hi</p>');
  const seen = [];
  const s = await serve(dir, { port: 0, renderLooks: async (d, o) => { seen.push(o.looks); return { rendered: (o.looks || ['paper']).map((look) => ({ look, file: path.join(d, 'renders', `x-${look}.mp4`), lufs: -14, tp: -1.3 })) }; } });
  const post = (q, headers = { 'x-av-build': '1' }) => fetch(new URL(`__av/render${q}`, s.url), { method: 'POST', headers });
  try {
    assert.equal((await post('?looks=glow', {})).status, 403);
    assert.equal((await post('?looks=nope')).status, 400);
    const res = await post('?looks=glow');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, rendered: [{ look: 'glow', file: 'renders/x-glow.mp4', lufs: -14, tp: -1.3 }] });
    assert.deepEqual(seen, [['glow']]);
  } finally {
    await s.close();
  }
});

test('every card but the pick can become the pick, and a locked look says it keeps the edits', () => {
  const looks = [{ id: 'paper', label: 'Warm Paper' }, { id: 'glow', label: 'Midnight Glow', picked: true, locked: true }, { id: 'doodle', label: 'Storybook Doodle', locked: true }];
  const html = pickerHtml({ title: 'T', duration: 10, looks });
  assert.match(html, /<button class="pick-one" type="button" data-look="paper"[^>]*>☆ Make this my pick<\/button>/);
  assert.match(html, /<button class="pick-one" type="button" data-look="doodle"/);
  assert.doesNotMatch(html, /class="pick-one" type="button" data-look="glow"/);
  assert.match(html, /data-look="doodle"[\s\S]*?🔒 Keeps your edits/);
  assert.match(html, /class="build-one" type="button" data-look="doodle"[^>]*>⟳ Refresh kit/);
  assert.match(html, /fetch\('__av\/pick\?looks=' \+ encodeURIComponent\(id\), \{ method: 'POST', headers: \{ 'x-av-build': '1' \} \}\)/);
});

test('serve sets the pick for one named look only', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-serve-'));
  fs.writeFileSync(path.join(dir, 'picker.html'), '<p>hi</p>');
  const seen = [];
  const s = await serve(dir, { port: 0, setPick: (d, look) => { seen.push([d, look]); return { pick: look, locked: ['doodle', look] }; } });
  const post = (q, headers = { 'x-av-build': '1' }) => fetch(new URL(`__av/pick${q}`, s.url), { method: 'POST', headers });
  try {
    assert.equal((await post('?looks=glow', {})).status, 403);
    assert.equal((await post('')).status, 400);
    assert.equal((await post('?looks=glow,paper')).status, 400);
    const res = await post('?looks=glow');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, pick: 'glow', locked: ['doodle', 'glow'] });
    assert.deepEqual(seen, [[path.resolve(dir), 'glow']]);
  } finally {
    await s.close();
  }
});

test('serve builds only the looks a request names, and refuses names it does not know', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-serve-'));
  fs.writeFileSync(path.join(dir, 'picker.html'), '<p>hi</p>');
  const seen = [];
  const s = await serve(dir, { port: 0, buildAll: async (d, o) => { seen.push(o.looks); return { built: o.looks || [], kept: [], warnings: [] }; } });
  const post = (q) => fetch(new URL(`__av/build${q}`, s.url), { method: 'POST', headers: { 'x-av-build': '1' } });
  try {
    assert.equal((await post('?looks=glow')).status, 200);
    assert.equal((await post('?looks=glow,paper')).status, 200);
    assert.equal((await post('?looks=nope')).status, 400);
    assert.equal((await post('?looks=../x')).status, 400);
    assert.equal((await post('')).status, 200);
    assert.deepEqual(seen, [['glow'], ['glow', 'paper'], undefined]);
  } finally {
    await s.close();
  }
});

test('serve runs buildAll for its own page only, one build at a time', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-serve-'));
  fs.writeFileSync(path.join(dir, 'picker.html'), '<p>hi</p>');
  let calls = 0;
  let release;
  const s = await serve(dir, { port: 0, buildAll: async (d) => { calls++; assert.equal(d, path.resolve(dir)); await new Promise((r) => { release = r; }); return { built: ['paper', 'glow'], kept: ['doodle'], warnings: [] }; } });
  const post = (headers) => fetch(new URL('__av/build', s.url), { method: 'POST', headers });
  try {
    assert.equal((await post({})).status, 403);
    assert.equal((await post({ 'x-av-build': '1', origin: 'https://evil.example' })).status, 403);
    const first = post({ 'x-av-build': '1', origin: new URL(s.url).origin });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal((await post({ 'x-av-build': '1' })).status, 409);
    release();
    const res = await first;
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, built: ['paper', 'glow'], kept: ['doodle'], warnings: [] });
    assert.equal(calls, 1);
    assert.equal((await fetch(new URL('__av/build', s.url))).status, 405);
  } finally {
    await s.close();
  }
});

test('the picker escapes the title', () => {
  assert.match(pickerHtml({ title: '<b>&', duration: 1, looks: LOOKS }), /&lt;b&gt;&amp;/);
});

test('serve answers byte ranges and revalidates, so players can seek audio without re-downloading it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-serve-'));
  const bytes = Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 256));
  fs.writeFileSync(path.join(dir, 'music.wav'), bytes);
  const s = await serve(dir, { port: 0 });
  const url = new URL('music.wav', s.url);
  try {
    const whole = await fetch(url);
    assert.equal(whole.status, 200);
    assert.equal(whole.headers.get('accept-ranges'), 'bytes');
    assert.equal(whole.headers.get('content-length'), '1000');
    assert.doesNotMatch(whole.headers.get('cache-control') || '', /no-store/);
    const etag = whole.headers.get('etag');
    assert.ok(etag);
    await whole.arrayBuffer();
    const part = await fetch(url, { headers: { range: 'bytes=100-199' } });
    assert.equal(part.status, 206);
    assert.equal(part.headers.get('content-range'), 'bytes 100-199/1000');
    assert.deepEqual(Buffer.from(await part.arrayBuffer()), bytes.subarray(100, 200));
    const open = await fetch(url, { headers: { range: 'bytes=990-' } });
    assert.equal(open.status, 206);
    assert.equal((await open.arrayBuffer()).byteLength, 10);
    assert.equal((await fetch(url, { headers: { range: 'bytes=5000-' } })).status, 416);
    assert.equal((await fetch(url, { headers: { 'if-none-match': etag } })).status, 304);
  } finally {
    await s.close();
  }
});

test('serve refuses raw traversal and survives a file it cannot read', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-serve-'));
  fs.writeFileSync(path.join(dir, 'picker.html'), '<p>hi</p>');
  fs.writeFileSync(path.join(dir, 'locked.wav'), 'x');
  fs.chmodSync(path.join(dir, 'locked.wav'), 0o000);
  const s = await serve(dir, { port: 0 });
  const raw = (p) => new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: s.port, path: p }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end();
  });
  try {
    assert.equal(await raw('/..%2f..%2f..%2fetc%2fpasswd'), 404);
    assert.equal(await raw('/../../etc/passwd'), 404);
    assert.ok([403, 500].includes(await raw('/locked.wav')));
    assert.equal(await raw('/picker.html'), 200);
  } finally {
    fs.chmodSync(path.join(dir, 'locked.wav'), 0o644);
    await s.close();
  }
});

test('serve hands out the folder with the right types and stops cleanly', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-serve-'));
  fs.writeFileSync(path.join(dir, 'picker.html'), '<!doctype html><p>hi</p>');
  fs.mkdirSync(path.join(dir, 'a'));
  fs.writeFileSync(path.join(dir, 'a', 'x.js'), 'window.x = 1;');
  const s = await serve(dir, { port: 0 });
  try {
    assert.match(s.url, /^http:\/\/localhost:\d+\/picker\.html$/);
    const page = await fetch(s.url);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const js = await fetch(new URL('a/x.js', s.url));
    assert.match(js.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(new URL('../../etc/passwd', s.url))).status, 404);
    assert.equal((await fetch(new URL('nope.css', s.url))).status, 404);
  } finally {
    await s.close();
  }
});

test('each card can export its look as an edit pack and links to the pack once it exists', () => {
  const html = pickerHtml({ title: 'T', duration: 10, looks: LOOKS, slug: 'my-video' });
  for (const l of LOOKS) {
    assert.match(html, new RegExp(`<button class="render-one"[^>]*data-look="${l.id}"[^>]*>[^<]*</button>\\s*<button class="pack-one" type="button" data-look="${l.id}" title="Export layers, sound and a Premiere timeline to edit in Premiere Pro or CapCut">📦 Edit pack</button>`));
    assert.match(html, new RegExp(`<a class="pack" href="renders/my-video-${l.id}-edit-pack/HOW%20TO%20EDIT\\.txt" target="_blank" hidden>📂 Open edit pack</a>`));
  }
  assert.match(html, /fetch\('__av\/editpack\?looks=' \+ encodeURIComponent\(id\), \{ method: 'POST', headers: \{ 'x-av-build': '1' \} \}\)/);
  assert.match(html, /Making the edit pack \(a few minutes\)…/);
  assert.match(html, /document\.querySelectorAll\('#build, \.build-one, #renderall, \.render-one, \.pick-one, \.pack-one'\)/);
});

test('serve exports an edit pack for one named look only, through the same guards', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-serve-'));
  fs.writeFileSync(path.join(dir, 'picker.html'), '<p>hi</p>');
  const seen = [];
  let release;
  const s = await serve(dir, { port: 0, editPack: async (d, o) => {
    seen.push([d, o.looks]);
    if (o.looks[0] === 'paper') await new Promise((r) => { release = r; });
    return { packed: o.looks.map((look) => ({ look, dir: path.join(d, 'renders', `x-${look}-edit-pack`), seconds: 12.5, files: [] })) };
  } });
  const post = (q, headers = { 'x-av-build': '1' }) => fetch(new URL(`__av/editpack${q}`, s.url), { method: 'POST', headers });
  try {
    assert.equal((await post('?looks=glow', {})).status, 403);
    assert.equal((await post('')).status, 400);
    assert.equal((await post('?looks=glow,paper')).status, 400);
    const res = await post('?looks=glow');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true, packed: [{ look: 'glow', dir: 'renders/x-glow-edit-pack', howto: 'renders/x-glow-edit-pack/HOW TO EDIT.txt', seconds: 12.5 }] });
    assert.deepEqual(seen, [[path.resolve(dir), ['glow']]]);
    const slow = post('?looks=paper');
    while (!release) await new Promise((r) => setTimeout(r, 10));
    assert.equal((await post('?looks=glow')).status, 409);
    release();
    assert.equal((await slow).status, 200);
  } finally {
    await s.close();
  }
});

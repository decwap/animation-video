// A tiny static server for a video folder, so the Look Picker can load every look, plus one action:
// POST __av/build runs buildAll and POST __av/render renders (the picker's buttons). Ctrl+C stops it.
//   node engine/serve.mjs <videoDir> [--port 4810]   → prints the picker URL
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { LOOKS } from './config.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
};

const json = (res, code, body) => res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body));

// Renders run in their own process, so a long render never freezes the server the picker plays from.
function renderInChild(root, { looks } = {}) {
  return new Promise((resolve, reject) => {
    const args = [path.join(path.dirname(fileURLToPath(import.meta.url)), 'render.mjs'), root, '--json', ...(looks ? ['--looks', looks.join(',')] : [])];
    const child = spawn(process.execPath, args);
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { err = (err + d).slice(-2000); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) { reject(new Error(err.trim().split('\n').pop() || `render exited with ${code}`)); return; }
      try { resolve(JSON.parse(out.trim().split('\n').pop())); } catch { reject(new Error('render gave no result')); }
    });
  });
}

export function serve(dir, { port = 4810, page = 'picker.html', buildAll, renderLooks, setPick } = {}) {
  const root = path.resolve(dir);
  let busy = null;
  const runBuild = buildAll || (async (d, o) => (await import('./build.mjs')).buildAll(d, o));
  const runRender = renderLooks || renderInChild;
  // picking also rewrites the picker page, so its badges show the new pick after the reload
  const runPick = setPick || (async (d, look) => { const r = (await import('./pick.mjs')).setPick(d, look); await (await import('./build.mjs')).writePicker(d); return r; });
  const relPath = (f) => path.relative(root, f).split(path.sep).join('/');

  // Only the picker's own page may start a job: other sites can't send the custom header without a
  // CORS preflight this server never approves, and their Origin wouldn't match. One job at a time.
  async function onJob(req, res, kind) {
    if (req.method !== 'POST') { json(res, 405, { ok: false, error: 'POST only' }); return; }
    const own = new Set([`http://localhost:${server.address().port}`, `http://127.0.0.1:${server.address().port}`]);
    if (req.headers['x-av-build'] !== '1' || (req.headers.origin && !own.has(req.headers.origin))) { json(res, 403, { ok: false, error: 'not from the Look Picker' }); return; }
    // ?looks=glow works on just those looks (a card's button); no query means every look
    const asked = new URL(req.url, 'http://x').searchParams.get('looks');
    const looks = asked === null ? null : asked.split(',').map((x) => x.trim()).filter(Boolean);
    if (looks && (!looks.length || looks.some((id) => !LOOKS.includes(id)))) { json(res, 400, { ok: false, error: `unknown look "${asked}" (looks: ${LOOKS.join(', ')})` }); return; }
    if (kind === 'pick' && (!looks || looks.length !== 1)) { json(res, 400, { ok: false, error: 'name one look to pick' }); return; }
    if (busy) { json(res, 409, { ok: false, error: `a ${busy} is already running` }); return; }
    busy = kind;
    try {
      const opts = looks ? { looks } : {};
      if (kind === 'pick') {
        const r = await runPick(root, looks[0]);
        json(res, 200, { ok: true, pick: r.pick, locked: r.locked });
      } else if (kind === 'build') {
        const r = await runBuild(root, opts);
        json(res, 200, { ok: true, built: r.built, kept: r.kept, warnings: r.warnings });
      } else {
        const r = await runRender(root, opts);
        json(res, 200, { ok: true, rendered: r.rendered.map((x) => ({ look: x.look, file: relPath(x.file), lufs: x.lufs, tp: x.tp, ...(x.cover ? { cover: relPath(x.cover) } : {}), ...(x.seconds ? { seconds: x.seconds } : {}) })) });
      }
    } catch (e) {
      json(res, 500, { ok: false, error: e.message });
    } finally {
      busy = null;
    }
  }

  const server = http.createServer((req, res) => {
    let rel;
    try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
    if (rel === '/__av/build') { onJob(req, res, 'build'); return; }
    if (rel === '/__av/render') { onJob(req, res, 'render'); return; }
    if (rel === '/__av/pick') { onJob(req, res, 'pick'); return; }
    const file = path.resolve(root, `.${rel.endsWith('/') ? `${rel}index.html` : rel}`);
    const fail = (code, text) => res.writeHead(code, { 'content-type': 'text/plain' }).end(text);
    if (!file.startsWith(root + path.sep)) { fail(404, 'not found'); return; }
    // Open before answering: a file a rebuild just deleted, or one we may not read, gets a status,
    // never a hung request or a crashed server.
    let fd;
    try {
      fd = fs.openSync(file, 'r');
      if (!fs.fstatSync(fd).isFile()) { fs.closeSync(fd); fail(404, 'not found'); return; }
    } catch (e) {
      fail(e.code === 'EACCES' || e.code === 'EPERM' ? 403 : 404, e.code === 'EACCES' ? 'cannot read' : 'not found');
      return;
    }
    // Players seek audio with byte ranges; without 206 answers each seek re-downloads the file.
    // no-cache + ETag lets the browser keep files and still see a rebuild at once.
    const { size, mtimeMs } = fs.fstatSync(fd);
    const etag = `"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
    const head = { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache', etag, 'accept-ranges': 'bytes' };
    const send = (code, extra, opts = {}) => {
      res.writeHead(code, { ...head, ...extra });
      const stream = fs.createReadStream(null, { fd, ...opts });
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    };
    if (req.headers['if-none-match'] === etag) { fs.closeSync(fd); res.writeHead(304, head).end(); return; }
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range && (range[1] || range[2])) {
      const start = range[1] ? +range[1] : Math.max(0, size - +range[2]);
      const end = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (start >= size || start > end) { fs.closeSync(fd); res.writeHead(416, { ...head, 'content-range': `bytes */${size}` }).end(); return; }
      send(206, { 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 }, { start, end });
      return;
    }
    send(200, { 'content-length': size });
  });
  return new Promise((resolve, reject) => {
    const tryPort = (p, left) => {
      server.once('error', (e) => (e.code === 'EADDRINUSE' && left > 0 ? tryPort(p + 1, left - 1) : reject(e)));
      server.listen(p, '127.0.0.1', () => {
        const actual = server.address().port;
        resolve({ url: `http://localhost:${actual}/${page}`, port: actual, close: () => new Promise((r) => server.close(r)) });
      });
    };
    tryPort(port, port === 0 ? 0 : 20);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const { values: o, positionals } = parseArgs({ allowPositionals: true, options: { port: { type: 'string' } } });
  const s = await serve(positionals[0] || '.', { port: o.port ? +o.port : 4810 });
  console.log(`Look Picker: ${s.url}`);
}

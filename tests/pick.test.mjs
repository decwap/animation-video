import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readPick, setPick } from '../engine/pick.mjs';

// A video folder with built looks a, b and c (index.html is what "built" means).
function video() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'av-pick-'));
  for (const id of ['a', 'b', 'c']) {
    fs.mkdirSync(path.join(dir, 'looks', id), { recursive: true });
    fs.writeFileSync(path.join(dir, 'looks', id, 'index.html'), '<html></html>');
  }
  return dir;
}
const locked = (dir, id) => fs.existsSync(path.join(dir, 'looks', id, '.av-master'));

test('setPick records the pick and locks that look; a look picked before stays locked', () => {
  const dir = video();
  assert.equal(readPick(dir, ['a', 'b', 'c']), null);
  setPick(dir, 'a');
  assert.equal(readPick(dir, ['a', 'b', 'c']), 'a');
  assert.ok(locked(dir, 'a'));
  const r = setPick(dir, 'b');
  assert.equal(r.pick, 'b');
  assert.equal(readPick(dir, ['a', 'b', 'c']), 'b');
  assert.ok(locked(dir, 'b'));
  assert.ok(locked(dir, 'a'), 'the old pick keeps its edits safe');
  assert.deepEqual(r.locked, ['a', 'b']);
  assert.ok(!locked(dir, 'c'));
  assert.throws(() => setPick(dir, 'nope'), /isn't built/);
});

test('without pick.json, the pick is the look that carries the master marker', () => {
  const dir = video();
  fs.writeFileSync(path.join(dir, 'looks', 'b', '.av-master'), 'picked\n');
  assert.equal(readPick(dir, ['a', 'b', 'c']), 'b');
});

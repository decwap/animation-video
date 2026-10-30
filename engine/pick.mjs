// The pick: the look that is the master (reviewed in Studio, rendered by default), kept in
// pick.json at the video's root. Picking a look also locks it (looks/<look>/.av-master), so builds
// never overwrite edits made in Studio; a look picked before stays locked, so changing the pick
// never exposes its edits. Part of animation-video (by Web Asamoah).
//   node engine/pick.mjs <videoDir> [<look>]   → sets the pick, or prints it
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { LOOKS, paths } from './config.mjs';

const pickFile = (videoDir) => path.join(videoDir, 'pick.json');
const built = (videoDir, id) => fs.existsSync(path.join(paths(videoDir).looksDir, id, 'index.html'));
const isLocked = (videoDir, id) => fs.existsSync(path.join(paths(videoDir).looksDir, id, '.av-master'));

// The current pick, or null. Before pick.json existed the pick was the look with the master marker.
export function readPick(videoDir, looks = LOOKS) {
  try {
    const { look } = JSON.parse(fs.readFileSync(pickFile(videoDir), 'utf8'));
    if (look && built(videoDir, look)) return look;
  } catch { /* no pick recorded */ }
  return looks.find((id) => built(videoDir, id) && isLocked(videoDir, id)) || null;
}

export function setPick(videoDir, look, looks = LOOKS) {
  if (!built(videoDir, look)) throw new Error(`${look} isn't built yet: build it first`);
  fs.writeFileSync(pickFile(videoDir), `${JSON.stringify({ look, at: new Date().toISOString() }, null, 2)}\n`);
  const marker = path.join(paths(videoDir).looksDir, look, '.av-master');
  if (!fs.existsSync(marker)) fs.writeFileSync(marker, `picked ${new Date().toISOString()}\n`);
  const all = [...new Set([...looks, ...fs.readdirSync(paths(videoDir).looksDir)])].filter((id) => !id.includes('.bak-'));
  return { pick: look, locked: all.filter((id) => built(videoDir, id) && isLocked(videoDir, id)).sort((a, b) => all.indexOf(a) - all.indexOf(b)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [dir, look] = process.argv.slice(2);
  if (!dir) { console.error('usage: node engine/pick.mjs <videoDir> [<look>]'); process.exit(1); }
  try {
    if (look) {
      const r = setPick(dir, look);
      console.log(`picked ${r.pick}; locked (edits kept): ${r.locked.join(', ')}`);
    } else console.log(readPick(dir) || 'no pick yet');
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

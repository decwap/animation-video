// Load a look from kit/looks/<id>/look.mjs and check it can render every primitive.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { KIT_DIR } from './config.mjs';
import { PRIMITIVES } from './table.mjs';

export async function loadLook(id) {
  const dir = path.join(KIT_DIR, 'looks', id);
  const file = path.join(dir, 'look.mjs');
  if (!fs.existsSync(file)) throw new Error(`unknown look "${id}" (no kit/looks/${id}/look.mjs)`);
  const look = { ...(await import(pathToFileURL(file).href)).default, dir };
  const missing = PRIMITIVES.filter((n) => typeof look.primitives?.[n] !== 'function');
  if (missing.length) throw new Error(`look ${id} cannot render: ${missing.join(', ')}`);
  return look;
}

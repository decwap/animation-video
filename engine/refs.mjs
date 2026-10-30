// Node side of kit/core/refs.js: one source of truth for word refs in the build and the browser.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { KIT_DIR } from './config.mjs';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(KIT_DIR, 'core', 'refs.js'), 'utf8'), context, { filename: 'kit/core/refs.js' });

export const { norm, resolveRef, RefError } = context.AVRefs;

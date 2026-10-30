// Node side of kit/core/table.js (primitive names and default verbs).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { KIT_DIR } from './config.mjs';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(KIT_DIR, 'core', 'table.js'), 'utf8'), context, { filename: 'kit/core/table.js' });

export const PRIMITIVES = [...context.AVTable.PRIMITIVES];
export const { defaultVerb } = context.AVTable;

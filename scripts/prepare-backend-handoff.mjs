import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const script = resolve(import.meta.dirname, '../packages/backend/scripts/prepare-backend-handoff.mjs');
execFileSync(process.execPath, [script], { stdio: 'inherit' });

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..');
const run = (args, cwd = root) => execFileSync('npm', args, { cwd, stdio: 'inherit' });
run(['run', 'typecheck:backend']);
run(['run', 'test:backend']);
run(['run', 'build:backend']);
const output = join(root, 'artifacts/backend');
mkdirSync(output, { recursive: true });
const scratch = mkdtempSync(join(tmpdir(), 'shared-backend-'));
try {
  const packed = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--cache', join(scratch, 'cache'), '--pack-destination', output], { cwd: join(root, 'packages/backend'), encoding: 'utf8' }))[0];
  writeFileSync(join(scratch, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--cache', join(scratch, 'cache'), join(output, packed.filename)], scratch);
  // The same public tests now resolve ONLY the installed tarball's exports.
  const consumer = readFileSync(join(root, 'packages/backend/tests/portability.test.ts'), 'utf8').replaceAll('../src/index.ts', '@shared/backend');
  const testPath = join(scratch, 'consumer.test.ts');
  writeFileSync(testPath, consumer);
  execFileSync(process.execPath, ['--import', join(root, 'node_modules/tsx/dist/loader.mjs'), '--test', testPath], { cwd: scratch, stdio: 'inherit' });
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', '--typeRoots', join(root, 'node_modules/@types'), testPath], { cwd: scratch, stdio: 'inherit' });
  writeFileSync(join(output, 'solar-projects.ts'), readFileSync(join(root, 'packages/backend/examples/solar-projects.ts'), 'utf8').replace('../src/index.js', '@shared/backend'));
  writeFileSync(join(output, 'HANDOFF.md'), readFileSync(join(root, 'packages/backend/docs/portability.md')));
  const sha256 = createHash('sha256').update(readFileSync(join(output, packed.filename))).digest('hex');
  writeFileSync(join(output, 'manifest.json'), JSON.stringify({ name: packed.name, version: packed.version, artifact: packed.filename, sha256, validated: ['source typecheck', 'source tests', 'build', 'installed tarball Mall/Solar CRUD, policy and SQL tests', 'installed tarball consumer typecheck'] }, null, 2) + '\n');
  console.log(`Prepared ${packed.filename}; SHA-256 ${sha256}`);
} finally { rmSync(scratch, { recursive: true, force: true }); }

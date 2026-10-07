import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const ids = ['building', 'tree', 'vehicle', 'person', 'lamp', 'bench', 'monument'];
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const previous = JSON.parse(await readFile('public/model-3d/asset-manifest.json', 'utf8'));
const building = previous.assets.find(asset => asset.id === 'building');
const buildingBytes = await readFile(`public/model-3d/${building.file}`);
if (hash(buildingBytes) !== '578abef2f86d3bac7093bf03e48fd7c4a590d1d6c6ee958d5ebc6bfc33ea6650') throw new Error('Preserved building checksum changed');
const assets = { building };
const sources = JSON.parse(await readFile('scripts/scene-asset-sources.json', 'utf8'));
const sourceFiles = new Map();
for (const source of sources) {
  for (const file of [{ ...source, file: source.url.split('/').pop() }, ...source.files]) {
    const key = `${source.id}/${file.file}`;
    const path = join(tmpdir(), 'le-grande-scene-sources', key);
    const algorithm = file.sha256 ? 'sha256' : 'md5', digest = file.sha256 ?? file.md5;
    let bytes;
    try { bytes = await readFile(path); } catch { /* First reproducible download. */ }
    if (!bytes || hash(bytes, algorithm) !== digest) {
      const response = await fetch(file.url);
      if (!response.ok) throw new Error(`Download failed: ${file.url} (${response.status})`);
      bytes = Buffer.from(await response.arrayBuffer());
      if (hash(bytes, algorithm) !== digest) throw new Error(`Source checksum changed: ${file.url}`);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, bytes);
    }
    sourceFiles.set(`/__sources/${key}`, path);
  }
  console.log(`Pinned source ready: ${source.id}`);
}
const provenance = {
  tree: { source: 'Poly Haven: Island Tree 02 — Rob Tuytel, Rico Cilliers; Shrub 02 — Rico Cilliers', license: 'CC0-1.0 — https://polyhaven.com/license' },
  vehicle: { source: 'Car Concept — Eric Chadwick / Darmstadt Graphics Group GmbH (2024), based on Unity Fan CC0 concept; Khronos glTF Sample Assets', license: 'CC-BY-4.0; steering emblem and license-plate pieces removed; logos/textures removed; see ASSET-LICENSE.md' },
  person: { source: 'Cesium Man — Cesium (2017), Khronos glTF Sample Assets; skinned walking character', license: 'CC-BY-4.0; trademark-bearing diffuse texture omitted and replaced with neutral material; skin/walk animation retained; see ASSET-LICENSE.md' },
};
const server = await createServer({ configFile: false, server: { host: '127.0.0.1', port: 4174, strictPort: true, cors: false, hmr: false }, plugins: [{
  name: 'scene-asset-authoring',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      if (sourceFiles.has(req.url)) {
        res.setHeader('Content-Type', req.url.endsWith('.gltf') ? 'model/gltf+json' : req.url.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
        res.end(await readFile(sourceFiles.get(req.url))); return;
      }
      if (req.url === '/__author') {
        res.setHeader('Content-Type', 'text/html');
        res.end('<!doctype html><html lang="en"><title>Le Grande asset authoring</title><body>Exporting assets…<script type="module" src="/scripts/scene-assets.ts"></script></body></html>');
        return;
      }
      const id = req.url?.replace('/__assets/', '');
      if (req.method !== 'POST' || id === 'building' || !ids.includes(id)) return next();
      try {
        if (req.headers.origin !== 'http://127.0.0.1:4174') throw new Error('Local authoring origin required');
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 32 * 1024 * 1024) throw new Error('Asset exceeds 32 MiB'); chunks.push(chunk); }
        const bytes = Buffer.concat(chunks);
        if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Invalid GLB 2.0');
        const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
        if ((json.buffers ?? []).some(value => value.uri) || (json.images ?? []).some(value => value.uri)) throw new Error('External URIs forbidden');
        if ((json.meshes?.length ?? 0) > 64 || (json.textures?.length ?? 0) > 32) throw new Error('Asset resource limits exceeded');
        const sha256 = hash(bytes), file = `${id}-${sha256.slice(0, 12)}.glb`;
        await mkdir('public/model-3d/assets', { recursive: true });
        await writeFile(`public/model-3d/assets/${file}`, bytes);
        assets[id] = { id, file: `assets/${file}`, bytes: bytes.length, sha256, meshes: json.meshes.length, textures: json.textures?.length ?? 0, ...(provenance[id] ?? { source: 'scripts/scene-assets.ts — original authored geometry', license: 'Project-authored; distribution as part of Le Grande Centre only' }), confidence: 'illustrative' };
        console.log(`${id}: ${bytes.length} bytes / ${json.meshes.length} meshes / ${sha256}`);
        if (ids.every(key => assets[key])) {
          const ordered = ids.map(key => assets[key]);
          await writeFile('public/model-3d/asset-manifest.json', JSON.stringify({ schemaVersion: 1, sceneVersion: '2026-10-07.3', assetManifestHash: hash(JSON.stringify(ordered)), assets: ordered }, null, 2) + '\n');
          console.log('Asset manifest written. Export complete; original building bytes preserved.');
        }
        res.end('OK');
      } catch (error) { res.statusCode = 400; res.end(String(error)); }
    });
  }
}] });
await server.listen();
console.log('Open http://127.0.0.1:4174/__author to reproduce optimized local GLBs.');

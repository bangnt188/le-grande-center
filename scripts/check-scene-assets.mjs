import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const manifest = JSON.parse(await readFile('public/model-3d/asset-manifest.json', 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.schemaVersion, 1);
assert.equal(manifest.assetManifestHash, hash(JSON.stringify(manifest.assets)));
assert.equal(manifest.assets.find(asset => asset.id === "building")?.sha256, "578abef2f86d3bac7093bf03e48fd7c4a590d1d6c6ee958d5ebc6bfc33ea6650", "The existing building must stay byte-identical");
const sources = JSON.parse(await readFile("scripts/scene-asset-sources.json", "utf8"));
assert.deepEqual(sources.map(source => source.id), ["island_tree_02", "shrub_02", "vehicle", "person"]);
for (const source of sources) for (const file of [source, ...source.files]) {
  assert.match(file.url, /^https:\/\/(dl\.polyhaven\.org|raw\.githubusercontent\.com)\//);
  assert.match(file.sha256 ?? file.md5, /^(?:[a-f0-9]{32}|[a-f0-9]{64})$/);
}
const ids = new Set();
let total = 0;
for (const asset of manifest.assets) {
  assert(!ids.has(asset.id)); ids.add(asset.id);
  assert.match(asset.file, /^assets\/[a-z]+-[a-f0-9]{12}\.glb$/);
  assert(asset.source && asset.license && asset.bytes <= 32 * 1024 * 1024);
  const data = await readFile(`public/model-3d/${asset.file}`);
  assert.equal(data.length, asset.bytes); assert.equal(hash(data), asset.sha256);
  assert.equal(data.readUInt32LE(0), 0x46546c67); assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length); assert.equal(data.readUInt32LE(16), 0x4e4f534a);
  const jsonSize = data.readUInt32LE(12), json = JSON.parse(data.subarray(20, 20 + jsonSize).toString());
  assert.equal(json.asset.version, '2.0');
  assert.equal(json.meshes.length, asset.meshes); assert(json.meshes.length <= 64);
  assert((json.textures?.length ?? 0) <= 32);
  assert((json.buffers ?? []).every(buffer => !buffer.uri));
  assert((json.images ?? []).every(image => !image.uri && ['image/png', 'image/jpeg'].includes(image.mimeType)));
  assert((json.accessors ?? []).every(accessor => accessor.count <= 2_000_000));
  assert(!(json.extensionsRequired ?? []).length, 'No external decoder required for these bounded assets');
  const triangles = json.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((count, primitive) => count + json.accessors[primitive.indices].count / 3, 0), 0);
  if (asset.id === "tree") {
    assert.match(asset.license, /CC0-1.0/); assert(asset.textures > 0); assert(triangles < 7000);
    assert(json.nodes.some(node => node.extras?.plantKind === "shrub"));
  }
  if (asset.id === "vehicle") {
    assert.match(asset.license, /CC-BY-4.0/); assert(triangles < 16000);
    assert(!(json.nodes ?? []).some(node => /license|licen[cs]e.?plate|logo|emblem|badge/i.test(node.name ?? "")), "Vehicle logo mesh pieces must be removed");
    assert(!(json.materials ?? []).some(material => /license|logo/i.test(material.name ?? "")), "Brand-marked vehicle materials must be removed");
  }
  if (asset.id === "person") {
    assert.match(asset.license, /CC-BY-4.0/);
    assert.equal(json.images?.length ?? 0, 0, "Trademark-bearing Cesium diffuse texture must be removed from redistributed pedestrian");
    assert.equal(json.textures?.length ?? 0, 0, "Pedestrian must use neutral authored material only");
    assert(json.skins?.length > 0 && json.animations?.[0]?.channels.length > 10, "Pedestrian must retain its articulated walking rig");
  }
  const binOffset = 20 + jsonSize + 8;
  for (const image of json.images ?? []) {
    const view = json.bufferViews[image.bufferView];
    assert(view.buffer === 0 && view.byteLength <= 4 * 1024 * 1024);
    if (image.mimeType === 'image/png') {
      const png = data.subarray(binOffset + (view.byteOffset ?? 0), binOffset + (view.byteOffset ?? 0) + view.byteLength);
      assert.equal(png.readUInt32BE(0), 0x89504e47);
      assert(png.readUInt32BE(16) <= 1024 && png.readUInt32BE(20) <= 1024);
    }
  }
  total += data.length;
  console.log(`${asset.id}: GLB 2.0, ${data.length} bytes, ${json.meshes.length} meshes, checksum and embedded resources verified`);
}
assert.deepEqual([...ids].sort(), ['bench', 'building', 'lamp', 'monument', 'person', 'tree', 'vehicle']);
assert(total < 16 * 1024 * 1024, "Bounded self-hosted GLB transfer budget");
console.log(`Total: ${total} bytes; self-hosted licensed sources, walking rig and unchanged building verified.`);

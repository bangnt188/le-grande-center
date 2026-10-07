import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// Three ships this authoring-only optimizer without an @types declaration.
// @ts-expect-error upstream addon declaration is not published
import { MeshoptSimplifier } from "three/addons/libs/meshopt_simplifier.module.js";
import { disposeScene } from "../src/app/model-3d/assets";

// Original authored assets. Reference image informs palette/landscape, never building geometry.
function material(name: string, color: string, roughness = .8, metalness = 0) {
  const result = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  result.name = name;
  return result;
}
const limestone = material("Warm limestone", "#b9ad94");
const bronze = material("Patinated bronze", "#555246", .6, .65);
const bark = material("Bark", "#665744");
const black = material("Charcoal", "#20282a", .65);
const warm = material("Lantern", "#e1ba72", .4);
warm.emissive.set("#ffc575"); warm.emissiveIntensity = .3;

function mesh(group: THREE.Group, geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(x, y, z); group.add(object); return object;
}
function box(group: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, bevel = .03) {
  return mesh(group, new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel, w / 4, h / 4, d / 4)), mat, x, y, z);
}
function cylinder(group: THREE.Group, mat: THREE.Material, x: number, y: number, z: number, top: number, bottom: number, h: number, segments = 12) {
  return mesh(group, new THREE.CylinderGeometry(top, bottom, h, segments), mat, x, y, z);
}
function bar(group: THREE.Group, mat: THREE.Material, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const mid = a.clone().add(b).multiplyScalar(.5);
  const object = cylinder(group, mat, mid.x, mid.y, mid.z, radius * .65, radius, a.distanceTo(b));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
}
function bake(group: THREE.Group, role: string) {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.updateMatrixWorld(true);
  for (const object of [...group.children]) if (object instanceof THREE.Mesh) {
    const geometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(object.matrix);
    const list = buckets.get(object.material) ?? []; list.push(geometry); buckets.set(object.material, list);
    object.geometry.dispose(); group.remove(object);
  }
  for (const [mat, geometries] of buckets) {
    const merged = mergeGeometries(geometries)!;
    const indexed = mergeVertices(merged);
    geometries.forEach(geometry => geometry.dispose()); merged.dispose();
    const object = new THREE.Mesh(indexed, mat); object.name = mat.name;
    object.userData.renderRole = role; object.castShadow = true; object.receiveShadow = true; group.add(object);
  }
  group.userData = { confidence: "illustrative", source: "Original procedural authoring", units: "estimated-model-units" };
  return group;
}
const loader = new GLTFLoader();

function normalize(group: THREE.Group, height: number, length = false) {
  const bounds = new THREE.Box3().setFromObject(group);
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const scale = height / (length ? Math.max(size.x, size.z) : size.y);
  const wrapper = new THREE.Group(); wrapper.add(group);
  group.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  wrapper.scale.setScalar(scale);
  return wrapper;
}

function simplify(geometry: THREE.BufferGeometry, target: number) {
  const position = geometry.getAttribute("position");
  const indices = geometry.index ? new Uint32Array(geometry.index.array) : Uint32Array.from({ length: position.count }, (_, i) => i);
  const points = Float32Array.from({ length: position.count * 3 }, (_, i) => position.getComponent(Math.floor(i / 3), i % 3));
  const reduced = indices.length > target ? MeshoptSimplifier.simplify(indices, points, 3, target - target % 3, .035, ["Permissive"])[0] : indices;
  const [remap, count] = MeshoptSimplifier.compactMesh(reduced);
  const result = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "uv"]) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    const data = new Float32Array(count * attribute.itemSize);
    for (let i = 0; i < attribute.count; i++) if (remap[i] < count) for (let j = 0; j < attribute.itemSize; j++) data[remap[i] * attribute.itemSize + j] = attribute.getComponent(i, j);
    result.setAttribute(name, new THREE.BufferAttribute(data, attribute.itemSize));
  }
  result.setIndex(new THREE.BufferAttribute(reduced, 1));
  if (!result.hasAttribute("normal")) result.computeVertexNormals();
  return result;
}
// Global quadric simplification deletes disconnected leaf islands. Keep whole leaves,
// then simplify each retained leaf; increased leaf area maintains canopy coverage.
function leafyCanopy(source: THREE.BufferGeometry) {
  const position = source.getAttribute("position"), indices = source.index!.array;
  const parent = Uint32Array.from({ length: position.count }, (_, i) => i);
  const find = (value: number): number => { while (parent[value] !== value) { parent[value] = parent[parent[value]]; value = parent[value]; } return value; };
  for (let i = 0; i < indices.length; i += 3) { parent[find(indices[i + 1])] = find(indices[i]); parent[find(indices[i + 2])] = find(indices[i]); }
  const leaves = new Map<number, number[]>();
  for (let i = 0; i < indices.length; i += 3) {
    const root = find(indices[i]), list = leaves.get(root) ?? [];
    list.push(indices[i], indices[i + 1], indices[i + 2]); leaves.set(root, list);
  }
  const geometries: THREE.BufferGeometry[] = []; let number = 0;
  for (const indices of leaves.values()) {
    if (number++ % 48) continue;
    const unique = [...new Set(indices)], remap = new Map(unique.map((index, i) => [index, i]));
    const leaf = new THREE.BufferGeometry(), center = new THREE.Vector3();
    for (const index of unique) center.add(new THREE.Vector3().fromBufferAttribute(position, index));
    center.divideScalar(unique.length);
    for (const name of ["position", "normal", "uv"]) {
      const attribute = source.getAttribute(name); if (!attribute) continue;
      const data = new Float32Array(unique.length * attribute.itemSize);
      unique.forEach((index, i) => { for (let j = 0; j < attribute.itemSize; j++) data[i * attribute.itemSize + j] = name === "position" ? center.getComponent(j) + (attribute.getComponent(index, j) - center.getComponent(j)) * 5.5 : attribute.getComponent(index, j); });
      leaf.setAttribute(name, new THREE.BufferAttribute(data, attribute.itemSize));
    }
    const local = Uint32Array.from(indices, index => remap.get(index)!);
    const reduced = MeshoptSimplifier.simplify(local, leaf.getAttribute("position").array, 3, 18, .5)[0];
    leaf.setIndex(new THREE.BufferAttribute(reduced, 1)); geometries.push(leaf);
  }
  const merged = mergeGeometries(geometries)!; geometries.forEach(geometry => geometry.dispose());
  return merged;
}


async function tree() {
  await MeshoptSimplifier.ready;
  const result = new THREE.Group();
  for (const [id, height, kind] of [["island_tree_02", 10.8, "tree"], ["shrub_02", 1.5, "shrub"]] as const) {
    const gltf = await loader.loadAsync("/__sources/" + id + "/" + id + "_1k.gltf");
    if (kind === "shrub") for (const child of [...gltf.scene.children]) if (child.name !== "shrub_02_a") gltf.scene.remove(child);
    const group = normalize(gltf.scene, height);
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const source = object.geometry;
      object.geometry = kind === "tree" && /leaves/.test((object.material as THREE.Material).name) ? leafyCanopy(source) : simplify(source, kind === "tree" ? 1800 : 6000); source.dispose();
      object.userData = { renderRole: "vegetation", plantKind: kind };
      const surface = object.material as THREE.MeshStandardMaterial;
      surface.side = THREE.DoubleSide; surface.roughness = .88;
      surface.metalness = 0; surface.normalScale.set(.65, .65);
      surface.aoMap = null;
    });
    result.add(group);
  }
  return result;
}

async function vehicle() {
  const gltf = await loader.loadAsync("/__sources/vehicle/CarConcept.glb");
  const group = normalize(gltf.scene, 4.65, true);
  const result = new THREE.Group(), buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.updateMatrixWorld(true);
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
     if (/license|licen[cs]e.?plate|logo|emblem|badge/i.test(object.name)) { object.geometry.dispose(); return; }
    const surface = object.material as THREE.MeshPhysicalMaterial;
     if (/license|logo/i.test(surface.name)) { surface.map = null; surface.emissiveMap = null; surface.color.set("#d8d3bf"); surface.emissive.set(0); }
    if (/paint/i.test(surface.name)) { surface.color.set("#747a75"); surface.roughness = .24; surface.metalness = .65; surface.iridescence = 0; }
    if (surface.transmission > 0) { surface.transmission = 0; surface.color.set("#182b33"); surface.metalness = .45; surface.roughness = .12; }
    surface.aoMap = null;
    object.userData = { renderRole: "context" };
    const geometry = simplify(object.geometry, 9000).applyMatrix4(object.matrixWorld);
    const list = buckets.get(surface) ?? []; list.push(geometry); buckets.set(surface, list);
  });
  for (const [surface, geometries] of buckets) {
    const merged = mergeGeometries(geometries); if (!merged) throw new Error("Incompatible car material geometry");
    geometries.forEach(geometry => geometry.dispose());
    const optimized = simplify(merged, 1800); merged.dispose();
    const object = new THREE.Mesh(optimized, surface); object.name = surface.name; object.userData.renderRole = "context"; result.add(object);
  }
  return result;
}

async function person() {
  const gltf = await loader.loadAsync("/__sources/person/CesiumMan.glb");
  const group = normalize(gltf.scene, 1.76);
  group.animations = gltf.animations;
  const sourceTextures = new Set<THREE.Texture>();
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const surfaces = Array.isArray(object.material) ? object.material : [object.material];
    for (const surface of surfaces) if (surface instanceof THREE.MeshStandardMaterial && surface.map) {
      sourceTextures.add(surface.map);
      surface.map = null;
      surface.color.set("#59656a");
      surface.roughness = .86;
      surface.metalness = 0;
      surface.emissive.set(0);
      surface.emissiveMap = null;
      surface.needsUpdate = true;
    }
    object.userData.renderRole = "context";
  });
  for (const texture of sourceTextures) texture.dispose();
  return group;
}

function lamp() {
  const group = new THREE.Group();
  cylinder(group, black, 0, .1, 0, .28, .35, .2);
  cylinder(group, black, 0, 2.6, 0, .065, .13, 5.2);
  box(group, black, 0, 5.3, 0, .55, .09, .55);
  box(group, warm, 0, 5.05, 0, .33, .45, .33);
  box(group, black, 0, 4.8, 0, .45, .08, .45);
  return bake(group, "context");
}
function bench() {
  const group = new THREE.Group();
  for (let i = 0; i < 5; i++) box(group, bark, 0, .48, i * .11 - .22, 2, .07, .09);
  for (let i = 0; i < 4; i++) box(group, bark, 0, .72 + i * .1, -.27, 2, .08, .07);
  for (const x of [-.7, .7]) box(group, black, x, .24, 0, .1, .48, .5);
  return bake(group, "context");
}
function monument() {
  const group = new THREE.Group();
  box(group, limestone, 0, .65, 0, 7.5, 1.3, 6.4, .07);
  box(group, limestone, 0, 1.45, 0, 6.8, .3, 5.8);
  const stele = cylinder(group, limestone, 0, 13.6, -.9, 1, 1.9, 24, 4); stele.rotation.y = Math.PI / 4;
  // Figurative silhouettes are original abstractions, not a reconstruction of the memorial.
  for (const [x, z, y] of [[-1.6, 1.3, 2], [0, 1.7, 1.7], [1.8, 1.2, 1.9]]) {
    cylinder(group, bronze, x, y + 1.5, z, .35, .62, 2.8);
    mesh(group, new THREE.SphereGeometry(.4, 12, 8), bronze, x, y + 3.2, z);
    for (const side of [-1, 1]) bar(group, bronze, new THREE.Vector3(x + side * .22, y + .5, z), new THREE.Vector3(x + side * .55, 1.6, z + .3), .2);
    bar(group, bronze, new THREE.Vector3(x, y + 2.5, z), new THREE.Vector3(x - .6, y + 4.8, z), .14);
  }
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .32 : .8; if (!i) star.moveTo(Math.cos(a) * r, Math.sin(a) * r); else star.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
  star.closePath(); mesh(group, new THREE.ShapeGeometry(star), bronze, 0, 21.5, .62);
  return bake(group, "structure");
}

async function main() {
  // Building is intentionally never regenerated: the exporter verifies its original bytes.
  const assets = { tree: await tree(), vehicle: await vehicle(), person: await person(), lamp: lamp(), bench: bench(), monument: monument() };
  const exporter = new GLTFExporter();
  for (const [id, group] of Object.entries(assets)) {
    group.name = id;
    const binary = await exporter.parseAsync(group, { binary: true, maxTextureSize: 1024, animations: group.animations });
    if (!(binary instanceof ArrayBuffer)) throw new Error("Expected binary GLB");
    const response = await fetch("/__assets/" + id, { method: "POST", headers: { "Content-Type": "model/gltf-binary" }, body: binary });
    if (!response.ok) throw new Error(await response.text());
    disposeScene(group);
  }
  document.body.textContent = "GLB export complete — licensed foliage, car and walking character; building byte-identical.";
}
main().catch(error => { document.body.textContent = String(error); console.error(error); });

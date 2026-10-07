import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { qualitySettings, type Quality } from "./rendering";

const landmark = { x: -32, z: 65, radius: 17 };

function material(name: string, color: string, roughness = .85) {
  const result = new THREE.MeshStandardMaterial({ name, color, roughness });
  return result;
}

function mesh(group: THREE.Group, geometry: THREE.BufferGeometry, surface: THREE.Material, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(geometry, surface);
  result.position.set(x, y, z);
  result.receiveShadow = true;
  result.userData.renderRole = "site";
  group.add(result);
  return result;
}

function box(group: THREE.Group, surface: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  return mesh(group, new THREE.BoxGeometry(w, h, d), surface, x, y, z);
}

function disk(group: THREE.Group, surface: THREE.Material, radius: number, height: number, y: number) {
  return mesh(group, new THREE.CylinderGeometry(radius, radius, height, 96), surface, landmark.x, y, landmark.z);
}

function surfaceShape(points: [number, number][]) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => index ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
  shape.closePath();
  return shape;
}

/** Geometry is merged only within one named procedural group and compatible material. */
function bake(group: THREE.Group) {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  group.updateMatrixWorld(true);
  for (const object of [...group.children]) if (object instanceof THREE.Mesh && !Array.isArray(object.material)) {
    const geometry = (object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone()).applyMatrix4(object.matrix);
    if (object.material instanceof THREE.MeshStandardMaterial && object.material.normalMap) {
      const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), uv = geometry.getAttribute("uv");
      for (let i = 0; i < positions.count; i++) uv.setXY(i, (Math.abs(normals.getX(i)) > .5 ? positions.getZ(i) : positions.getX(i)) * .5, (Math.abs(normals.getY(i)) > .5 ? positions.getZ(i) : positions.getY(i)) * .5);
    }
    const list = buckets.get(object.material) ?? [];
    list.push(geometry);
    buckets.set(object.material, list);
    object.geometry.dispose();
    group.remove(object);
  }
  for (const [surface, geometries] of buckets) {
    const merged = mergeGeometries(geometries)!;
    geometries.forEach(geometry => geometry.dispose());
    const object = mesh(group, merged, surface);
    object.name = surface.name;
    object.geometry.computeBoundingSphere();
  }
}

function waterTexture(normal: boolean) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const index = (y * size + x) * 4;
    const a = x / size * Math.PI * 2, b = y / size * Math.PI * 2;
    data[index] = normal ? 128 + Math.round(12 * Math.cos(a * 3 + b * 2)) : 110;
    data[index + 1] = normal ? 128 + Math.round(8 * Math.cos(b * 4 - a)) : 105 + Math.round(15 * Math.sin(a * 3 + b * 2));
    data[index + 2] = normal ? 254 : 110;
    data[index + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(26, 10);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/** Opaque low-poly surroundings: five shared batches, no extra GLB or shadow passes. */
function addBackgroundNeighborhood(group: THREE.Group, quality: Quality) {
  const facade = document.createElement("canvas"), lights = document.createElement("canvas");
  facade.width = lights.width = 128; facade.height = lights.height = 128;
  const paint = facade.getContext("2d")!, glow = lights.getContext("2d")!;
  paint.fillStyle = "#a3a39a"; paint.fillRect(0, 0, 128, 128);
  glow.fillStyle = "#000000"; glow.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 12; row++) for (let col = 0; col < 8; col++) {
    const lit = (row * 7 + col * 11) % 9 < 3;
    paint.fillStyle = lit ? "#e0b16d" : "#48565a";
    paint.fillRect(col * 16 + 4, row * 10 + 4, 8, 6);
    if (lit) { glow.fillStyle = "#f1bf77"; glow.fillRect(col * 16 + 4, row * 10 + 4, 8, 6); }
  }
  const map = new THREE.CanvasTexture(facade), emission = new THREE.CanvasTexture(lights);
  map.colorSpace = emission.colorSpace = THREE.SRGBColorSpace;
  const masonry = new THREE.MeshStandardMaterial({ name: "Unbranded background apartments", map, emissiveMap: emission, emissive: "#ffcd8d", emissiveIntensity: .2, roughness: .88 });
  masonry.userData.siteWindow = true;
  const roof = material("Background charcoal roofs", "#5b6261"), paving = material("Neighborhood courtyards", "#6d7567");
  const bark = material("Background grove trunks", "#4c4b38"), leaf = material("Background grove canopies", "#35492a");
  type Lot = { x: number; z: number; w: number; d: number; h: number; rotation: number };
  const lots: Lot[] = [], trees: [number, number, number][] = [];
  const step = quality === "high" ? 44 : quality === "medium" ? 56 : 72;
  const grid = Math.floor(720 / step);
  const noise = (seed: number) => { const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453; return value - Math.floor(value); };
  // Preserve the project, lake and through-road; fill the surrounding city in every direction.
  for (let row = -grid; row <= grid; row++) for (let col = -grid; col <= grid; col++) {
    const x = col * step, z = row * step, seed = (row + grid) * (grid * 2 + 1) + col + grid;
    if ((Math.abs(x) < 170 && z > -145 && z < 140) || (Math.abs(x) < 270 && z > -132 && z < -24) || Math.abs(z - 65) < step * .55) continue;
    const jitterX = (noise(seed + 1) - .5) * 7, jitterZ = (noise(seed + 2) - .5) * 7;
    if (noise(seed + 3) < .18) {
      trees.push([x + jitterX, z + jitterZ, 1.2 + noise(seed + 4)]);
      trees.push([x + 11, z - 10, 1 + noise(seed + 5)]);
      continue;
    }
    const distance = Math.hypot(x, z);
    const h = 9 + noise(seed + 6) * (distance < 300 ? 22 : 53);
    lots.push({ x: x + jitterX, z: z + jitterZ, w: step * (.4 + noise(seed + 7) * .25), d: step * (.38 + noise(seed + 8) * .22), h, rotation: noise(seed + 9) < .5 ? 0 : Math.PI / 2 });
    trees.push([x - step * .36, z - step * .33, .8 + noise(seed + 10) * .6]);
    trees.push([x + step * .36, z + step * .3, .8 + noise(seed + 11) * .6]);
  }
  // A cheap middle-distance grove bridges the detailed site trees and distant urban blocks.
  const groveCount = qualitySettings[quality].contextCount * 14;
  for (let i = 0; i < groveCount; i++) {
    const angle = i * 2.399963, radius = 165 + noise(i + 3100) * 120;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    if (Math.abs(z - 65) < 19 || (Math.abs(x) < 255 && z > -118 && z < -27) || (Math.abs(x) < 155 && z > -26 && z < 96)) continue;
    trees.push([x, z, .8 + noise(i + 3500) * .7]);
  }
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const body = new THREE.InstancedMesh(cube, masonry, lots.length);
  const caps = new THREE.InstancedMesh(cube, roof, lots.length);
  const yards = new THREE.InstancedMesh(cube, paving, lots.length);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.2, .32, 1, 6), bark, trees.length);
  const crowns = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), leaf, trees.length * 3);
  const transform = new THREE.Object3D(), color = new THREE.Color();
  const put = (batch: THREE.InstancedMesh, index: number, x: number, y: number, z: number, w: number, h: number, d: number, rotation = 0) => {
    transform.position.set(x, y, z); transform.rotation.set(0, rotation, 0); transform.scale.set(w, h, d); transform.updateMatrix(); batch.setMatrixAt(index, transform.matrix);
  };
  lots.forEach((lot, i) => {
    put(body, i, lot.x, lot.h / 2 - .3, lot.z, lot.w, lot.h, lot.d, lot.rotation);
    put(caps, i, lot.x, lot.h + .15, lot.z, lot.w * 1.04, .9, lot.d * 1.04, lot.rotation);
    put(yards, i, lot.x, -.25, lot.z, step * .9, .12, step * .9);
    body.setColorAt(i, color.setHSL(.09 + noise(i + 4100) * .04, .08 + noise(i + 4200) * .08, .7 + noise(i + 4300) * .2));
  });
  trees.forEach(([x, z, scale], i) => {
    put(trunks, i, x, 3 * scale, z, scale, 6 * scale, scale);
    for (let lobe = 0; lobe < 3; lobe++) {
      const angle = lobe * Math.PI * 2 / 3 + i * .8;
      put(crowns, i * 3 + lobe, x + Math.cos(angle) * 1.9 * scale, (6.4 + lobe * .7) * scale, z + Math.sin(angle) * 1.9 * scale, 3.4 * scale, (3.1 + lobe * .25) * scale, 3.1 * scale);
      crowns.setColorAt(i * 3 + lobe, color.setHSL(.18 + noise(i + 4500) * .08, .15 + noise(i + 4600) * .15, .55 + noise(i + 4700) * .2));
    }
  });
  for (const [batch, name] of [[body, "Background apartments"], [caps, "Background roofs"], [yards, "Background courtyards"], [trunks, "Background tree trunks"], [crowns, "Background tree crowns"]] as const) {
    batch.name = name; batch.userData = { renderRole: "context", confidence: "illustrative" };
    batch.castShadow = false; batch.receiveShadow = false; batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox(); batch.computeBoundingSphere(); group.add(batch);
  }
}

/** Site dimensions and neighboring buildings are illustrative, not cadastral geometry. */
export function createSite(quality: Quality): THREE.Group {
  const site = new THREE.Group();
  site.name = "site";
  site.userData = { confidence: "illustrative", source: "Project landscape study; front/roundabout and rear/lake orientation verified", units: "estimated-model-units" };
  const groups = Object.fromEntries(["ground", "forecourt", "road", "roundabout", "lake", "banks", "context"].map(name => {
    const group = new THREE.Group();
    group.name = name;
    group.userData.confidence = "illustrative";
    site.add(group);
    return [name, group];
  })) as Record<string, THREE.Group>;
  const stone = material("Warm limestone paving", "#b9ad94");
  const curb = material("Honed limestone curbs", "#c7bba4", .72);
  const asphalt = new THREE.MeshPhysicalMaterial({ name: "Rain-dark reflective asphalt", color: "#171d21", roughness: .27, metalness: .22, clearcoat: .65, clearcoatRoughness: .3 });
  const grass = material("Deep mixed meadow ground", "#424d2d");
  const planting = material("Olive planted terraces", "#283b23");
  const joints = material("Paving joints", "#918b7e");
  const markings = material("Road lane paint", "#d2cdbd", .95);
  const sand = material("Natural lake banks", "#969b7e");
  const water = new THREE.MeshPhysicalMaterial({ name: "Slate blue lake", color: "#526c77", roughness: .28, metalness: .12, clearcoat: .8, clearcoatRoughness: .2, normalMap: waterTexture(true), roughnessMap: waterTexture(false) });
  water.normalScale.set(.18, .18);
  const mineral = new Uint8Array(64 * 64 * 4), mineralNormal = new Uint8Array(64 * 64 * 4);
  let seed = 73;
  for (let i = 0; i < mineral.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    mineral[i] = mineral[i + 1] = mineral[i + 2] = 225 + (seed >>> 28); mineral[i + 3] = 255;
    mineralNormal[i] = 124 + (seed >>> 29); mineralNormal[i + 1] = 124 + ((seed >>> 16) & 7); mineralNormal[i + 2] = 255; mineralNormal[i + 3] = 255;
  }
  const grain = new THREE.DataTexture(mineralNormal, 64, 64), roughness = new THREE.DataTexture(mineral, 64, 64);
  for (const map of [grain, roughness]) { map.wrapS = map.wrapT = THREE.RepeatWrapping; map.magFilter = THREE.LinearFilter; map.minFilter = THREE.LinearMipmapLinearFilter; map.generateMipmaps = true; map.needsUpdate = true; }
  for (const surface of [stone, curb, asphalt, sand]) { surface.normalMap = grain; surface.normalScale.set(.16, .16); surface.roughnessMap = roughness; }

  // Ground continues beneath the fog horizon; no exposed model-board edge.
  const ground = mesh(groups.ground, new THREE.PlaneGeometry(4000, 4000), grass, 0, -.36, 0);
  ground.rotation.x = -Math.PI / 2;
  box(groups.forecourt, stone, 0, -.02, 24, 124, .2, 20);
  box(groups.forecourt, curb, 0, .08, 34, 124, .26, .45);
  box(groups.forecourt, curb, -62, .08, 24, .45, .26, 20);
  box(groups.forecourt, curb, 62, .08, 24, .45, .26, 20);
  // A wide, unplanted arrival route preserves the real entrances and signage.
  box(groups.forecourt, stone, 0, -.03, 44, 20, .18, 20);
  for (let x = -60; x <= 60; x += 4) box(groups.forecourt, joints, x, .086, 24, .025, .01, 19.5);
  for (let z = 16; z < 34; z += 4) box(groups.forecourt, joints, 0, .086, z, 123, .01, .025);
  for (const side of [-1, 1]) {
    box(groups.forecourt, stone, side * 73, -.04, 24, 16, .16, 31);
    box(groups.forecourt, curb, side * 52, .16, 42, 17, .35, 7);
    box(groups.forecourt, planting, side * 52, .35, 42, 16.2, .25, 6.2);
  }

  // The road is a bounded asphalt corridor widening around the island, not a grey ground plane.
  const roadPoints: [number, number][] = [[-2000, 55], [-57, 55]];
  for (let i = 0; i <= 48; i++) {
    const angle = Math.PI + i / 48 * Math.PI;
    const x = landmark.x + Math.cos(angle) * 25;
    roadPoints.push([x, Math.min(55, landmark.z + Math.sin(angle) * 25)]);
  }
  roadPoints.push([-7, 55], [2000, 55], [2000, 75], [-7, 75]);
  for (let i = 0; i <= 48; i++) {
    const angle = i / 48 * Math.PI;
    roadPoints.push([landmark.x + Math.cos(angle) * 25, Math.max(75, landmark.z + Math.sin(angle) * 25)]);
  }
  roadPoints.push([-2000, 75]);
  const shape = surfaceShape(roadPoints);
  const islandHole = new THREE.Path();
  islandHole.absarc(landmark.x, -landmark.z, landmark.radius, 0, Math.PI * 2, true);
  shape.holes.push(islandHole);
  const road = mesh(groups.road, new THREE.ShapeGeometry(shape, 64), asphalt, 0, -.05, 0);
  road.rotation.x = -Math.PI / 2;
  for (const z of [54.7, 75.3]) {
    box(groups.road, curb, -1030, .02, z, 1940, .25, .5);
    box(groups.road, curb, 1000, .02, z, 2014, .25, .5);
  }
  for (const start of [Math.asin(.4), Math.PI + Math.asin(.4)]) {
    const arc = mesh(groups.road, new THREE.RingGeometry(25, 25.55, 48, 1, start, Math.PI - 2 * Math.asin(.4)), curb, landmark.x, .07, landmark.z);
    arc.rotation.x = -Math.PI / 2;
  }
  // Only paint on actual road: straight dashes stop before the roundabout.
  for (let x = -240; x <= 240; x += 12) if (x < -62 || x > 0) box(groups.road, markings, x, -.035, 65, 5, .01, .16);
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    const dash = box(groups.road, markings, landmark.x + Math.cos(angle) * 21, -.035, landmark.z + Math.sin(angle) * 21, 1.8, .01, .16);
    dash.rotation.y = -angle - Math.PI / 2;
  }
  for (let z = 56; z < 75; z += 2.2) box(groups.road, markings, 17, -.03, z, 5.8, .015, 1.1);

  disk(groups.roundabout, curb, 17, .3, .1);
  disk(groups.roundabout, planting, 16.5, .25, .32);
  disk(groups.roundabout, curb, 12.8, .32, .44);
  disk(groups.roundabout, planting, 12.25, .2, .65);
  disk(groups.roundabout, stone, 8.2, .32, .72);
  disk(groups.roundabout, stone, 5.1, .25, .94);
  // The monument asset itself remains at its original ground-level transform.
  site.userData.monumentBase = 0;

  const lakePoints: [number, number][] = [[-230, -43], [-150, -32], [-95, -29], [-50, -28], [10, -29], [72, -34], [126, -30], [200, -39], [242, -61], [225, -88], [146, -99], [60, -94], [-10, -102], [-98, -97], [-182, -108], [-238, -85]];
  const bank = mesh(groups.banks, new THREE.ShapeGeometry(surfaceShape(lakePoints.map(([x, z]) => [x * 1.025, (z + 65) * 1.1 - 65])), 32), sand, 0, -.22, 0);
  bank.rotation.x = -Math.PI / 2;
  const lake = mesh(groups.lake, new THREE.ShapeGeometry(surfaceShape(lakePoints), 32), water, 0, -.16, 0);
  lake.name = "Static lake water";
  lake.userData.renderRole = "water";
  lake.rotation.x = -Math.PI / 2;
  lake.receiveShadow = false;
  box(groups.banks, stone, 0, -.03, -22, 144, .15, 8);
  box(groups.banks, curb, 0, .04, -26, 144, .25, .55);
  for (const x of [-68, 68]) {
    box(groups.banks, curb, x, .12, -20, 5, .3, 5);
    box(groups.banks, planting, x, .32, -20, 4.5, .25, 4.5);
  }
  // Broad banks with irregular planted mounds, not an empty uniform base plane.
  const mound = new THREE.SphereGeometry(1, 16, 10);
  for (let i = 0; i < 52; i++) {
    const x = -290 + (i % 26) * 23 + Math.sin(i * 3.1) * 9;
    const z = i < 26 ? -136 - i % 4 * 9 : 130 + i % 5 * 12;
    const hill = mesh(groups.ground, mound.clone(), i % 3 ? grass : planting, x, -.6, z);
    hill.scale.set(16 + i % 4 * 4, 1.6 + i % 3 * 1.1, 12 + i % 5 * 3);
  }
  mound.dispose();
  bake(groups.ground);

  addBackgroundNeighborhood(groups.context, quality);
  for (const name of ["forecourt", "road", "roundabout", "banks"]) bake(groups[name]);
  return site;
}

type Placement = [x: number, z: number, rotation?: number, scale?: number];
type MovingBatch = { mesh: THREE.InstancedMesh; local: THREE.Matrix4; count: number };
type Walker = { root: THREE.Object3D; mixer: THREE.AnimationMixer; phase: number };
type SiteMotion = { cars: MovingBatch[]; walkers: Walker[]; transform: THREE.Object3D; matrix: THREE.Matrix4 };
const motions = new WeakMap<THREE.Group, SiteMotion>();

/** Absolute scene time comes from the pausable runtime. All frame matrices are reused. */
export function updateSiteMotion(site: THREE.Group, elapsedSeconds: number): boolean {
  const motion = motions.get(site);
  if (!motion) return false;
  const { transform, matrix } = motion;
  for (const batch of motion.cars) {
    for (let i = 0; i < batch.count; i++) {
      const lane = i % 2 ? 1 : -1;
      const x = ((i * 137 + elapsedSeconds * 7 * -lane + 2100) % 1400 + 1400) % 1400 - 700;
      const offset = x - landmark.x;
      const curve = Math.abs(offset) < 35 ? (1 + Math.cos(offset / 35 * Math.PI)) * .5 : 0;
      const slope = Math.abs(offset) < 35 ? -lane * 8 * Math.PI / 35 * Math.sin(offset / 35 * Math.PI) : 0;
      transform.position.set(x, -.05, landmark.z + lane * (5 + 16 * curve));
      transform.rotation.set(0, Math.atan2(-lane, -lane * slope), 0);
      transform.scale.setScalar(1); transform.updateMatrix();
      matrix.multiplyMatrices(transform.matrix, batch.local); batch.mesh.setMatrixAt(i, matrix);
    }
    batch.mesh.instanceMatrix.needsUpdate = true;
  }
  for (const walker of motion.walkers) {
    const angle = walker.phase + elapsedSeconds * .022;
    walker.root.position.set(Math.cos(angle) * 51, .1, 25.6 + Math.sin(angle) * 3.1);
    walker.root.rotation.y = Math.atan2(-51 * Math.sin(angle), 3.1 * Math.cos(angle));
    walker.mixer.setTime(elapsedSeconds * .72 + walker.phase);
  }
  return motion.cars.length > 0 || motion.walkers.length > 0;
}

/** Source geometry/materials are shared; shrub and tree prototypes are independent. */
export function addSiteAsset(site: THREE.Group, root: THREE.Group, id: string, quality: Quality): void {
  if (id === "monument") {
    root.name = "Original authored roundabout monument"; root.position.set(landmark.x, 0, landmark.z);
    root.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; object.userData.renderRole = "context"; } });
    site.getObjectByName("roundabout")!.add(root); return;
  }
  const motion = motions.get(site) ?? { cars: [], walkers: [], transform: new THREE.Object3D(), matrix: new THREE.Matrix4() };
  motions.set(site, motion);
  const density = qualitySettings[quality].density;
  if (id === "person") {
    const clip = root.animations[0];
    if (!clip) throw new Error("Approved pedestrian asset requires a walking clip");
    const count = Math.max(4, Math.round(18 * density));
    for (let i = 0; i < count; i++) {
      const person = cloneSkeleton(root); person.name = "Walking pedestrian " + (i + 1);
      person.scale.setScalar(.94 + (i % 4) * .035);
      person.traverse(object => { if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; object.frustumCulled = false; object.userData.renderRole = "context"; } });
      const mixer = new THREE.AnimationMixer(person); mixer.clipAction(clip).play();
      motion.walkers.push({ root: person, mixer, phase: i / count * Math.PI * 2 });
      site.getObjectByName("forecourt")!.add(person);
    }
    site.userData.walkerCount = count; updateSiteMotion(site, 0); return;
  }
  const placements: Placement[] = [], shrubs: Placement[] = [];
  let groupName = "forecourt";
  if (id === "tree") {
    groupName = "banks";
    // Layered groves leave the actual facade, lake and carriageway clear.
    for (const side of [-1, 1]) for (let i = 0; i < 72; i++) {
      const x = side * (76 + (i % 8) * 9 + Math.sin(i * 2.13) * 3);
      const z = -20 + Math.floor(i / 8) * 8 + Math.cos(i * 1.71) * 2;
      if (z < 48) placements.push([x, z, i * 2.399, .65 + (i % 7) * .085]);
    }
    for (let i = 0; i < 150; i++) placements.push([-285 + (i % 50) * 11.6 + Math.sin(i * 2.1) * 4, -120 - Math.floor(i / 50) * 14 - (i % 5) * 2, i * 2.4, .9 + (i % 6) * .09]);
    for (let i = 0; i < 140; i++) placements.push([-330 + (i % 55) * 12 + Math.sin(i * 3.7) * 3, 104 + Math.floor(i / 55) * 16 + (i % 4) * 3, i * 1.9, .7 + (i % 7) * .1]);
    for (const side of [-1, 1]) for (let i = 0; i < 12; i++) placements.push([side * (88 + i * 18), 88 + Math.sin(i) * 2, i * 1.4, .7 + i % 3 * .1]);
    for (const x of [-58, -47, 47, 58]) placements.push([x, 42, x * .13, .65]);
    for (let i = 0; i < 100; i++) { const angle = i * 2.39996, radius = 10.5 + (i % 5) * 1.02; shrubs.push([landmark.x + Math.cos(angle) * radius, landmark.z + Math.sin(angle) * radius, angle, 1.1 + i % 4 * .16]); }
    for (const side of [-1, 1]) for (let i = 0; i < 28; i++) shrubs.push([side * (45 + (i % 8) * 2.05), 40 + Math.floor(i / 8) * 1.2, i * 2.4, .7 + i % 3 * .17]);
    for (let i = 0; i < 170; i++) shrubs.push([-275 + (i % 80) * 7 + Math.sin(i * 2.4) * 3, 99 + Math.floor(i / 80) * 12 + Math.sin(i * 1.3) * 4, i * 2.1, .9 + i % 5 * .19]);
    for (const side of [-1, 1]) for (let i = 0; i < 85; i++) shrubs.push([side * (80 + (i % 10) * 8), -23 + Math.floor(i / 10) * 8, i * 2.1, .9 + i % 4 * .2]);
  } else if (id === "vehicle") {
    groupName = "road"; for (let i = 0; i < 18; i++) placements.push([i * 70, 60]);
  } else if (id === "lamp") {
    for (const x of [-59, -36, 36, 59]) placements.push([x, 33]);
    for (const x of [-65, -35, 0, 35, 65]) placements.push([x, -25]);
    for (const x of [-170, -125, -80, 28, 73, 118, 163]) placements.push([x, 53], [x, 77]);
  } else if (id === "bench") {
    placements.push([-48, 32, Math.PI], [48, 32, Math.PI], [-72, 26, Math.PI / 2], [72, 26, -Math.PI / 2], [-48, -23], [-20, -23], [20, -23], [48, -23]);
  } else throw new Error("Unsupported site asset: " + id);
  const select = (values: Placement[]) => values.filter((_, index) => Math.floor((index + 1) * density) > Math.floor(index * density));
  const selected = select(placements), selectedShrubs = select(shrubs);
  const instanceGroup = new THREE.Group(); instanceGroup.name = id + " instances";
  instanceGroup.userData = { confidence: "illustrative", assetId: id };
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert();
  const transform = new THREE.Object3D(), matrix = new THREE.Matrix4(), color = new THREE.Color();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const values = object.userData.plantKind === "shrub" ? selectedShrubs : selected;
    if (!values.length) return;
    const instances = new THREE.InstancedMesh(object.geometry, object.material, values.length);
    instances.name = id + ": " + object.name; instances.castShadow = true; instances.receiveShadow = true;
    instances.userData.renderRole = id === "tree" ? "vegetation" : "context";
    const surfaces = Array.isArray(object.material) ? object.material : [object.material];
    if (id === "lamp") for (const surface of surfaces) if (surface instanceof THREE.MeshStandardMaterial && surface.name === "Lantern") { surface.userData.siteLamp = true; surface.emissiveIntensity = .18; }
    const local = new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld);
    for (let i = 0; i < values.length; i++) {
      const [x, z, rotation = 0, scale = 1] = values[i];
      const raisedShrub = object.userData.plantKind === "shrub";
      const baseY = raisedShrub && Math.hypot(x - landmark.x, z - landmark.z) < 17 ? .76 : raisedShrub && z >= 39 && z <= 45 && Math.abs(x) > 43 && Math.abs(x) < 63 ? .49 : .1;
      transform.position.set(x, groupName === "road" ? -.05 : baseY, z);
      transform.rotation.set(0, rotation, 0); transform.scale.setScalar(scale); transform.updateMatrix();
      matrix.multiplyMatrices(transform.matrix, local); instances.setMatrixAt(i, matrix);
      if (id === "tree") instances.setColorAt(i, color.setHSL(.09 + i % 5 * .012, .08 + i % 4 * .035, .72 + i % 6 * .04));
    }
    instances.instanceMatrix.needsUpdate = true;
    if (id === "vehicle") { instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage); instances.frustumCulled = false; motion.cars.push({ mesh: instances, local, count: values.length }); }
    else { instances.computeBoundingBox(); instances.computeBoundingSphere(); }
    instanceGroup.add(instances);
  });
  if (id === "lamp") {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d")!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,205,126,.65)"); gradient.addColorStop(.3, "rgba(255,178,78,.28)"); gradient.addColorStop(1, "rgba(255,164,62,0)");
    context.fillStyle = gradient; context.fillRect(0, 0, 64, 64);
    const pool = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, opacity: 0, blending: THREE.AdditiveBlending });
    pool.userData.siteLightPool = true;
    const geometry = new THREE.PlaneGeometry(11, 11);
    for (const [x, z] of selected) { const light = new THREE.Mesh(geometry, pool); light.rotation.x = -Math.PI / 2; light.position.set(x, .13, z); light.userData.renderRole = "light"; instanceGroup.add(light); }
  }
  site.getObjectByName(groupName)!.add(instanceGroup);
  if (id === "vehicle") { site.userData.vehicleCount = selected.length; updateSiteMotion(site, 0); }
}

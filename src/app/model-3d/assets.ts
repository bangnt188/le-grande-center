import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import manifest from "../../../public/model-3d/asset-manifest.json";

export async function loadSceneAsset(id: string, base: string, signal: AbortSignal) {
  const asset = manifest.assets.find(item => item.id === id);
  if (!asset) throw new Error(`Asset không được duyệt: ${id}`);
  const response = await fetch(`${base}/model-3d/${asset.file}`, { signal, credentials: "omit", cache: "force-cache" });
  if (!response.ok || !response.body) throw new Error(`Không tải được ${id}`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > asset.bytes) { await reader.cancel(); throw new Error(`Asset vượt giới hạn: ${id}`); }
    chunks.push(value);
  }
  if (bytes !== asset.bytes) throw new Error(`Asset không đầy đủ: ${id}`);
  const binary = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { binary.set(chunk, offset); offset += chunk.length; }
  const digest = await crypto.subtle.digest("SHA-256", binary);
  const sha256 = Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
  if (sha256 !== asset.sha256) throw new Error(`Checksum không khớp: ${id}`);
  signal.throwIfAborted();
  const start = performance.now();
  const gltf = await new GLTFLoader().parseAsync(binary.buffer, "");
  if (signal.aborted) { disposeScene(gltf.scene); signal.throwIfAborted(); }
  gltf.scene.userData.loadStats = { id, bytes, decodeMs: performance.now() - start };
  gltf.scene.animations = gltf.animations;
  gltf.scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = !["glazing", "water", "decal"].includes(object.userData.renderRole);
    object.receiveShadow = true;
  });
  return gltf.scene;
}

export function disposeScene(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object instanceof THREE.InstancedMesh) object.dispose();
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
    geometries.add(object.geometry);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) materials.add(mat);
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const mat of materials) {
    for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
    mat.dispose();
  }
  for (const map of textures) { map.dispose(); if (typeof ImageBitmap !== "undefined" && map.image instanceof ImageBitmap) map.image.close(); }
}

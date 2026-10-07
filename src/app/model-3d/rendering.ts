import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { Sky } from "three/addons/objects/Sky.js";

/** Glass contributes neither opaque occlusion nor receives its fullscreen darkening. */
class ArchitecturalOcclusionPass extends Pass {
  private readonly ao: GTAOPass;
  private readonly composite: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly excluded: THREE.Object3D[] = [];

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.PerspectiveCamera) {
    super();
    scene.traverse(object => {
      if (object instanceof THREE.Mesh && object.userData.renderRole !== "structure") this.excluded.push(object);
      if (object instanceof THREE.LineSegments) this.excluded.push(object);
    });
    this.ao = new GTAOPass(scene, camera, 1, 1);
    // Off still computes AO and denoising; our depth-aware composite owns the output.
    this.ao.output = GTAOPass.OUTPUT.Off;
    this.ao.updateGtaoMaterial({ radius: 1.15, thickness: .7, distanceExponent: 1.5, distanceFallOff: .8, samples: 12 });
    this.ao.updatePdMaterial({ radius: 4, samples: 8, rings: 2 });
    this.ao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(-59, -1, -19), new THREE.Vector3(59, 30, 31)));
    this.composite = new THREE.ShaderMaterial({
      depthTest: false, depthWrite: false,
      uniforms: {
        beauty: { value: null }, beautyDepth: { value: null }, opaqueDepth: { value: this.ao.depthTexture },
        occlusion: { value: this.ao.gtaoMap }, near: { value: camera.near }, far: { value: camera.far }, strength: { value: .48 },
      },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `#include <packing>
        varying vec2 vUv;
        uniform sampler2D beauty, beautyDepth, opaqueDepth, occlusion;
        uniform float near, far, strength;
        void main() {
          vec4 color = texture2D(beauty, vUv);
          float visibleDepth = texture2D(beautyDepth, vUv).x;
          float structureDepth = texture2D(opaqueDepth, vUv).x;
          float visibleZ = perspectiveDepthToViewZ(visibleDepth, near, far);
          float structureZ = perspectiveDepthToViewZ(structureDepth, near, far);
          // Transmissive surfaces lie in front of the opaque geometry, so keep their reflections intact.
          float receiver = (visibleDepth < 0.99999 && abs(visibleZ - structureZ) < 0.075) ? 1.0 : 0.0;
          float ao = clamp(texture2D(occlusion, vUv).r, 0.0, 1.0);
          gl_FragColor = vec4(color.rgb * mix(1.0, ao, receiver * strength), color.a);
        }`,
    });
    this.quad = new FullScreenQuad(this.composite);
  }

  override setSize(width: number, height: number) { this.ao.setSize(width, height); }

  override render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const visibility = this.excluded.map(object => object.visible);
    try {
      for (const object of this.excluded) object.visible = false;
      this.ao.render(renderer, write, read, 0, false);
    } finally {
      this.excluded.forEach((object, index) => { object.visible = visibility[index]; });
    }
    this.composite.uniforms.beauty.value = read.texture;
    this.composite.uniforms.beautyDepth.value = read.depthTexture;
    this.composite.uniforms.near.value = this.camera.near;
    this.composite.uniforms.far.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : write);
    this.quad.render(renderer);
  }

  override dispose() {
    this.ao.dispose();
    // These two materials are not disposed by GTAOPass 0.186.1.
    this.ao.gtaoMaterial.dispose();
    this.ao.blendMaterial.dispose();
    this.composite.dispose();
    this.quad.dispose();
  }
}

export function createArchitecturalRenderer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    samples: Math.min(4, renderer.capabilities.maxSamples),
  });
  const composer = new EffectComposer(renderer, target);
  const beauty = new RenderPass(scene, camera);
  const occlusion = new ArchitecturalOcclusionPass(scene, camera);
  const output = new OutputPass();
  const edges = new FXAAPass();
  composer.addPass(beauty);
  composer.addPass(occlusion);
  composer.addPass(output);
  composer.addPass(edges);
  let pixelRatio = 0;
  let disposed = false;
  return {
    resize(width: number, height: number) {
      const memory = "deviceMemory" in navigator && typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : 8;
      const ratio = memory < 4 ? Math.min(window.devicePixelRatio || 1, 1.25) : Math.min(Math.max(window.devicePixelRatio || 1, 1.35), width < 700 ? 1.6 : 1.8);
      const samples = memory < 4 ? 0 : Math.min(4, renderer.capabilities.maxSamples);
      for (const buffer of [composer.renderTarget1, composer.renderTarget2]) {
        if (buffer.samples !== samples) { buffer.dispose(); buffer.samples = samples; }
      }
      if (ratio !== pixelRatio) {
        pixelRatio = ratio;
        renderer.setPixelRatio(ratio);
        composer.setPixelRatio(ratio);
      }
      occlusion.enabled = memory >= 4;
      renderer.setSize(width, height);
      composer.setSize(width, height);
    },
    render() { if (!disposed) composer.render(0); },
    dispose() {
      disposed = true;
      for (const pass of [beauty, occlusion, output, edges]) pass.dispose();
      composer.dispose();
    },
  };
}

/** A bounded static light rig. Photograph-based sky is bundled, with a procedural first frame. */
export function createDaylight(renderer: THREE.WebGLRenderer, scene: THREE.Scene, building: THREE.Object3D, assetBase: string, invalidate: () => void) {
  const sky = new Sky();
  sky.scale.setScalar(1000);
  sky.material.uniforms.turbidity.value = 2.8;
  sky.material.uniforms.rayleigh.value = 1;
  sky.material.uniforms.mieCoefficient.value = .004;
  sky.material.uniforms.mieDirectionalG.value = .8;
  const direction = new THREE.Vector3(-.62, .68, .48).normalize();
  sky.material.uniforms.sunPosition.value.copy(direction);
  const skyScene = new THREE.Scene();
  skyScene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environment = pmrem.fromScene(skyScene, .025, .1, 2000);
  scene.environment = environment.texture;
  scene.background = environment.texture;
  scene.backgroundIntensity = .8;
  scene.environmentIntensity = .85;
  scene.fog = new THREE.Fog("#e3e9e9", 250, 700);

  const fill = new THREE.HemisphereLight("#cbddeb", "#b2a38c", .35);
  const sun = new THREE.DirectionalLight("#fff1dd", 2.65);
  const bounds = new THREE.Box3().setFromObject(building);
  const center = bounds.getCenter(new THREE.Vector3());
  sun.target.position.copy(center);
  sun.position.copy(center).addScaledVector(direction, 190);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.normalBias = .012;
  sun.shadow.bias = -.000025;
  sun.shadow.radius = 2;
  scene.add(fill, sun, sun.target);
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  const shadowCamera = sun.shadow.camera;
  shadowCamera.position.copy(sun.position);
  shadowCamera.lookAt(center);
  shadowCamera.updateMatrixWorld(true);
  const shadowBounds = bounds.clone();
  shadowBounds.expandByPoint(new THREE.Vector3(-63, 0, 30));
  shadowBounds.expandByPoint(new THREE.Vector3(63, 0, 30));
  const projected = new THREE.Vector3();
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const x of [shadowBounds.min.x, shadowBounds.max.x]) for (const y of [0, shadowBounds.max.y]) for (const z of [shadowBounds.min.z, shadowBounds.max.z]) {
    projected.set(x, y, z).applyMatrix4(shadowCamera.matrixWorldInverse);
    left = Math.min(left, projected.x); right = Math.max(right, projected.x);
    bottom = Math.min(bottom, projected.y); top = Math.max(top, projected.y);
  }
  shadowCamera.left = left - 8; shadowCamera.right = right + 8;
  shadowCamera.bottom = bottom - 8; shadowCamera.top = top + 8;
  shadowCamera.near = 20; shadowCamera.far = 300;
  shadowCamera.updateProjectionMatrix();
  // The model and sun are static; do not redraw a 4K shadow map on every orbit frame.
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  pmrem.compileEquirectangularShader();
  let disposed = false;
  // Retain the bounded 1K source on the CPU: render-target contents are lost with a WebGL context.
  let source: THREE.DataTexture | null = null;
  const rebuildEnvironment = () => {
    if (disposed) return;
    const next = source ? pmrem.fromEquirectangular(source) : pmrem.fromScene(skyScene, .025, .1, 2000);
    const previous = environment;
    environment = next;
    scene.environment = next.texture;
    scene.background = source ?? next.texture;
    scene.environmentRotation.y = source ? .8 : 0;
    scene.backgroundRotation.y = scene.environmentRotation.y;
    previous.dispose();
    sun.shadow.needsUpdate = true;
  };
  const loader = new HDRLoader();
  loader.load(`${assetBase}/model-3d/daylight-995d68b1.hdr`, texture => {
    if (disposed) { texture.dispose(); return; }
    source = texture;
    source.mapping = THREE.EquirectangularReflectionMapping;
    rebuildEnvironment();
    invalidate();
  }, undefined, () => { /* The procedural daylight rig remains fully usable offline. */ });
  return {
    resize(width: number) {
      const memory = "deviceMemory" in navigator && typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : 8;
      const size = width < 700 || memory < 4 ? 2048 : 4096;
      if (sun.shadow.mapSize.x === size) return;
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.needsUpdate = true;
    },
    restore: rebuildEnvironment,
    dispose() {
      disposed = true;
      scene.environment = null;
      scene.background = null;
      scene.remove(fill, sun, sun.target);
      environment.dispose();
      source?.dispose();
      pmrem.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      sun.shadow.dispose();
    },
  };
}

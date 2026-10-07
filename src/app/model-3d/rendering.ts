import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { Sky } from "three/addons/objects/Sky.js";

export type Quality = "high" | "medium" | "low";
export const qualitySettings = {
  high: { dpr: 1.8, msaa: 4, shadowSize: 4096, ao: true, density: 1, contextCount: 26, contextDistance: 360 },
  medium: { dpr: 1.4, msaa: 2, shadowSize: 2048, ao: true, density: .65, contextCount: 18, contextDistance: 290 },
  low: { dpr: 1, msaa: 0, shadowSize: 1024, ao: false, density: .35, contextCount: 10, contextDistance: 230 },
} satisfies Record<Quality, { dpr: number; msaa: number; shadowSize: number; ao: boolean; density: number; contextCount: number; contextDistance: number }>;

/** Fixed before scene construction; the viewer can explicitly override this tier. */
export function chooseQuality(): Quality {
  if (typeof navigator === "undefined" || typeof window === "undefined") return "medium";
  const memory = "deviceMemory" in navigator && typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : 4;
  const cores = navigator.hardwareConcurrency || 4;
  const pixels = window.innerWidth * window.innerHeight * Math.min(window.devicePixelRatio || 1, 2) ** 2;
  if (memory <= 2 || cores <= 2 || (memory <= 4 && pixels > 3000000)) return "low";
  return memory >= 8 && cores >= 8 && window.innerWidth >= 900 && pixels <= 8000000 ? "high" : "medium";
}

/** Glass contributes neither opaque occlusion nor receives its fullscreen darkening. */
class ArchitecturalOcclusionPass extends Pass {
  private readonly ao: GTAOPass;
  private readonly composite: THREE.ShaderMaterial;
  private readonly quad: FullScreenQuad;
  private readonly excluded: THREE.Object3D[] = [];
  private readonly visibility: boolean[] = [];
  private readonly collectExcluded = (object: THREE.Object3D) => {
    if ((object instanceof THREE.Mesh && object.userData.renderRole !== "structure") || object instanceof THREE.LineSegments) {
      const index = this.excluded.length;
      this.excluded.push(object);
      this.visibility[index] = object.visible;
    }
  };

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.PerspectiveCamera) {
    super();
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
        occlusion: { value: this.ao.gtaoMap }, near: { value: camera.near }, far: { value: camera.far }, strength: { value: .32 },
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
          float receiver = (visibleDepth < 0.99999 && abs(visibleZ - structureZ) < 0.075) ? 1.0 : 0.0;
          float ao = clamp(texture2D(occlusion, vUv).r, 0.0, 1.0);
          gl_FragColor = vec4(color.rgb * mix(1.0, ao, receiver * strength), color.a);
        }`,
    });
    this.quad = new FullScreenQuad(this.composite);
  }

  override setSize(width: number, height: number) { this.ao.setSize(width, height); }

  override render(renderer: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    // Dynamic GLB meshes are covered; arrays and traversal callback are reused across frames.
    this.excluded.length = 0;
    this.scene.traverse(this.collectExcluded);
    try {
      for (const object of this.excluded) object.visible = false;
      this.ao.render(renderer, write, read, 0, false);
    } finally {
      for (let i = 0; i < this.excluded.length; i++) this.excluded[i].visible = this.visibility[i];
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

export function createArchitecturalRenderer(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, quality: Quality = chooseQuality()) {
  const settings = qualitySettings[quality];
  const target = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthTexture: new THREE.DepthTexture(1, 1, THREE.UnsignedIntType),
    samples: Math.min(settings.msaa, renderer.capabilities.maxSamples),
  });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  // Low tier never allocates GTAO textures, materials or its denoising targets.
  if (settings.ao) composer.addPass(new ArchitecturalOcclusionPass(scene, camera));
  composer.addPass(new OutputPass());
  composer.addPass(new FXAAPass());
  let pixelRatio = 0;
  let disposed = false;
  return {
    resize(width: number, height: number) {
      const ratio = Math.min(window.devicePixelRatio || 1, settings.dpr);
      if (ratio !== pixelRatio) {
        pixelRatio = ratio;
        renderer.setPixelRatio(ratio);
        composer.setPixelRatio(ratio);
      }
      renderer.setSize(width, height);
      composer.setSize(width, height);
    },
    render() { if (!disposed) composer.render(0); },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const pass of composer.passes) pass.dispose();
      composer.dispose();
    },
  };
}

/** Clouded golden-hour sky, warm architecture and a daylight inspection preset. */
export function createDaylight(renderer: THREE.WebGLRenderer, scene: THREE.Scene, building: THREE.Object3D, assetBase: string, invalidate: () => void, quality: Quality = chooseQuality()) {
  const settings = qualitySettings[quality];
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
  const sunset = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { sunDirection: { value: new THREE.Vector3(-.6, .13, -.78).normalize() } },
    vertexShader: `varying vec3 vDirection;
      void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDirection;
      uniform vec3 sunDirection;
      float hash(vec3 p) { p = fract(p * .3183099 + vec3(.13, .27, .43)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float cloud(vec3 p) { return noise(p) * .55 + noise(p * 2.03) * .28 + noise(p * 4.07) * .12 + noise(p * 8.13) * .05; }
      void main() {
        vec3 d = normalize(vDirection);
        float height = max(d.y, 0.0), facing = max(dot(d, sunDirection), 0.0);
        float glow = pow(facing, 10.0);
        vec3 horizon = mix(vec3(.65,.29,.12), vec3(1.5,.67,.24), pow(facing, 3.0));
        vec3 color = mix(horizon, vec3(.022,.055,.13), smoothstep(0.0,.62,height));
        color += vec3(1.1,.38,.07) * glow * exp(-height * 4.0);
        vec3 p = d * vec3(6.0, 20.0, 6.0);
        float density = cloud(p + vec3(1.7, 0.0, 3.4));
        float coverage = smoothstep(.46,.65,density) * smoothstep(.01,.16,height);
        vec3 cloudColor = mix(vec3(.035,.065,.12), vec3(.73,.29,.12), glow * .7 + pow(1.0-height, 7.0) * .2);
        color = mix(color, cloudColor, coverage * .92);
        color += vec3(7.0,3.5,1.2) * smoothstep(.99955,.99985,dot(d,sunDirection)) * (1.0-coverage);
        gl_FragColor = vec4(color,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sunset.visible = false; skyScene.add(sunset);
  const sunsetDome = new THREE.Mesh(sunset.geometry, sunset.material);
  sunsetDome.name = "Golden sunset cloud sky";
  sunsetDome.visible = false; sunsetDome.frustumCulled = false;
  sunsetDome.userData.renderRole = "sky"; scene.add(sunsetDome);
  const pmrem = new THREE.PMREMGenerator(renderer);
  let environment = pmrem.fromScene(skyScene, .025, .1, 2000);
  const fog = new THREE.Fog("#bbc8cf", settings.contextDistance * 1.1, settings.contextDistance * 2.5);
  scene.fog = fog;
  const fill = new THREE.HemisphereLight("#b6cadf", "#a88961", .4);
  const sun = new THREE.DirectionalLight("#fff1dd", 2.65);
  // Bounds include the landmark/landscape even if asynchronous GLBs have not arrived yet.
  const bounds = new THREE.Box3().setFromObject(building);
  bounds.union(new THREE.Box3(new THREE.Vector3(-80, 0, -32), new THREE.Vector3(80, 30, 90)));
  const center = bounds.getCenter(new THREE.Vector3());
  sun.target.position.copy(center);
  sun.position.copy(center).addScaledVector(direction, 190);
  sun.castShadow = true;
  sun.shadow.mapSize.set(settings.shadowSize, settings.shadowSize);
  sun.shadow.normalBias = .012;
  sun.shadow.bias = -.000025;
  sun.shadow.radius = 2;
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  scene.add(fill, sun, sun.target);
  sun.updateMatrixWorld(true);
  sun.target.updateMatrixWorld(true);
  const shadowCamera = sun.shadow.camera;
  const projected = new THREE.Vector3();
  const fitSunShadow = () => {
    sun.updateMatrixWorld(true);
    shadowCamera.position.copy(sun.position); shadowCamera.lookAt(center); shadowCamera.updateMatrixWorld(true);
    let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [0, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      projected.set(x, y, z).applyMatrix4(shadowCamera.matrixWorldInverse);
      left = Math.min(left, projected.x); right = Math.max(right, projected.x);
      bottom = Math.min(bottom, projected.y); top = Math.max(top, projected.y);
    }
    shadowCamera.left = left - 8; shadowCamera.right = right + 8;
    shadowCamera.bottom = bottom - 8; shadowCamera.top = top + 8;
    shadowCamera.near = 20; shadowCamera.far = 330; shadowCamera.updateProjectionMatrix();
  };
  fitSunShadow();
  pmrem.compileEquirectangularShader();
  let disposed = false;
  let preset: "daylight" | "evening" = "daylight";
  // Retain the 1K source on the CPU for WebGL context restoration.
  let source: THREE.DataTexture | null = null;
  const applyLamp = (object: THREE.Object3D) => {
    const evening = preset === "evening";
    if (object instanceof THREE.Light && object.userData.siteLight) object.intensity = evening ? (object.userData.eveningIntensity ?? 65) : 0;
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material.userData.siteLightPool) material.opacity = evening ? .3 : 0;
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      if (material.userData.siteLamp) material.emissiveIntensity = evening ? 3.2 : .18;
      if (material.userData.siteWindow) material.emissiveIntensity = evening ? .2 : 0;
      if (material.name.startsWith("Recessed neutral structural")) { material.emissive.set("#f8b76e"); material.emissiveIntensity = evening ? .22 : 0; }
      if (material.name === "Cool grey reflective storefront glass") { material.emissive.set("#d89747"); material.emissiveIntensity = evening ? .12 : 0; }
    }
  };
  const invalidateShadows = () => {
    if (disposed) return;
    scene.traverse(applyLamp);
    sun.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  };
  const rebuildEnvironment = () => {
    if (disposed) return;
    const photographic = preset === "daylight" && source !== null;
    const next = photographic ? pmrem.fromEquirectangular(source!) : pmrem.fromScene(skyScene, .025, .1, 2000);
    const previous = environment;
    environment = next;
    scene.environment = next.texture;
    scene.background = preset === "evening" ? null : photographic ? source : next.texture;
    scene.environmentRotation.y = photographic ? .8 : 0;
    scene.backgroundRotation.y = scene.environmentRotation.y;
    scene.backgroundIntensity = .8;
    scene.environmentIntensity = .85;
    previous.dispose();
    invalidateShadows();
  };
  scene.environment = environment.texture;
  scene.background = environment.texture;
  scene.backgroundIntensity = .8;
  scene.environmentIntensity = .85;
  new HDRLoader().load(`${assetBase}/model-3d/daylight-995d68b1.hdr`, texture => {
    if (disposed) { texture.dispose(); return; }
    source = texture;
    source.mapping = THREE.EquirectangularReflectionMapping;
    if (preset === "daylight") rebuildEnvironment();
  }, undefined, () => { /* The complete procedural rig remains available if the HDR fails. */ });
  return {
    resize(width: number) {
      const size = Math.min(settings.shadowSize, width < 700 ? 2048 : settings.shadowSize);
      if (disposed || sun.shadow.mapSize.x === size) return;
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.needsUpdate = true;
    },
    restore: rebuildEnvironment,
    invalidateShadows,
    updateMovingShadows() { if (!disposed) { sun.shadow.needsUpdate = true; renderer.shadowMap.needsUpdate = true; } },
    setPreset(next: "daylight" | "evening") {
      if (disposed || next === preset) return;
      preset = next;
      const evening = next === "evening";
      sky.visible = !evening; sunset.visible = evening; sunsetDome.visible = evening;
      sun.position.copy(center).addScaledVector(evening ? sunset.material.uniforms.sunDirection.value : direction, 190);
      fitSunShadow();
      sun.color.set(evening ? "#ffc17b" : "#fff1dd");
      sun.intensity = evening ? 3.1 : 2.65;
      fill.color.set(evening ? "#e1c6a2" : "#b6cadf");
      fill.groundColor.set(evening ? "#b9976a" : "#a88961");
      fill.intensity = evening ? 1.35 : .4;
      renderer.toneMappingExposure = evening ? 1.06 : .9;
      fog.color.set(evening ? "#b49a80" : "#bbc8cf");
      rebuildEnvironment();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.environment = null;
      scene.background = null;
      if (scene.fog === fog) scene.fog = null;
      scene.remove(fill, sun, sun.target, sunsetDome);
      environment.dispose();
      source?.dispose();
      pmrem.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      sunset.geometry.dispose(); sunset.material.dispose();
      sun.shadow.dispose();
    },
  };
}

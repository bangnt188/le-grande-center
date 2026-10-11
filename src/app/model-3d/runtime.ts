import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { loadSceneAsset, disposeScene } from "./assets";
import { createSite, addSiteAsset, updateSiteMotion } from "./site";
import { sceneManifest } from "./scene";
import { createArchitecturalRenderer, createDaylight, chooseQuality, type Quality } from "./rendering";

export type View = "front" | "aerial" | "rearLake" | "side";
export type Selection = { floor: number | null; slot: string | null; view: View; lighting: "daylight" | "evening"; motion: boolean; allowedViews: View[] };
export type SceneActions = { view: (view: View) => void; selectFloor: (floor: number | null) => void; selectSlot: (slot: string | null) => void; lighting: (preset: "daylight" | "evening") => void; motion: (enabled: boolean) => void };

export function mountScene(container: HTMLDivElement, options: {
  base: string; quality: Quality | "auto"; selection: Selection; dots: (HTMLButtonElement | null)[];
  onActions: (actions: SceneActions | null) => void; onReady: (ready: boolean) => void; onProgress: (value: number) => void;
  onError: (message: string) => void; onView: (view: View) => void; onNotice: (message: string) => void;
}) {
  const controller = new AbortController(), disposers: (() => void)[] = [];
  let stopped = false;
  const cleanup = () => {
    stopped = true; controller.abort(); options.onActions(null);
    for (const dispose of disposers.reverse()) dispose();
    disposers.length = 0;
  };
  options.onReady(false); options.onError(""); options.onNotice("");
  void (async () => {
    const tier = options.quality === "auto" ? chooseQuality() : options.quality;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: tier === "low" ? "low-power" : "high-performance" });
    disposers.push(() => { renderer.dispose(); renderer.domElement.remove(); });
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.info.autoReset = false;
    renderer.domElement.setAttribute("aria-label", "Mô hình Le Grande Centre. Xoay 360 độ, nhìn từ trên cao và phóng to; chọn góc nhìn, tầng và vị trí bằng các nút điều khiển.");
    renderer.domElement.tabIndex = 0; renderer.domElement.dataset.quality = tier;
    const scene = new THREE.Scene(); disposers.push(() => disposeScene(scene));
    const site = createSite(tier); scene.add(site);
    const building = await loadSceneAsset("building", options.base, controller.signal); scene.add(building);
    options.onProgress(73);
    const stats: { id: string; bytes: number; decodeMs: number }[] = [building.userData.loadStats];
    const camera = new THREE.PerspectiveCamera(38, 1, .12, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.enableDamping = false; controls.mouseButtons.RIGHT = null;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
    controls.minPolarAngle = .008; controls.maxPolarAngle = Math.PI / 2;
    controls.minDistance = .6;
    disposers.push(() => controls.dispose());
    const bounds = new THREE.Box3().setFromObject(building);
    const slab = new THREE.BoxGeometry(113.2, 3.8, 36.8);
    const outlineGeometry = new THREE.EdgesGeometry(slab); slab.dispose();
    const outlineMaterial = new THREE.LineBasicMaterial({ color: "#fff2be", transparent: true, opacity: .9, depthTest: false });
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial); outline.visible = false; scene.add(outline);
    disposers.push(() => { outlineGeometry.dispose(); outlineMaterial.dispose(); });
    const slotGeometry = new THREE.PlaneGeometry(1, 3.65);
    const slotMaterial = new THREE.MeshBasicMaterial({ color: "#e4c679", transparent: true, opacity: .24, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
    const slotHighlight = new THREE.Mesh(slotGeometry, slotMaterial); slotHighlight.userData.renderRole = "interaction"; slotHighlight.visible = false; scene.add(slotHighlight);
    const pickMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    const picks = sceneManifest.slots.map(slot => {
      const pick = new THREE.Mesh(slotGeometry, pickMaterial); pick.position.set(...slot.anchor); pick.scale.x = slot.width;
      pick.layers.set(1);
      pick.userData = { renderRole: "interaction", slotId: slot.slotId, floorId: slot.floorId }; scene.add(pick); return pick;
    });
    let initialized = false;
    const pipeline = createArchitecturalRenderer(renderer, scene, camera, tier); disposers.push(() => pipeline.dispose());
    const daylight = createDaylight(renderer, scene, building, options.base, () => { if (initialized) render(); }, tier, options.selection.lighting); disposers.push(() => daylight.dispose());
    let width = 1, height = 1, frame: number | null = null, contextAvailable = true, renders = 0;
    let visible = true, dirty = true, elapsedSeconds = 0, lastMotionTime = 0, lastRenderTime = 0, lastShadowTime = 0, lastStatsTime = 0;
    let vehicleProbe: THREE.InstancedMesh | null = null, walkerProbe: THREE.Object3D | null = null;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const canRender = () => initialized && !stopped && contextAvailable && visible && !document.hidden;
    const motionActive = () => canRender() && options.selection.motion && !reducedMotion.matches;
    const projected = new THREE.Vector3(), relative = new THREE.Vector3(), direction = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0), center = bounds.getCenter(new THREE.Vector3());
    const corners: THREE.Vector3[] = [];
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
    const siteCorners: Record<View, THREE.Vector3[]> = { front: [], side: [], aerial: [], rearLake: [] };
    for (const x of [-53, -11]) for (const y of [0, 27]) for (const z of [44, 86]) siteCorners.aerial.push(new THREE.Vector3(x, y, z));
    for (const x of [-65, 65]) for (const z of [-98, -28]) siteCorners.rearLake.push(new THREE.Vector3(x, 0, z));
    let activeView: View = options.selection.view;
    const anchorX = [-44, 36, -31, 46, -16, 23], anchorZ = [10, -7, 6, -10, 2, -3];
    const distanceToFit = () => {
      right.crossVectors(worldUp, direction).normalize(); up.crossVectors(direction, right).normalize();
      const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
      let distance = 0;
      const include = (point: THREE.Vector3) => {
        relative.copy(point).sub(controls.target);
        const depth = relative.dot(direction);
        const padding = activeView === "front" ? 1.16 : 1.08;
        distance = Math.max(distance, Math.abs(relative.dot(right)) * padding / tanH + depth, Math.abs(relative.dot(up)) * padding / tanV + depth);
      };
      corners.forEach(include); siteCorners[activeView].forEach(include);
      return distance;
    };
    const positionDots = () => {
      const sideFacing = Math.abs(camera.position.x) > Math.abs(camera.position.z) * 1.35;
      sceneManifest.floors.forEach((floor, index) => {
        const dot = options.dots[index]; if (!dot) return;
        if (sideFacing) projected.set(camera.position.x > 0 ? 56.65 : -56.65, floor.elevation, anchorZ[index]);
        else projected.set(anchorX[index], floor.elevation, camera.position.z >= 0 ? 13.7 : -15.7);
        projected.project(camera);
        dot.hidden = !(projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < .96 && Math.abs(projected.y) < .96);
        dot.style.transform = `translate(${(projected.x + 1) * width / 2}px, ${(1 - projected.y) * height / 2}px) translate(-50%, -50%)`;
      });
    };
    const stopFrame = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null; lastMotionTime = 0;
    };
    const tick = (time: number) => {
      frame = null;
      if (!canRender()) { lastMotionTime = 0; return; }
      const animate = motionActive();
      if (dirty || time - lastRenderTime >= 1000 / (tier === "low" ? 24 : 30)) {
        if (animate) {
          if (lastMotionTime) elapsedSeconds += (time - lastMotionTime) / 1000;
          lastMotionTime = time;
          if (updateSiteMotion(site, elapsedSeconds) && time - lastShadowTime >= 125) { daylight.updateMovingShadows(); lastShadowTime = time; }
        } else lastMotionTime = 0;
        camera.position.y = Math.max(1.2, camera.position.y); camera.lookAt(controls.target); camera.updateMatrixWorld();
        renderer.info.reset();
        const start = performance.now(); pipeline.render(); if (dirty) positionDots(); renders++;
        if (process.env.NODE_ENV === "development" && (dirty || time - lastStatsTime >= 250)) {
          renderer.domElement.dataset.sceneStats = JSON.stringify({
            quality: tier, renders, renderMs: performance.now() - start, calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
            camera: camera.position.toArray(), target: controls.target.toArray(), azimuth: controls.getAzimuthalAngle(), polar: controls.getPolarAngle(),
            distance: controls.getDistance(), minDistance: controls.minDistance, maxDistance: controls.maxDistance,
            motion: { enabled: options.selection.motion, active: animate, elapsedSeconds, reduced: reducedMotion.matches,
              vehicles: site.userData.vehicleCount ?? 0, walkers: site.userData.walkerCount ?? 0,
              vehicleX: vehicleProbe?.instanceMatrix.array[12], pedestrian: walkerProbe?.position.toArray() },
            projectedCorners: corners.map(point => { projected.copy(point).project(camera); return projected.toArray(); }), assets: stats,
          });
          lastStatsTime = time;
        }
        dirty = false; lastRenderTime = time;
      }
      if (animate) frame = requestAnimationFrame(tick);
    };
    const render = () => {
      dirty = true;
      if (frame === null && canRender()) frame = requestAnimationFrame(tick);
    };
    const refreshMotion = () => { stopFrame(); daylight.updateMovingShadows(); render(); };
    const visibilityObserver = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; refreshMotion(); });
    visibilityObserver.observe(container);
    document.addEventListener("visibilitychange", refreshMotion);
    reducedMotion.addEventListener("change", refreshMotion);
    disposers.push(() => { stopFrame(); visibilityObserver.disconnect(); document.removeEventListener("visibilitychange", refreshMotion); reducedMotion.removeEventListener("change", refreshMotion); });
    const setView = (next: View) => {
      if (!options.selection.allowedViews.includes(next)) next = options.selection.allowedViews[0];
      options.selection.view = next; options.onView(next);
      activeView = next;
      const preset = sceneManifest.cameraPresets.find(item => item.id === next)!;
      camera.fov = camera.aspect < 1 ? Math.max(preset.fov, 58) : preset.fov;
      camera.updateProjectionMatrix(); direction.set(...preset.position).normalize();
      center.set(...preset.target);
      if (options.selection.floor !== null && next === "front") center.y = sceneManifest.floors[options.selection.floor - 1].elevation;
      controls.target.copy(center);
      const distance = distanceToFit();
      controls.maxDistance = Math.max(distance, Math.max(280, distance * 1.15) * .65);
      camera.position.copy(center).addScaledVector(direction, distance); controls.update(); render();
    };
    const highlightSlot = (slotId: string | null) => {
      const slot = sceneManifest.slots.find(item => item.slotId === slotId); slotHighlight.visible = Boolean(slot);
      if (slot) { slotHighlight.position.set(...slot.anchor); slotHighlight.position.z += .12; slotHighlight.scale.x = slot.width; }
      render();
    };
    const focusFloor = (floor: number | null) => {
      outline.visible = floor !== null;
      if (floor !== null) { outline.position.y = sceneManifest.floors[floor - 1].elevation; outline.position.z = 1; setView(options.selection.allowedViews.includes("front") ? "front" : activeView); }
      else setView(activeView);
      highlightSlot(options.selection.slot);
    };
    const resize = () => {
      width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
      pipeline.resize(width, height); daylight.resize(width); camera.aspect = width / height; camera.updateProjectionMatrix();
      setView(activeView);
    };
    const observer = new ResizeObserver(resize); disposers.push(() => observer.disconnect());
    controls.addEventListener("change", render); disposers.push(() => controls.removeEventListener("change", render));
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    raycaster.layers.set(1);
    let pointerStart: [number, number] | null = null;
    const pickSlot = (event: PointerEvent) => {
      if (options.selection.floor === null || activeView !== "front") return null;
      const rect = renderer.domElement.getBoundingClientRect(); pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(picks).find(item => item.object.userData.floorId === `T${options.selection.floor}`);
      return hit?.object.userData.slotId as string | undefined;
    };
    const pointerDown = (event: PointerEvent) => { pointerStart = [event.clientX, event.clientY]; };
    const pointerUp = (event: PointerEvent) => {
      if (!pointerStart || Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) > 5) { pointerStart = null; return; }
      pointerStart = null; const id = pickSlot(event);
      if (id) container.closest("section")?.querySelector<HTMLButtonElement>(`[data-slot-id="${id}"]:not(:disabled)`)?.click();
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || event.buttons) return;
      const id = pickSlot(event), allowed = id && container.closest("section")?.querySelector(`[data-slot-id="${id}"]:not(:disabled)`);
      highlightSlot(allowed ? id! : options.selection.slot);
    };
    const pointerLeave = () => highlightSlot(options.selection.slot);
    const contextLost = (event: Event) => { event.preventDefault(); contextAvailable = false; stopFrame(); options.onReady(false); options.onError("Kết nối đồ họa bị gián đoạn. Bạn vẫn có thể chọn tầng và liên hệ dự án."); };
    const contextRestored = () => { daylight.restore(); contextAvailable = true; if (!initialized) return; options.onError(""); options.onReady(true); render(); };
    const listeners: [string, EventListener][] = [["pointerdown", pointerDown as EventListener], ["pointerup", pointerUp as EventListener], ["pointermove", pointerMove as EventListener], ["pointerleave", pointerLeave], ["webglcontextlost", contextLost], ["webglcontextrestored", contextRestored]];
    for (const [name, listener] of listeners) renderer.domElement.addEventListener(name, listener);
    disposers.push(() => { for (const [name, listener] of listeners) renderer.domElement.removeEventListener(name, listener); });
    container.appendChild(renderer.domElement); resize(); observer.observe(container);
    await daylight.ready;
    if (stopped) return;
    options.onProgress(76);
    // Warm shaders and uploads behind loading, yielding between GPU batches.
    const warmup = async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (stopped) return;
      await pipeline.prepare();
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (!stopped) pipeline.render();
    };
    daylight.invalidateShadows(); focusFloor(options.selection.floor); highlightSlot(options.selection.slot);
    let warming = warmup(), assetsReady = 0;
    await Promise.all(["monument", "tree", "vehicle", "person", "lamp", "bench"].map(async id => {
      let root: THREE.Group;
      try { root = await loadSceneAsset(id, options.base, controller.signal); }
      catch {
        if (!stopped) { options.onNotice("Một phần cảnh quan chưa tải được. Công trình và thông tin tầng vẫn hoạt động."); options.onProgress(76 + ++assetsReady * 3); }
        return;
      }
      warming = warming.then(async () => {
        if (stopped) { disposeScene(root); return; }
        stats.push(root.userData.loadStats); addSiteAsset(site, root, id, tier); daylight.invalidateShadows();
        if (process.env.NODE_ENV === "development") {
          const vehicle = site.getObjectByName("vehicle instances")?.children.find(object => object instanceof THREE.InstancedMesh);
          if (vehicle instanceof THREE.InstancedMesh) vehicleProbe = vehicle;
          walkerProbe = site.getObjectByName("Walking pedestrian 1") ?? null;
        }
        await warmup();
        if (!stopped) options.onProgress(76 + ++assetsReady * 3);
      });
      await warming;
    }));
    await warming;
    if (stopped) return;
    options.onProgress(97);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (stopped) return;
    activeView = options.selection.view; focusFloor(options.selection.floor); highlightSlot(options.selection.slot);
    initialized = true; tick(performance.now());
    options.onActions({ view: setView, selectFloor: focusFloor, selectSlot: highlightSlot, lighting: daylight.setPreset, motion: enabled => { options.selection.motion = enabled; refreshMotion(); } });
    options.onProgress(100); options.onReady(true);
  })().catch(() => {
    if (stopped) return;
    cleanup(); options.onReady(false); options.onError("Không mở được mô hình 3D. Bạn vẫn có thể xem ảnh/phim, chọn tầng và liên hệ trực tiếp.");
  });
  return cleanup;
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createModel, disposeModel } from "./model";
import { createArchitecturalRenderer, createDaylight } from "./rendering";
import styles from "./viewer.module.css";

type View = "front" | "aerial" | "rear" | "side";
type ViewerActions = {
  view: (view: View) => void;
  selectFloor: (floor: number | null) => void;
};
const VIEWS: { id: View; label: string }[] = [
  { id: "front", label: "Mặt tiền" },
  { id: "aerial", label: "Tổng thể" },
  { id: "rear", label: "Mặt hồ" },
  { id: "side", label: "Mặt bên" },
];
const FLOORS = [1, 2, 3, 4, 5, 6];
const ANCHOR_X = [-44, 36, -31, 46, -16, 23];
const ANCHOR_Z = [10, -7, 6, -10, 2, -3];
const PROGRAMS = [
  { floors: [1, 2], title: "Shophouse thương mại", description: "Không gian thương mại tầng 1–2 được giới thiệu theo mô hình shophouse thông tầng (duplex)." },
  { floors: [3, 4], title: "Dịch vụ – văn phòng", description: "Tầng 3–4 dành cho công năng dịch vụ và văn phòng theo giới thiệu dự án." },
  { floors: [5], title: "Giải trí", description: "Không gian giải trí, gồm phương án rạp chiếu phim dự kiến theo hồ sơ dự án." },
  { floors: [6], title: "Dịch vụ ngoài trời – sự kiện", description: "Tầng 6 được định hướng cho dịch vụ ngoài trời và sự kiện (dự kiến)." },
];
const ADDRESS = "18 Nguyễn Chí Thanh, Khu vực 3, Phường Sóc Trăng, TP. Cần Thơ";

export default function ModelViewer({ showAdminLink, assetBase }: { showAdminLink: boolean; assetBase: string }) {
  const host = useRef<HTMLDivElement>(null);
  const filmVideo = useRef<HTMLVideoElement>(null);
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const actions = useRef<ViewerActions | null>(null);
  const [view, setView] = useState<View>("front");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const selectedProgram = PROGRAMS.find(program => selectedFloor !== null && program.floors.includes(selectedFloor));
  const emailSubject = `Tìm hiểu Le Grande Centre${selectedFloor === null ? "" : ` – Tầng ${selectedFloor}`}`;
  const emailBody = `Kính gửi Le Grande Centre,\n\nDoanh nghiệp chúng tôi muốn tìm hiểu ${selectedFloor === null ? "không gian tại dự án" : `tầng ${selectedFloor} (${selectedProgram?.title})`}. Vui lòng tư vấn công năng, mặt bằng và tình trạng khả dụng đã được xác nhận.\n\nXin cảm ơn.`;
  const emailHref = `mailto:ntmcongty@gmail.com?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  useEffect(() => {
    const video = filmVideo.current;
    if (!video || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    const syncPlayback = () => {
      if (motion.matches || !inView) { video.pause(); return; }
      video.muted = true;
      void video.play().catch(() => {});
    };
    const observer = new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      syncPlayback();
    }, { threshold: .35 });
    observer.observe(video);
    motion.addEventListener("change", syncPlayback);
    return () => { observer.disconnect(); motion.removeEventListener("change", syncPlayback); video.pause(); };
  }, []);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    const disposers: (() => void)[] = [];
    const cleanup = () => {
      actions.current = null;
      for (const dispose of disposers.reverse()) dispose();
      disposers.length = 0;
    };
    try {
      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
      disposers.push(() => { renderer.dispose(); renderer.domElement.remove(); });
      renderer.setClearColor("#f4f0e4");
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = .9;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.domElement.setAttribute("aria-label", "Mô hình Le Grande Centre. Kéo để xoay, cuộn hoặc chụm để phóng to; phím mũi tên để di chuyển góc nhìn.");
      renderer.domElement.tabIndex = 0;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, .3, 1400);
      const controls = new OrbitControls(camera, renderer.domElement);
      disposers.push(() => controls.dispose());
      controls.minDistance = 45;
      controls.maxDistance = 700;
      controls.maxPolarAngle = Math.PI / 2 + .1;
      controls.listenToKeyEvents(renderer.domElement);
      const { model, building } = createModel();
      disposers.push(() => disposeModel(model));
      scene.add(model);

      const slab = new THREE.BoxGeometry(113.2, 3.8, 27.8);
      const outlineGeometry = new THREE.EdgesGeometry(slab);
      slab.dispose();
      const outlineMaterial = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: .38 });
      const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
      outline.visible = false;
      scene.add(outline);
      disposers.push(() => { outlineGeometry.dispose(); outlineMaterial.dispose(); });
      const pipeline = createArchitecturalRenderer(renderer, scene, camera);
      disposers.push(() => pipeline.dispose());
      const daylight = createDaylight(renderer, scene, building, assetBase, () => render());
      disposers.push(() => daylight.dispose());
      const projected = new THREE.Vector3();
      let width = 1;
      let height = 1;
      const positionDots = () => {
        const sideFacing = Math.abs(camera.position.x) > Math.abs(camera.position.z) * 1.35;
        for (let index = 0; index < FLOORS.length; index++) {
          const dot = dots.current[index];
          if (!dot) continue;
          // Keep the original six floor elevations: 2, 6, 10, 14, 18 and 22.
          const y = index * 4 + 2;
          if (sideFacing) projected.set(camera.position.x > 0 ? 56.65 : -56.65, y, ANCHOR_Z[index]);
          else projected.set(ANCHOR_X[index], y, camera.position.z >= 0 ? 13.7 : -15.7);
          projected.project(camera);
          dot.hidden = !(projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < .96 && Math.abs(projected.y) < .96);
          dot.style.transform = `translate(${(projected.x + 1) * width / 2}px, ${(1 - projected.y) * height / 2}px) translate(-50%, -50%)`;
        }
      };
      const bounds = new THREE.Box3().setFromObject(building);
      const cameraBounds = bounds.clone().expandByScalar(1.5);
      const cameraRay = new THREE.Ray();
      const cameraExit = new THREE.Vector3();
      let frame: number | null = null;
      let contextAvailable = true;
      disposers.push(() => { if (frame !== null) cancelAnimationFrame(frame); });
      const render = () => {
        if (frame !== null || !contextAvailable) return;
        // Coalesce asset, control and resize updates; the static scene has no idle render loop.
        frame = requestAnimationFrame(() => {
          frame = null;
          if (!contextAvailable) return;
          // Keep orbit/zoom outside the structure and above the ground.
          camera.position.y = Math.max(1.8, camera.position.y);
          if (cameraBounds.containsPoint(camera.position)) {
            cameraRay.set(controls.target, camera.position.clone().sub(controls.target).normalize());
            if (cameraRay.intersectBox(cameraBounds, cameraExit)) camera.position.copy(cameraExit);
          }
          camera.lookAt(controls.target);
          pipeline.render();
          positionDots();
        });
      };
      let activeView: View = "front";
      const center = bounds.getCenter(new THREE.Vector3());
      const corners: THREE.Vector3[] = [];
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
      for (const x of [-36, -2]) for (const y of [0, 29]) for (const z of [41, 75]) corners.push(new THREE.Vector3(x, y, z));
      const relativeCorner = new THREE.Vector3();
      const direction = new THREE.Vector3();
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      const worldUp = new THREE.Vector3(0, 1, 0);
      const positions: Record<View, [number, number, number]> = {
        front: [.7, .08, 1], aerial: [.58, .68, 1], rear: [-.32, .16, -1], side: [1, .12, .32],
      };
      const fitView = () => {
        const includeMonument = activeView === "aerial";
        bounds.getCenter(center);
        if (includeMonument) center.z += 10;
        right.crossVectors(worldUp, direction).normalize();
        up.crossVectors(direction, right).normalize();
        const tanVertical = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const tanHorizontal = tanVertical * camera.aspect;
        let distance = 0;
        // The primary view prioritizes the facade; the overview retains the monument and site relationship.
        for (let index = 0; index < (includeMonument ? corners.length : 8); index++) {
          relativeCorner.copy(corners[index]).sub(center);
          const depth = relativeCorner.dot(direction);
          distance = Math.max(distance, Math.abs(relativeCorner.dot(right)) * 1.1 / tanHorizontal + depth, Math.abs(relativeCorner.dot(up)) * 1.12 / tanVertical + depth);
        }
        camera.position.copy(center).addScaledVector(direction, distance);
        controls.target.copy(center);
        controls.update();
        render();
      };
      const setView = (next: View) => { activeView = next; direction.set(...positions[next]).normalize(); fitView(); };
      const resize = () => {
        width = Math.max(1, container.clientWidth); height = Math.max(1, container.clientHeight);
        pipeline.resize(width, height);
        daylight.resize(width);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        // Preserve the visitor's rotation while fitting the new viewport.
        if (camera.position.distanceTo(controls.target) > 0) direction.copy(camera.position).sub(controls.target).normalize();
        fitView();
      };
      const observer = new ResizeObserver(resize);
      disposers.push(() => observer.disconnect());
      controls.addEventListener("change", render);
      disposers.push(() => controls.removeEventListener("change", render));
      const contextLost = (event: Event) => {
        event.preventDefault();
        contextAvailable = false;
        setReady(false);
        setError("Kết nối đồ họa bị gián đoạn. Bạn vẫn có thể xem phim dự án và liên hệ bên dưới.");
      };
      const contextRestored = () => {
        daylight.restore();
        contextAvailable = true;
        setReady(true); setError(""); render();
      };
      renderer.domElement.addEventListener("webglcontextlost", contextLost);
      renderer.domElement.addEventListener("webglcontextrestored", contextRestored);
      disposers.push(() => {
        renderer.domElement.removeEventListener("webglcontextlost", contextLost);
        renderer.domElement.removeEventListener("webglcontextrestored", contextRestored);
      });
      container.appendChild(renderer.domElement);
      direction.set(...positions.front).normalize();
      camera.position.copy(center).addScaledVector(direction, 200);
      controls.target.copy(center);
      resize();
      observer.observe(container);
      actions.current = {
        view: setView,
        selectFloor: floor => {
          outline.visible = floor !== null;
          if (floor !== null) outline.position.y = (floor - 1) * 4 + 2;
          render();
        },
      };
      setError("");
      setReady(true);
    } catch {
      cleanup();
      setReady(false);
      setError("Trình duyệt chưa mở được mô hình 3D. Xem phim dự án hoặc liên hệ trực tiếp để tìm hiểu không gian.");
    }
    return cleanup;
  }, [assetBase]);

  function selectFloor(floor: number | null) {
    const next = floor === selectedFloor ? null : floor;
    setSelectedFloor(next);
    actions.current?.selectFloor(next);
  }

  function selectHotspot(floor: number, clientX: number, clientY: number, keyboard: boolean) {
    if (keyboard) { selectFloor(floor); return; }
    // Overlapping touch targets resolve to the nearest visible dot, not DOM order.
    let nearest = floor;
    let distance = Infinity;
    for (let index = 0; index < dots.current.length; index++) {
      const dot = dots.current[index];
      if (!dot || dot.hidden) continue;
      const rect = dot.getBoundingClientRect();
      const dx = clientX - rect.x - rect.width / 2;
      const dy = clientY - rect.y - rect.height / 2;
      const squared = dx * dx + dy * dy;
      if (squared < distance) { distance = squared; nearest = FLOORS[index]; }
    }
    selectFloor(nearest);
  }

  return <main className={styles.page} id="main-content">
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="Le Grande Centre – Trang chủ">Le Grande <span>Centre</span></Link>
      <nav className={styles.headerLinks} aria-label="Điều hướng chính">
        <a href="#kham-pha">Khám phá</a><a href="#lien-he">Liên hệ dự án</a>
        {showAdminLink && <Link href="/admin-preview/" className={styles.adminLink}>Quản trị</Link>}
      </nav>
    </header>

    <section className={styles.lead} aria-labelledby="project-heading">
      <h1 id="project-heading">Không gian kinh doanh.<br /><em>Dấu ấn bên hồ.</em></h1>
      <div className={styles.intro}>
        <p>Le Grande Centre kết nối thương mại, dịch vụ và giải trí trong một công trình sáu tầng trên đường Nguyễn Chí Thanh, bên Hồ Nước Ngọt.</p>
        <div className={styles.leadActions}><a className={styles.primaryLink} href="#kham-pha">Khám phá không gian <Arrow /></a><a className={styles.textLink} href="#lien-he">Trao đổi với dự án</a></div>
      </div>
    </section>

    <section className={styles.explore} id="kham-pha" aria-label="Khám phá kiến trúc và công năng">
      <div className={styles.workspace}>
        <div className={styles.canvas} ref={host} />
        <div className={styles.hotspots} aria-label="Chọn tầng trên tòa nhà">{FLOORS.map((floor, index) => <button
          key={floor}
          ref={element => { dots.current[index] = element; }}
          className={styles.hotspot}
          disabled={!ready}
          aria-label={`Chọn tầng ${floor}`}
          aria-pressed={selectedFloor === floor}
          aria-controls="floor-detail"
          onClick={event => selectHotspot(floor, event.clientX, event.clientY, event.detail === 0)}
        ><span className={styles.dot} /><span className={styles.dotLabel}>Tầng {floor}</span></button>)}</div>
        {!ready && !error && <p className={styles.loading} role="status">Đang mở không gian 3D…</p>}
        {error && <div className={styles.sceneError} role="alert"><p>{error}</p><a href="#phim-du-an" className={styles.textLink}>Xem phim dự án <Arrow /></a></div>}
      </div>
      <div className={styles.sceneBar}>
        <label className={styles.viewControl}>Góc nhìn <select value={view} disabled={!ready} onChange={event => { const next = event.target.value as View; actions.current?.view(next); setView(next); }}>{VIEWS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <p className={styles.gesture}>Kéo để xoay · Chụm / cuộn để phóng to</p>
        <p className={styles.modelNote}>Mô hình kiến trúc · Tỷ lệ ước lượng</p>
      </div>
      <div className={styles.programLayout}>
        <div className={styles.floorDetail} id="floor-detail" aria-live="polite" aria-atomic="true">
          {selectedFloor === null ? <><h2>Sáu tầng,<br />một không gian kết nối.</h2><p>Chọn chấm trắng trên tòa nhà hoặc chọn tầng bên cạnh để tìm hiểu công năng được giới thiệu.</p></> : <><p className={styles.floorNumber}>Tầng {selectedFloor}</p><h2>{selectedProgram?.title}</h2><p>{selectedProgram?.description}</p><button className={styles.clearFloor} onClick={() => selectFloor(null)}>Bỏ chọn tầng</button></>}
          <p className={styles.sourceNote}>Theo brochure Le Grande Centre. Mặt bằng và khả dụng cần xác nhận. <a href={`${assetBase}/le-grande-brochure.pdf`} target="_blank" rel="noopener noreferrer">Xem hồ sơ dự án (PDF)</a>.</p>
        </div>
        <div className={styles.programs} aria-label="Công năng theo tầng">{PROGRAMS.map(program => <div className={styles.programRow} key={program.title}>
          <div className={styles.floorChoices}>{program.floors.map(floor => <button key={floor} aria-pressed={selectedFloor === floor} aria-controls="floor-detail" onClick={() => selectFloor(floor)}>Tầng {floor}</button>)}</div>
          <div><h3>{program.title}</h3><p>{program.floors[0] === 1 ? "Shophouse thông tầng 1–2 (duplex)" : program.floors[0] === 3 ? "Dịch vụ và không gian văn phòng" : program.floors[0] === 5 ? "Rạp chiếu phim dự kiến" : "Công năng dự kiến"}</p></div>
        </div>)}</div>
      </div>
    </section>

    <section className={styles.filmSection} id="phim-du-an" aria-labelledby="film-heading">
      <div className={styles.filmIntro}><h2 id="film-heading">Nhìn từ<br />công trình thực.</h2><p>Mặt tiền trắng – xám, nhịp kiến trúc và bối cảnh bên hồ qua phim dự án.</p></div>
      <figure className={styles.film}><video ref={filmVideo} controls muted preload="none" playsInline poster={`${assetBase}/project-film-poster.webp`} aria-label="Phim kiến trúc Le Grande Centre — tự phát im tiếng khi cuộn tới"><source src={`${assetBase}/project-film.mp4`} type="video/mp4" />Trình duyệt không hỗ trợ video. <a href={`${assetBase}/project-film.mp4`}>Mở phim dự án</a>.</video><figcaption>Phim Le Grande Centre · Tự phát im tiếng khi xuất hiện · Bật âm thanh tại nút điều khiển.</figcaption></figure>
    </section>

    <section className={styles.contact} id="lien-he" aria-labelledby="contact-heading">
      <div className={styles.contactLead}><h2 id="contact-heading">Cùng tìm không gian<br />cho doanh nghiệp của bạn.</h2><p>Trao đổi trực tiếp với Le Grande Centre để xác nhận công năng, mặt bằng phù hợp và thông tin khai thác hiện tại.</p></div>
      <div className={styles.contactDetails}>
        <a className={styles.phone} href="tel:0973879563">0973 879 563 <Arrow /></a>
        <a className={styles.emailLink} href={emailHref}>Mở email{selectedFloor === null ? " trao đổi" : ` về tầng ${selectedFloor}`} <Arrow /></a>
        <p className={styles.emailNote}>Mở ứng dụng email của bạn, chưa gửi yêu cầu.<br />ntmcongty@gmail.com</p>
        <address>{ADDRESS}<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`} className={styles.mapLink} target="_blank" rel="noopener noreferrer">Xem vị trí trên bản đồ <Arrow /></a></address>
        <p className={styles.additionalPhones}>Liên hệ khác: <a href="tel:0944634243">0944 634 243</a> · <a href="tel:0931060768">0931 060 768</a></p>
      </div>
    </section>
    <footer className={styles.footer}><Link href="/" className={styles.footerBrand}>Le Grande Centre</Link><p>Mô hình minh họa, không thay thế hồ sơ thiết kế chính thức.</p><a href="https://legrandecentre.vn/" target="_blank" rel="noopener noreferrer">Website dự án <Arrow /></a></footer>
  </main>;
}

function Arrow() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

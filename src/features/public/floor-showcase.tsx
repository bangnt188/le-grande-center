"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { BROCHURE_FLOORS, BROCHURE_UNITS } from "./brochure-leasing";
import { Arrow } from "./homepage-v2-interactive";
import styles from "./homepage-v2.module.css";

gsap.registerPlugin(ScrollTrigger);

const CANVAS = { width: 1440, height: 960 };
const LAYER_DURATION = 0.85;
const CONNECTOR = { desktop: { x: 1296, y: 456 }, mobile: { x: 720, y: 1040 } };
const layers = [
  { name: "base", closedY: 0 },
  { name: "middle", closedY: 9 },
  { name: "roof", closedY: 20 },
];
const groups = [
  { floors: [1, 2], x: 1110, y: 546, title: "Shophouse", range: "Tầng 1–2", description: "Hai tầng liên thông, hai mặt tiền. Không gian riêng cho thương hiệu, kết nối trực tiếp với nhịp sống đô thị." },
  { floors: [3, 4], x: 1080, y: 305, title: "Dịch vụ & Văn phòng", range: "Tầng 3–4", description: "Mặt bằng linh hoạt cho nhiều quy mô doanh nghiệp. Sảnh giữa và giao thông trung tâm kết nối toàn bộ phân khu." },
  { floors: [5, 6], x: 1110, y: 146, title: "Giải trí & Sự kiện", range: "Tầng 5–6", description: "Không gian giải trí dự kiến, dịch vụ ngoài trời và sự kiện. Mở ra những trải nghiệm mới trên cao." },
];
const floorDetails = new Map(BROCHURE_FLOORS.map(floor => {
  const areas = BROCHURE_UNITS.filter(unit => unit.floorId === floor.id).map(unit => unit.area);
  return [floor.id, {
    ...floor,
    areaRange: `${Math.min(...areas).toLocaleString("vi-VN")}–${Math.max(...areas).toLocaleString("vi-VN")}`,
  }];
}));

function syncConnector(connector: SVGGElement | null, progress: number) {
  if (!connector) return;
  const index = Number(connector.dataset.connectorGroup);
  const anchor = groups[index];
  const offset = layers[index].closedY * CANVAS.height / 100 * Math.max(1 - progress / LAYER_DURATION, 0);
  const y = anchor.y + offset;
  connector.children[0].setAttribute("d", `M${anchor.x} ${y} H${anchor.x + 64} L${CONNECTOR.desktop.x} ${CONNECTOR.desktop.y}`);
  connector.children[1].setAttribute("d", `M${anchor.x} ${y} H${anchor.x + 64} V${CANVAS.height} L${CONNECTOR.mobile.x} ${CONNECTOR.mobile.y}`);
}

export function FloorShowcase({ assetBase }: { assetBase: string }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const connectorRef = useRef<SVGGElement>(null);
  const progressRef = useRef(0);
  const readyRef = useRef(false);
  const suppressFocusRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [selection, setSelection] = useState({ group: 0, floor: 1 });
  const group = groups[selection.group];
  const floor = floorDetails.get(selection.floor)!;
  const anchor = active === null ? null : groups[active];

  useLayoutEffect(() => {
    syncConnector(connectorRef.current, progressRef.current);
  }, [active]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    let opening = false;
    let inView = false;
    const updatePulse = () => {
      const pulsing = String(opening && inView && !document.hidden);
      if (scene.dataset.pulsing !== pulsing) scene.dataset.pulsing = pulsing;
    };
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updatePulse();
    });
    observer.observe(scene);
    document.addEventListener("visibilitychange", updatePulse);
    const updateReady = (next: boolean) => {
      if (readyRef.current === next) return;
      readyRef.current = next;
      setReady(next);
      if (!next) setActive(null);
    };
    const updateTimeline = (progress: number) => {
      progressRef.current = progress;
      syncConnector(connectorRef.current, progress);
      opening = progress > 0;
      updatePulse();
      updateReady(opening);
    };
    const media = gsap.matchMedia();
    const context = gsap.context(() => {
      media.add({
        desktop: "(min-width: 1001px)",
        mobile: "(max-width: 1000px)",
        reduce: "(prefers-reduced-motion: reduce)",
      }, match => {
        const reduced = match.conditions?.reduce;
        const hotspots = scene.querySelector<HTMLElement>("[data-floor-hotspots]")!;
        if (reduced) {
          gsap.set("[data-floor-layer]", { y: 0, yPercent: 0 });
          gsap.set("[data-floor-group]", { y: 0 });
          gsap.set(hotspots, { autoAlpha: 1 });
          updateTimeline(1);
          return;
        }
        updateTimeline(0);
        layers.forEach(layer => gsap.set(`[data-floor-layer="${layer.name}"]`, { y: 0, yPercent: layer.closedY }));
        gsap.set(hotspots, { autoAlpha: 0 });
        const timeline = gsap.timeline({
          defaults: { ease: "none" },
          onUpdate: () => updateTimeline(timeline.progress()),
          scrollTrigger: {
            trigger: scene,
            start: () => {
              const viewport = window.innerHeight;
              const endTop = match.conditions?.mobile ? viewport * 0.2 : viewport * 0.5 - scene.getBoundingClientRect().height * 0.5;
              // Keep the open pose in view; a shorter scroll range starts later and expands 15% faster.
              return `top ${endTop + (viewport * 0.82 - endTop) / 1.15}px`;
            },
            end: match.conditions?.mobile ? "top 20%" : "center 50%",
            scrub: 0.6,
            invalidateOnRefresh: true,
            onRefresh: self => updateTimeline(self.animation!.progress()),
            onScrubComplete: self => updateTimeline(self.animation!.progress()),
          },
        });
        timeline.to('[data-floor-layer="roof"], [data-floor-layer="middle"]', { yPercent: 0, duration: LAYER_DURATION }, 0)
          .to(hotspots, { autoAlpha: 1, duration: 1, ease: "expo.out" }, 0);
        layers.forEach((layer, index) => {
          if (!layer.closedY) return;
          timeline.fromTo(`[data-floor-group="${index}"]`,
            { y: () => hotspots.clientHeight * layer.closedY / 100 },
            { y: 0, duration: LAYER_DURATION }, 0);
        });
        timeline.scrollTrigger!.refresh();
        updateTimeline(timeline.progress());
      }, scene);
    }, scene);
    return () => {
      media.revert();
      context.revert();
      observer.disconnect();
      document.removeEventListener("visibilitychange", updatePulse);
    };
  }, []);

  const groupAtPoint = (x: number, y: number) => {
    let nearest = 0;
    let distance = Infinity;
    for (let index = 0; index < groups.length; index++) {
      const bounds = sceneRef.current!.querySelector(`[data-floor-group="${index}"]`)!.getBoundingClientRect();
      const dx = x - bounds.left - bounds.width / 2;
      const dy = y - bounds.top - bounds.height / 2;
      const squared = dx * dx + dy * dy;
      if (squared < distance) { distance = squared; nearest = index; }
    }
    return nearest;
  };
  const openGroup = (index: number) => {
    if (!readyRef.current) return;
    setSelection(current => current.group === index ? current : { group: index, floor: groups[index].floors[0] });
    setActive(index);
  };
  const closeCard = () => {
    suppressFocusRef.current = true;
    if (active !== null) sceneRef.current?.querySelector<HTMLButtonElement>(`[data-floor-group="${active}"]`)?.focus();
    suppressFocusRef.current = false;
    setActive(null);
  };
  const information = <div id="floor-information" className={styles.floorCard} role="region" aria-labelledby="floor-information-title">
    <button type="button" className={styles.floorClose} aria-label="Đóng thông tin tầng" onClick={closeCard}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
    </button>
    <h3 id="floor-information-title" className={styles.floorTitle}>{group.range}<span>{group.title}</span></h3>
    <p className={styles.floorDescription}>{group.description}</p>
    <div className={styles.floorTabs} aria-label={`Chọn tầng trong ${group.range.toLowerCase()}`}>
      {group.floors.map(id => <button type="button" key={id} aria-pressed={selection.floor === id} aria-controls="floor-detail" onClick={() => setSelection(current => ({ ...current, floor: id }))} onPointerEnter={event => { if (event.pointerType !== "touch") setSelection(current => ({ ...current, floor: id })); }}>Tầng {id}</button>)}
    </div>
    <div id="floor-detail" className={styles.floorDetail} aria-live="polite" aria-atomic="true">
      <h4>Tầng {selection.floor} · {floor.label}</h4><p>{floor.description}</p>
      <p className={styles.floorArea}>{floor.areaRange} m² <span>/ mặt bằng theo brochure</span></p>
    </div>
    <Link href={`/mat-bang/#tang-${selection.floor}`} prefetch={false} className={styles.goldButton}>Xem thông số & sơ đồ tầng {selection.floor} <Arrow/></Link>
  </div>;

  return <div
    ref={sceneRef}
    className={styles.floorScene}
    data-floor-scene
    data-ready={ready}
    onPointerLeave={() => {
      if (!sceneRef.current?.contains(document.activeElement)) setActive(null);
    }}
    onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setActive(null);
    }}
    onKeyDown={event => {
      if (event.key === "Escape" && active !== null) {
        event.preventDefault();
        closeCard();
      }
    }}
  >
    <div className={styles.floorArt}>
      <figure role="img" aria-label="Phối cảnh tách lớp Le Grande Centre: shophouse tầng 1–2, dịch vụ và văn phòng tầng 3–4, giải trí dự kiến và sự kiện tầng 5–6.">
        {layers.map(layer => <img
          key={layer.name}
          className={styles.floorLayer}
          data-floor-layer={layer.name}
          src={`${assetBase}/images/home-v2/floor-${layer.name}.webp`}
          width={CANVAS.width}
          height={CANVAS.height}
          alt=""
          loading="lazy"
          decoding="async"
        />)}
      </figure>
      <svg className={styles.floorLine} viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`} aria-hidden="true">
        {anchor && <g ref={connectorRef} data-connector-group={active} key={active}>
          <path className={styles.floorConnectorDesktop} data-floor-connector pathLength="1" strokeDasharray="1" fill="none"/>
          <path className={styles.floorConnectorMobile} data-floor-connector pathLength="1" strokeDasharray="1" fill="none"/>
        </g>}
      </svg>
      <div className={styles.floorHotspots} data-floor-hotspots onClickCapture={event => {
        if (!event.detail || !(event.target instanceof Element) || !event.target.closest("[data-floor-group]")) return;
        event.stopPropagation();
        const index = groupAtPoint(event.clientX, event.clientY);
        sceneRef.current!.querySelector<HTMLButtonElement>(`[data-floor-group="${index}"]`)!.focus({ preventScroll: true });
        openGroup(index);
      }}>
        {groups.map((item, index) => <Fragment key={item.range}>
          <button
            type="button"
            className={styles.floorHotspot}
            data-floor-group={index}
            style={{ left: `${item.x / CANVAS.width * 100}%`, top: `${item.y / CANVAS.height * 100}%` }}
            disabled={!ready}
            aria-label={`Xem ${item.range.toLowerCase()} · ${item.title}`}
            aria-controls={active === index ? "floor-information" : undefined}
            aria-expanded={active === index}
            onPointerEnter={event => { if (event.pointerType !== "touch") openGroup(groupAtPoint(event.clientX, event.clientY)); }}
            onPointerMove={event => { if (event.pointerType !== "touch") openGroup(groupAtPoint(event.clientX, event.clientY)); }}
            onPointerDown={event => {
              if (event.button !== 0 || !readyRef.current) return;
              event.preventDefault();
              openGroup(groupAtPoint(event.clientX, event.clientY));
            }}
            onFocus={() => { if (!suppressFocusRef.current) openGroup(index); }}
            onClick={() => openGroup(index)}
          ><span className={styles.floorHotspotMark} aria-hidden="true"/></button>
          {active === index && information}
        </Fragment>)}
      </div>
    </div>
    <Link href="/kham-pha/" prefetch={false} className={styles.floorExplore} data-ui-theme="shopping-mall" data-ui-scheme="dark">Khám phá công trình 3D <Arrow/></Link>
  </div>;
}

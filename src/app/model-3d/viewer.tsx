"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { View, Selection, SceneActions } from "./runtime";
import { loadPublicProjection, type ProjectionResult } from "./projection";
import type { Quality } from "./rendering";
import styles from "./viewer.module.css";
import { SiteHeader } from "@/features/public/site-header";
import { ADDRESS, PROGRAMS, PUBLIC_FLOORS } from "@/features/public/site-content";
import { ScrollMotion } from "@mall/ui/motion";
import { LayeredScrollStory } from "@mall/ui";
const VIEWS: { id: View; label: string }[] = [
  { id: "front", label: "Mặt tiền" },
  { id: "aerial", label: "Tổng thể" },
  { id: "rearLake", label: "Mặt hồ" },
  { id: "side", label: "Mặt bên" },
];
const FLOORS = [1, 2, 3, 4, 5, 6];


export default function ModelViewer({ showAdminLink, assetBase, immersive = false }: { showAdminLink: boolean; assetBase: string; immersive?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const filmVideo = useRef<HTMLVideoElement>(null);
  const dots = useRef<(HTMLButtonElement | null)[]>([]);
  const actions = useRef<SceneActions | null>(null);
  const [view, setView] = useState<View>("aerial");
  const [panelOpen, setPanelOpen] = useState(false);
  const [motion, setMotion] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [projection, setProjection] = useState<ProjectionResult>({ status: "unavailable", projection: null, message: "Đang tải thông tin công khai…" });
  const [quality, setQuality] = useState<Quality | "auto">("auto");
  const [lighting, setLighting] = useState<"daylight" | "evening">("evening");
  const [assetNotice, setAssetNotice] = useState("");
  const selection = useRef<Selection>({ floor: null, slot: null, view: "aerial", lighting: "evening", motion: true, allowedViews: VIEWS.map(view => view.id) });
  const publicSlots = projection.projection?.slots.filter(slot => slot.floorId === `T${selectedFloor}` && slot.confidence === "verified") ?? [];
  const slotInfo = publicSlots.find(slot => slot.slotId === selectedSlot);
  const selectedProgram = PROGRAMS.find(program => selectedFloor !== null && program.floors.includes(selectedFloor));
  const emailSubject = `Tìm hiểu Le Grande Centre${selectedFloor === null ? "" : ` – Tầng ${selectedFloor}`}${selectedSlot ? ` – ${selectedSlot}` : ""}`;
  const emailBody = `Kính gửi Le Grande Centre,\n\nDoanh nghiệp chúng tôi muốn tìm hiểu ${selectedFloor === null ? "không gian tại dự án" : `tầng ${selectedFloor} (${selectedProgram?.title})`}${selectedSlot ? `, mặt bằng ${selectedSlot}` : ""}. Vui lòng xác nhận mặt bằng, công năng và tình trạng khả dụng hiện tại.\n\nXin cảm ơn.`;
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
    if (!immersive) return;
    const controller = new AbortController();
    let expiry: ReturnType<typeof setTimeout> | undefined;
    void loadPublicProjection(assetBase, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setProjection(result);
      selection.current.allowedViews = result.projection?.allowedPresetIds ?? VIEWS.map(view => view.id);
      if (!selection.current.allowedViews.includes(selection.current.view)) {
        const next = selection.current.allowedViews[0]; selection.current.view = next; setView(next); actions.current?.view(next);
      }
      if (result.status !== "ready") { setSelectedSlot(null); selection.current.slot = null; actions.current?.selectSlot(null); }
      if (result.projection) {
        const remaining = Math.max(0, Date.parse(result.projection.updatedAt) + 86400000 - Date.now());
        expiry = setTimeout(() => {
          setProjection({ status: "stale", projection: null, message: "Thông tin công khai đã quá hạn cập nhật. Liên hệ dự án để xác nhận." });
          setSelectedSlot(null); selection.current.slot = null; actions.current?.selectSlot(null);
        }, remaining + 1);
      }
    });
    return () => { controller.abort(); clearTimeout(expiry); };
  }, [assetBase, immersive]);

  useEffect(() => {
    if (!immersive || !host.current) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    setReady(false); setError(""); setAssetNotice("");
    void import("./runtime").then(({ mountScene }) => {
      if (cancelled || !host.current) return;
      dispose = mountScene(host.current, { base: assetBase, quality, selection: selection.current, dots: dots.current,
        onActions: value => { actions.current = value; }, onReady: setReady, onError: setError, onView: setView, onNotice: setAssetNotice });
    }).catch(() => { if (!cancelled) setError("Không tải được trải nghiệm 3D. Bạn có thể thoát để xem phim và liên hệ dự án."); });
    return () => { cancelled = true; dispose?.(); };
  }, [assetBase, quality, immersive]);

  function selectFloor(floor: number | null) {
    const next = floor === selectedFloor ? null : floor;
    selection.current.floor = next; selection.current.slot = null;
    setSelectedFloor(next); setSelectedSlot(null);
    if (next !== null) setPanelOpen(true);
    actions.current?.selectFloor(next);
  }

  function selectSlot(slotId: string) {
    if (projection.status !== "ready" || !publicSlots.some(slot => slot.slotId === slotId)) return;
    const next = selectedSlot === slotId ? null : slotId;
    selection.current.slot = next; setSelectedSlot(next); actions.current?.selectSlot(next);
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

  return <main className={`${styles.page} ${immersive ? styles.immersive : ""}`} id="main-content" onKeyDown={event => { if (event.key === "Escape" && panelOpen) { setPanelOpen(false); event.currentTarget.querySelector<HTMLButtonElement>("[aria-controls=viewer-information]")?.focus(); } }}>
    {!immersive && <ScrollMotion />}
    {!immersive && <LayeredScrollStory>
    <SiteHeader overlay showAdminLink={showAdminLink}/>
    <LayeredScrollStory.Hero><section className={styles.cover} aria-labelledby="cover-heading">
    <img className={styles.coverImage} src={`${assetBase}/model-3d/explore-cover.webp`} alt="Phối cảnh hoàng hôn: tượng đài, cảnh quan và không gian bên hồ" fetchPriority="high" decoding="async" />
      <div className={styles.coverTitle}><h1 id="cover-heading">Le Grande<br /><em>Centre.</em></h1><p>Thương mại, dịch vụ và giải trí.<br/>Sáu tầng kết nối bên Hồ Nước Ngọt.</p></div>
      <div className={styles.coverActions}><Link className={styles.exploreLink} href="/mat-bang/" prefetch={false}><span>Xem mặt bằng</span><Arrow /><small>Tìm không gian cho doanh nghiệp</small></Link><Link className={styles.coverExplore} href="/kham-pha/" prefetch={false}>Khám phá công trình 3D <Arrow/></Link></div>
    </section></LayeredScrollStory.Hero>
    <LayeredScrollStory.Surface backgroundImage={`${assetBase}/model-3d/explore-cover.webp`}>
    <section className={styles.lead} aria-labelledby="project-heading">
      <div className={styles.leadCopy}>
        <p className={styles.leadKicker}>Le Grande Centre · Không gian thương mại</p>
        <h2 id="project-heading">Không gian kinh doanh.<br /><em>Dấu ấn bên hồ.</em></h2>
        <div className={styles.intro}>
          <p>Le Grande Centre kết nối thương mại, dịch vụ và giải trí trong một công trình sáu tầng trên đường Nguyễn Chí Thanh, bên Hồ Nước Ngọt.</p>
          <div className={styles.leadActions}><Link className={styles.primaryLink} href="/tong-quan/">Tổng quan Le Grande <Arrow /></Link><Link className={styles.textLink} href="/lien-he/">Trao đổi với dự án</Link></div>
        </div>
      </div>
      <div className={styles.leadGallery}>
        <figure className={styles.leadPrimaryFigure}>
          <div className={styles.leadMediaFrame}><img className={styles.leadMediaImage} src={`${assetBase}/images/le-grande-aerial-close.webp`} alt="Le Grande Centre nhìn cận cảnh từ trên cao" loading="lazy" decoding="async" /></div>
          <figcaption><span>01</span>Mặt tiền thương mại và toàn khối công trình.</figcaption>
        </figure>
        <figure className={styles.leadSecondaryFigure}>
          <div className={styles.leadMediaFrame}><img className={styles.leadMediaImage} src={`${assetBase}/images/le-grande-aerial-context.webp`} alt="Le Grande Centre trong bối cảnh đô thị" loading="lazy" decoding="async" /></div>
          <figcaption><span>02</span>Cảnh quan và liên kết giao thông xung quanh.</figcaption>
        </figure>
        <figure className={styles.leadThirdFigure}>
          <div className={styles.leadMediaFrame}><img className={styles.leadMediaImage} src={`${assetBase}/images/le-grande-aerial-third.webp`} alt="Góc nhìn drone bổ sung về khu vực Le Grande Centre" loading="lazy" decoding="async" /></div>
          <figcaption><span>03</span>Một góc nhìn khác về công trình và khu vực.</figcaption>
        </figure>
        <figure className={styles.leadFourthFigure}>
          <div className={styles.leadMediaFrame}><img className={styles.leadMediaImage} src={`${assetBase}/images/le-grande-hero-drive.webp`} alt="Hình ảnh giới thiệu dự án Le Grande Centre" loading="lazy" decoding="async" /></div>
          <figcaption><span>04</span>Hình ảnh chủ đạo giới thiệu Le Grande Centre.</figcaption>
        </figure>
      </div>
    </section>

    <section className={styles.floorPreview} aria-labelledby="home-floors-heading">
      <div className={styles.floorPreviewIntro}><h2 id="home-floors-heading">Sáu tầng.<br/><em>Nhiều khả năng.</em></h2><p>Tìm hiểu công năng từng tầng, từ không gian thương mại đến dịch vụ và giải trí.</p><Link className={styles.textLink} href="/tong-quan-tang/">Tổng quan từng tầng <Arrow/></Link></div>
      <div className={styles.floorPreviewList}>{PUBLIC_FLOORS.map(item => <Link key={item.floor} href={`/tong-quan-tang/#tang-${item.floor}`} className={styles.floorPreviewRow}><span>Tầng {item.floor}</span><h3>{item.title}{item.floor >= 5 && <small>Công năng dự kiến</small>}</h3><Arrow/></Link>)}</div>
    </section>

    </LayeredScrollStory.Surface></LayeredScrollStory>}
    {immersive && <section className={styles.explore} id="kham-pha" aria-label="Khám phá kiến trúc và công năng">
      <div className={styles.viewerHeader}><Link href="/" className={styles.exitLink}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h13" stroke="currentColor" strokeWidth="1.5" /></svg>Thoát</Link><h1>Le Grande Centre</h1><button className={styles.infoToggle} aria-expanded={panelOpen} aria-controls="viewer-information" onClick={() => setPanelOpen(!panelOpen)}>Tầng & mặt bằng</button></div>
      <div className={styles.workspace}>
        <div className={styles.canvas} ref={host} />
        {!ready && <img className={styles.poster} src={`${assetBase}/project-film-poster.webp`} alt="Le Grande Centre qua phim dự án" />}
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
        {error && <div className={styles.sceneError} role="alert"><p>{error}</p><Link href="/#phim-du-an" className={styles.textLink}>Thoát và xem phim dự án <Arrow /></Link></div>}
      </div>
      <div className={styles.quickFloors} aria-label="Chọn nhanh tầng">{[...FLOORS].reverse().map(floor => <button key={floor} aria-label={`Tầng ${floor}`} aria-pressed={selectedFloor === floor} onClick={() => selectFloor(floor)}>{floor}</button>)}</div>
      <div className={styles.sceneBar}>
        <label className={styles.viewControl}>Góc nhìn <select aria-label="Góc nhìn" value={view} disabled={!ready} onChange={event => { const next = VIEWS.find(item => item.id === event.target.value)?.id; if (!next) return; selection.current.view = next; actions.current?.view(next); setView(next); }}>{VIEWS.map(item => <option key={item.id} value={item.id} disabled={projection.status === "ready" && !projection.projection?.allowedPresetIds.includes(item.id)}>{item.label}</option>)}</select></label>
        <button className={styles.sceneButton} disabled={!ready} onClick={() => actions.current?.view(view)}>Đặt lại góc nhìn</button>
        <label className={styles.viewControl}>Ánh sáng <select aria-label="Ánh sáng" value={lighting} disabled={!ready} onChange={event => { const next = event.target.value === "evening" ? "evening" : "daylight"; selection.current.lighting = next; setLighting(next); actions.current?.lighting(next); }}><option value="daylight">Chiều ấm</option><option value="evening">Hoàng hôn</option></select></label>
        <label className={styles.viewControl}>Chất lượng <select aria-label="Chất lượng" value={quality} onChange={event => { const value = event.target.value; setQuality(value === "high" || value === "medium" || value === "low" ? value : "auto"); }}><option value="auto">Tự động</option><option value="high">Cao</option><option value="medium">Vừa</option><option value="low">Nhẹ</option></select></label>
      </div>
      <button className={styles.motionButton} aria-pressed={motion} onClick={() => { const next = !motion; setMotion(next); selection.current.motion = next; actions.current?.motion(next); }}>{motion ? "Dừng chuyển động" : "Chạy chuyển động"}</button>
      <p className={styles.siteNote}>Kéo để xoay 360° · Kéo dọc để nhìn từ trên cao · Cuộn hoặc chụm để thu/phóng</p>
      {assetNotice && <p className={styles.assetNotice} role="status">{assetNotice}</p>}
      <aside id="viewer-information" className={styles.infoPanel} hidden={!panelOpen} aria-label="Thông tin tầng và vị trí">
      <button className={styles.closePanel} onClick={event => { setPanelOpen(false); event.currentTarget.closest("main")?.querySelector<HTMLButtonElement>("[aria-controls=viewer-information]")?.focus(); }}>Đóng thông tin <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" stroke="currentColor" strokeWidth="1.5" /></svg></button>
      <div className={styles.programLayout}>
        <div className={styles.floorDetail} id="floor-detail" aria-live="polite" aria-atomic="true">
          {selectedFloor === null ? <><h2>Sáu tầng,<br />một không gian kết nối.</h2><p>Chọn chấm trắng trên tòa nhà hoặc chọn tầng bên cạnh để tìm hiểu công năng được giới thiệu.</p></> : <><p className={styles.floorNumber}>Tầng {selectedFloor}</p><h2>{projection.projection?.floors.find(floor => floor.floorId === `T${selectedFloor}`)?.label ?? selectedProgram?.title}</h2><p>{selectedProgram?.description}</p><button className={styles.clearFloor} onClick={() => selectFloor(null)}>Bỏ chọn tầng</button></>}
          <p className={styles.sourceNote}><a href={`${assetBase}/le-grande-brochure.pdf`} target="_blank" rel="noopener noreferrer">Xem hồ sơ dự án (PDF)</a>.</p>
        </div>
        <div className={styles.programs} aria-label="Công năng theo tầng">{PROGRAMS.map(program => <div className={styles.programRow} key={program.title}>
          <div className={styles.floorChoices}>{program.floors.map(floor => <button key={floor} aria-pressed={selectedFloor === floor} aria-controls="floor-detail" onClick={() => selectFloor(floor)}>Tầng {floor}</button>)}</div>
          <div><h3>{program.title}</h3><p>{program.floors[0] === 1 ? "Shophouse thông tầng 1–2 (duplex)" : program.floors[0] === 3 ? "Dịch vụ và không gian văn phòng" : program.floors[0] === 5 ? "Rạp chiếu phim dự kiến" : "Công năng dự kiến"}</p></div>
        </div>)}</div>
      </div>
      <section className={styles.slotSection} aria-labelledby="slot-heading" data-projection-status={projection.status}>
        <div><h2 id="slot-heading">Mặt bằng theo tầng</h2><p>Tìm không gian phù hợp cho doanh nghiệp của bạn.</p></div>
        <div>{selectedFloor === null ? <p>Chọn tầng để khám phá công năng và mặt bằng.</p> : publicSlots.length === 0 ? <p><Link href={`/mat-bang/#tang-${selectedFloor}`}>Xem sơ đồ và mặt bằng tầng {selectedFloor} <Arrow /></Link></p> : <><div className={styles.slotChoices} aria-label={`Vị trí tầng ${selectedFloor}`}>{publicSlots.map(slot => <button key={slot.slotId} data-slot-id={slot.slotId} aria-controls="slot-detail" aria-pressed={selectedSlot === slot.slotId} onClick={() => selectSlot(slot.slotId)} onFocus={() => actions.current?.selectSlot(slot.slotId)} onBlur={() => actions.current?.selectSlot(selection.current.slot)}>{slot.label}</button>)}</div><div id="slot-detail" className={styles.slotDetail} aria-live="polite">{slotInfo ? <><h3>{slotInfo.label}</h3>{slotInfo.area !== undefined && <p>Diện tích công bố: {slotInfo.area.toLocaleString("vi-VN")} m²</p>}{slotInfo.tenant && <p>Đơn vị được công bố: {slotInfo.tenant}</p>}{slotInfo.availability && <p>Khả dụng dự kiến: {slotInfo.availability}</p>}<a className={styles.textLink} href={emailHref}>Mở email về {slotInfo.slotId} <Arrow /></a></> : <p>Chọn một vị trí để xem thông tin công khai và trao đổi với dự án.</p>}</div></>}</div>
      </section>
      </aside>
    </section>}

    {!immersive && <LayeredScrollStory.Surface backgroundImage={`${assetBase}/model-3d/explore-cover.webp`}><section className={styles.filmSection} id="phim-du-an" aria-labelledby="film-heading">
      <div className={styles.filmIntro}><h2 id="film-heading">Nhìn từ<br />công trình thực.</h2><p>Mặt tiền trắng – xám, nhịp kiến trúc và bối cảnh bên hồ qua phim dự án.</p></div>
      <figure className={styles.film}><video ref={filmVideo} controls muted preload="none" playsInline poster={`${assetBase}/project-film-poster.webp`} aria-label="Phim kiến trúc Le Grande Centre"><source src={`${assetBase}/project-film.mp4`} type="video/mp4" />Trình duyệt không hỗ trợ video. <a href={`${assetBase}/project-film.mp4`}>Mở phim dự án</a>.</video><figcaption>Phim kiến trúc Le Grande Centre.</figcaption></figure>
    </section>

    <section className={styles.contact} id="lien-he" aria-labelledby="contact-heading">
      <div className={styles.contactLead}><h2 id="contact-heading">Cùng tìm không gian<br />cho doanh nghiệp của bạn.</h2><p>Trao đổi trực tiếp với Le Grande Centre để xác nhận công năng, mặt bằng phù hợp và thông tin khai thác hiện tại.</p></div>
      <div className={styles.contactDetails}>
        <a className={styles.phone} href="tel:0973879563">0973 879 563 <Arrow /></a>
        <a className={styles.emailLink} href={emailHref}>Liên hệ qua email{selectedFloor === null ? " trao đổi" : ` về tầng ${selectedFloor}`} <Arrow /></a>
        <p className={styles.emailNote}>ntmcongty@gmail.com</p>
        <address>{ADDRESS}<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS)}`} className={styles.mapLink} target="_blank" rel="noopener noreferrer">Xem vị trí trên bản đồ <Arrow /></a></address>
        <p className={styles.additionalPhones}>Liên hệ khác: <a href="tel:0944634243">0944 634 243</a> · <a href="tel:0931060768">0931 060 768</a></p>
      </div>
    </section>
    </LayeredScrollStory.Surface>}
  </main>;
}

function Arrow() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

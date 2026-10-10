"use client";

import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Link from "next/link";
import { Modal } from "@mall/ui";
import { siteUrl } from "@/config/site";
import type { AreaFilter, LeasingFloor, LeasingOrientation, LeasingUnit, PlanShape } from "./leasing-model";
import { useLeasingExplorer } from "./use-leasing-explorer";
import { LeasingSuggestion } from "./leasing-suggestion";
import planStyles from "./canva-pages.module.css";
import styles from "./leasing-explorer.module.css";

const number = (value: number) => value.toLocaleString("vi-VN");
function planStyle(shape: PlanShape): CSSProperties {
  return { left: shape.x / 10 + "%", top: shape.y / 2.5 + "%", width: shape.width / 10 + "%", height: shape.height / 2.5 + "%", clipPath: shape.polygon };
}
function Arrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>;
}

export function LeasingExplorer({ floors, units: inventory, orientation, sourceDocument, contactEmail }: {
  floors: readonly LeasingFloor[];
  units: readonly LeasingUnit[];
  orientation: LeasingOrientation;
  sourceDocument: string;
  contactEmail: string;
}) {
  const { group, floorGroups, units, visible, selected, type, area, unitTypes, setType, setArea, setSelectedId, chooseFloor, clearFilters, clearSelection } = useLeasingExplorer(floors, inventory);
  const [view, setView] = useState<"map" | "list">("map");
  const portal = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLButtonElement>(null);
  if (!group) return null;
  const visibleIds = new Set(visible.map(unit => unit.id));
  const selectedFloor = floors.find(item => item.id === selected?.floorId);
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  function openUnit(unit: LeasingUnit, event: MouseEvent<HTMLButtonElement>) {
    returnFocus.current = event.currentTarget;
    setSelectedId(unit.id);
  }

  return <>
    <section className={styles.explorer} aria-labelledby="leasing-explorer-heading">
      <h2 id="leasing-explorer-heading" className={styles.srOnly}>Khám phá mặt bằng cho thuê</h2>
      <nav className={styles.floorNav} aria-label="Chọn tầng">
        {floorGroups.map(item => <div className={styles.floorOption} key={item.id}>
          <button id={`tang-${item.id}`} type="button" aria-pressed={group.id === item.id} aria-controls="leasing-floor-content" onClick={() => chooseFloor(item.id)}><strong>{item.title}</strong><span>{item.label}</span></button>
          {item.floors.filter(floor => floor.id !== item.id).map(floor => <span id={`tang-${floor.id}`} key={floor.id} className={styles.floorAnchor} aria-hidden="true"/>)}
        </div>)}
      </nav>
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <label>Loại hình<select aria-label="Lọc loại hình" value={type} onChange={event => setType(event.target.value)}><option value="">Tất cả loại hình</option>{unitTypes.map(value => <option key={value}>{value}</option>)}</select></label>
          <label>Diện tích<select aria-label="Lọc diện tích" value={area} onChange={event => setArea(event.target.value as AreaFilter)}><option value="">Mọi diện tích</option><option value="small">Dưới 100 m²</option><option value="medium">100–150 m²</option><option value="large">Trên 150 m²</option></select></label>
          {(type || area) && <button type="button" className={styles.clearFilters} onClick={clearFilters}>Xóa bộ lọc</button>}
        </div>
        <div className={styles.viewToggle} role="group" aria-label="Kiểu xem mặt bằng">
          <button type="button" aria-label="Xem sơ đồ (Map)" aria-pressed={view === "map"} aria-controls="leasing-floor-content" onClick={() => setView("map")}><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="m2 5 5-2 6 2 5-2v12l-5 2-6-2-5 2zM7 3v12m6-10v12"/></svg>Map</button>
          <button type="button" aria-label="Xem danh sách (List)" aria-pressed={view === "list"} aria-controls="leasing-floor-content" onClick={() => setView("list")}><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true"><path d="M7 4h11M7 10h11M7 16h11M2 4h2M2 10h2M2 16h2"/></svg>List</button>
        </div>
      </div>
      <p className={styles.resultCount} role="status">{group.title} <span>· {visible.length} mặt bằng theo brochure</span></p>
      <div id="leasing-floor-content" data-view={view} className={styles.content}>
        {!visible.length ? <div className={styles.empty}><h3>Không có mặt bằng phù hợp</h3><p>Thử đổi loại hình hoặc diện tích trong {group.title.toLowerCase()}.</p><button type="button" onClick={clearFilters}>Xóa bộ lọc</button></div> : view === "map" ? <div className={styles.maps}>
          {group.floors.map(floor => <article className={styles.planPanel} key={floor.id} aria-label={`Sơ đồ tầng ${floor.id}`}>
            <div className={styles.planHeading}><h3>Tầng {floor.id} <span>· {floor.label}</span></h3><a href={`${assetBase}${sourceDocument}#page=${floor.sourcePage}`} target="_blank" rel="noopener noreferrer">Brochure · trang {floor.sourcePage}<Arrow/></a></div>
            <p className={styles.floorDescription}>{floor.description}</p>
            <div className={`${planStyles.planScroll} ${styles.planScroll}`} tabIndex={0} role="region" aria-label={`Sơ đồ tầng ${floor.id}, cuộn ngang để xem đầy đủ`}>
              <div className={`${planStyles.plan} ${styles.planCanvas}`}>
                {floor.sharedAreas.map((space, index) => <div key={index} className={planStyles.sharedArea} style={planStyle(space)}>{space.label}</div>)}
                {units.filter(unit => unit.floorId === floor.id).map(unit => <button id={`leasing-plan-${unit.id}`} className={planStyles.planSlot} style={planStyle(unit.plan)} key={unit.id} type="button" disabled={!visibleIds.has(unit.id)} aria-pressed={selected?.id === unit.id} aria-haspopup="dialog" aria-label={`${unit.id}, tầng ${unit.floorId}, ${number(unit.area)} mét vuông`} onClick={event => openUnit(unit, event)}>
                  <span className={planStyles.slotLabel} style={unit.plan.labelPosition ? { position: "absolute", left: unit.plan.labelPosition.x + "%", top: unit.plan.labelPosition.y + "%", transform: "translate(-50%, -50%)" } : undefined}><strong>{unit.id}</strong><span>{number(unit.area)} m²</span></span>
                </button>)}
              </div>
            </div>
          </article>)}
        </div> : <ul className={styles.unitList} aria-label="Danh sách mặt bằng">
          {visible.map(unit => <li key={unit.id}><button id={`leasing-list-${unit.id}`} type="button" className={styles.unit} aria-haspopup="dialog" aria-pressed={selected?.id === unit.id} onClick={event => openUnit(unit, event)}><strong>{unit.id}</strong><span className={styles.unitFloor}>Tầng {unit.floorId}</span><span className={styles.unitArea}>{number(unit.area)} m²</span><span className={styles.unitType}>{unit.types.join(" · ") || "Tư vấn công năng"}</span><Arrow/></button></li>)}
        </ul>}
      </div>
      <details className={styles.planNotes}><summary>Hướng và nguồn sơ đồ</summary>
        <dl className={planStyles.orientationFacts} aria-label="Hướng sơ đồ tham khảo"><div><dt>Phía sau</dt><dd>{orientation.rear}</dd></div><div><dt>Mặt tiền · Nguyễn Chí Thanh</dt><dd>{orientation.front}</dd></div><div><dt>Đầu giáp khu hồ</dt><dd>{orientation.lakeSide}</dd></div><div><dt>Đầu giáp nhà máy nước</dt><dd>{orientation.waterworksSide}</dd></div></dl>
        <p>Hướng mặt ngoài tham khảo theo vị trí trên bản đồ và bố trí brochure, không thay thế hướng cửa hoặc tầm nhìn được xác nhận trong hồ sơ kỹ thuật. <a href={orientation.sourceUrl} target="_blank" rel="noopener noreferrer">Đối chiếu trên Google Maps</a>.</p>
      </details>
    </section>
    <div ref={portal} className={styles.popupHost}>
      <Modal title={selected ? `Mặt bằng ${selected.id}` : "Thông tin mặt bằng"} description={selected ? `Tầng ${selected.floorId} · ${selectedFloor?.label}` : "Thông tin theo brochure Le Grande Centre."} closeLabel="Đóng thông tin" open={!!selected} onOpenChange={open => { if (!open) clearSelection(); }} portalContainer={portal} returnFocusRef={returnFocus}>
        {selected && <div id="leasing-unit-preview">
          <dl className={styles.unitFacts}><div><dt>Diện tích brochure</dt><dd className={styles.areaValue}>{number(selected.area)} <span>m²</span></dd></div><div><dt>Loại hình</dt><dd>{selected.types.join(" · ") || "Tư vấn công năng"}</dd></div><div><dt>Hướng mặt ngoài · tham khảo</dt><dd>{selected.orientation}</dd></div>{selected.dimensions && <div><dt>Kích thước brochure</dt><dd>{number(selected.dimensions.width)} × {number(selected.dimensions.depth)} m</dd></div>}</dl>
          {selected.note && <p className={styles.unitNote}>{selected.note}</p>}
          <p className={styles.popupNote}>Thông số tham chiếu brochure, không thể hiện giá hay tình trạng còn trống. Liên hệ để nhận phương án phù hợp.</p>
          <div className={styles.popupActions}><Link href={`/mat-bang/${encodeURIComponent(selected.id)}/`} prefetch={false} className={styles.detailLink}>Xem chi tiết<Arrow/></Link><Link href={{ pathname: "/lien-he/", query: { unit: selected.id } }} className={styles.inquiryLink}>Yêu cầu tư vấn</Link></div>
          <a className={styles.emailLink} href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Tư vấn mặt bằng ${selected.id}, tầng ${selected.floorId} — Le Grande Centre`)}`}>Trao đổi qua email</a>
        </div>}
      </Modal>
    </div>
    <LeasingSuggestion unitId={selected?.id}/>
  </>;
}

"use client";

import { useRef, type CSSProperties } from "react";
import Link from "next/link";
import { siteUrl } from "@/config/site";
import type { AreaFilter, LeasingFloor, LeasingUnit, PlanShape } from "./leasing-model";
import { useLeasingExplorer } from "./use-leasing-explorer";
import styles from "./canva-pages.module.css";

const number = (value: number) => value.toLocaleString("vi-VN");
function planStyle(shape: PlanShape): CSSProperties {
  return { left: shape.x / 10 + "%", top: shape.y / 2.5 + "%", width: shape.width / 10 + "%", height: shape.height / 2.5 + "%", clipPath: shape.polygon };
}

export function LeasingExplorer({ floors, units: inventory, sourceDocument, contactEmail, initialSelectedId }: {
  floors: readonly LeasingFloor[];
  units: readonly LeasingUnit[];
  sourceDocument: string;
  contactEmail: string;
  initialSelectedId?: string;
}) {
  const { floor, units, visible, selected, type, area, unitTypes, setType, setArea, setSelectedId, chooseFloor, clearFilters } = useLeasingExplorer(floors, inventory, initialSelectedId);
  const detail = useRef<HTMLDivElement>(null);
  if (!floor) return null;
  const visibleIds = new Set(visible.map(unit => unit.id));
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  function choose(id: string) {
    setSelectedId(id);
    document.getElementById("leasing-plan-" + id)?.firstElementChild?.scrollIntoView({ block: "nearest", inline: "nearest" });
    detail.current?.scrollIntoView({ block: "nearest" });
  }
  return <section className={styles.section} aria-labelledby="leasing-explorer-heading">
    <h2 id="leasing-explorer-heading">Khám phá theo<br/><em>từng lớp không gian.</em></h2>
    <p className={styles.notice}>Chọn tầng, diện tích và loại hình kinh doanh để tìm không gian phù hợp với nhu cầu của bạn.</p>
    <nav className={styles.floorNav} aria-label="Chọn tầng">{floors.map(item => <button id={"tang-" + item.id} key={item.id} type="button" aria-pressed={floor.id === item.id} aria-controls="leasing-floor-content" onClick={() => chooseFloor(item.id)}><strong>Tầng {item.id}</strong><span>{item.label}</span></button>)}</nav>
    <div id="leasing-floor-content" aria-live="polite">
      <p>{floor.description}</p>
      {!units.length ? <div className={styles.empty}><h3>Tầng {floor.id} · {floor.label}</h3><p>Liên hệ để nhận sơ đồ và thông tin mặt bằng tầng {floor.id}.</p><Link href="/lien-he/" className={styles.primary}>Nhận tư vấn tầng {floor.id}</Link></div> : <div className={styles.workspace}>
        <div className={styles.planPanel}><h3>Tầng {floor.id} · {floor.label}</h3><p>Chọn một ô trên sơ đồ để xem chi tiết. Cuộn ngang để xem toàn bộ mặt bằng.</p>
          <div className={styles.planScroll} tabIndex={0} aria-label={"Sơ đồ bố trí tầng " + floor.id + " theo brochure, cuộn ngang để xem đầy đủ"}><div className={styles.plan}>
            {floor.sharedAreas.map((space, index) => <div key={index} className={styles.sharedArea} style={planStyle(space)}>{space.label}</div>)}
            {units.map(unit => <button id={"leasing-plan-" + unit.id} className={styles.planSlot} style={planStyle(unit.plan)} key={unit.id} type="button" disabled={!visibleIds.has(unit.id)} aria-pressed={selected?.id === unit.id} aria-controls="leasing-unit-preview" aria-label={unit.id + ", " + number(unit.area) + " mét vuông"} onClick={() => choose(unit.id)}>
              <span className={styles.slotLabel} style={unit.plan.labelPosition ? { position: "absolute", left: unit.plan.labelPosition.x + "%", top: unit.plan.labelPosition.y + "%", transform: "translate(-50%, -50%)" } : undefined}><strong>{unit.id}</strong><span>{number(unit.area)} m²</span></span>
            </button>)}
          </div></div>
          <a className={styles.sourceLink} href={assetBase + sourceDocument + "#page=" + floor.sourcePage} target="_blank" rel="noopener noreferrer">Xem hồ sơ mặt bằng</a>
          <div ref={detail} id="leasing-unit-preview" className={styles.detail} aria-live="polite">{selected ? <><h3>{selected.id} · Tầng {floor.id}</h3><p>{number(selected.area)} m² · {selected.types.join(" · ") || "Tư vấn công năng"}</p>
            {selected.dimensions && <p>Kích thước: {number(selected.dimensions.width)} × {number(selected.dimensions.depth)} m.</p>}
            {selected.note && <p>{selected.note}</p>}<p>Liên hệ để nhận thông tin cho thuê và phương án phù hợp.</p><a href={"mailto:" + contactEmail + "?subject=" + encodeURIComponent("Tư vấn mặt bằng " + selected.id + ", tầng " + floor.id + " — Le Grande Centre")}>Trao đổi về mặt bằng {selected.id}</a></> : <><h3>Chưa có mặt bằng phù hợp bộ lọc</h3><p>Thử đổi diện tích hoặc loại hình để xem lại các ô trên sơ đồ.</p></>}</div>
        </div>
        <aside className={styles.results} aria-label="Danh sách mặt bằng"><h3>Tầng {floor.id} · {visible.length} ô mặt bằng</h3>
          <div className={styles.filters}><label>Loại hình<select value={type} onChange={event => setType(event.target.value)}><option value="">Tất cả loại hình</option>{unitTypes.map(value => <option key={value}>{value}</option>)}</select></label><label>Diện tích<select value={area} onChange={event => setArea(event.target.value as AreaFilter)}><option value="">Mọi diện tích</option><option value="small">Dưới 100 m²</option><option value="medium">100–150 m²</option><option value="large">Trên 150 m²</option></select></label></div>
          <div className={styles.unitList}>{visible.map(unit => <button type="button" className={styles.unit} key={unit.id} aria-pressed={selected?.id === unit.id} aria-controls="leasing-unit-preview" onClick={() => choose(unit.id)}><strong>{unit.id}</strong><span>{number(unit.area)} m²</span><small>{unit.types.join(" · ") || "Tư vấn công năng"}</small></button>)}</div>
          {!visible.length && <div className={styles.empty}><p>Không có ô mặt bằng phù hợp.</p><button type="button" onClick={clearFilters}>Xóa bộ lọc</button></div>}
        </aside>
      </div>}
    </div>
  </section>;
}

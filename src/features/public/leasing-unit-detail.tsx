import Link from "next/link";
import { Breadcrumbs } from "@mall/ui";
import { r2AssetBase } from "@/config/site";
import { BROCHURE_ORIENTATION, BROCHURE_PATH, BROCHURE_UNITS } from "./brochure-leasing";
import { getShophousePair, type LeasingFloor, type LeasingUnit } from "./leasing-model";
import { planStyle, planLabelStyle } from "./leasing-plan-style";
import { WebsiteEmailLink, WebsiteFloorDescription, WebsiteFloorTitle, WebsiteLeasingPhones } from "./website-settings";
import planStyles from "./canva-pages.module.css";
import { LeasingUnitGallery } from "./leasing-unit-gallery";
import { LeasingUnitMap } from "./leasing-unit-map";
import styles from "./leasing-unit-detail.module.css";
import { LeasingAvailabilityBadge } from "./leasing-availability-badge";
import { LeasingConsultation } from "./leasing-consultation";

const number = (value: number) => value.toLocaleString("vi-VN");

export function LeasingUnitDetail({ unit, floor, floorUnits }: { unit: LeasingUnit; floor: LeasingFloor; floorUnits: readonly LeasingUnit[] }) {
  const assetBase = r2AssetBase;
  const backHref = `/mat-bang/#tang-${floor.id}`;
  const detailHref = `/mat-bang/${encodeURIComponent(unit.id)}/`;
  const orderedUnits = floorUnits.filter(item => item.floorId === floor.id).sort((a, b) => a.id.localeCompare(b.id, "vi", { numeric: true }));
  const unitIndex = orderedUnits.findIndex(item => item.id === unit.id);
  const previous = unitIndex > 0 ? orderedUnits[unitIndex - 1] : undefined;
  const next = unitIndex >= 0 ? orderedUnits[unitIndex + 1] : undefined;
  const others = orderedUnits.filter(item => item.id !== unit.id);
  const pair = getShophousePair(unit, BROCHURE_UNITS);
  const counterpart = pair?.find(item => item.id !== unit.id);
  return <div className={styles.page} data-ui-theme="shopping-mall" data-ui-scheme="light">
    <div className={styles.breadcrumb}><Breadcrumbs label="Vị trí mặt bằng" items={[
      { label: "Trang chủ", href: `${assetBase}/` },
      { label: "Mặt bằng/Cho thuê", href: `${assetBase}/mat-bang/` },
      { label: `Tầng ${floor.id}`, href: assetBase + backHref },
      { label: unit.id, href: assetBase + detailHref, current: true },
    ]}/></div>
    <LeasingUnitMap key={unit.id} unitId={unit.id} floorId={floor.id}>
      <div className={styles.planSection}>
      <dl className={`${planStyles.orientationFacts} ${styles.orientation}`} aria-label="Hướng sơ đồ tham khảo">
        <div><dt>Phía sau</dt><dd>{BROCHURE_ORIENTATION.rear}</dd></div><div><dt>Mặt tiền · Nguyễn Chí Thanh</dt><dd>{BROCHURE_ORIENTATION.front}</dd></div>
        <div><dt>Đầu giáp khu hồ</dt><dd>{BROCHURE_ORIENTATION.lakeSide}</dd></div><div><dt>Đầu giáp nhà máy nước</dt><dd>{BROCHURE_ORIENTATION.waterworksSide}</dd></div>
      </dl>
      <div className={`${planStyles.planScroll} ${styles.planScroll}`} tabIndex={0} role="region" aria-label={`Sơ đồ tầng ${floor.id}, mặt bằng ${unit.id} đang xem, sơ đồ toàn tầng`}>
        <div className={`${planStyles.plan} ${styles.planCanvas}`}>
          {floor.sharedAreas.map((space, index) => <div key={index} className={`${planStyles.sharedArea} ${styles.planShared}`} style={planStyle(space)}>{space.label}</div>)}
          {floorUnits.map(item => <Link className={`${planStyles.planSlot} ${styles.planUnit}`} key={item.id} href={`/mat-bang/${encodeURIComponent(item.id)}/`} style={planStyle(item.plan)} aria-current={item.id === unit.id ? "page" : undefined} aria-label={`${item.id}, ${number(item.area)} mét vuông${item.id === unit.id ? ", đang xem" : ""}`}>
            <span className={planStyles.slotLabel} style={planLabelStyle(item.plan)}><strong>{item.id}</strong><span>{number(item.area)} m²</span></span>
          </Link>)}
        </div>
      </div>
      <p className={styles.sourceNote}>Sơ đồ tái hiện bố trí trong brochure, không phải bản vẽ khảo sát hay phương án hoàn thiện nội thất. Diện tích giữ nguyên số liệu được in, không tính lại từ kích thước. Hướng mặt ngoài chỉ là tham khảo theo vị trí và bố trí, không xác nhận hướng cửa hoặc tầm nhìn. <a href={BROCHURE_ORIENTATION.sourceUrl} target="_blank" rel="noopener noreferrer">Đối chiếu vị trí trên Google Maps</a>.</p>
      </div>
    </LeasingUnitMap>
    <nav className={styles.unitNavigation} aria-label={`Mặt bằng trước và tiếp theo trong tầng ${floor.id}`}>
      {previous ? <Link className={styles.previousUnit} href={`/mat-bang/${encodeURIComponent(previous.id)}/`} aria-label={`Mặt bằng trước: ${previous.id}, tầng ${floor.id}`} rel="prev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg><span><small>Căn trước</small><strong>{previous.id}</strong></span></Link> : <span className={styles.previousUnit} aria-disabled="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg><span>Căn đầu tầng</span></span>}
      {next ? <Link className={styles.nextUnit} href={`/mat-bang/${encodeURIComponent(next.id)}/`} aria-label={`Mặt bằng tiếp theo: ${next.id}, tầng ${floor.id}`} rel="next"><span><small>Căn tiếp</small><strong>{next.id}</strong></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 6 6 6-6 6M4 12h12"/></svg></Link> : <span className={styles.nextUnit} aria-disabled="true"><span>Căn cuối tầng</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 6 6 6-6 6M4 12h12"/></svg></span>}
    </nav>
    <section className={styles.intro} aria-labelledby="unit-title">
      <LeasingUnitGallery key={unit.id} assetBase={assetBase} floorId={floor.id} unitId={unit.id}/>
      <div className={styles.unitOverview}>
        <p className={styles.subtitle}>Tầng {floor.id} · <WebsiteFloorTitle floor={floor.id}/></p>
        <LeasingAvailabilityBadge availability={unit.availability}/>
        <h1 id="unit-title" className={styles.unitTitle}>Mặt bằng <em>{unit.id}</em></h1>
        <p className={styles.unitType}>{unit.types.join(" · ") || "Liên hệ tư vấn công năng"}</p>
        <dl className={styles.facts}>
          <div><dt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M7 7h10v10H7z"/></svg>{pair ? `Diện tích tầng ${floor.id} · ${unit.id}` : "Diện tích brochure"}</dt><dd>{number(unit.area)} m²</dd></div>
          <div><dt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 16 12-12 4 4L8 20zM13 7l2 2m-5 1 2 2m-5 1 2 2"/></svg>Kích thước brochure</dt><dd>{unit.dimensions ? `${number(unit.dimensions.width)} × ${number(unit.dimensions.depth)} m` : "Chưa có kích thước cạnh đầy đủ"}</dd></div>
          <div><dt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4z"/></svg>Hướng tham khảo</dt><dd>{unit.orientation}</dd></div>
        </dl>
        <p><WebsiteFloorDescription floor={floor.id}/></p>
        {pair && counterpart && <section className={styles.linkedPair} aria-labelledby="linked-pair-title">
          <h2 id="linked-pair-title" className={styles.pairTitle}>Shophouse liên kết {pair[0].id} / {pair[1].id}</h2>
          <p>Có thể thuê riêng từng căn hoặc kết hợp hai tầng.</p>
          <dl className={styles.pairAreas}>
            {pair.map(item => <div key={item.id}><dt>Tầng {item.floorId} · {item.id}{item.id === unit.id ? " · đang xem" : ""}</dt><dd>{number(item.area)} m²</dd></div>)}
            <div><dt>Tổng hai tầng</dt><dd>{number(pair[0].area + pair[1].area)} m²</dd></div>
          </dl>
          <p className={styles.pairSource}>Diện tích từng căn theo brochure; tổng là cộng diện tích hai tầng, không phải diện tích riêng của {unit.id}.</p>
          <Link className={styles.textLink} href={`/mat-bang/${encodeURIComponent(counterpart.id)}/`}>Xem {counterpart.id} · chuyển sang tầng {counterpart.floorId}</Link>
          <div className={styles.pairPlans}>{pair.map(item => <Link key={item.id} className={styles.textLink} href={`/mat-bang/#tang-${item.floorId}`}>Sơ đồ tầng {item.floorId}</Link>)}</div>
        </section>}
        <div className={styles.unitActions}>
          <LeasingConsultation unit={unit} pair={pair} className={styles.primaryAction}/>
          <Link className={styles.secondaryAction} href={{ pathname: "/lien-he/", query: { unit: unit.id, intent: "visit" } }}>Đăng ký tham quan thực tế <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/></svg></Link>
          <a className={styles.secondaryAction} href={`${assetBase}${BROCHURE_PATH}#page=${floor.sourcePage}`} target="_blank" rel="noopener noreferrer">Xem brochure · trang {floor.sourcePage} (PDF)</a>
        </div>
        <Link className={styles.textLink} href={backHref}>Trở lại sơ đồ tầng {floor.id}</Link>
      </div>
    </section>
    <section className={styles.consultation} aria-labelledby="unit-consultation-title">
      <div><h2 id="unit-consultation-title">Trao đổi về<br/><em>mặt bằng {unit.id}.</em></h2>{unit.note && <p>{unit.note}</p>}<p>Thông tin mặt bằng lấy theo brochure; trạng thái hiển thị là mô phỏng, không xác nhận tình trạng thuê thực tế. Liên hệ đội ngũ cho thuê để xác nhận thông tin và nhu cầu.</p></div>
      <div className={styles.contactActions}><WebsiteEmailLink className={styles.textLink} subject={`Tư vấn mặt bằng ${unit.id}, tầng ${floor.id} — Le Grande Centre`} body={`Tôi quan tâm mặt bằng ${unit.id}, tầng ${floor.id}, diện tích ${number(unit.area)} m² theo brochure. Vui lòng tư vấn thông tin cho thuê và phương án phù hợp.`}>Trao đổi qua email</WebsiteEmailLink><WebsiteLeasingPhones className={styles.textLink} prefix="Gọi "/></div>
    </section>
    <section className={styles.otherUnits} aria-labelledby="other-units-title">
      <div className={styles.sectionHead}><h2 id="other-units-title">Các mặt bằng khác trong tầng {floor.id}.</h2><Link className={styles.textLink} href={backHref}>Khám phá toàn bộ tầng {floor.id}</Link></div>
      {others.length ? <ul>{others.map(item => <li key={item.id}><Link href={`/mat-bang/${encodeURIComponent(item.id)}/`}><strong>{item.id}</strong><span>{number(item.area)} m²</span><small>{item.types.join(" · ") || "Tư vấn công năng"}</small></Link></li>)}</ul> : <p>Không có mặt bằng khác được giới thiệu trong brochure ở tầng này.</p>}
    </section>
  </div>;
}

import Link from "next/link";
import { Breadcrumbs } from "@mall/ui";
import { siteUrl } from "@/config/site";
import { BROCHURE_ORIENTATION, BROCHURE_PATH } from "./brochure-leasing";
import type { LeasingFloor, LeasingUnit } from "./leasing-model";
import { planStyle, planLabelStyle } from "./leasing-plan-style";
import { EMAIL, LEASING_PHONES } from "./site-content";
import planStyles from "./canva-pages.module.css";
import { LeasingUnitGallery } from "./leasing-unit-gallery";
import { LeasingUnitMap } from "./leasing-unit-map";
import styles from "./leasing-unit-detail.module.css";

const number = (value: number) => value.toLocaleString("vi-VN");

export function LeasingUnitDetail({ unit, floor, floorUnits }: { unit: LeasingUnit; floor: LeasingFloor; floorUnits: readonly LeasingUnit[] }) {
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  const backHref = `/mat-bang/?unit=${encodeURIComponent(unit.id)}#tang-${floor.id}`;
  const detailHref = `/mat-bang/${encodeURIComponent(unit.id)}/`;
  const mailHref = `mailto:${EMAIL}?subject=${encodeURIComponent(`Tư vấn mặt bằng ${unit.id}, tầng ${floor.id} — Le Grande Centre`)}&body=${encodeURIComponent(`Tôi quan tâm mặt bằng ${unit.id}, tầng ${floor.id}, diện tích ${number(unit.area)} m² theo brochure. Vui lòng tư vấn thông tin cho thuê và phương án phù hợp.`)}`;
  const others = floorUnits.filter(item => item.id !== unit.id);
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
      <div className={`${planStyles.planScroll} ${styles.planScroll}`} tabIndex={0} role="region" aria-label={`Sơ đồ tầng ${floor.id}, mặt bằng ${unit.id} đang xem, cuộn ngang để xem đầy đủ`}>
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
    <section className={styles.intro} aria-labelledby="unit-title">
      <LeasingUnitGallery key={unit.id} assetBase={assetBase} floorId={floor.id} unitId={unit.id}/>
      <div className={styles.unitOverview}>
        <p className={styles.subtitle}>Tầng {floor.id} · {floor.label}</p>
        <h1 id="unit-title" className={styles.unitTitle}>Mặt bằng <em>{unit.id}</em></h1>
        <p className={styles.unitType}>{unit.types.join(" · ") || "Liên hệ tư vấn công năng"}</p>
        <dl className={styles.facts}>
          <div><dt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M7 7h10v10H7z"/></svg>Diện tích brochure</dt><dd>{number(unit.area)} m²</dd></div>
          <div><dt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 16 12-12 4 4L8 20zM13 7l2 2m-5 1 2 2m-5 1 2 2"/></svg>Kích thước brochure</dt><dd>{unit.dimensions ? `${number(unit.dimensions.width)} × ${number(unit.dimensions.depth)} m` : "Chưa có kích thước cạnh đầy đủ"}</dd></div>
          <div><dt><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4z"/></svg>Hướng tham khảo</dt><dd>{unit.orientation}</dd></div>
        </dl>
        <p>{floor.description}</p>
        <div className={styles.unitActions}>
          <Link className={styles.primaryAction} href={{ pathname: "/lien-he/", query: { unit: unit.id } }}>Yêu cầu tư vấn <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></Link>
          <Link className={styles.secondaryAction} href={{ pathname: "/lien-he/", query: { unit: unit.id, intent: "visit" } }}>Đặt lịch xem mặt bằng <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/></svg></Link>
          <a className={styles.secondaryAction} href={`${assetBase}${BROCHURE_PATH}#page=${floor.sourcePage}`} target="_blank" rel="noopener noreferrer">Xem brochure · trang {floor.sourcePage} (PDF)</a>
        </div>
        <Link className={styles.textLink} href={backHref}>Trở lại sơ đồ tầng {floor.id}</Link>
      </div>
    </section>
    <section className={styles.consultation} aria-labelledby="unit-consultation-title">
      <div><h2 id="unit-consultation-title">Trao đổi về<br/><em>mặt bằng {unit.id}.</em></h2>{unit.note && <p>{unit.note}</p>}<p>Thông tin trên là giới thiệu theo brochure, không xác nhận tình trạng còn trống, giá thuê hoặc phương án bàn giao. Liên hệ đội ngũ cho thuê để xác nhận thông tin và nhu cầu thực tế.</p></div>
      <div className={styles.contactActions}><a className={styles.textLink} href={mailHref}>Trao đổi qua email</a>{LEASING_PHONES.map(phone => <a key={phone.href} className={styles.textLink} href={phone.href}>Gọi {phone.label}</a>)}</div>
    </section>
    <section className={styles.otherUnits} aria-labelledby="other-units-title">
      <div className={styles.sectionHead}><h2 id="other-units-title">Các mặt bằng khác trong tầng {floor.id}.</h2><Link className={styles.textLink} href={backHref}>Khám phá toàn bộ tầng {floor.id}</Link></div>
      {others.length ? <ul>{others.map(item => <li key={item.id}><Link href={`/mat-bang/${encodeURIComponent(item.id)}/`}><strong>{item.id}</strong><span>{number(item.area)} m²</span><small>{item.types.join(" · ") || "Tư vấn công năng"}</small></Link></li>)}</ul> : <p>Không có mặt bằng khác được giới thiệu trong brochure ở tầng này.</p>}
    </section>
  </div>;
}

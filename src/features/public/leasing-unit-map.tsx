"use client";

import { useRef, useState } from "react";
import { Button, Modal } from "@mall/ui";
import { useMotionVisibility } from "@mall/ui/motion";
import Link from "next/link";
import { BROCHURE_ORIENTATION } from "./brochure-leasing";
import type { LeasingFloor, LeasingUnit } from "./leasing-model";
import { planStyle, planLabelStyle } from "./leasing-plan-style";
import planStyles from "./canva-pages.module.css";
import styles from "./leasing-unit-detail.module.css";

export function LeasingUnitMap({ unitId, floor, units }: {
  unitId: string;
  floor: Pick<LeasingFloor, "id" | "sharedAreas">;
  units: readonly Pick<LeasingUnit, "id" | "area" | "plan">[];
}) {
  const floorId = floor.id;
  const portal = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useMotionVisibility(trigger, !open);
  return <div ref={portal} className={styles.mapControl} data-open={open || undefined}>
    <Button ref={trigger} variant="primary" effect="attention" aria-label={`Sơ đồ tầng ${floorId} (Map)`} title={`Sơ đồ tầng ${floorId} · ${unitId}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16"/></svg></Button>
    <Modal title={`Vị trí mặt bằng ${unitId} · Tầng ${floorId}`} description={`Mặt bằng ${unitId} được tô đậm trên sơ đồ tầng ${floorId}.`} closeLabel="Đóng sơ đồ" open={open} onOpenChange={setOpen} portalContainer={portal} returnFocusRef={trigger}>
      {open && <div className={styles.planSection}>
        <dl className={`${planStyles.orientationFacts} ${styles.orientation}`} aria-label="Hướng sơ đồ tham khảo">
          <div><dt>Phía sau</dt><dd>{BROCHURE_ORIENTATION.rear}</dd></div><div><dt>Mặt tiền · Nguyễn Chí Thanh</dt><dd>{BROCHURE_ORIENTATION.front}</dd></div>
          <div><dt>Đầu giáp khu hồ</dt><dd>{BROCHURE_ORIENTATION.lakeSide}</dd></div><div><dt>Đầu giáp nhà máy nước</dt><dd>{BROCHURE_ORIENTATION.waterworksSide}</dd></div>
        </dl>
        <div className={`${planStyles.planScroll} ${styles.planScroll}`} tabIndex={0} role="region" aria-label={`Sơ đồ tầng ${floorId}, mặt bằng ${unitId} đang xem, sơ đồ toàn tầng`}>
          <div className={`${planStyles.plan} ${styles.planCanvas}`}>
            {floor.sharedAreas.map((space, index) => <div key={index} className={`${planStyles.sharedArea} ${styles.planShared}`} style={planStyle(space)}>{space.label}</div>)}
            {units.map(item => <Link className={`${planStyles.planSlot} ${styles.planUnit}`} key={item.id} href={`/mat-bang/${encodeURIComponent(item.id)}/`} prefetch={false} style={planStyle(item.plan)} aria-current={item.id === unitId ? "page" : undefined} aria-label={`${item.id}, ${item.area.toLocaleString("vi-VN")} mét vuông${item.id === unitId ? ", đang xem" : ""}`}>
              <span className={planStyles.slotLabel} style={planLabelStyle(item.plan)}><strong>{item.id}</strong><span>{item.area.toLocaleString("vi-VN")} m²</span></span>
            </Link>)}
          </div>
        </div>
        <p className={styles.sourceNote}>Sơ đồ tái hiện bố trí trong brochure, không phải bản vẽ khảo sát hay phương án hoàn thiện nội thất. Diện tích giữ nguyên số liệu được in, không tính lại từ kích thước. Hướng mặt ngoài chỉ là tham khảo theo vị trí và bố trí, không xác nhận hướng cửa hoặc tầm nhìn. <a href={BROCHURE_ORIENTATION.sourceUrl} target="_blank" rel="noopener noreferrer">Đối chiếu vị trí trên Google Maps</a>.</p>
      </div>}
    </Modal>
  </div>;
}

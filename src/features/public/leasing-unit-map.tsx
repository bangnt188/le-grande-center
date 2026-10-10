"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Modal } from "@mall/ui";
import styles from "./leasing-unit-detail.module.css";

export function LeasingUnitMap({ unitId, floorId, children }: { unitId: string; floorId: number; children: ReactNode }) {
  const portal = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const node = portal.current!;
    const update = () => { node.dataset.live = String(!document.hidden); };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return <div ref={portal} className={styles.mapControl} data-open={open || undefined}>
    <Button ref={trigger} variant="primary" aria-label="Vị trí trong tầng" title="Vị trí trong tầng" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16"/></svg></Button>
    <Modal title={`Vị trí mặt bằng ${unitId} · Tầng ${floorId}`} description={`Mặt bằng ${unitId} được tô đậm trên sơ đồ tầng ${floorId}.`} closeLabel="Đóng sơ đồ" open={open} onOpenChange={setOpen} portalContainer={portal} returnFocusRef={trigger}>
      {children}
    </Modal>
  </div>;
}

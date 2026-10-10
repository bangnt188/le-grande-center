"use client";

import { useMemo, useRef, useState, type MouseEvent } from "react";
import { Button, ImagePreview } from "@mall/ui";
import styles from "./leasing-unit-detail.module.css";

const sharedPhotos = [
  { path: "/images/le-grande-aerial-context.webp", label: "Công trình và vòng xoay Tượng đài 3 Cô Gái" },
  { path: "/images/le-grande-aerial-close.webp", label: "Công trình và không gian xanh phía sau" },
  { path: "/images/home-v2/architecture-detail.jpg", label: "Chi tiết kiến trúc dự án" },
  { path: "/images/home-v2/introduction.webp", label: "Phối cảnh Le Grande Centre" },
];
const shophousePhotos = [{ path: "/images/home-v2/facade-detail.jpg", label: "Phối cảnh mặt tiền thương mại" }, ...sharedPhotos];
const upperPhotos = [{ path: "/images/home-v2/upper-detail.jpg", label: "Phối cảnh không gian tầng trên" }, ...sharedPhotos];

export function LeasingUnitGallery({ assetBase, floorId, unitId }: { assetBase: string; floorId: number; unitId: string }) {
  const photos = floorId <= 2 ? shophousePhotos : upperPhotos;
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);
  const current = photos[selected];
  const move = (step: number) => setSelected(index => (index + step + photos.length) % photos.length);
  const images = useMemo(() => photos.map(photo => ({ src: assetBase + photo.path, alt: photo.label })), [assetBase, photos]);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const openPreview = (event: MouseEvent<HTMLElement>) => { returnFocusRef.current = event.currentTarget; setOpen(true); };

  return <div className={styles.gallery} role="region" aria-label={`Ảnh dự án tham khảo cho mặt bằng ${unitId}`} onKeyDown={event => {
    if (open || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    move(event.key === "ArrowRight" ? 1 : -1);
  }}>
    <div className={styles.photoStage}>
      <button type="button" className={styles.photoOpenButton} aria-label={`Mở ảnh: ${current.label}`} onClick={openPreview}><img src={assetBase + current.path} alt={current.label} width="900" height="600" decoding="async"/></button>
      <span className={styles.photoSource}>Ảnh dự án</span>
      <div className={styles.photoActions}><Button variant="secondary" onClick={openPreview}>Xem tất cả ảnh</Button></div>
      <Button variant="secondary" className={`${styles.photoArrow} ${styles.previousPhoto}`} aria-label="Ảnh trước" onClick={() => move(-1)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></Button>
      <Button variant="secondary" className={`${styles.photoArrow} ${styles.nextPhoto}`} aria-label="Ảnh tiếp theo" onClick={() => move(1)}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m10 6 6 6-6 6"/></svg></Button>
    </div>
    <div className={styles.thumbnails} role="group" aria-label="Chọn ảnh dự án">{photos.map((photo, index) => <button type="button" key={photo.path} aria-label={`Ảnh ${index + 1}: ${photo.label}`} aria-pressed={selected === index} onClick={() => setSelected(index)}>
      <img src={assetBase + photo.path} alt="" width="120" height="90" loading="lazy" decoding="async"/>
    </button>)}</div>
    <p className={styles.photoCaption} aria-live="polite" aria-atomic="true">{selected + 1} / {photos.length} · {current.label}</p>
    <ImagePreview mode="modal" images={images} title={`Ảnh dự án · ${unitId}`} description="Ảnh dự án hiện có dùng thử bố cục, chưa phải ảnh bàn giao riêng của từng mặt bằng." index={selected} onIndexChange={setSelected} open={open} onOpenChange={setOpen} returnFocusRef={returnFocusRef}/>
  </div>;
}

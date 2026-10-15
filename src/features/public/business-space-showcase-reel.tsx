"use client";

import { useMemo } from "react";
import { ShowcaseReelGallery, type ShowcaseReelAssetMap, type ShowcaseReelMediaItem } from "@mall/ui";
import styles from "./business-space-showcase-reel.module.css";

// Reuse the project's published R2 photographs so the reel never falls back to demo placeholders.
const MOSAIC_MEDIA: readonly ShowcaseReelMediaItem[] = [
  { id: "retail", src: "retail.webp", title: "Không gian thương mại", tag: "Le Grande · Khối đế", alt: "Không gian bán lẻ tại Le Grande Centre" },
  { id: "market", src: "market.webp", title: "Nhịp sống mua sắm", tag: "Le Grande · Thương mại", alt: "Không gian kinh doanh và mua sắm" },
  { id: "hero", src: "hero.webp", title: "Điểm đến bên hồ", tag: "Le Grande · Toàn cảnh", alt: "Phối cảnh tổng thể công trình Le Grande Centre" },
  { id: "office", src: "office.webp", title: "Môi trường làm việc", tag: "Le Grande · Văn phòng", alt: "Không gian văn phòng tại công trình" },
  { id: "services", src: "services.webp", title: "Dịch vụ đa dạng", tag: "Le Grande · Dịch vụ", alt: "Không gian dịch vụ thương mại" },
  { id: "upper", src: "upper-detail.jpg", title: "Không gian tầng cao", tag: "Le Grande · Kiến trúc", alt: "Chi tiết kiến trúc tại khu vực tầng cao" },
  { id: "entertainment", src: "entertainment.webp", title: "Giải trí & trải nghiệm", tag: "Le Grande · Tiện ích", alt: "Không gian giải trí dự kiến tại công trình" },
  { id: "cafe", src: "cafe.webp", title: "Kết nối cộng đồng", tag: "Le Grande · F&B", alt: "Không gian cà phê và dịch vụ" },
  { id: "architecture", src: "architecture-detail.jpg", title: "Chi tiết kiến trúc", tag: "Le Grande · Thiết kế", alt: "Chi tiết kiến trúc thương mại" },
  { id: "facade", src: "facade-detail.jpg", title: "Dấu ấn mặt đứng", tag: "Le Grande · Kiến trúc", alt: "Chi tiết mặt đứng công trình" },
];

export function BusinessSpaceShowcaseReel({ assetBase }: { assetBase: string }) {
  const assetMap = useMemo<ShowcaseReelAssetMap>(() => {
    const media = MOSAIC_MEDIA.map(({ src, title, tag, alt }) => ({
      src: `${assetBase}/images/home-v2/${src}`,
      title, tag, alt,
    }));
    return {
      A01: media[0], A02: media[1],
      A03: { ...media[2], sequence: [media[2]!.src, media[7]!.src, media[6]!.src, media[3]!.src] },
      A04: media[8], A05: media[9], A06: media[3], A07: media[4],
      A08: media[6], A09: media[7], A10: media[1], A10_TOP: media[1],
      A11: media[9], A12: media[5], A13: media[3], A14: media[7],
      A15: media[8], A16: media[0], A17: media[4], A18: media[6], A19: media[2],
      B01: media[2], B02: media[0], B03: media[3],
      B04: media[6], B05: media[7], B06: media[9],
    };
  }, [assetBase]);
  return (
    <div className={styles.section} aria-labelledby="business-reel-heading">
      <div className={styles.heading}>
        <div>
          <p className={styles.kicker}>LE GRANDE CENTRE / GÓC NHÌN KIẾN TRÚC</p>
          <h2 id="business-reel-heading">Không gian mở ra <em>muôn trải nghiệm.</em></h2>
        </div>
      </div>
      <ShowcaseReelGallery
        label="Thư viện hình ảnh không gian kinh doanh Le Grande Centre"
        mode="scroll"
        assetMap={assetMap}
        scrollDistanceVh={600}
        minimumScrollDuration={10}
        showControls={false}
        showCaptions
      />
      <p className={styles.disclaimer}>Hình ảnh minh họa trải nghiệm và định hướng không gian; công năng thực tế theo hồ sơ dự án.</p>
    </div>
  );
}

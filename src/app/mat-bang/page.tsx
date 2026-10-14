import { publicPageMetadata } from "@/features/public/seo-metadata";
import { PublicPageLayout } from "@/features/public/public-page-layout";
import { r2AssetBase } from "@/config/site";
import { LeasingExplorer } from "@/features/public/leasing-explorer";
import styles from "@/features/public/leasing-hero.module.css";
import { BROCHURE_ORIENTATION, BROCHURE_PATH } from "@/features/public/brochure-leasing";
import { readPublicLeasing } from "@/server/public-leasing";
import Link from "next/link";
import directoryStyles from "@/features/public/leasing-explorer.module.css";

export const metadata = publicPageMetadata(
  "Mặt bằng cho thuê tại Le Grande Centre | Sóc Trăng",
  "Tra cứu mặt bằng shophouse, dịch vụ và văn phòng tại Le Grande Centre, Sóc Trăng. Xem sơ đồ tầng, diện tích brochure và liên hệ tư vấn.",
  "mat-bang/",
);
export default async function SpacesPage() {
  const { floors, units } = await readPublicLeasing();
  const assetBase = r2AssetBase;
  return <PublicPageLayout active="/mat-bang/" variant="project">
    <section className={styles.hero} aria-labelledby="leasing-title">
      <img className={styles.image} src={`${assetBase}/images/leasing-hero.webp`} alt="" width={785} height={442} fetchPriority="high" decoding="async"/>
      <div className={styles.content}>
        <p className={styles.label}>KHÁM PHÁ MẶT BẰNG</p>
        <h1 id="leasing-title" className={styles.title}>Mặt bằng<br/>cho thuê</h1>
        <p className={styles.description}>Chọn một tầng để bắt đầu, hoặc lọc theo loại hình và diện tích bạn cần.</p>
      </div>
    </section>
    <LeasingExplorer floors={floors} units={units} orientation={BROCHURE_ORIENTATION} sourceDocument={BROCHURE_PATH}/>
    <details className={directoryStyles.unitDirectory}>
      <summary>Danh sách mặt bằng theo tầng</summary>
      {floors.map(floor => <section key={floor.id} aria-labelledby={`directory-floor-${floor.id}`}>
        <h2 id={`directory-floor-${floor.id}`}>Mặt bằng tầng {floor.id}</h2>
        <ul>{units.filter(unit => unit.floorId === floor.id).map(unit => <li key={unit.id}>
          <Link href={`/mat-bang/${encodeURIComponent(unit.id)}/`}>Mặt bằng {unit.id} · Tầng {unit.floorId} · {unit.area.toLocaleString("vi-VN")} m²</Link>
        </li>)}</ul>
      </section>)}
    </details>
  </PublicPageLayout>;
}

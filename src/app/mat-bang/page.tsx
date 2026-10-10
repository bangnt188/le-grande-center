import { PublicPageLayout } from "@/features/public/public-page-layout";
import { siteUrl } from "@/config/site";
import { LeasingExplorer } from "@/features/public/leasing-explorer";
import styles from "@/features/public/leasing-hero.module.css";
import { BROCHURE_FLOORS, BROCHURE_ORIENTATION, BROCHURE_PATH, BROCHURE_UNITS } from "@/features/public/brochure-leasing";
import { EMAIL } from "@/features/public/site-content";

export const metadata = { title: "Mặt bằng / Cho thuê" };
export default function SpacesPage() {
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");
  return <PublicPageLayout active="/mat-bang/" variant="project">
    <section className={styles.hero} aria-labelledby="leasing-title">
      <img className={styles.image} src={`${assetBase}/images/leasing-hero.webp`} alt="" width={785} height={442} fetchPriority="high" decoding="async"/>
      <div className={styles.content}>
        <p className={styles.label}>KHÁM PHÁ MẶT BẰNG</p>
        <h1 id="leasing-title" className={styles.title}>Mặt bằng<br/>cho thuê</h1>
        <p className={styles.description}>Chọn một tầng để bắt đầu, hoặc lọc theo loại hình và diện tích bạn cần.</p>
      </div>
    </section>
    <LeasingExplorer floors={BROCHURE_FLOORS} units={BROCHURE_UNITS} orientation={BROCHURE_ORIENTATION} sourceDocument={BROCHURE_PATH} contactEmail={EMAIL}/>
  </PublicPageLayout>;
}

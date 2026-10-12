import Link from "next/link";
import { siteUrl } from "@/config/site";
import { SitePage } from "@/features/public/site-page";
import { BusinessSpaceScrollStory } from "@/features/public/business-space-scroll-story";
import styles from "@/features/public/site-shell.module.css";

export const metadata = { title: "Tổng quan từng tầng" };

export default function FloorsPage() {
  const assetBase = new URL(siteUrl).pathname.replace(/\/+$/, "");

  return <SitePage active="/tong-quan-tang/" title="Sáu tầng. Nhiều cơ hội kinh doanh.">
    <p className={styles.intro}>Khám phá sáu tầng thương mại, dịch vụ và giải trí. Tìm không gian phù hợp cho thương hiệu của bạn.</p>
    <BusinessSpaceScrollStory assetBase={assetBase} />
    <Link href="/kham-pha/" prefetch={false} className={styles.primary}>Khám phá công trình 3D</Link>
  </SitePage>;
}

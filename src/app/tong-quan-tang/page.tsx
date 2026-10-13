import { r2AssetBase } from "@/config/site";
import { publicPageMetadata } from "@/features/public/seo-metadata";
import { SitePage } from "@/features/public/site-page";
import { BusinessSpaceScrollStory } from "@/features/public/business-space-scroll-story";
import styles from "@/features/public/site-shell.module.css";

export const metadata = publicPageMetadata(
  "Không gian kinh doanh 6 tầng | Le Grande Centre",
  "Tìm hiểu sáu tầng thương mại, shophouse, dịch vụ, văn phòng và giải trí tại Le Grande Centre, Sóc Trăng.",
  "tong-quan-tang/",
);

export default function FloorsPage() {
  const assetBase = r2AssetBase;

  return <SitePage active="/tong-quan-tang/" title="Sáu tầng. Nhiều cơ hội kinh doanh.">
    <p className={styles.intro}>Khám phá sáu tầng thương mại, dịch vụ và giải trí. Tìm không gian phù hợp cho thương hiệu của bạn.</p>
    <BusinessSpaceScrollStory assetBase={assetBase} />
  </SitePage>;
}

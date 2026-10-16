import { LoadingIndicator } from "@mall/ui";
import { PublicPageLayout } from "@/features/public/public-page-layout";
import styles from "@/features/public/leasing-unit-detail.module.css";

export default function LoadingSpaces() {
  return <PublicPageLayout active="/mat-bang/" variant="project" className={styles.frame} colorScheme="light">
    <div className={styles.loadingState}><LoadingIndicator label="Đang tải thông tin mặt bằng…"/></div>
  </PublicPageLayout>;
}

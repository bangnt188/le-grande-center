import { PublicPageLayout } from "@/features/public/public-page-layout";
import { ProjectHero } from "@/features/public/project-sections";
import { LeasingExplorer } from "@/features/public/leasing-explorer";
import { PROJECT_IMAGES } from "@/features/public/canva-content";
import { BROCHURE_FLOORS, BROCHURE_ORIENTATION, BROCHURE_PATH, BROCHURE_UNITS } from "@/features/public/brochure-leasing";
import { EMAIL } from "@/features/public/site-content";

export const metadata = { title: "Mặt bằng / Cho thuê" };
export default function SpacesPage() {
  return <PublicPageLayout active="/mat-bang/" variant="project">
    <ProjectHero title={<>Mặt bằng<br/><em>cho thuê.</em></>} description="Chọn một tầng để bắt đầu, hoặc lọc theo loại hình và diện tích bạn cần." image={PROJECT_IMAGES.facade}/>
    <LeasingExplorer floors={BROCHURE_FLOORS} units={BROCHURE_UNITS} orientation={BROCHURE_ORIENTATION} sourceDocument={BROCHURE_PATH} contactEmail={EMAIL} initialSelectedId="A.1"/>
  </PublicPageLayout>;
}

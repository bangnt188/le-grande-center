import { PublicPageLayout } from "@/features/public/public-page-layout";
import { LeasingSuggestion } from "@/features/public/leasing-suggestion";
import { ProjectHero, ProjectOverview } from "@/features/public/project-sections";
import { InvestorLetter } from "@/features/public/investor-letter";
import { ProjectDocuments } from "@/features/public/project-documents";
import { PROJECT_DOCUMENTS, LETTER_BACKGROUND_PATH, INVESTOR_LETTER } from "@/features/public/legacy-content";
import { ABOUT_INTRO, ABOUT_OVERVIEW, PROJECT_IMAGES } from "@/features/public/canva-content";

export const metadata = { title: "Về Le Grande Centre" };
export default function OverviewPage() {
  return <PublicPageLayout active="/tong-quan/" variant="project">
    <ProjectHero title={<>Le Grande<br/><em>Centre.</em></>} description={ABOUT_INTRO} image={PROJECT_IMAGES.perspective}/>
    <ProjectOverview paragraphs={ABOUT_OVERVIEW}/>
    <InvestorLetter paragraphs={INVESTOR_LETTER} backgroundPath={LETTER_BACKGROUND_PATH}/>
    <ProjectDocuments groups={PROJECT_DOCUMENTS}/>
    <LeasingSuggestion/>
  </PublicPageLayout>;
}

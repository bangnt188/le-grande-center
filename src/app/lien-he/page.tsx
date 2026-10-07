import { PublicPageLayout } from "@/features/public/public-page-layout";
import { ProjectContact } from "@/features/public/project-contact";

export const metadata = { title: "Liên hệ" };
export default function ContactPage() {
  return <PublicPageLayout active="/lien-he/" variant="project"><ProjectContact/></PublicPageLayout>;
}

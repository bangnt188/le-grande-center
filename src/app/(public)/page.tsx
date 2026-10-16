import { publicPageMetadata } from "@/features/public/seo-metadata";
import { WebsiteStructuredData } from "@/features/public/seo-structured-data";
import HomePageV2 from "@/features/public/homepage-v2";

export const metadata = publicPageMetadata(
  "Le Grande Centre | Trung tâm thương mại tại Sóc Trăng",
  "Khám phá Le Grande Centre tại Sóc Trăng: shophouse, mặt bằng thương mại, dịch vụ và văn phòng trên sáu tầng.",
  "",
);

export default function HomePage() {
  return <><WebsiteStructuredData/><HomePageV2/></>;
}

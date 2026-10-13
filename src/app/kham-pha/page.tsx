import ModelViewer from "../model-3d/viewer";
import { r2AssetBase } from "@/config/site";
import { publicPageMetadata } from "@/features/public/seo-metadata";

export const metadata = publicPageMetadata(
  "Khám phá kiến trúc 3D | Le Grande Centre",
  "Xoay xem mô hình kiến trúc Le Grande Centre và khám phá sáu tầng công năng thương mại, dịch vụ, văn phòng và giải trí.",
  "kham-pha/",
);

export default function ExplorePage() {
  return <ModelViewer immersive showAdminLink={false} assetBase={r2AssetBase} />;
}

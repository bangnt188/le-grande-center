import ModelViewer from "@/app/model-3d/viewer";
import { SiteFooter } from "./site-footer";
import { r2AssetBase } from "@/config/site";

// Archived composition. The homepage route imports only homepage-v2.
export default function HomePageV1() {
  return <>
    <ModelViewer
      assetBase={r2AssetBase}
      showAdminLink={false}
    />
    <SiteFooter />
  </>;
}

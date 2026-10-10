import ModelViewer from "@/app/model-3d/viewer";
import { SiteFooter } from "./site-footer";
import { siteUrl } from "@/config/site";

// Archived composition. The homepage route imports only homepage-v2.
export default function HomePageV1() {
  return <>
    <ModelViewer
      assetBase={new URL(siteUrl).pathname.replace(/\/+$/, "")}
      showAdminLink={false}
    />
    <SiteFooter />
  </>;
}

import ModelViewer from "./model-3d/viewer";
import { SiteFooter } from "@/features/public/site-footer";
import { siteUrl } from "@/config/site";

export default function HomePage() {
  return <>
    <ModelViewer
      assetBase={new URL(siteUrl).pathname.replace(/\/+$/, "")}
      showAdminLink={false}
    />
    <SiteFooter />
  </>;
}

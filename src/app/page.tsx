import ModelViewer from "./model-3d/viewer";
import { siteUrl } from "@/config/site";

export default function HomePage() {
  return <ModelViewer
    assetBase={new URL(siteUrl).pathname.replace(/\/+$/, "")}
    showAdminLink={process.env.NEXT_PUBLIC_ADMIN_DEMO === "true"}
  />;
}

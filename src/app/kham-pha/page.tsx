import ModelViewer from "../model-3d/viewer";
import { siteUrl } from "@/config/site";

export const metadata = { title: "Khám phá 3D | Le Grande Centre" };

export default function ExplorePage() {
  return <ModelViewer immersive showAdminLink={false} assetBase={new URL(siteUrl).pathname.replace(/\/+$/, "")} />;
}

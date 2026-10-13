import catalog from "./project-media.json";
import type { AdminSnapshot, MediaItem } from "../../../shared/admin/contracts";
import { formatStorageBytes } from "../../../shared/admin/storage-policy";
import { PROJECT_FILM_URL } from "../../public/site-content";

import { neonMediaUrl, r2AssetUrl } from "../../../config/site";
const ids: Record<string, string> = { "/admin-demo/floor-plan.png": "plan-reference", "/admin-demo/contract-sample.pdf": "contract-sample-pdf", "/le-grande-brochure.pdf": "sample-brochure" };
export function projectMedia(): MediaItem[] {
  const media: MediaItem[] = catalog.map(item => ({
    id: ids[item.path] ?? "project:" + item.path, name: item.name, kind: item.kind as MediaItem["kind"],
    mimeType: item.mimeType, sizeBytes: item.sizeBytes, size: formatStorageBytes(item.sizeBytes),
    sourcePath: item.path, projectAsset: true, hasUploadedFile: false,
    scope: item.path === "/admin-demo/floor-plan.png" ? "Chưa xác nhận tầng" : item.path === "/admin-demo/contract-sample.pdf" ? "lease:HD-2026-004" : "Toàn dự án",
    reference: item.path === "/admin-demo/floor-plan.png", url: ["/admin-demo/logo-without-text.webp", "/client-reference/legacy/logo-without-text.png", "/client-reference/legacy/icon.png"].includes(item.path) ? neonMediaUrl(item.path) : r2AssetUrl(item.path),
  }));
  media.push({ id: "project:homepage-video", name: "video-homepage.mp4", kind: "Video", scope: "Toàn dự án", mimeType: "video/mp4", size: "Chưa có số liệu từ R2", sourcePath: PROJECT_FILM_URL, url: PROJECT_FILM_URL, projectAsset: true, hasUploadedFile: false });
  return media;
}
/** Refresh only shipped assets, preserving uploaded files and their associations. */
export function synchronizeProjectMedia(snapshot: AdminSnapshot): boolean {
  const assets = projectMedia();
  const current = snapshot.media.filter(item => item.projectAsset || item.id === "plan-reference" || item.id === "sample-brochure" || item.id === "sample-plan" || item.id === "contract-sample-pdf");
  if (JSON.stringify(current) === JSON.stringify(assets)) return false;
  const retired: Record<string, true> = { "plan-reference": true, "sample-plan": true, "sample-brochure": true, "contract-sample-pdf": true };
  snapshot.media = [...assets, ...snapshot.media.filter(item => !item.projectAsset && !retired[item.id])];
  return true;
}

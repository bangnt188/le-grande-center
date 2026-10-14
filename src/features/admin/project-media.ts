import catalog from "./project-media.json";
import type { MediaItem } from "../../shared/admin/contracts";
import { formatStorageBytes } from "../../shared/admin/storage-policy";
import { PROJECT_FILM_URL } from "../public/site-content";
import { r2AssetUrl } from "../../config/site";

export function projectMedia(): MediaItem[] {
  const media: MediaItem[] = catalog.map(item => ({
    id: "project:" + item.path, name: item.name, kind: item.kind as MediaItem["kind"],
    mimeType: item.mimeType, sizeBytes: item.sizeBytes, size: formatStorageBytes(item.sizeBytes),
    sourcePath: item.path, scope: "Toàn dự án", url: r2AssetUrl(item.path),
    projectAsset: true, hasUploadedFile: false,
  }));
  media.push({ id: "project:homepage-video", name: "video-homepage.mp4", kind: "Video", scope: "Toàn dự án", mimeType: "video/mp4", size: "Chưa có số liệu từ R2", sourcePath: PROJECT_FILM_URL, url: PROJECT_FILM_URL, projectAsset: true, hasUploadedFile: false });
  return media;
}

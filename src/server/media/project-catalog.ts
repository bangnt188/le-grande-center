import "server-only";
import catalog from "../../features/admin/project-media.json";
import imageData from "../../features/public/responsive-image-data.json";
import type { MediaItem } from "../../shared/admin/contracts";
import { formatStorageBytes } from "../../shared/admin/storage-policy";
import { PROJECT_FILM_URL } from "../../features/public/site-content";
import { r2AssetUrl } from "../../config/site";
const derivatives: Record<string, { thumbnails: { path: string; width: number }[] }> = imageData;
export function projectMedia(): MediaItem[] {
  const items: MediaItem[] = catalog.map(item => {
    const thumbnails = derivatives[item.path]?.thumbnails;
    const thumbnail = thumbnails?.find(variant => variant.width >= 192) ?? thumbnails?.[thumbnails.length - 1];
    return { id: "project:" + item.path, name: item.name, kind: item.kind as MediaItem["kind"], mimeType: item.mimeType, sizeBytes: item.sizeBytes, size: formatStorageBytes(item.sizeBytes), sourcePath: item.path, scope: "Toàn dự án", url: r2AssetUrl(item.path), thumbnailUrl: thumbnail ? r2AssetUrl(thumbnail.path) : undefined, projectAsset: true, hasUploadedFile: false, canDelete: false, protectedReason: "Tài nguyên dự án chỉ được xem." };
  });
  items.push({ id: "project:homepage-video", name: "video-homepage.mp4", kind: "Video", scope: "Toàn dự án", mimeType: "video/mp4", size: "Chưa có số liệu từ R2", sourcePath: PROJECT_FILM_URL, url: PROJECT_FILM_URL, projectAsset: true, hasUploadedFile: false, canDelete: false, protectedReason: "Tài nguyên dự án chỉ được xem." });
  return items.sort((a, b) => (a.sourcePath ?? a.id).localeCompare(b.sourcePath ?? b.id) || a.id.localeCompare(b.id));
}

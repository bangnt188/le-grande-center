const defaultSiteUrl = "https://legrandecentre.vn/";
const configuredUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl);

if (
  (configuredUrl.protocol !== "https:" && configuredUrl.hostname !== "localhost") ||
  configuredUrl.search ||
  configuredUrl.hash ||
  configuredUrl.username ||
  configuredUrl.password
) {
  throw new Error("NEXT_PUBLIC_SITE_URL must be an HTTPS URL without query, fragment or credentials.");
}

export const siteUrl = `${configuredUrl.origin}${configuredUrl.pathname.replace(/\/+$/, "")}/`;
export const isIndexable = process.env.SEO_INDEXABLE === "true";
export const r2AssetBase = (process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "https://pub-d9ed63c9208840ee87c1595f4a1077de.r2.dev").replace(/\/+$/, "");
export const neonMediaBase = (process.env.NEXT_PUBLIC_NEON_MEDIA_BASE_URL ?? "https://br-tiny-butterfly-b3uuw92p.storage.c-4.ap-southeast-1.aws.neon.tech/media").replace(/\/+$/, "");
export const r2AssetUrl = (path: string) => r2AssetBase + "/" + path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
export const neonMediaUrl = (path: string) => neonMediaBase + "/" + path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");

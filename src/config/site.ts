import { deploymentTarget } from "./deployment";

const target = deploymentTarget();
const defaultSiteUrl = "https://bangnt188.github.io/le-grande-center/";
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

if (target === "server") {
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    throw new Error("Server deployment requires NEXT_PUBLIC_SITE_URL set to an absolute HTTPS site URL.");
  }
  if (configuredUrl.pathname !== "/") {
    throw new Error("Server deployment requires a root domain URL without the GitHub Pages base path.");
  }
}

export const siteUrl = `${configuredUrl.origin}${configuredUrl.pathname.replace(/\/+$/, "")}/`;
export const isIndexable = target === "server" && process.env.SEO_INDEXABLE === "true";

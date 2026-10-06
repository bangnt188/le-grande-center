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

export const siteUrl = `${configuredUrl.origin}${configuredUrl.pathname.replace(/\/+$/, "")}/`;
export const isIndexable = process.env.SEO_INDEXABLE === "true";

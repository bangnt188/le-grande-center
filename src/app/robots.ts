import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/config/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(isIndexable ? { sitemap: `${siteUrl}sitemap.xml` } : {}),
  };
}

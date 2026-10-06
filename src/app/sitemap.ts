import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/config/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexable) return [];
  return [{ url: siteUrl, changeFrequency: "monthly", priority: 1 }];
}

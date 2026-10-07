import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/config/site";
import { PUBLIC_NAVIGATION } from "@/features/public/site-content";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexable) return [];
  return PUBLIC_NAVIGATION.map(item => ({ url: new URL(item.href.replace(/^\//, ""), siteUrl).href, changeFrequency: "monthly", priority: item.href === "/" ? 1 : 0.7 }));
}

import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/config/site";
import { PUBLIC_NAVIGATION } from "@/features/public/site-content";
import { BROCHURE_UNITS } from "@/features/public/brochure-leasing";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isIndexable) return [];
  return [
    ...PUBLIC_NAVIGATION.map(item => ({ url: new URL(item.href.replace(/^\//, ""), siteUrl).href, changeFrequency: "monthly" as const, priority: item.href === "/" ? 1 : 0.7 })),
    ...BROCHURE_UNITS.map(unit => ({ url: new URL(`mat-bang/${encodeURIComponent(unit.id)}/`, siteUrl).href, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}

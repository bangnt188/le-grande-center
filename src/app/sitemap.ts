import type { MetadataRoute } from "next";
import { isIndexable, siteUrl } from "@/config/site";
import { PUBLIC_NAVIGATION } from "@/features/public/site-content";
import { readPublicLeasing } from "@/server/public-leasing";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexable) return [];
  const { units } = await readPublicLeasing();
  return [
    ...PUBLIC_NAVIGATION.map(item => ({ url: new URL(item.href.replace(/^\//, ""), siteUrl).href, changeFrequency: "monthly" as const, priority: item.href === "/" ? 1 : 0.7 })),
    ...units.map(unit => ({ url: new URL(`mat-bang/${encodeURIComponent(unit.id)}/`, siteUrl).href, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}

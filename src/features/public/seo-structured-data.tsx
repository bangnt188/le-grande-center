import { siteUrl } from "@/config/site";
import { JsonLd } from "./json-ld";

export function WebsiteStructuredData() {
  return <JsonLd data={{
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Le Grande Centre",
    url: siteUrl,
    inLanguage: "vi-VN",
  }} />;
}

export function LeasingBreadcrumbStructuredData({ unitId, floorId }: { unitId: string; floorId: number }) {
  const items = [
    { name: "Trang chủ", path: "" },
    { name: "Mặt bằng cho thuê", path: "mat-bang/" },
    { name: `Tầng ${floorId}`, path: `mat-bang/#tang-${floorId}` },
    { name: `Mặt bằng ${unitId}`, path: `mat-bang/${encodeURIComponent(unitId)}/` },
  ];
  return <JsonLd data={{
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.path, siteUrl).href,
    })),
  }} />;
}

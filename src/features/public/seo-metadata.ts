import type { Metadata } from "next";
import { r2AssetUrl, siteUrl } from "@/config/site";

const shareImage = r2AssetUrl("images/home-v2/hero.webp");

export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  const url = new URL(path.replace(/^\/+/, ""), siteUrl).href;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Le Grande Centre",
      locale: "vi_VN",
      type: "website",
      images: [{ url: shareImage, width: 1842, height: 854, alt: "Le Grande Centre — không gian thương mại tại Sóc Trăng" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: shareImage, alt: "Le Grande Centre — không gian thương mại tại Sóc Trăng" }],
    },
  };
}

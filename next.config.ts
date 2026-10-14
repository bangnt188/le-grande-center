import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://legrandecentre.vn/",
);
const basePath = siteUrl.pathname.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@mall/ui"],
  serverExternalPackages: ["@cf-wasm/photon"],
  output: "standalone",
  distDir: process.env.NODE_ENV === "development" ? process.env.NEXT_DIST_DIR || ".next" : ".next",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

if (process.env.NODE_ENV === "development") initOpenNextCloudflareForDev();
export default nextConfig;

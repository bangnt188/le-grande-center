import type { NextConfig } from "next";

const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bangnt188.github.io/le-grande-center/",
);
const basePath = siteUrl.pathname.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@mall/ui"],
  output: "export",
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;

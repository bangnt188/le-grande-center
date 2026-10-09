import type { NextConfig } from "next";
import { deploymentTarget } from "./src/config/deployment";
import { siteUrl } from "./src/config/site";

const target = deploymentTarget();
const basePath = new URL(siteUrl).pathname.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  transpilePackages: ["@mall/ui"],
  ...(target === "demo" ? { output: "export" as const } : {}),
  basePath: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;

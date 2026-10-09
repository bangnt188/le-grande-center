// A single build contract for GitHub Pages customer demo and Vercel server.
// Default to demo so existing local development and GitHub Pages remain unchanged.
export type DeploymentTarget = "demo" | "server";

export function deploymentTarget(env: NodeJS.ProcessEnv = process.env): DeploymentTarget {
  const target = env.DEPLOY_TARGET || "demo";
  if (target !== "demo" && target !== "server") {
    throw new Error("DEPLOY_TARGET must be demo or server.");
  }
  if (env.VERCEL_ENV === "production" && target !== "server") {
    throw new Error("Vercel production requires DEPLOY_TARGET=server.");
  }
  if (target === "server" && (env.NEXT_PUBLIC_ADMIN_DEMO === "true" || env.INCLUDE_ADMIN_DEMO === "true")) {
    throw new Error("Server deployment must not enable the fixture-only admin demo.");
  }
  return target;
}

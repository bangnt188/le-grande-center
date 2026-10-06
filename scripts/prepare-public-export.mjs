import { rmSync } from "node:fs";
import { resolve } from "node:path";

// An explicit opt-in publishes fixture-only UI on the dev Pages site.
// Real administration remains a separately authenticated backend deployment.
if (process.env.INCLUDE_ADMIN_DEMO !== "true") {
  rmSync(resolve("out", "admin-preview"), { recursive: true, force: true });
  rmSync(resolve("out", "admin-demo"), { recursive: true, force: true });
} else if (process.env.NEXT_PUBLIC_ADMIN_DEMO !== "true" || process.env.NEXT_PUBLIC_ADMIN_API_URL) {
  throw new Error("Public admin demo requires explicit demo mode and no backend API.");
}

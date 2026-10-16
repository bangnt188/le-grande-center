import { createHash } from "node:crypto";
import { parsePublicWebsite } from "../src/shared/public/parse-website.ts";

/**
 * Build from the public projection, never database/authentication credentials.
 * @param {Record<string, string | undefined>} env
 */
export async function publicBuildEnv(env = process.env) {
  let projection;
  if (env.LE_GRANDE_BUILD_PUBLIC_WEBSITE) {
    projection = parsePublicWebsite(JSON.parse(env.LE_GRANDE_BUILD_PUBLIC_WEBSITE));
  } else {
    const origin = new URL(env.PUBLIC_BUILD_ORIGIN ?? "https://le-grande-centre-stage2.nguyenbang-skyone.workers.dev/");
    if ((origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname))) || origin.username || origin.password || origin.search || origin.hash) {
      throw new Error("PUBLIC_BUILD_ORIGIN must be HTTPS (or loopback HTTP), without credentials/query/hash.");
    }
    const response = await fetch(new URL("api/public/website/", origin.href.replace(/\/?$/, "/")), {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Public prerender data request failed (${response.status}).`);
    projection = parsePublicWebsite(await response.json());
    console.log(`Public prerender projection: ${projection.floors.length} floors, ${projection.units.length} units; no private data.`);
  }
  const snapshot = JSON.stringify(projection);
  return {
    ...env,
    LE_GRANDE_BUILD_PUBLIC_WEBSITE: snapshot,
    LE_GRANDE_BUILD_PUBLIC_WEBSITE_KEY: createHash("sha256").update(snapshot).digest("hex"),
  };
}

import { cp, access } from "node:fs/promises";
import { join } from "node:path";

const buildDir = ".next";
const standalone = join(buildDir, "standalone");
await access(join(standalone, "server.js"));
// Next traces server dependencies but intentionally omits browser/static assets.
// Copy only these public directories; never env files or cloud credentials.
await cp("public", join(standalone, "public"), { recursive: true });
await cp(join(buildDir, "static"), join(standalone, buildDir, "static"), { recursive: true });
console.log("Standalone browser assets prepared.");

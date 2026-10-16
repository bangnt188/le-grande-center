import { existsSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { publicBuildEnv } from "./public-build-env.mjs";

const buildEnv = await publicBuildEnv();

// OpenNext embeds standard .env files in its Worker bundle. Runtime credentials
// belong to Wrangler secrets, never to a portable build artifact.
const hidden = mkdtempSync(join(tmpdir(), "le-grande-build-env-"));
const files = [".env", ".env.local", ".env.production", ".env.production.local", ".env.development", ".env.development.local", ".env.test", ".env.test.local"];
const moved = [];
let result;
try {
  for (const file of files) {
    const source = resolve(file);
    if (!existsSync(source)) continue;
    const destination = join(hidden, file);
    renameSync(source, destination);
    moved.push([source, destination]);
  }
  result = spawnSync("npm", ["exec", "--", "opennextjs-cloudflare", "build"], { stdio: "inherit", env: buildEnv });
  if (result.error) throw result.error;
} finally {
  for (const [source, destination] of moved) renameSync(destination, source);
  rmSync(hidden, { recursive: true });
}
process.exitCode = result.status ?? 1;

import { spawnSync } from "node:child_process";

// Delegates to npm so prebuild, build and postbuild hooks keep working.
const target = process.argv[2];
if (target !== "demo" && target !== "server") {
  throw new Error("Usage: node scripts/build-target.mjs demo|server");
}
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "build"], {
  env: { ...process.env, DEPLOY_TARGET: target },
  stdio: "inherit",
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

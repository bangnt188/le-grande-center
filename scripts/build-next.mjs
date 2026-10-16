import { spawnSync } from "node:child_process";
import { publicBuildEnv } from "./public-build-env.mjs";

const result = spawnSync("npm", ["exec", "--", "next", "build"], {
  stdio: "inherit", env: await publicBuildEnv(),
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

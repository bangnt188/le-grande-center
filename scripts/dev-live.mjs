import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// Load explicit env files without --env-file in execArgv: Next forwards execArgv
// to its dev child through NODE_OPTIONS, where Node rejects that flag.
const args = process.argv.slice(2);
const nextArgs = [];
for (let index = 0; index < args.length; index++) {
  if (args[index] === "--env") {
    const path = args[++index];
    if (!path || path.startsWith("--")) throw new Error("--env requires an env file path");
    Object.assign(process.env, parseEnv(readFileSync(path, "utf8")));
  } else nextArgs.push(args[index]);
}
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", ...nextArgs], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });

import "./load-local-env.mjs";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

// Spawn without --env-file in execArgv: Next forwards execArgv to its dev child
// through NODE_OPTIONS, where Node rejects that flag.
const nextArgs = process.argv.slice(2);
const require = createRequire(import.meta.url);
const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", ...nextArgs], { stdio: "inherit", env: process.env });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });

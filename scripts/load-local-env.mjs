import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// CLI-only preload: explicit local values must override stale shell credentials.
// Never import this module from app/config code or the OpenNext build.
Object.assign(process.env, parseEnv(readFileSync(new URL("../.env.local", import.meta.url), "utf8")));

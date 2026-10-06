import { rmSync } from "node:fs";
import { resolve } from "node:path";

// The admin preview is a public, static design prototype. Keep it out of the
// deployable site artifact so it cannot be mistaken for a secured admin app.
rmSync(resolve("out", "admin-preview"), { recursive: true, force: true });
rmSync(resolve("out", "admin-demo"), { recursive: true, force: true });

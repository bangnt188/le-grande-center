import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Publish only public fixtures. Backend administration has its own deployment.
const root = process.cwd();
const repository = "https://github.com/bangnt188/le-grande-center.git";
function run(command, args, cwd = root, env = process.env, capture = false) {
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
  return capture ? result.stdout.trim() : "";
}
const git = (...args) => run("git", args, root, process.env, true);
if (git("branch", "--show-current") !== "dev") throw new Error("Publish from dev only.");
if (git("status", "--porcelain")) throw new Error("Commit source changes before publishing.");
if (git("remote", "get-url", "origin") !== repository) throw new Error("Unexpected origin repository.");
if (process.env.NEXT_PUBLIC_ADMIN_API_URL) throw new Error("Public demo cannot connect a backend API.");
const sourceCommit = git("rev-parse", "HEAD");
const remoteCommit = git("ls-remote", "origin", "refs/heads/dev").split(/\s+/)[0];
if (sourceCommit !== remoteCommit) throw new Error("Push dev before publishing its artifact.");
const name = git("config", "user.name");
const email = git("config", "user.email");
const env = { ...process.env, NEXT_PUBLIC_SITE_URL: "https://bangnt188.github.io/le-grande-center/",
  NEXT_PUBLIC_ADMIN_DEMO: "true", INCLUDE_ADMIN_DEMO: "true", SEO_INDEXABLE: "false" };
run("npm", ["run", "typecheck"]);
run("npm", ["run", "test:admin"]);
run("npm", ["run", "build"], root, env);
for (const file of ["index.html", "admin-preview/index.html", "admin-demo/floor-plan.png", "admin-demo/logo-without-text.webp"]) {
  if (!existsSync(resolve("out", file))) throw new Error(`Missing artifact: ${file}`);
}
const folder = mkdtempSync(join(tmpdir(), "legrande-pages-"));
try {
  const publish = (...args) => run("git", args, folder);
  publish("init", "--initial-branch=gh-pages");
  publish("config", "user.name", name);
  publish("config", "user.email", email);
  publish("remote", "add", "origin", repository);
  if (git("ls-remote", "origin", "refs/heads/gh-pages")) {
    publish("fetch", "--depth=1", "origin", "gh-pages");
    publish("reset", "--soft", "FETCH_HEAD");
  }
  // This directory was freshly created above; remove only copied artifact data.
  for (const file of readdirSync(folder)) {
    if (file !== ".git") rmSync(join(folder, file), { recursive: true });
  }
  cpSync(resolve("out"), folder, { recursive: true });
  writeFileSync(join(folder, ".nojekyll"), "");
  writeFileSync(join(folder, "deployment.json"), JSON.stringify({ sourceBranch: "dev", sourceCommit }, null, 2) + "\n");
  publish("add", "--all");
  publish("commit", "--allow-empty", "-m", `Deploy dev ${sourceCommit.slice(0, 7)}`);
  publish("push", "origin", "HEAD:gh-pages");
} finally {
  rmSync(folder, { recursive: true });
}

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
const r2Base = process.env.R2_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ?? "https://pub-d9ed63c9208840ee87c1595f4a1077de.r2.dev";
const neonBase = process.env.NEXT_PUBLIC_NEON_MEDIA_BASE_URL ?? "https://br-tiny-butterfly-b3uuw92p.storage.c-4.ap-southeast-1.aws.neon.tech/media";
const pagesBase = process.env.GITHUB_PAGES_BASE_URL ?? "https://bangnt188.github.io/le-grande-centre/";
const env = { ...process.env, NEXT_PUBLIC_SITE_URL: pagesBase, R2_PUBLIC_BASE_URL: r2Base,
  NEXT_PUBLIC_R2_PUBLIC_BASE_URL: r2Base, NEXT_PUBLIC_NEON_MEDIA_BASE_URL: neonBase,
  NEXT_PUBLIC_ADMIN_DEMO: "true", INCLUDE_ADMIN_DEMO: "true", SEO_INDEXABLE: "false" };
run("npm", ["run", "typecheck"]);
run("npm", ["run", "test:admin"]);
run("npm", ["run", "build"], root, env);
for (const file of ["index.html", "admin-preview/index.html"]) {
  if (!existsSync(resolve("out", file))) throw new Error("Missing artifact: " + file);
}
for (const url of [r2Base + "/admin-demo/floor-plan.png", neonBase + "/admin-demo/logo-without-text.webp"]) {
  const response = await fetch(url, { method: "HEAD" });
  if (!response.ok) throw new Error("Missing public storage asset: " + url);
}
const folder = mkdtempSync(join(tmpdir(), "legrande-pages-"));
try {
  const publish = (...args) => run("git", args, folder);
  publish("init", "--initial-branch=gh-pages");
  publish("config", "user.name", name);
  publish("config", "user.email", email);
  // Use the active GitHub CLI account rather than another macOS keychain account.
  // The helper returns credentials directly to Git; no token enters the artifact.
  publish("config", "credential.helper", "");
  publish("config", "--add", "credential.helper", "!gh auth git-credential");
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

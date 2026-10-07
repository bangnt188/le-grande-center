import { spawnSync } from "node:child_process";

function run(args, { capture = false } = {}) {
  const result = spawnSync("git", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed (${result.status}).`);
  }
  return capture ? result.stdout.trim() : "";
}

const ghAuth = spawnSync("gh", ["auth", "status"], { stdio: "ignore" });
const gitCredentialArgs = ghAuth.status === 0
  ? ["-c", "credential.helper=", "-c", "credential.helper=!gh auth git-credential"]
  : [];

if (!run(["rev-parse", "--show-toplevel"], { capture: true })) {
  throw new Error("Run npm run pull from the application repository.");
}

run([
  "submodule",
  "foreach",
  "--recursive",
  'git diff --quiet && git diff --cached --quiet && test -z "$(git ls-files --others --exclude-standard)" || { echo "Commit or stash submodule changes before pulling." >&2; exit 1; }',
]);
run(["submodule", "sync", "--recursive"]);
run([
  ...gitCredentialArgs,
  "submodule",
  "update",
  "--init",
  "--recursive",
  "--remote",
  "--merge",
]);
run(["submodule", "status", "--recursive"]);

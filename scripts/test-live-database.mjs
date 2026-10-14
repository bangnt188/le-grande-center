import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createHash, randomUUID } from "node:crypto";
import { Pool } from "@neondatabase/serverless";
import { migrateDatabase, importApprovedLogo } from "./migrate-database.ts";
import { neonMediaUrl } from "../src/config/site.ts";
import { fileType, imageDimensions, MAX_FILE_BYTES } from "../src/server/media/validation.ts";

const exec = promisify(execFile);
const options = process.env.NEON_TEST_PROJECT_ID ? ["--project-id", process.env.NEON_TEST_PROJECT_ID] : [];
async function neon(args) {
  try {
    const { stdout } = await exec("neon", [...args, ...options, "--output", "json", "--no-color"], { maxBuffer: 2 ** 20 });
    return args[0] === "connection-string" ? stdout.trim() : JSON.parse(stdout);
  } catch (error) {
    // Connection commands can emit credentials even on failure; keep them private.
    const detail = args[0] === "branches" ? String(error.stderr ?? "").replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[redacted]").trim() : "";
    throw new Error("Neon CLI command failed: " + args.slice(0, 2).join(" ") + (detail ? " — " + detail : ""));
  }
}
function owned(branch, parent, name) {
  assert.ok(branch?.id && branch.id !== parent.id, "Disposable branch must differ from parent");
  assert.equal(branch.name, name, "Only the uniquely named branch created by this run is owned");
  assert.equal(branch.project_id, parent.project_id);
  assert.ok(!branch.default && !branch.primary && !branch.protected, "Refusing a default/primary/protected branch");
}
async function assertEmptyTemplate(connection) {
  const pool = new Pool({ connectionString: connection, max: 1 });
  try {
    const { rows } = await pool.query(`SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind IN ('r','p','f','m') AND n.nspname NOT IN ('pg_catalog','information_schema')
        AND n.nspname !~ '^pg_(toast|temp)_'
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e' AND d.refclassid='pg_extension'::regclass)`);
    assert.equal(rows.length, 0, "Dedicated template/clone must have no non-extension app, customer or Auth tables");
  } finally { await pool.end(); }
}

const parent = await neon(["branches", "get", process.env.NEON_TEST_PARENT || "test-template"]);
assert.ok(parent.id && parent.project_id, "Neon project context and parent branch are required");
assert.ok(!parent.default && !parent.primary && !parent.protected, "Never clone a production/default/primary parent for tests");
options.splice(0, options.length, "--project-id", parent.project_id);
const parentConnection = await neon(["connection-string", parent.id, "--no-pooled"]);
assert.equal(typeof parentConnection, "string");
await assertEmptyTemplate(parentConnection);
const name = "owned-database-test-" + randomUUID();
assert.ok(!(await neon(["branches", "list", "--no-secrets"])).some(branch => branch.name === name));
let created;
try {
  const result = await neon(["branches", "create", "--name", name, "--parent", parent.id, "--no-secrets", "--expires-at", new Date(Date.now() + 60 * 60 * 1000).toISOString()]);
  created = result.branch ?? result;
  owned(created, parent, name);
  const branch = await neon(["branches", "get", created.id]);
  owned(branch, parent, name);
  assert.equal(branch.parent_id, parent.id);
  assert.equal(branch.init_source, "parent-data");
  const connection = await neon(["connection-string", branch.id, "--no-pooled"]);
  assert.equal(typeof connection, "string", "Expected one direct connection string");
  assert.ok(!new URL(connection).hostname.includes("-pooler"));
  assert.notEqual(new URL(connection).hostname, new URL(parentConnection).hostname, "Disposable compute must differ from parent");
  await assertEmptyTemplate(connection);
  console.log("Isolated empty-template branch: " + name + " (" + branch.id + ")");
  const pool = new Pool({ connectionString: connection, max: 1 });
  try {
    // Only these app-owned schemas on this proven-owned empty branch; never auth/public or parent.
    await pool.query("DROP SCHEMA IF EXISTS leasing CASCADE; DROP SCHEMA IF EXISTS row_audit CASCADE");
  } finally { await pool.end(); }
  await migrateDatabase(connection);
  // Check applied hashes and seed idempotency, not just fresh schema creation.
  await migrateDatabase(connection);
  const publicUrl = process.env.APPROVED_LOGO_URL || neonMediaUrl("client-reference/legacy/logo-without-text.png");
  const url = new URL(publicUrl);
  assert.ok(url.protocol === "https:" && url.hostname.endsWith(".neon.tech") && !url.username && !url.password && !url.search && !url.hash);
  const response = await fetch(publicUrl, { redirect: "error", signal: AbortSignal.timeout(30_000) });
  assert.ok(response.ok && response.headers.get("content-type")?.split(";")[0] === "image/png", "Approved Neon logo must be readable PNG bytes");
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.ok(bytes.byteLength > 0 && bytes.byteLength <= MAX_FILE_BYTES);
  assert.equal(fileType(bytes, "image/png"), "image/png");
  imageDimensions(bytes, "image/png");
  const metadata = { publicUrl, bytes: bytes.byteLength, sha256: createHash("sha256").update(bytes).digest("hex") };
  await importApprovedLogo(connection, metadata);
  const env = { ...process.env, DATABASE_URL: connection, RUN_LIVE_DATABASE_TESTS: "1", LIVE_TEST_BRANCH_ID: branch.id, LIVE_TEST_PARENT_ID: parent.id, LIVE_TEST_BRANCH_NAME: name, APPROVED_LOGO_URL: publicUrl };
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--conditions=react-server", "--import", "tsx", "--test", "tests/live-workspace.test.ts"], { env, stdio: "inherit" });
    child.on("error", reject); child.on("exit", code => resolve(code));
  });
  assert.equal(code, 0, "Live database regression failed");
} finally {
  // Recover only this unique name if CLI creation failed after provisioning; expiry is the crash backstop.
  if (!created?.id) created = (await neon(["branches", "list", "--no-secrets"])).find(branch => branch.name === name);
  if (created?.id) {
    owned(created, parent, name);
    const branch = await neon(["branches", "get", created.id]);
    owned(branch, parent, name);
    await neon(["branches", "delete", branch.id]);
    console.log("Deleted owned database test branch: " + branch.id);
  }
}

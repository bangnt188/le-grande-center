import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import pg from "pg";

// Test-only attestation. A flag or an arbitrary DATABASE_URL alone never opts in.
export function assertOwnedLocalDatabase(connectionString = process.env.DATABASE_URL) {
  assert.equal(process.env.RUN_LOCAL_DATABASE_TESTS, "1", "Use npm run test:database");
  const nonce = process.env.LOCAL_DATABASE_TEST_NONCE;
  assert.match(nonce ?? "", /^[a-f0-9]{32}$/);
  const root = process.env.LOCAL_DATABASE_TEST_ROOT;
  assert.ok(root && realpathSync(root) === root);
  assert.equal(dirname(root), realpathSync(tmpdir()));
  assert.ok(basename(root).startsWith(`le-grande-pg-${nonce}-`));
  assert.ok(lstatSync(root).isDirectory() && !lstatSync(root).isSymbolicLink());
  if (process.getuid) assert.equal(lstatSync(root).uid, process.getuid());
  const manifest = JSON.parse(readFileSync(join(root, "owner.json"), "utf8"));
  assert.equal(manifest.nonce, nonce);
  assert.equal(manifest.dataDir, join(root, "data"));
  assert.equal(realpathSync(manifest.dataDir), manifest.dataDir);
  assert.equal(manifest.database, `regression_${nonce}`);
  assert.equal(manifest.user, `owner_${nonce}`);
  assert.ok(Number.isInteger(manifest.port) && manifest.port > 1023 && manifest.port <= 65535);
  const url = new URL(connectionString ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1", "Local regressions must never connect to Neon or another host");
  assert.equal(url.port, String(manifest.port));
  assert.equal(url.pathname, `/${manifest.database}`);
  assert.equal(url.username, manifest.user);
  assert.equal(url.search, "?sslmode=disable");
  assert.equal(url.hash, "");
  assert.equal(createHash("sha256").update(url.password).digest("hex"), manifest.passwordHash);
  return manifest;
}

export async function verifyOwnedLocalDatabase() {
  const manifest = assertOwnedLocalDatabase();
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const { rows: [server] } = await pool.query("SELECT current_database() AS database, current_user AS username, current_setting('data_directory') AS directory, host(inet_server_addr()) AS host, inet_server_port() AS port");
    assert.equal(server.database, manifest.database);
    assert.equal(server.username, manifest.user);
    assert.equal(realpathSync(server.directory), manifest.dataDir);
    assert.equal(server.host, "127.0.0.1");
    assert.equal(server.port, manifest.port);
  } finally {
    await pool.end();
  }
}

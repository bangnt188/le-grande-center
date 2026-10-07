import assert from "node:assert/strict";
import test from "node:test";
import { BackendError } from "../packages/backend/src/errors";
import { createPostgresDatabase, type PostgresPool } from "../packages/backend/src/pg-connection";
import type { PgQuery } from "../packages/backend/src/postgres";

const mutation = "UPDATE counter SET value = value + $1 RETURNING value";
const providerError = () => new Error("private provider host, SQL and credentials");
function fixture(options: {
  acquireFails?: boolean;
  setupFails?: "begin" | "isolation" | "actor";
  rollbackFails?: boolean;
  commitFails?: "before" | "after";
  beforeWrite?: () => Promise<void>;
} = {}) {
  let committed = 0;
  let acquisitions = 0;
  let writes = 0;
  const releases: (Error | boolean | undefined)[] = [];
  const pool: PostgresPool = {
    async connect() {
      acquisitions++;
      if (options.acquireFails) throw providerError();
      let current: number | undefined;
      let actorId: unknown;
      let isolation: string | undefined;
      let released = false;
      return {
        async query(text, values) {
          if (released) throw providerError();
          if (text === "BEGIN") {
            if (options.setupFails === "begin") throw providerError();
            current = committed;
          } else if (text.startsWith("SET TRANSACTION ISOLATION LEVEL ")) {
            if (options.setupFails === "isolation" || current === undefined) throw providerError();
            isolation = text.slice("SET TRANSACTION ISOLATION LEVEL ".length).toLowerCase();
          } else if (text === "SELECT set_config('app.actor_id', $1, true)") {
            if (options.setupFails === "actor" || current === undefined) throw providerError();
            actorId = values?.[0];
          } else if (text === "COMMIT") {
            if (options.commitFails === "before" || current === undefined) throw providerError();
            committed = current;
            current = undefined;
            actorId = undefined;
            if (options.commitFails === "after") throw providerError();
          } else if (text === "ROLLBACK") {
            if (options.rollbackFails) throw providerError();
            current = undefined;
            actorId = undefined;
          } else if (text === mutation) {
            await options.beforeWrite?.();
            if (current === undefined || typeof actorId !== "string" || !isolation || typeof values?.[0] !== "number") throw providerError();
            current += values[0];
            writes++;
            return { rows: [{ value: current, actorId, isolation }] };
          } else {
            throw providerError();
          }
          return { rows: [] };
        },
        release(error) { released = true; releases.push(error); },
      };
    },
  };
  return { database: createPostgresDatabase({ pool }), releases,
    state: () => ({ committed, acquisitions, writes }) };
}
function unavailable(error: unknown): boolean {
  assert.ok(error instanceof BackendError);
  assert.equal(error.code, "UNAVAILABLE");
  assert.equal(error.message, "UNAVAILABLE");
  assert.equal(error.cause, undefined);
  return true;
}

test("commits callback result with a pinned actor and serializable isolation, then clears actor context", async () => {
  const { database, state, releases } = fixture();
  const result = await database.transaction({ actorId: "staff:internal-1" }, async query => {
    await query(mutation, [2]);
    return query(mutation, [3]);
  });
  assert.deepEqual(result.rows, [{ value: 5, actorId: "staff:internal-1", isolation: "serializable" }]);
  assert.deepEqual(state(), { committed: 5, acquisitions: 1, writes: 2 });
  assert.deepEqual(releases, [undefined]);
  const next = await database.transaction({ actorId: "system:nightly-job", isolation: "read committed" }, query => query(mutation, [1]));
  assert.deepEqual(next.rows, [{ value: 6, actorId: "system:nightly-job", isolation: "read committed" }]);
});

test("supports repeatable read without provider-specific identity parsing", async () => {
  const { database } = fixture();
  const result = await database.transaction({ actorId: "internal-opaque-identity", isolation: "repeatable read" }, query => query(mutation, [1]));
  assert.deepEqual(result.rows, [{ value: 1, actorId: "internal-opaque-identity", isolation: "repeatable read" }]);
});

test("callback domain failures roll back semantic mutations and preserve the original error", async () => {
  for (const domainError of [new BackendError("CONFLICT"), new Error("domain rule")]) {
    const { database, state, releases } = fixture();
    await assert.rejects(database.transaction({ actorId: "staff-1" }, async query => {
      await query(mutation, [9]);
      throw domainError;
    }), error => error === domainError);
    assert.equal(state().committed, 0);
    assert.equal(state().writes, 1);
    assert.deepEqual(releases, [undefined]);
  }
});

test("driver query failures expose only safe errors and roll back prior mutations", async () => {
  const { database, state, releases } = fixture();
  await assert.rejects(database.transaction({ actorId: "staff-1" }, async query => {
    await query(mutation, [7]);
    await query("SELECT private_sql_that_fails", []);
  }), unavailable);
  assert.equal(state().committed, 0);
  assert.deepEqual(releases, [undefined]);
});

test("a caught SQL failure cannot accidentally commit callback success", async () => {
  const { database, state } = fixture();
  await assert.rejects(database.transaction({ actorId: "staff-1" }, async query => {
    await query(mutation, [7]);
    await assert.rejects(query("SELECT broken", []), unavailable);
    return "would look successful";
  }), unavailable);
  assert.equal(state().committed, 0);
});

test("retained query refuses writes after success and after rollback", async () => {
  for (const fail of [false, true]) {
    const { database, state } = fixture();
    let retained: PgQuery | undefined;
    const work = database.transaction({ actorId: "staff-1" }, async query => {
      retained = query;
      await query(mutation, [1]);
      if (fail) throw new BackendError("CONFLICT");
    });
    if (fail) await assert.rejects(work, { code: "CONFLICT" });
    else await work;
    assert.ok(retained);
    await assert.rejects(retained(mutation, [100]), unavailable);
    assert.equal(state().writes, 1);
    assert.equal(state().committed, fail ? 0 : 1);
  }
});

test("commit failure is unavailable even when the server may have committed, and discards the client", async () => {
  for (const commitFails of ["before", "after"] as const) {
    const { database, releases, state } = fixture({ commitFails });
    await assert.rejects(database.transaction({ actorId: "staff-1" }, async query => {
      await query(mutation, [5]);
      return "success";
    }), unavailable);
    assert.equal(state().acquisitions, 1);
    assert.equal(state().committed, commitFails === "after" ? 5 : 0);
    assert.equal(releases.length, 1);
    assert.ok(releases[0] instanceof Error);
    assert.equal(releases[0].message, "UNAVAILABLE");
  }
});

test("failed rollback discards the poisoned client without replacing the callback domain error", async () => {
  const { database, releases, state } = fixture({ rollbackFails: true });
  const domainError = new BackendError("CONFLICT");
  await assert.rejects(database.transaction({ actorId: "staff-1" }, async query => {
    await query(mutation, [4]);
    throw domainError;
  }), error => error === domainError);
  assert.equal(state().committed, 0);
  assert.equal(releases.length, 1);
  assert.ok(releases[0] instanceof Error);
  assert.equal(releases[0].message, "UNAVAILABLE");
});

test("missing, blank, noncanonical, control-bearing and oversized actors deny before acquisition or writes", async () => {
  const { database, state } = fixture();
  for (const actorId of [undefined, null, 42, "", " \t", " staff-1", "staff-1 ", "staff\u0000id", "staff\nid", "x".repeat(256)]) {
    await assert.rejects(Reflect.apply(database.transaction, database, [{ actorId }, async (query: PgQuery) => query(mutation, [1])]), { code: "INVALID_INPUT" });
  }
  assert.deepEqual(state(), { committed: 0, acquisitions: 0, writes: 0 });
  await database.transaction({ actorId: "x".repeat(255) }, query => query(mutation, [1]));
  assert.equal(state().committed, 1);
});

test("unsupported isolation cannot inject SQL or acquire a client", async () => {
  const { database, state } = fixture();
  for (const isolation of [null, "", "SERIALIZABLE", "serializable; COMMIT"]) {
    await assert.rejects(Reflect.apply(database.transaction, database, [{ actorId: "staff-1", isolation }, async (query: PgQuery) => query(mutation, [1])]), { code: "INVALID_INPUT" });
  }
  assert.deepEqual(state(), { committed: 0, acquisitions: 0, writes: 0 });
});
test("acquisition and setup failures are safe, do not invoke the callback and do not retry", async () => {
  for (const options of [{ acquireFails: true }, { setupFails: "begin" }, { setupFails: "isolation" }, { setupFails: "actor" }] as const) {
    const { database, state, releases } = fixture(options);
    let invoked = false;
    await assert.rejects(database.transaction({ actorId: "staff-1" }, async () => { invoked = true; }), unavailable);
    assert.equal(invoked, false);
    assert.deepEqual(state(), { committed: 0, acquisitions: 1, writes: 0 });
    assert.equal(releases.length, "acquireFails" in options ? 0 : 1);
  }
});

test("started queries finish before commit and release, while newly escaped queries are denied", async () => {
  let finishWrite: (() => void) | undefined;
  const writeReady = new Promise<void>(resolve => { finishWrite = resolve; });
  let callbackDone: (() => void) | undefined;
  const callbackReady = new Promise<void>(resolve => { callbackDone = resolve; });
  const { database, releases, state } = fixture({ beforeWrite: () => writeReady });
  let retained: PgQuery | undefined;
  const transaction = database.transaction({ actorId: "staff-1" }, async query => {
    retained = query;
    void query(mutation, [8]);
    callbackDone!();
  });
  await callbackReady;
  // Let the adapter observe callback completion; the original write is still blocked.
  await Promise.resolve();
  assert.deepEqual(releases, []);
  assert.equal(state().committed, 0);
  assert.ok(retained);
  await assert.rejects(retained(mutation, [100]), unavailable);
  finishWrite!();
  await transaction;
  assert.equal(state().committed, 8);
  assert.equal(state().writes, 1);
  assert.deepEqual(releases, [undefined]);
});

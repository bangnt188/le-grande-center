import assert from "node:assert/strict";
import pg from "pg";
import { assertOwnedLocalDatabase } from "./local-database-guard.mjs";

export const types = pg.types;

// Only the owned test child redirects the Neon module here. All statements still
// execute against PostgreSQL; production keeps its WebSocket/HTTP Neon driver.
export class Pool extends pg.Pool {
  constructor(options) {
    assertOwnedLocalDatabase(options?.connectionString);
    super(options);
  }
}

export function neon(connectionString) {
  assertOwnedLocalDatabase(connectionString);
  const descriptors = new WeakSet();
  const descriptor = (text, values = []) => {
    assert.equal(typeof text, "string");
    assert.ok(Array.isArray(values));
    const query = { text, values };
    descriptors.add(query);
    return query;
  };
  const sql = (strings, ...values) => {
    assert.ok(Array.isArray(strings) && Array.isArray(strings.raw), "Expected a SQL tagged template");
    return descriptor(strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, ""), values);
  };
  sql.query = descriptor;
  sql.transaction = async (queries, transactionOptions) => {
    const levels = { ReadCommitted: "READ COMMITTED", RepeatableRead: "REPEATABLE READ", Serializable: "SERIALIZABLE" };
    const isolation = transactionOptions?.isolationLevel ?? "ReadCommitted";
    assert.ok(Object.hasOwn(levels, isolation), "Unsupported PostgreSQL isolation level");
    assert.ok(Array.isArray(queries) && queries.every(query => descriptors.has(query)), "Only this SQL client's descriptors may be batched");
    const pool = new Pool({ connectionString, max: 1 });
    let client;
    try {
      client = await pool.connect();
      await client.query(`BEGIN ISOLATION LEVEL ${levels[isolation]}${transactionOptions?.readOnly ? " READ ONLY" : ""}`);
      const results = [];
      for (const query of queries) results.push((await client.query(query.text, query.values)).rows);
      await client.query("COMMIT");
      return results;
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client?.release();
      await pool.end();
    }
  };
  return sql;
}

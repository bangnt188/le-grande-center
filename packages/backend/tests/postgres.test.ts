import assert from "node:assert/strict";
import test from "node:test";
import { createPostgresRepository } from "../src/postgres.ts";
import { type CrudRow } from "../src/crud.ts";

type Row = CrudRow & { name: string };
const row: Row = { id: "customer-1", version: 1, tenantId: "owner-1", propertyId: "mall-1", name: "Acme" };
const decode = (input: unknown): Row => {
  if (!input || typeof input !== "object" || !("id" in input)) throw new Error("bad DB row");
  return input as Row;
};
test("Postgres insert sends user data only as parameters and decodes the returned row", async () => {
  const statements: { text: string; values: readonly unknown[] }[] = [];
  const repo = createPostgresRepository<Row, { name: string }, { name: string }>({
    schema: "leasing", table: "customers", columns: { name: "name" }, scopeColumns: { tenantId: "owner_org_id", propertyId: "property_id" }, decode,
    query: async (text, values) => { statements.push({ text, values }); return { rows: [row] }; },
  });
  assert.deepEqual(await repo.insert({ name: "Robert'); DROP TABLE customers;--" }, { tenantId: "owner-1", propertyId: "mall-1" }), row);
  assert.deepEqual(statements, [{ text: 'INSERT INTO "leasing"."customers" ("name", "owner_org_id", "property_id") VALUES ($1, $2, $3) RETURNING *', values: ["Robert'); DROP TABLE customers;--", "owner-1", "mall-1"] }]);
});

test("Postgres lookup includes exact tenant/property predicates and parameterizes the ID", async () => {
  const repo = createPostgresRepository<Row, { name: string }, { name: string }>({
    table: "customers", columns: { name: "name" }, scopeColumns: { tenantId: "owner_org_id", propertyId: "property_id" }, decode,
    query: async (text, values) => {
      assert.equal(text, 'SELECT * FROM "customers" WHERE "owner_org_id" = $1 AND "property_id" = $2 AND "id" = $3');
      assert.deepEqual(values, ["owner-1", "mall-1", "customer-1"]); return { rows: [row] };
    },
  });
  assert.deepEqual(await repo.find("customer-1", { tenantId: "owner-1", propertyId: "mall-1" }), row);
});

test("Postgres pagination scopes both count and rows and orders deterministically", async () => {
  const repo = createPostgresRepository<Row, { name: string }, { name: string }>({
    table: "customers", columns: { name: "name" }, scopeColumns: { tenantId: "owner_org_id" }, decode,
    query: async (text, values) => {
      if (text.startsWith("SELECT COUNT")) {
        assert.equal(text, 'SELECT COUNT(*) AS total FROM "customers" WHERE "owner_org_id" = $1');
        assert.deepEqual(values, ["owner-1"]); return { rows: [{ total: "3" }] };
      }
      assert.equal(text, 'SELECT * FROM "customers" WHERE "owner_org_id" = $1 ORDER BY "id" ASC LIMIT $2 OFFSET $3');
      assert.deepEqual(values, ["owner-1", 1, 1]); return { rows: [row] };
    },
  });
  assert.deepEqual(await repo.list({ tenantId: "owner-1" }, { limit: 1, offset: 1 }), { items: [row], totalItems: 3 });
});

test("Postgres update compares version and scope atomically in the UPDATE statement", async () => {
  const repo = createPostgresRepository<Row, { name: string }, { name: string }>({
    table: "customers", columns: { name: "name" }, scopeColumns: { tenantId: "owner_org_id" }, decode,
    query: async (text, values) => {
      assert.equal(text, 'UPDATE "customers" SET "name" = $1, "version" = "version" + 1 WHERE "owner_org_id" = $2 AND "id" = $3 AND "version" = $4 RETURNING *');
      assert.deepEqual(values, ["Updated", "owner-1", "customer-1", 1]); return { rows: [] };
    },
  });
  assert.equal(await repo.update("customer-1", { name: "Updated" }, 1, { tenantId: "owner-1" }), null);
});

test("Postgres delete scopes and compares version in one statement", async () => {
  const repo = createPostgresRepository<Row, { name: string }, { name: string }>({
    table: "customers", columns: { name: "name" }, scopeColumns: { tenantId: "owner_org_id" }, decode,
    query: async (text, values) => {
      assert.equal(text, 'DELETE FROM "customers" WHERE "owner_org_id" = $1 AND "id" = $2 AND "version" = $3 RETURNING "id"');
      assert.deepEqual(values, ["owner-1", "customer-1", 1]); return { rows: [{ id: "customer-1" }] };
    },
  });
  assert.equal(await repo.delete("customer-1", 1, { tenantId: "owner-1" }), true);
});

test("Postgres rejects injected table identifiers, unknown columns and unmapped scopes", async () => {
  const options = { table: "customers", columns: { name: "name" }, scopeColumns: { tenantId: "owner_org_id" }, decode, query: async () => ({ rows: [] }) };
  assert.throws(() => createPostgresRepository({ ...options, table: 'customers;DROP TABLE users' }), { message: "INVALID_INPUT" });
  const repo = createPostgresRepository<Row, Record<string, unknown>, Record<string, unknown>>(options);
  await assert.rejects(() => repo.insert({ admin: true }, { tenantId: "owner-1" }), { message: "INVALID_INPUT" });
  await assert.rejects(() => repo.find("customer-1", { tenantId: "owner-1", organizationId: "customer-org" }), { message: "INVALID_INPUT" });
  await assert.rejects(() => repo.update("customer-1", {}, 1, { tenantId: "owner-1" }), { message: "INVALID_INPUT" });
});

test("Postgres webhook inbox atomically inserts a delivery or reports a duplicate", async () => {
  const { createPostgresWebhookInbox } = await import("../src/postgres.ts");
  let existing = false;
  const inbox = createPostgresWebhookInbox({ schema: "example_app", table: "webhook_inbox", query: async (text, values) => {
    assert.equal(text, 'INSERT INTO "example_app"."webhook_inbox" ("namespace", "delivery_id", "signed_at", "raw_body", "retain_until") VALUES ($1, $2, $3, $4, $5) ON CONFLICT ("namespace", "delivery_id") DO NOTHING RETURNING "delivery_id"');
    assert.equal(values[0], "vendor:customers"); assert.equal(values[1], "delivery-1");
    if (existing) return { rows: [] };
    existing = true; return { rows: [{ delivery_id: "delivery-1" }] };
  } });
  const event = { namespace: "vendor:customers", id: "delivery-1", timestamp: 1_800_000_000, body: new TextEncoder().encode("{}"), retainUntil: 1_800_086_400_000 };
  assert.equal(await inbox.storeEvent(event), true);
  assert.equal(await inbox.storeEvent(event), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { fixture, request } from "./fixtures/crud.ts";

test("a permitted user creates a customer and reads a safe DTO", async () => {
  const { crud } = fixture();
  const created = await crud.create(request, { name: "  Acme  ", taxId: "private-tax-id" });
  assert.deepEqual(await crud.get(request, created.id), { id: "customer-1", name: "Acme", version: 1 });
  assert.equal("taxId" in created, false);
});

test("list returns scoped pagination and a safe DTO for each customer", async () => {
  const { crud } = fixture({ rows: [
    { id: "a", version: 1, tenantId: "owner-1", propertyId: "mall-1", name: "Acme", taxId: "secret" },
    { id: "b", version: 1, tenantId: "owner-1", propertyId: "mall-1", name: "Bravo", taxId: "secret" },
    { id: "c", version: 1, tenantId: "other-owner", propertyId: "mall-1", name: "Hidden", taxId: "secret" },
  ] });
  assert.deepEqual(await crud.list(request, { page: 2, pageSize: 1 }), {
    items: [{ id: "b", version: 1, name: "Bravo" }], page: 2, pageSize: 1, totalItems: 2, totalPages: 2,
  });
});

test("update increments version and rejects a stale edit without losing the saved name", async () => {
  const { crud } = fixture();
  const row = await crud.create(request, { name: "Acme" });
  assert.deepEqual(await crud.update(request, row.id, 1, { name: "Updated" }), { id: row.id, name: "Updated", version: 2 });
  await assert.rejects(() => crud.update(request, row.id, 1, { name: "Stale" }), { message: "CONFLICT" });
  assert.equal((await crud.get(request, row.id)).name, "Updated");
});

test("delete requires the current version and removes the customer", async () => {
  const { crud } = fixture();
  const row = await crud.create(request, { name: "Acme" });
  await assert.rejects(() => crud.delete(request, row.id, 2), { message: "CONFLICT" });
  assert.equal((await crud.get(request, row.id)).name, "Acme");
  await crud.delete(request, row.id, 1);
  await assert.rejects(() => crud.get(request, row.id), { message: "NOT_FOUND" });
});

test("request body cannot assign identity, version, role, or tenant scope", async () => {
  const { crud } = fixture();
  for (const field of ["id", "version", "tenantId", "propertyId", "organizationId", "ownerId", "role", "grants"]) {
    await assert.rejects(() => crud.create(request, { name: "Acme", [field]: "forged" }), { message: "INVALID_INPUT" });
  }
  assert.equal((await crud.list(request)).totalItems, 0);
});

test("denied create never leaves a row and revoked permissions block existing rows", async () => {
  const denied = fixture({ grants: [{ permission: "customers:view", effect: "allow", scope: { tenantId: "owner-1", propertyId: "mall-1" } }] });
  await assert.rejects(() => denied.crud.create(request, { name: "Forbidden" }), { message: "FORBIDDEN" });
  assert.equal((await denied.crud.list(request)).totalItems, 0);
  const allowed = fixture();
  const row = await allowed.crud.create(request, { name: "Acme" });
  allowed.revoke();
  await assert.rejects(() => allowed.crud.update(request, row.id, 1, { name: "Forbidden" }), { message: "FORBIDDEN" });
  await assert.rejects(() => allowed.crud.get(request, row.id), { message: "FORBIDDEN" });
});

test("another tenant's customer cannot be read, updated, or deleted by ID", async () => {
  const { crud } = fixture({ rows: [{ id: "private", version: 1, tenantId: "owner-2", propertyId: "mall-1", name: "Hidden", taxId: "secret" }] });
  await assert.rejects(() => crud.get(request, "private"), { message: "NOT_FOUND" });
  await assert.rejects(() => crud.update(request, "private", 1, { name: "Attack" }), { message: "NOT_FOUND" });
  await assert.rejects(() => crud.delete(request, "private", 1), { message: "NOT_FOUND" });
});

test("a failed DTO projection rolls back the create transaction", async () => {
  const { crud } = fixture({ project: () => { throw new Error("projection failure"); } });
  await assert.rejects(() => crud.create(request, { name: "Acme" }), /projection failure/);
  assert.equal((await crud.list(request)).totalItems, 0);
});

test("two concurrent edits of one version have exactly one winner", async () => {
  const { crud } = fixture();
  const row = await crud.create(request, { name: "Acme" });
  const results = await Promise.allSettled([
    crud.update(request, row.id, 1, { name: "First" }),
    crud.update(request, row.id, 1, { name: "Second" }),
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected");
  assert.equal(rejected?.status === "rejected" && rejected.reason.message, "CONFLICT");
  assert.deepEqual(await crud.get(request, row.id), { id: row.id, name: "First", version: 2 });
});

test("invalid payloads and unbounded pagination are rejected", async () => {
  const { crud } = fixture();
  await assert.rejects(() => crud.create(request, { name: "" }), { message: "INVALID_INPUT" });
  for (const pagination of [{ page: 0 }, { pageSize: 101 }, { page: 1.5 }, { page: Number.MAX_SAFE_INTEGER }]) {
    await assert.rejects(() => crud.list(request, pagination), { message: "INVALID_INPUT" });
  }
});

test("a DB adapter cannot silently move a customer to another organization during update", async () => {
  const { crud } = fixture({ rows: [{ id: "a", version: 1, tenantId: "owner-1", propertyId: "mall-1", organizationId: "org-1", name: "Acme", taxId: "" }],
    afterUpdate: row => ({ ...row, organizationId: "org-2" }),
  });
  await assert.rejects(() => crud.update(request, "a", 1, { name: "Moved" }), { message: "UNAVAILABLE" });
  assert.equal((await crud.get(request, "a")).name, "Acme");
});

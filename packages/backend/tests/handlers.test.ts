import assert from "node:assert/strict";
import test from "node:test";
import { createCrudHandlers } from "../src/handlers.ts";
import { fixture } from "./fixtures/crud.ts";
const origin = "https://app.example";

test("Web/Next handlers create and get through guarded CRUD with an ETag", async () => {
  const handlers = createCrudHandlers(fixture().crud, { origin });
  const response = await handlers.collection.POST(new Request(origin + "/api/customers", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: '{"name":"Acme"}',
  }));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("etag"), '"1"');
  const retrieved = await handlers.item.GET(new Request(origin + "/api/customers/customer-1"), { params: Promise.resolve({ id: "customer-1" }) });
  assert.deepEqual(await retrieved.json(), { ok: true, data: { id: "customer-1", name: "Acme", version: 1 } });
});

test("collection GET parses bounded pagination and rejects ambiguous query parameters", async () => {
  const handlers = createCrudHandlers(fixture().crud, { origin });
  const response = await handlers.collection.GET(new Request(origin + "/api/customers?page=1&pageSize=10"));
  assert.deepEqual(await response.json(), { ok: true, data: { items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } });
  for (const query of ["page=1abc", "page=1&page=2", "table=users", "pageSize=101"]) {
    assert.equal((await handlers.collection.GET(new Request(origin + "/api/customers?" + query))).status, 400);
  }
});

test("PATCH uses If-Match and returns conflict for a stale version", async () => {
  const { crud } = fixture(); const row = await crud.create(new Request(origin), { name: "Acme" });
  const handlers = createCrudHandlers(crud, { origin });
  const context = { params: Promise.resolve({ id: row.id }) };
  const patch = (match?: string) => new Request(origin + "/api/customers/" + row.id, { method: "PATCH", body: '{"name":"Updated"}',
    headers: { origin, "content-type": "application/json", ...(match ? { "if-match": match } : {}) } });
  assert.equal((await handlers.item.PATCH(patch(), context)).status, 400);
  const saved = await handlers.item.PATCH(patch('"1"'), context);
  assert.equal(saved.status, 200); assert.equal(saved.headers.get("etag"), '"2"');
  assert.equal((await handlers.item.PATCH(patch('"1"'), context)).status, 409);
});

test("DELETE checks Origin and version and returns an empty 204 only after removal", async () => {
  const { crud } = fixture(); const row = await crud.create(new Request(origin), { name: "Acme" });
  const handlers = createCrudHandlers(crud, { origin }); const context = { params: Promise.resolve({ id: row.id }) };
  const incoming = (requestOrigin: string) => new Request(origin + "/api/customers/" + row.id, { method: "DELETE", headers: { origin: requestOrigin, "if-match": '"1"' } });
  assert.equal((await handlers.item.DELETE(incoming("https://evil.example"), context)).status, 403);
  const deleted = await handlers.item.DELETE(incoming(origin), context);
  assert.equal(deleted.status, 204); assert.equal(await deleted.text(), "");
  assert.equal((await handlers.item.GET(new Request(origin), context)).status, 404);
});

test("browser writes without a valid Origin are denied and revoked access maps to 403", async () => {
  const f = fixture(); const handlers = createCrudHandlers(f.crud, { origin });
  const request = (requestOrigin?: string) => new Request(origin + "/api/customers", { method: "POST", body: '{"name":"Acme"}', headers: { "content-type": "application/json", ...(requestOrigin ? { origin: requestOrigin } : {}) } });
  assert.equal((await handlers.collection.POST(request())).status, 403);
  assert.equal((await handlers.collection.POST(request("https://evil.example"))).status, 403);
  f.revoke();
  const forbidden = await handlers.collection.POST(request(origin));
  assert.equal(forbidden.status, 403);
  assert.deepEqual(await forbidden.json(), { ok: false, error: { code: "FORBIDDEN" } });
});

import assert from "node:assert/strict";
import test from "node:test";
import { AccessError } from "../src/access.ts";
import { BackendError } from "../src/errors.ts";
import { jsonError, jsonSuccess } from "../src/response.ts";

test("API error responses map status safely and never expose the original error", async () => {
  for (const [error, status, code] of [
    [new AccessError("FORBIDDEN"), 403, "FORBIDDEN"],
    [new BackendError("CONFLICT"), 409, "CONFLICT"],
    [new Error("DB password=secret"), 500, "INTERNAL_ERROR"],
  ] as const) {
    const response = jsonError(error, { requestId: "request-1" });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("x-request-id"), "request-1");
    assert.deepEqual(await response.json(), { ok: false, error: { code } });
  }
});

test("success responses carry the DTO and prevent shared caching", async () => {
  const response = jsonSuccess({ id: "customer-1" }, { status: 201 });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), { ok: true, data: { id: "customer-1" } });
});

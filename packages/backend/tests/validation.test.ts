import assert from "node:assert/strict";
import test from "node:test";
import { objectInput, readJson, textInput, integerInput } from "../src/validation.ts";

test("a JSON request is parsed through an explicit field allowlist and validators", async () => {
  const request = new Request("https://app.example/api/customers", { method: "POST", headers: { "content-type": "application/json" }, body: '{"name":"  Acme  ","seats":2}' });
  const dto = await readJson(request, input => {
    const data = objectInput(input, ["name", "seats"]);
    return { name: textInput(data.name, { maxLength: 80 }), seats: integerInput(data.seats, { min: 1, max: 10 }) };
  });
  assert.deepEqual(dto, { name: "Acme", seats: 2 });
});

test("unknown fields, prototype keys and invalid scalar types are rejected", () => {
  for (const input of [null, [], { name: "Acme", role: "admin" }, JSON.parse('{"__proto__":{"admin":true}}')]) {
    assert.throws(() => objectInput(input, ["name"]), { message: "INVALID_INPUT" });
  }
  for (const input of [undefined, 1, "", "x".repeat(257)]) assert.throws(() => textInput(input), { message: "INVALID_INPUT" });
  for (const input of ["2", 1.5, 0, 11]) assert.throws(() => integerInput(input, { min: 1, max: 10 }), { message: "INVALID_INPUT" });
});

test("JSON reader rejects bad media type, malformed JSON and oversized bodies", async () => {
  for (const [body, contentType] of [["{}", "text/plain"], ["{bad", "application/json"], ['{"name":"' + "x".repeat(100) + '"}', "application/json"]]) {
    const request = new Request("https://app.example/api", { method: "POST", body, headers: { "content-type": contentType! } });
    await assert.rejects(() => readJson(request, value => value, { maxBytes: 32 }), { message: "INVALID_INPUT" });
  }
});

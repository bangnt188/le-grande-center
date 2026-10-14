import assert from "node:assert/strict";
import { test } from "node:test";
import { parseContactInput } from "../src/server/contact-input";
import { createContactSubmitter } from "../src/features/contact/submit-contact";

const callback = { intent: "callback", name: "Nguyễn Văn A", phone: "0973879563", company: "", email: "", business: "", area: "", timing: "", space: "A.1", note: "", consent: true, unitId: "A.1", scope: "single" };
test("public intake validates consent, bounds, visit dates and strips untrusted privileges", () => {
  const result = parseContactInput({ ...callback, role: "administrator", companyId: "private", name: " Nguyễn Văn A " });
  assert.equal(result.name, callback.name);
  assert.equal(result.email, "");
  assert.equal("role" in result, false);
  assert.equal("companyId" in result, false);
  for (const invalid of [null, [], { ...callback, consent: false }, { ...callback, name: "a" }, { ...callback, note: "x".repeat(2001) }, { ...callback, phone: "x" }, { ...callback, intent: "confirmed" }, { ...callback, visitDate: "2099-01-01" }, { ...callback, scope: "all" }, { ...callback, intent: "visit", visitDate: "2020-02-30", visitTime: "morning" }]) assert.throws(() => parseContactInput(invalid));
  assert.throws(() => parseContactInput({ ...callback, intent: "consultation" }));
  assert.equal(parseContactInput({ ...callback, intent: "consultation", email: "person@example.com", business: "office" }).intent, "consultation");
});
test("network retries reuse receipt keys, accepted submissions start a new receipt", async () => {
  const original = globalThis.fetch;
  const keys: string[] = [];
  let attempts = 0;
  globalThis.fetch = async (_url, init) => { keys.push(new Headers(init?.headers).get("Idempotency-Key")!); if (++attempts === 1) throw new Error("Connection lost"); return Response.json({ accepted: true }); };
  try {
    const send = createContactSubmitter();
    const input = parseContactInput(callback);
    await assert.rejects(send(input));
    await send(input);
    await send(input);
    assert.equal(keys[0], keys[1]);
    assert.notEqual(keys[1], keys[2]);
  } finally { globalThis.fetch = original; }
});

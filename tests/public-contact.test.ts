import assert from "node:assert/strict";
import { test } from "node:test";
import { parseContactInput } from "../src/server/contact-input";
import { createContactSubmitter } from "../src/features/contact/submit-contact";
import { notifySurveyOwner } from "../src/server/zalo-survey-notification";

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
test("survey notification sends the new lead code and customer details to the owner", async () => {
  const token = process.env.LE_GRANDE_ZALO_BOT_TOKEN, ownerId = process.env.LE_GRANDE_ZALO_OWNER_ID, original = globalThis.fetch;
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  process.env.LE_GRANDE_ZALO_BOT_TOKEN = "test-token";
  process.env.LE_GRANDE_ZALO_OWNER_ID = "owner-id";
  globalThis.fetch = async (url, init) => { sent.push({ url: String(url), body: JSON.parse(String(init?.body)) }); return Response.json({ ok: true, result: {} }); };
  try {
    await notifySurveyOwner({ referenceCode: "LGC-00001", name: "Nguyễn Văn A", phone: "0973879563", intent: "visit" });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, "https://bot-api.zaloplatforms.com/bottest-token/sendMessage");
    assert.equal(sent[0].body.chat_id, "owner-id");
    const text = String(sent[0].body.text);
    assert.match(text, /LGC-00001/);
    assert.match(text, /Nguyễn Văn A/);
    assert.match(text, /0973879563/);
    assert.match(text, /Tham quan/);
  } finally {
    globalThis.fetch = original;
    if (token === undefined) delete process.env.LE_GRANDE_ZALO_BOT_TOKEN; else process.env.LE_GRANDE_ZALO_BOT_TOKEN = token;
    if (ownerId === undefined) delete process.env.LE_GRANDE_ZALO_OWNER_ID; else process.env.LE_GRANDE_ZALO_OWNER_ID = ownerId;
  }
});

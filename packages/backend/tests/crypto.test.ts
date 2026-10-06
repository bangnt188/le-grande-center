import assert from "node:assert/strict";
import test from "node:test";
import { createFieldCipher } from "../src/crypto.ts";

const context = { tenantId: "owner-1", recordId: "customer-1", field: "taxId" };
const key = (raw = new Uint8Array(32), extractable = false) => crypto.subtle.importKey("raw", raw, "AES-GCM", extractable, ["encrypt", "decrypt"]);
async function fixture() {
  const current = await key();
  return createFieldCipher({ activeKeyId: "k1", getKey: async id => { if (id !== "k1") throw new Error("unknown key"); return current; } });
}
test("field cipher reads a fixed AES-GCM reference envelope produced outside this library", async () => {
  const cipher = await fixture();
  assert.equal(await cipher.decrypt({ version: 1, algorithm: "AES-256-GCM", keyId: "k1", iv: "AAAAAAAAAAAAAAAA",
    ciphertext: "g2TjHT6B0P8nOq2mW0kiIlJQMPsFlR5B55XNS1FEJMoWI1rZYwPVB51ELA",
  }, context), "Mã số thuế: 0312345678");
});

test("empty, Vietnamese, emoji and leading BOM text round-trip without losing information", async () => {
  const cipher = await fixture();
  for (const text of ["", "Thông tin khách hàng 🏢", "\uFEFFtax-id"]) {
    assert.equal(await cipher.decrypt(await cipher.encrypt(text, context), context), text);
  }
});

test("malformed Unicode is rejected rather than silently encrypted as a replacement character", async () => {
  const cipher = await fixture();
  await assert.rejects(() => cipher.encrypt("\uD800", context), { message: "FIELD_CRYPTO_FAILED" });
});

test("ciphertext, IV and tenant/record/field swapping fail authenticated decryption", async () => {
  const cipher = await fixture();
  const sealed = await cipher.encrypt("private-tax-id", context);
  for (const field of ["tenantId", "recordId", "field"] as const) {
    await assert.rejects(() => cipher.decrypt(sealed, { ...context, [field]: "other" }), { message: "FIELD_CRYPTO_FAILED" });
  }
  const altered = (value: string) => (value[0] === "A" ? "B" : "A") + value.slice(1);
  for (const field of ["iv", "ciphertext"] as const) {
    await assert.rejects(() => cipher.decrypt({ ...sealed, [field]: altered(sealed[field]) }, context), { message: "FIELD_CRYPTO_FAILED" });
  }
});

test("each encryption gets a fresh IV and old keys remain readable during rotation", async () => {
  const oldKey = await key(); const newKey = await key(new Uint8Array(32).fill(7));
  const keys = new Map([["k1", oldKey], ["k2", newKey]]);
  const getKey = async (id: string) => { const value = keys.get(id); if (!value) throw new Error("unknown key"); return value; };
  const old = createFieldCipher({ activeKeyId: "k1", getKey });
  const rotated = createFieldCipher({ activeKeyId: "k2", getKey });
  const first = await old.encrypt("same", context); const second = await old.encrypt("same", context);
  assert.notEqual(first.iv, second.iv);
  assert.equal(await rotated.decrypt(first, context), "same");
  assert.equal((await rotated.encrypt("new", context)).keyId, "k2");
  keys.delete("k1");
  await assert.rejects(() => rotated.decrypt(first, context), { message: "FIELD_CRYPTO_FAILED" });
});

test("wrong keys, extractable keys and malformed envelopes expose only a safe crypto error", async () => {
  const original = await fixture(); const sealed = await original.encrypt("private", context);
  const other = await key(new Uint8Array(32).fill(9));
  await assert.rejects(() => createFieldCipher({ activeKeyId: "k1", getKey: async () => other }).decrypt(sealed, context), { message: "FIELD_CRYPTO_FAILED" });
  const extractable = await key(new Uint8Array(32), true);
  await assert.rejects(() => createFieldCipher({ activeKeyId: "k1", getKey: async () => extractable }).encrypt("private", context), { message: "FIELD_CRYPTO_FAILED" });
  await assert.rejects(() => original.decrypt({ ...sealed, iv: "malformed=" }, context), { message: "FIELD_CRYPTO_FAILED" });
});

test("field size is limited by UTF-8 bytes, including multibyte text", async () => {
  const cipher = await fixture();
  await assert.rejects(() => cipher.encrypt("ế".repeat(30_000), context), { message: "FIELD_CRYPTO_FAILED" });
  const limit = "a".repeat(65_536);
  assert.equal(await cipher.decrypt(await cipher.encrypt(limit, context), context), limit);
});

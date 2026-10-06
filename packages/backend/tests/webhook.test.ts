import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { createWebhookVerifier } from "../src/webhook.ts";

const now = 1_800_000_000_000;
const secret = Buffer.from("0123456789abcdef0123456789abcdef");
const key = () => crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
function signed(body = '{"name":"Acme"}', id = "delivery-1", timestamp = String(now / 1000)) {
  const signature = createHmac("sha256", secret).update(`v1.vendor:customers.${timestamp}.${id}.`).update(body).digest("hex");
  return new Request("https://app.example/api/webhook", { method: "POST", body, headers: {
    "x-webhook-id": id, "x-webhook-timestamp": timestamp, "x-webhook-signature": `v1=${signature}`,
  } });
}
test("a correctly signed raw event is durably recorded before accepted", async () => {
  const stored: string[] = [];
  const verifier = createWebhookVerifier({ namespace: "vendor:customers", now: () => now, getKeys: async () => [await key()],
    storeEvent: async event => { stored.push(new TextDecoder().decode(event.body)); return true; },
  });
  assert.deepEqual(await verifier.verify(signed()), { status: "accepted", id: "delivery-1" });
  assert.deepEqual(stored, ['{"name":"Acme"}']);
});

test("stale and far-future timestamps are rejected before storing an event", async () => {
  const verifier = createWebhookVerifier({ namespace: "vendor:customers", now: () => now, getKeys: async () => [await key()], storeEvent: async () => true });
  for (const delta of [-301, 301]) {
    await assert.rejects(() => verifier.verify(signed(undefined, undefined, String(now / 1000 + delta))), { message: "INVALID_WEBHOOK" });
  }
});

test("webhook rejects oversized raw payloads even when the signature is valid", async () => {
  const verifier = createWebhookVerifier({ namespace: "vendor:customers", now: () => now, maxBodyBytes: 16,
    getKeys: async () => [await key()], storeEvent: async () => true,
  });
  await assert.rejects(() => verifier.verify(signed('{"name":"' + 'x'.repeat(100) + '"}')), { message: "INVALID_WEBHOOK" });
});

test("a stalled webhook upload is rejected within the configured timeout", async () => {
  const original = signed();
  const init: RequestInit & { duplex: "half" } = { method: "POST", headers: original.headers,
    body: new ReadableStream({ start() {} }), duplex: "half" };
  const stalled = new Request(original.url, init);
  const verifier = createWebhookVerifier({ namespace: "vendor:customers", now: () => now, timeoutMs: 10,
    getKeys: async () => [await key()], storeEvent: async () => true,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await assert.rejects(() => Promise.race([
      verifier.verify(stalled),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("test deadline")), 200); }),
    ]), { message: "INVALID_WEBHOOK" });
  } finally { clearTimeout(timer); }
});

test("a webhook signed for one endpoint namespace cannot be reused at another", async () => {
  const verifier = createWebhookVerifier({ namespace: "other:customers", now: () => now,
    getKeys: async () => [await key()], storeEvent: async () => true,
  });
  await assert.rejects(() => verifier.verify(signed()), { message: "INVALID_WEBHOOK" });
});

test("modified raw bytes, ID, timestamp or signature cannot reach the inbox", async () => {
  let stored = 0;
  const verifier = createWebhookVerifier({ namespace: "vendor:customers", now: () => now,
    getKeys: async () => [await key()], storeEvent: async () => { stored++; return true; },
  });
  const original = signed();
  await assert.rejects(() => verifier.verify(new Request(original.url, { method: "POST", headers: original.headers, body: '{ "name": "Acme" }' })), { message: "INVALID_WEBHOOK" });
  for (const [header, value] of [["x-webhook-id", "delivery-2"], ["x-webhook-timestamp", String(now / 1000 - 1)], ["x-webhook-signature", "v1=" + "0".repeat(64)]]) {
    const modified = signed(); modified.headers.set(header!, value!);
    await assert.rejects(() => verifier.verify(modified), { message: "INVALID_WEBHOOK" });
  }
  assert.equal(stored, 0);
});

test("an atomic inbox admits one of two concurrent duplicates", async () => {
  const inbox = new Map<string, Uint8Array>();
  const verifier = createWebhookVerifier({ namespace: "vendor:customers", now: () => now,
    getKeys: async () => [await key()], storeEvent: async event => {
      const id = `${event.namespace}:${event.id}`;
      if (inbox.has(id)) return false;
      inbox.set(id, event.body); return true;
    },
  });
  const results = await Promise.all([verifier.verify(signed()), verifier.verify(signed())]);
  assert.deepEqual(results.map(result => result.status).sort(), ["accepted", "duplicate"]);
  assert.equal(inbox.size, 1);
});

test("key lookup and durable inbox failures fail closed without leaking details", async () => {
  const options = { namespace: "vendor:customers", now: () => now, getKeys: async () => [await key()], storeEvent: async () => true };
  for (const failure of [
    { getKeys: async () => { throw new Error("secret-key-material"); } },
    { storeEvent: async () => { throw new Error("postgres-credentials"); } },
  ]) {
    await assert.rejects(() => createWebhookVerifier({ ...options, ...failure }).verify(signed()), { message: "UNAVAILABLE" });
  }
});

test("previous signing keys remain valid during controlled rotation", async () => {
  const other = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256", length: 256 }, false, ["verify"]);
  const options = { namespace: "vendor:customers", now: () => now, storeEvent: async () => true };
  assert.equal((await createWebhookVerifier({ ...options, getKeys: async () => [other, await key()] }).verify(signed())).status, "accepted");
  await assert.rejects(() => createWebhookVerifier({ ...options, getKeys: async () => [other] }).verify(signed()), { message: "INVALID_WEBHOOK" });
});

test("timestamp is checked again if key lookup crosses the validity window", async () => {
  let clock = now;
  const verifier = createWebhookVerifier({ namespace: "vendor:customers", now: () => clock, getKeys: async () => { clock += 301_000; return [await key()]; }, storeEvent: async () => true });
  await assert.rejects(() => verifier.verify(signed()), { message: "INVALID_WEBHOOK" });
});

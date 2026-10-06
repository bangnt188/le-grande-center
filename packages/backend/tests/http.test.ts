import assert from "node:assert/strict";
import test from "node:test";
import { createHttpsClient } from "../src/http.ts";

const parseName = (input: unknown) => {
  if (!input || typeof input !== "object" || !("name" in input) || typeof input.name !== "string") throw new Error("bad response");
  return { name: input.name };
};
test("HTTPS client sends JSON and server credentials and parses a minimal response", async () => {
  let sent: Request | undefined;
  const client = createHttpsClient({
    origin: "https://api.vendor.example",
    headers: async () => ({ authorization: "Bearer server-secret" }),
    fetch: async (url, init) => { sent = new Request(url, init); return Response.json({ name: "Acme", internal: "hide" }); },
  });
  assert.deepEqual(await client.request("/customers", { method: "POST", body: { name: "Acme" }, parse: parseName }), { name: "Acme" });
  assert.equal(sent?.url, "https://api.vendor.example/customers");
  assert.equal(sent?.headers.get("authorization"), "Bearer server-secret");
  assert.deepEqual(await sent?.json(), { name: "Acme" });
});

test("timeout covers a stalled transport even if it ignores cancellation", async () => {
  const client = createHttpsClient({ origin: "https://api.vendor.example", timeoutMs: 10, fetch: async () => new Promise<Response>(() => {}) });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await assert.rejects(() => Promise.race([
      client.request("/customers", { parse: parseName }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("test deadline")), 200); }),
    ]), { message: "TIMEOUT" });
  } finally { clearTimeout(timer); }
});

test("response size is bounded even without Content-Length", async () => {
  const client = createHttpsClient({ origin: "https://api.vendor.example", maxResponseBytes: 32,
    fetch: async () => Response.json({ name: "x".repeat(100) }),
  });
  await assert.rejects(() => client.request("/customers", { parse: parseName }), { message: "UPSTREAM_ERROR" });
});

test("oversized JSON requests are rejected before transport", async () => {
  const client = createHttpsClient({ origin: "https://api.vendor.example", maxRequestBytes: 32,
    fetch: async () => { throw new Error("must not send"); },
  });
  await assert.rejects(() => client.request("/customers", { method: "POST", body: { name: "x".repeat(100) }, parse: parseName }), { message: "INVALID_INPUT" });
});

test("client rejects non-HTTPS, local/IP destinations, credentials and off-origin paths", async () => {
  for (const origin of ["http://api.vendor.example", "https://localhost", "https://127.0.0.1", "https://169.254.169.254", "https://[::1]", "https://service.internal", "https://user:pass@api.vendor.example", "https://api.vendor.example/path"]) {
    assert.throws(() => createHttpsClient({ origin }), { message: "INVALID_INPUT" });
  }
  const client = createHttpsClient({ origin: "https://api.vendor.example", fetch: async () => { throw new Error("never send"); } });
  for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", "/customers#token"]) {
    await assert.rejects(() => client.request(path, { parse: parseName }), { message: "INVALID_INPUT" });
  }
});

test("redirect and upstream errors expose no provider payload and mutation is never retried", async () => {
  let calls = 0;
  const client = createHttpsClient({ origin: "https://api.vendor.example", fetch: async (_url, init) => {
    assert.equal(init?.redirect, "error");
    calls++;
    return new Response("sensitive-provider-token", { status: 302, headers: { location: "https://evil.example" } });
  } });
  await assert.rejects(() => client.request("/charge", { method: "POST", body: {}, parse: parseName }), { message: "UPSTREAM_ERROR" });
  assert.equal(calls, 1);
});

test("response schema and content type are validated before returning data", async () => {
  for (const response of [Response.json({ password: "secret" }), new Response('<html>secret</html>', { headers: { "content-type": "text/html" } }), new Response('{bad', { headers: { "content-type": "application/json" } })]) {
    const client = createHttpsClient({ origin: "https://api.vendor.example", fetch: async () => response });
    await assert.rejects(() => client.request("/customers", { parse: parseName }), { message: "UPSTREAM_ERROR" });
  }
});

test("timeout also covers slow headers and a response body that never finishes", async () => {
  const stalled = new ReadableStream<Uint8Array>({ start() {} });
  for (const options of [
    { headers: async () => new Promise<HeadersInit>(() => {}), fetch: async () => Response.json({ name: "Acme" }) },
    { fetch: async () => new Response(stalled, { headers: { "content-type": "application/json" } }) },
  ]) {
    const client = createHttpsClient({ origin: "https://api.vendor.example", timeoutMs: 10, ...options });
    await assert.rejects(() => client.request("/customers", { parse: parseName }), { message: "TIMEOUT" });
  }
});

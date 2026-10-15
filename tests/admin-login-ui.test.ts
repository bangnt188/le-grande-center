import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config";


test("next.config defines global security headers", async () => {
  assert.equal(typeof nextConfig.headers, "function");
  const headersConfig = await nextConfig.headers!();
  assert.ok(Array.isArray(headersConfig));
  const globalRule = headersConfig.find(rule => rule.source === "/:path*");
  assert.ok(globalRule, "Should have a global rule for /:path*");
  
  const headersMap = new Map(globalRule.headers.map(h => [h.key, h.value]));
  assert.equal(headersMap.get("X-Frame-Options"), "SAMEORIGIN");
  assert.equal(headersMap.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headersMap.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.ok(headersMap.get("Strict-Transport-Security")?.includes("max-age="));
  assert.ok(headersMap.get("Permissions-Policy")?.includes("camera=()"));
});

test("password prefix transformation adds prefix when configured", async () => {
  const { applyPasswordPrefix, transformPasswordRequest } = await import("../src/server/auth");
  const originalEnv = process.env.PASSWORD_PREFIX;
  try {
    process.env.PASSWORD_PREFIX = "test_pref_";
    assert.equal(applyPasswordPrefix("mypass"), "test_pref_mypass");

    const req = new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "42" },
      body: JSON.stringify({ email: "user@example.com", password: "raw_password" }),
    });

    const transformed = await transformPasswordRequest(req);
    const body = await transformed.json();
    assert.equal(body.password, "test_pref_raw_password");
    assert.equal(body.email, "user@example.com");
    assert.equal(transformed.headers.has("content-length"), false);

    // Without prefix
    delete process.env.PASSWORD_PREFIX;
    assert.equal(applyPasswordPrefix("mypass"), "mypass");
    const req2 = new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "raw_password" }),
    });
    const untouched = await transformPasswordRequest(req2);
    assert.equal(untouched, req2);
  } finally {
    if (originalEnv !== undefined) process.env.PASSWORD_PREFIX = originalEnv;
    else delete process.env.PASSWORD_PREFIX;
  }
});



import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT, decodeJwt } from "jose";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, AdminSessionError, adminCookie, clearAdminCookie, mintAdminSession, requireAdministrator, sessionDTO, verifyAdminToken } from "../src/server/admin-session";
import { requireAdmin } from "../src/server/auth";
import { withAdminTransaction, WorkspaceError, type AdminIdentity } from "../src/server/database";
const secret = "owned-test-session-key-not-a-production-secret";
const provider = { issuer: "https://owned-auth.example.test", subject: "provider-user-123", expiresAt: Date.now() + 3_600_000 };
const identity: AdminIdentity = { id: "25f3093b-e593-4d78-a9a4-c9d2a129ce77", propertyId: "44b414cc-3742-43eb-aee3-cc49254c7ed4", role: "editor", email: "test@example.test" };

test("signed admin expiry is fixed900s, provider bounded, and warm verification does not slide", async () => {
  const now = Math.floor(Date.now() / 1000) * 1000;
  const minted = await mintAdminSession(identity, provider, now, secret);
  assert.equal(minted.identity.verifiedSession.expiresAt, now + ADMIN_SESSION_SECONDS * 1000);
  const warm = await verifyAdminToken(minted.token, now + 899_000, secret);
  assert.equal(warm.id, identity.id); assert.equal(warm.propertyId, identity.propertyId); assert.equal(warm.verifiedSession!.subject, provider.subject);
  assert.equal(warm.verifiedSession!.expiresAt, minted.identity.verifiedSession.expiresAt);
  await assert.rejects(verifyAdminToken(minted.token, now + 900_000, secret), error => error instanceof AdminSessionError && error.code === "SESSION_EXPIRED");
  const shorter = await mintAdminSession(identity, { ...provider, expiresAt: now + 32_000 }, now, secret);
  assert.equal(shorter.identity.verifiedSession.expiresAt, now + 32_000);
  const cookie = adminCookie(minted.token, minted.identity.verifiedSession.expiresAt);
  for (const flag of ["Path=/", "HttpOnly", "Secure", "SameSite=Lax"]) assert.ok(cookie.includes(flag));
  assert.ok(!cookie.includes("Domain=")); assert.ok(clearAdminCookie().includes("Max-Age=0"));
});

test("tampered and incorrectly bound sessions fail closed before any repository work", async () => {
  const now = Math.floor(Date.now() / 1000) * 1000;
  const { token } = await mintAdminSession(identity, provider, now, secret);
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ ...decodeJwt(token), role: "administrator" })).toString("base64url");
  await assert.rejects(verifyAdminToken(parts.join("."), now, secret), AdminSessionError);
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveBits"]);
  const key = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("le-grande-centre:admin"), info: new TextEncoder().encode("signed-admin-session:v1") }, material, 256));
  const payload = decodeJwt(token);
  for (const changes of [{ iss: "other" }, { aud: "other" }, { role: "root" }, { role: "viewer" }, { owner: true }, { propertyId: "invalid" }, { providerSubject: "" }, { iat: now / 1000 - 901 }, { v: 2 }]) {
    const forged = await new SignJWT({ ...payload, ...changes }).setProtectedHeader({ alg: "HS256", typ: "lgc-admin+jwt" }).sign(key);
    await assert.rejects(verifyAdminToken(forged, now, secret), AdminSessionError);
  }
  const wrongType = await new SignJWT(payload).setProtectedHeader({ alg: "HS256", typ: "JWT" }).sign(key);
  await assert.rejects(verifyAdminToken(wrongType, now, secret), AdminSessionError);
  await assert.rejects(verifyAdminToken(token, now, ""), error => error instanceof WorkspaceError && error.status === 503);
});

test("warm request uses only signed identity; owner maps to Administrator and expired writes never open a transaction", async () => {
  const previousSecret = process.env.NEON_AUTH_COOKIE_SECRET, originalFetch = globalThis.fetch;
  let providerCalls = 0;
  try {
    process.env.NEON_AUTH_COOKIE_SECRET = secret;
    globalThis.fetch = async () => { providerCalls++; throw new Error("Unexpected auth/network lookup"); };
    const { token } = await mintAdminSession(identity, provider);
    const warm = await requireAdmin(new Request("https://admin.example.test/api/admin/screens/floors", { headers: { cookie: `${ADMIN_COOKIE}=${token}` } }));
    assert.deepEqual(sessionDTO(warm), { actorId: identity.id, propertyId: identity.propertyId, role: "editor", expiresAt: warm.verifiedSession!.expiresAt });
    assert.equal(providerCalls, 0);
    assert.throws(() => requireAdministrator(warm), error => error instanceof WorkspaceError && error.status === 403);
    const root = await mintAdminSession({ ...identity, role: "root" }, provider);
    assert.equal(sessionDTO(await verifyAdminToken(root.token)).role, "administrator");
    requireAdministrator(await verifyAdminToken(root.token));
    await assert.rejects(requireAdmin(new Request("https://admin.example.test/api/admin/session")), error => error instanceof AdminSessionError && error.code === "SESSION_MISSING");
    const expired = { ...warm, verifiedSession: { ...warm.verifiedSession!, expiresAt: Date.now() - 1 } };
    let opened = false;
    await assert.rejects(withAdminTransaction(expired, async () => { opened = true; }), AdminSessionError);
    assert.equal(opened, false); assert.equal(providerCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousSecret === undefined) delete process.env.NEON_AUTH_COOKIE_SECRET; else process.env.NEON_AUTH_COOKIE_SECRET = previousSecret;
  }
});

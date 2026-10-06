import assert from "node:assert/strict";
import test from "node:test";
import { AccessError, createAccessBackend, evaluateAccess, getCapabilities, type AccessContext, type AccessResource, type DecisionAudit } from "../src/index.ts";

const now = 1_800_000_000_000;
const resource: AccessResource = { kind: "object", type: "contracts", id: "contract-1", tenantId: "owner-1", propertyId: "mall-1", organizationId: "customer-1", ownerId: "user-1" };
const context = (): AccessContext => ({
  sessionExpiresAt: now + 60_000,
  principal: { actorId: "user-1", issuer: "https://identity.example", subject: "subject-1", disabled: false, policyVersion: "version-1", grants: [
    { permission: "contracts:view", effect: "allow", scope: { tenantId: "owner-1", propertyId: "mall-1", organizationId: "customer-1" } },
  ] },
});

test("object access never crosses tenant, property, organization, resource type, or object grant", () => {
  const c = context();
  assert.equal(evaluateAccess(c, "contracts:view", resource, now).allowed, true);
  for (const field of ["tenantId", "propertyId", "organizationId"] as const) {
    assert.equal(evaluateAccess(c, "contracts:view", { ...resource, [field]: "other" }, now).allowed, false);
  }
  assert.equal(evaluateAccess(c, "contracts:view", { ...resource, type: "customers" }, now).allowed, false);
  c.principal.grants = [{ ...c.principal.grants[0]!, resourceId: "contract-2" }];
  assert.equal(evaluateAccess(c, "contracts:view", resource, now).allowed, false);
});

test("deny wins regardless of grant order and an empty policy denies everything", () => {
  const c = context();
  const deny = { permission: "contracts:view", effect: "deny" as const, scope: { tenantId: "owner-1" } };
  for (const grants of [[...c.principal.grants, deny], [deny, ...c.principal.grants], []]) {
    assert.equal(evaluateAccess({ ...c, principal: { ...c.principal, grants } }, "contracts:view", resource, now).allowed, false);
  }
});

test("never combines property from one grant and organization from another", () => {
  const c = context();
  c.principal.grants = [
    { permission: "contracts:view", effect: "allow", scope: { tenantId: "owner-1", propertyId: "mall-1", organizationId: "customer-2" } },
    { permission: "contracts:view", effect: "allow", scope: { tenantId: "owner-1", propertyId: "mall-2", organizationId: "customer-1" } },
  ];
  assert.equal(evaluateAccess(c, "contracts:view", resource, now).allowed, false);
});

test("session/grant expiry uses exclusive expiry, and future grants are not yet valid", () => {
  const c = context();
  assert.equal(evaluateAccess(c, "contracts:view", resource, c.sessionExpiresAt).reason, "expired-session");
  c.principal.grants = [{ ...c.principal.grants[0]!, expiresAt: now }];
  assert.equal(evaluateAccess(c, "contracts:view", resource, now).allowed, false);
  c.principal.grants = [{ ...c.principal.grants[0]!, notBefore: now + 1 }];
  assert.equal(evaluateAccess(c, "contracts:view", resource, now).allowed, false);
});

test("disabled principals, malformed scopes, wildcard permissions and missing object facts fail closed", () => {
  const c = context();
  assert.equal(evaluateAccess({ ...c, principal: { ...c.principal, disabled: true } }, "contracts:view", resource, now).allowed, false);
  c.principal.grants = [{ ...c.principal.grants[0]!, scope: { tenantId: "" } }];
  assert.equal(evaluateAccess(c, "contracts:view", resource, now).reason, "invalid-context");
  assert.equal(evaluateAccess(context(), "contracts:*", resource, now).allowed, false);
  assert.equal(evaluateAccess(context(), "contracts:view", { ...resource, id: undefined }, now).allowed, false);
});

test("narrow organization grants cannot authorize a broad list; capabilities are only permission strings", () => {
  const list: AccessResource = { kind: "collection", type: "contracts", tenantId: "owner-1", propertyId: "mall-1" };
  assert.equal(evaluateAccess(context(), "contracts:view", list, now).allowed, false);
  const scopedList = { ...list, organizationId: "customer-1" };
  assert.deepEqual(getCapabilities(context(), ["contracts:update", "contracts:view", "contracts:view"], scopedList, now), ["contracts:view"]);
});

const request = new Request("https://app.example/api/contracts/contract-1");
const input = { permission: "contracts:view", resource };
function setup(overrides: Partial<Parameters<typeof createAccessBackend>[0]> = {}) {
  const events: DecisionAudit[] = [];
  const backend = createAccessBackend({
    now: () => now,
    verifySession: async () => ({ issuer: context().principal.issuer, subject: context().principal.subject, expiresAt: now + 60_000 }),
    loadPrincipal: async () => context().principal,
    recordDecision: async event => { events.push(event); },
    ...overrides,
  });
  return { backend, events };
}
const errorCode = (code: AccessError["code"]) => (error: unknown) => error instanceof AccessError && error.code === code;

test("backend binds session issuer/subject to server principal; browser role headers do not grant access", async () => {
  const { backend, events } = setup({ loadPrincipal: async () => ({ ...context().principal, subject: "different-subject" }) });
  await assert.rejects(() => backend.requireAccess(request, input), errorCode("FORBIDDEN"));
  assert.equal(events[0]?.reason, "identity-mismatch");
  const denied = setup({ loadPrincipal: async () => ({ ...context().principal, grants: [] }) }).backend;
  const forged = new Request(request.url, { headers: { "x-role": "administrator", "x-tenant-id": "owner-1" } });
  await assert.rejects(() => denied.requireAccess(forged, input), errorCode("FORBIDDEN"));
});

test("a revoked grant takes effect on the next request without a process cache", async () => {
  let current = context().principal;
  let loads = 0;
  const { backend } = setup({ loadPrincipal: async () => { loads++; return current; } });
  await backend.requireAccess(request, input);
  current = { ...current, policyVersion: "version-2", grants: [] };
  await assert.rejects(() => backend.requireAccess(request, input), errorCode("FORBIDDEN"));
  assert.equal(loads, 2);
});

test("missing/expired session denies before loading principal, and adapter failures never allow", async () => {
  let loads = 0;
  const noSession = setup({ verifySession: async () => null, loadPrincipal: async () => { loads++; return context().principal; } });
  await assert.rejects(() => noSession.backend.requireAccess(request, input), errorCode("UNAUTHENTICATED"));
  assert.equal(loads, 0);
  const failedAdapters = [
    { verifySession: async () => { throw new Error("provider unavailable"); } },
    { loadPrincipal: async () => { throw new Error("DB unavailable"); } },
    { recordDecision: async () => { throw new Error("audit unavailable"); } },
  ];
  for (const adapters of failedAdapters) {
    await assert.rejects(() => setup(adapters).backend.requireAccess(request, input), errorCode("UNAVAILABLE"));
  }
});

test("a session that expires while audit writes must not reach the domain operation", async () => {
  let clock = now;
  const { backend } = setup({ now: () => clock, recordDecision: async () => { clock = now + 60_000; } });
  await assert.rejects(() => backend.requireAccess(request, input), errorCode("UNAUTHENTICATED"));
});

test("an object with missing organization facts cannot bypass a narrow deny through a broad allow", () => {
  const c = context();
  c.principal.grants = [
    { permission: "contracts:view", effect: "allow", scope: { tenantId: "owner-1" } },
    { permission: "contracts:view", effect: "deny", scope: { tenantId: "owner-1", organizationId: "customer-1" } },
  ];
  assert.equal(evaluateAccess(c, "contracts:view", { ...resource, organizationId: undefined }, now).reason, "explicit-deny");
});

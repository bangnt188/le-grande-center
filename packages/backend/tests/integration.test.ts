import assert from "node:assert/strict";
import test from "node:test";
import { createFieldCipher, type DecisionAudit } from "../src/index.ts";
import type { PgQuery } from "../src/postgres.ts";
import { createCustomerExample } from "../examples/customers.ts";

test("HTTP → auth → scoped CRUD → encrypted storage → role-specific DTO works together", async () => {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const cipher = createFieldCipher({ activeKeyId: "k1", getKey: async () => key });
  const rows = new Map<string, Record<string, unknown>>();
  const audit: DecisionAudit[] = [];
  let privateRead = false;
  const query: PgQuery = async (text, values) => {
    if (text.startsWith("INSERT")) {
      const [id, tenantId, propertyId, name, taxId] = values;
      const row = { id, tenant_id: tenantId, property_id: propertyId, name, tax_id_cipher: taxId, version: 1 };
      rows.set(String(id), row); return { rows: [row] };
    }
    if (text.startsWith("SELECT *")) {
      const row = rows.get(String(values[2]));
      return { rows: row && row.tenant_id === values[0] && row.property_id === values[1] ? [row] : [] };
    }
    throw new Error("Unimplemented test DB operation");
  };
  const example = createCustomerExample({
    origin: "https://app.example", cipher,
    verifySession: async () => ({ issuer: "https://identity.example", subject: "staff-1", expiresAt: Date.now() + 60_000 }),
    runInTransaction: async work => work(query),
    resolveScope: async () => ({ tenantId: "owner-1", propertyId: "mall-1" }),
    loadPrincipal: async identity => ({ actorId: "staff-1", ...identity, disabled: false, policyVersion: "v1", grants:
      ["customers:create", "customers:view", ...(privateRead ? ["customers:view-tax-id"] : [])].map(permission => ({ permission, effect: "allow", scope: { tenantId: "owner-1", propertyId: "mall-1" } })),
    }),
    recordDecision: async event => { audit.push(event); },
  });
  const created = await example.handlers.collection.POST(new Request("https://app.example/api/customers", {
    method: "POST", headers: { origin: "https://app.example", "content-type": "application/json" }, body: '{"name":"Acme","taxId":"0312345678"}',
  }));
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal("taxId" in body.data, false);
  assert.equal(JSON.stringify([...rows.values()]).includes("0312345678"), false);
  const context = { params: Promise.resolve({ id: body.data.id }) };
  privateRead = true;
  const permitted = await example.handlers.item.GET(new Request("https://app.example/api/customers/" + body.data.id), context);
  assert.equal((await permitted.json()).data.taxId, "0312345678");
  privateRead = false;
  const redacted = await example.handlers.item.GET(new Request("https://app.example/api/customers/" + body.data.id), context);
  assert.equal("taxId" in (await redacted.json()).data, false);
  assert.equal(JSON.stringify(audit).includes("0312345678"), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import { BackendError, createAccessBackend, objectInput, textInput } from "@shared/backend";
import { createMallWorkspaceApi, type MallWorkspaceUnit } from "../src/server/workspace-api";
import type { AdminSnapshot } from "../src/shared/admin/contracts";
import { makeDemoSnapshot } from "../src/features/admin/demo/data";
const origin = "https://mall.example";
const snapshot: AdminSnapshot = { ...makeDemoSnapshot(), revision: 1, storage: null, slots: [], groups: [], leads: [], media: [], companies: [], requests: [], reservations: [], leases: [], appointments: [] };
function fixture() {
  let state = structuredClone(snapshot);
  let allowed = true;
  const scope = { tenantId: "mall-owner", propertyId: "centre" };
  const verifySession = async () => ({ issuer: "mall", subject: "staff", expiresAt: Date.now() + 60000 });
  const access = createAccessBackend({ verifySession,
    loadPrincipal: async () => ({ actorId: "staff", issuer: "mall", subject: "staff", disabled: false, policyVersion: "1", grants: ["workspace:view", ...(allowed ? ["companies:update"] : [])].map(permission => ({ permission, effect: "allow", scope })) }), recordDecision: async () => {} });
  const receipts = new Map<string, string>();
  const api = createMallWorkspaceApi({ origin, verifySession, parseCommand: input => {
    const data = objectInput(input, ["type", "companyId", "note"]);
    if (data.type !== "save-company") throw new BackendError("INVALID_INPUT");
    return { type: "save-company", companyId: textInput(data.companyId), note: textInput(data.note, { minLength: 0 }) };
  }, transaction: async (_request, work) => {
    const previous = structuredClone(state);
    const savedReceipts = new Map(receipts);
    const unit: MallWorkspaceUnit = { scope, access,
      resource: async command => ({ permission: "companies:update", resource: { ...scope, kind: "object", type: "companies", id: command.type === "save-company" ? command.companyId : "unknown" } }),
      read: async () => structuredClone(state), execute: async (command, expected, key) => {
        const fingerprint = JSON.stringify(command);
        if (receipts.has(key)) { if (receipts.get(key) !== fingerprint) throw new BackendError("CONFLICT"); return; }
        if (expected !== state.revision) throw new BackendError("CONFLICT");
        state.revision++; receipts.set(key, fingerprint);
      },
    };
    try { return await work(unit); } catch (error) { state = previous; receipts.clear(); for (const [key, value] of savedReceipts) receipts.set(key, value); throw error; }
  } });
  return { api, deny: () => { allowed = false; } };
}
test("Mall command validates Origin, operation permission, revision and durable receipt contract", async () => {
  const { api, deny } = fixture();
  const key = "90000000-0000-4000-8000-000000000001";
  const send = (expectedRevision: number, requestOrigin = origin, idempotencyKey = key) => api.commands(new Request(origin + "/commands", {
    method: "POST", headers: { origin: requestOrigin, "content-type": "application/json", "idempotency-key": idempotencyKey },
    body: JSON.stringify({ command: { type: "save-company", companyId: "company-1", note: "" }, expectedRevision }),
  }));
  assert.equal((await send(1, "https://evil.example")).status, 403);
  assert.equal((await send(1, origin, "invalid")).status, 400);
  assert.equal((await send(1)).status, 200);
  assert.equal((await send(1)).status, 200);
  assert.equal((await send(1, origin, "90000000-0000-4000-8000-000000000002")).status, 409);
  deny(); assert.equal((await send(2)).status, 403);
  const state = await (await api.workspace(new Request(origin + "/workspace"))).json();
  assert.equal(state.revision, 2);
});

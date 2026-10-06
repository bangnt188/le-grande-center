import { createAccessBackend } from "../../src/access.ts";
import { createCrud, type CrudOptions, type CrudRow, type CrudUnit } from "../../src/crud.ts";
import type { AccessGrant } from "../../src/policy.ts";

export type Customer = CrudRow & { name: string; taxId: string };
export type Form = { name: string; taxId: string };
export const scope = { tenantId: "owner-1", propertyId: "mall-1" };
export const request = new Request("https://app.example/api/customers");
const fixedNow = 1_800_000_000_000;
const scoped = (row: Customer) => row.tenantId === scope.tenantId && row.propertyId === scope.propertyId;
export function fixture(options: { grants?: AccessGrant[]; rows?: Customer[]; afterUpdate?: (row: Customer) => Customer; project?: CrudOptions<Customer, Form, Partial<Form>, { id: string; name: string; version: number }>["project"] } = {}) {
  let rows = structuredClone(options.rows ?? []);
  let nextId = 1;
  let queue = Promise.resolve();
  let grants = options.grants ?? ["view", "create", "update", "delete"].map(action => ({ permission: `customers:${action}`, effect: "allow" as const, scope }));
  const access = createAccessBackend({
    now: () => fixedNow,
    verifySession: async () => ({ issuer: "https://identity.example", subject: "staff-1", expiresAt: fixedNow + 60_000 }),
    loadPrincipal: async () => ({ actorId: "staff-1", issuer: "https://identity.example", subject: "staff-1", disabled: false, policyVersion: "v1", grants }),
    recordDecision: async () => {},
  });
  const transaction: CrudOptions<Customer, Form, Partial<Form>, { id: string; name: string; version: number }>["transaction"] = async (_request, work) => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    const snapshot = structuredClone(rows);
    const unit: CrudUnit<Customer, Form, Partial<Form>> = {
      scope, access,
      repository: {
        find: async id => rows.find(row => row.id === id && scoped(row)) ?? null,
        list: async (_scope, { offset, limit }) => {
          const visible = rows.filter(scoped).sort((a, b) => a.id.localeCompare(b.id));
          return { items: visible.slice(offset, offset + limit), totalItems: visible.length };
        },
        insert: async data => { const row = { ...data, ...scope, id: `customer-${nextId++}`, version: 1 }; rows.push(row); return row; },
        update: async (id, data, version) => {
          const index = rows.findIndex(row => row.id === id && scoped(row) && row.version === version);
          if (index === -1) return null;
          const changed = { ...rows[index]!, ...data, version: version + 1 };
          const row = options.afterUpdate ? options.afterUpdate(changed) : changed; rows[index] = row; return row;
        },
        delete: async (id, version) => {
          const index = rows.findIndex(row => row.id === id && scoped(row) && row.version === version);
          if (index === -1) return false;
          rows.splice(index, 1); return true;
        },
      },
    };
    try { return await work(unit); }
    catch (error) { rows = snapshot; throw error; }
    finally { release(); }
  };
  const crud = createCrud<Customer, Form, Partial<Form>, { id: string; name: string; version: number }>({
    type: "customers", transaction,
    parseCreate: input => {
      if (!input || typeof input !== "object" || !("name" in input) || typeof input.name !== "string" || !input.name.trim()) throw new Error("name required");
      return { name: input.name.trim(), taxId: "taxId" in input && typeof input.taxId === "string" ? input.taxId : "" };
    },
    parseUpdate: input => {
      if (!input || typeof input !== "object" || !("name" in input) || typeof input.name !== "string" || !input.name.trim()) throw new Error("name required");
      return { name: input.name.trim() };
    },
    project: options.project ?? (row => ({ id: row.id, name: row.name, version: row.version })),
  });
  return { crud, revoke: () => { grants = []; } };
}

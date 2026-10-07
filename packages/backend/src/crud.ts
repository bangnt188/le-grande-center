import type { createAccessBackend } from "./access.js";
import type { AccessContext, AccessResource, AccessScope } from "./policy.js";
import { validScope } from "./policy.js";
import { BackendError } from "./errors.js";
export type CrudRow = AccessScope & { id: string; version: number };
export type CrudRepository<Row extends CrudRow, Create, Update> = {
  find: (id: string, scope: AccessScope) => Promise<Row | null>;
  list: (scope: AccessScope, page: { offset: number; limit: number }) => Promise<{ items: Row[]; totalItems: number }>;
  insert: (data: Create, scope: AccessScope) => Promise<Row>;
  /** Must compare expectedVersion atomically and increment version; null = conflict. */
  update: (id: string, data: Update, expectedVersion: number, scope: AccessScope) => Promise<Row | null>;
  delete: (id: string, expectedVersion: number, scope: AccessScope) => Promise<boolean>;
};
export type CrudUnit<Row extends CrudRow, Create, Update> = {
  /** Resolve on server from active verified assignments, never body scope. */
  scope: AccessScope;
  /** Load permissions using this transaction's authoritative assignments/revision. */
  access: ReturnType<typeof createAccessBackend>;
  repository: CrudRepository<Row, Create, Update>;
};
export type CrudOptions<Row extends CrudRow, Create, Update, DTO> = {
  type: string;
  /** Commit only when work succeeds; rollback any failure. Protect policy and rows against concurrent changes. */
  transaction: <Result>(request: Request, work: (unit: CrudUnit<Row, Create, Update>) => Promise<Result>) => Promise<Result>;
  parseCreate: (input: unknown) => Create;
  parseUpdate: (input: unknown) => Update;
  /** Return only fields authorized for this actor/action. May encrypt/decrypt after the guard. */
  project: (row: Row, context: AccessContext, action: "view" | "create" | "update") => DTO | Promise<DTO>;
};
const keys = ["tenantId", "propertyId", "organizationId", "ownerId"] as const;
const validId = (id: unknown): id is string => typeof id === "string" && id.trim().length > 0 && id.length <= 256;
function parse<T>(parser: (input: unknown) => T, input: unknown): T {
  const reserved = ["id", "version", ...keys, "dimensions", "role", "grants", "__proto__", "constructor", "prototype"];
  if (!input || typeof input !== "object" || Array.isArray(input) || reserved.some(key => Object.hasOwn(input, key))) throw new BackendError("INVALID_INPUT");
  try {
    const data = parser(input);
    if (!data || typeof data !== "object" || Array.isArray(data) || reserved.some(key => Object.hasOwn(data, key))) throw new Error("Invalid parsed data");
    return data;
  } catch { throw new BackendError("INVALID_INPUT"); }
}

export function createCrud<Row extends CrudRow, Create, Update, DTO>(options: CrudOptions<Row, Create, Update, DTO>) {
  if (!/^[a-z][a-z0-9-]*$/.test(options.type) || ![options.transaction, options.parseCreate, options.parseUpdate, options.project].every(fn => typeof fn === "function")) throw new BackendError("INVALID_INPUT");
  const resource = (unit: CrudUnit<Row, Create, Update>, row?: Row): AccessResource => {
    if (!validScope(unit.scope) || (row && !validScope(row, true))) throw new BackendError("UNAVAILABLE");
    if (row && (!validId(row.id) || !Number.isSafeInteger(row.version) || row.version < 1 || keys.some(key => unit.scope[key] !== undefined && unit.scope[key] !== row[key]) || Object.entries(unit.scope.dimensions ?? {}).some(([key, value]) => row.dimensions?.[key] !== value))) throw new BackendError("UNAVAILABLE");
    const scope = row ?? unit.scope;
    return { kind: row ? "object" : "collection", type: options.type, id: row?.id,
      tenantId: scope.tenantId, propertyId: scope.propertyId, organizationId: scope.organizationId, ownerId: scope.ownerId, dimensions: scope.dimensions };
  };
  return {
    async list(request: Request, pagination: { page?: number; pageSize?: number } = {}) {
      const { page = 1, pageSize = 20 } = pagination;
      const offset = (page - 1) * pageSize;
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100 || !Number.isSafeInteger(offset)) throw new BackendError("INVALID_INPUT");
      return options.transaction(request, async unit => {
        await unit.access.requireAccess(request, { permission: `${options.type}:view`, resource: resource(unit) });
        const result = await unit.repository.list(unit.scope, { offset, limit: pageSize });
        if (!Number.isSafeInteger(result.totalItems) || result.totalItems < 0 || result.items.length > pageSize || result.totalItems < result.items.length) throw new BackendError("UNAVAILABLE");
        const items: DTO[] = [];
        for (const row of result.items) {
          const context = await unit.access.requireAccess(request, { permission: `${options.type}:view`, resource: resource(unit, row) });
          items.push(await options.project(row, context, "view"));
        }
        return { items, page, pageSize, totalItems: result.totalItems, totalPages: Math.ceil(result.totalItems / pageSize) };
      });
    },
    async create(request: Request, input: unknown): Promise<DTO> {
      const data = parse(options.parseCreate, input);
      return options.transaction(request, async unit => {
        await unit.access.requireAccess(request, { permission: `${options.type}:create`, resource: resource(unit) });
        const row = await unit.repository.insert(data, unit.scope);
        const context = await unit.access.requireAccess(request, { permission: `${options.type}:create`, resource: resource(unit, row) });
        return options.project(row, context, "create");
      });
    },
    async update(request: Request, id: string, expectedVersion: number, input: unknown): Promise<DTO> {
      if (!validId(id) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new BackendError("INVALID_INPUT");
      const data = parse(options.parseUpdate, input);
      return options.transaction(request, async unit => {
        const current = await unit.repository.find(id, unit.scope);
        if (!current) throw new BackendError("NOT_FOUND");
        await unit.access.requireAccess(request, { permission: `${options.type}:update`, resource: resource(unit, current) });
        if (current.version !== expectedVersion) throw new BackendError("CONFLICT");
        const originalScope = keys.map(key => current[key]);
        const originalDimensions = { ...current.dimensions };
        const row = await unit.repository.update(id, data, expectedVersion, unit.scope);
        if (!row) throw new BackendError("CONFLICT");
        if (row.id !== id || row.version !== expectedVersion + 1 || keys.some((key, index) => row[key] !== originalScope[index]) || Object.keys({ ...originalDimensions, ...row.dimensions }).some(key => originalDimensions[key] !== row.dimensions?.[key])) throw new BackendError("UNAVAILABLE");
        const context = await unit.access.requireAccess(request, { permission: `${options.type}:update`, resource: resource(unit, row) });
        return options.project(row, context, "update");
      });
    },
    async delete(request: Request, id: string, expectedVersion: number): Promise<void> {
      if (!validId(id) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new BackendError("INVALID_INPUT");
      return options.transaction(request, async unit => {
        const current = await unit.repository.find(id, unit.scope);
        if (!current) throw new BackendError("NOT_FOUND");
        await unit.access.requireAccess(request, { permission: `${options.type}:delete`, resource: resource(unit, current) });
        if (current.version !== expectedVersion) throw new BackendError("CONFLICT");
        if (!await unit.repository.delete(id, expectedVersion, unit.scope)) throw new BackendError("CONFLICT");
      });
    },
    async get(request: Request, id: string): Promise<DTO> {
      if (!validId(id)) throw new BackendError("INVALID_INPUT");
      return options.transaction(request, async unit => {
        const row = await unit.repository.find(id, unit.scope);
        if (!row) throw new BackendError("NOT_FOUND");
        const context = await unit.access.requireAccess(request, { permission: `${options.type}:view`, resource: resource(unit, row) });
        return options.project(row, context, "view");
      });
    },
  };
}

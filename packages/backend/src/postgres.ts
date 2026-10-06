import { BackendError } from "./errors.js";
import type { CrudRow, CrudRepository } from "./crud.js";
import type { AccessScope } from "./policy.js";
export type PgQuery = (text: string, values: readonly unknown[]) => Promise<{ rows: unknown[] }>;
export type PostgresOptions<Row extends CrudRow> = {
  /** Bound to the application's current DB transaction, not a global pool.query. */
  query: PgQuery;
  schema?: string;
  table: string;
  idColumn?: string;
  versionColumn?: string;
  /** Trusted mapping of writable form fields to DB columns. */
  columns: Readonly<Record<string, string>>;
  scopeColumns: { tenantId: string } & Partial<Record<"propertyId" | "organizationId" | "ownerId", string>>;
  /** Validate DB row and map SQL column names into CrudRow facts. Never return it directly to the browser. */
  decode: (row: unknown) => Row;
};
const scopeKeys = ["tenantId", "propertyId", "organizationId", "ownerId"] as const;
const identifier = (value: string) => {
  if (typeof value !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(value)) throw new BackendError("INVALID_INPUT");
  return `"${value}"`;
};
export function createPostgresRepository<Row extends CrudRow, Create, Update>(options: PostgresOptions<Row>): CrudRepository<Row, Create, Update> {
  const table = options.schema ? `${identifier(options.schema)}.${identifier(options.table)}` : identifier(options.table);
  const id = identifier(options.idColumn ?? "id");
  const version = identifier(options.versionColumn ?? "version");
  const columns = { ...options.columns };
  const scopes = { ...options.scopeColumns };
  const names = [id, version, ...Object.values(columns).map(identifier), ...Object.values(scopes).map(identifier)];
  if (new Set(names).size !== names.length || typeof scopes.tenantId !== "string" || typeof options.query !== "function" || typeof options.decode !== "function") throw new BackendError("INVALID_INPUT");
  const scopeEntries = (scope: AccessScope): [string, unknown][] => scopeKeys.flatMap(key => {
    const value = scope[key];
    if (value === undefined && key !== "tenantId") return [];
    if (typeof value !== "string" || !value.trim() || !scopes[key]) throw new BackendError("INVALID_INPUT");
    return [[identifier(scopes[key]!), value]];
  });
  const dataEntries = (data: unknown): [string, unknown][] => {
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new BackendError("INVALID_INPUT");
    return Object.entries(data).map(([key, value]) => {
      if (!Object.hasOwn(columns, key) || value === undefined) throw new BackendError("INVALID_INPUT");
      return [identifier(columns[key]!), value];
    });
  };
  const decoded = (rows: unknown[]) => {
    if (rows.length !== 1) throw new BackendError("UNAVAILABLE");
    try { return options.decode(rows[0]); } catch { throw new BackendError("UNAVAILABLE"); }
  };
  const where = (entries: [string, unknown][], start = 1) => entries.map(([name], i) => `${name} = $${i + start}`).join(" AND ");
  return {
    async find(rowId: string, scope: AccessScope): Promise<Row | null> {
      const entries = [...scopeEntries(scope), [id, rowId] as [string, unknown]];
      const result = await options.query(`SELECT * FROM ${table} WHERE ${where(entries)}`, entries.map(([, value]) => value));
      return result.rows.length === 0 ? null : decoded(result.rows);
    },
    async list(scope: AccessScope, page: { offset: number; limit: number }): Promise<{ items: Row[]; totalItems: number }> {
      if (!Number.isSafeInteger(page.offset) || page.offset < 0 || !Number.isSafeInteger(page.limit) || page.limit < 1 || page.limit > 100) throw new BackendError("INVALID_INPUT");
      const entries = scopeEntries(scope);
      const values = entries.map(([, value]) => value);
      const count = await options.query(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where(entries)}`, values);
      const rawTotal = count.rows[0];
      if (count.rows.length !== 1 || !rawTotal || typeof rawTotal !== "object" || !("total" in rawTotal) || !/^[0-9]+$/.test(String(rawTotal.total))) throw new BackendError("UNAVAILABLE");
      const totalItems = Number(rawTotal.total);
      if (!Number.isSafeInteger(totalItems)) throw new BackendError("UNAVAILABLE");
      const result = await options.query(`SELECT * FROM ${table} WHERE ${where(entries)} ORDER BY ${id} ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, page.limit, page.offset]);
      return { items: result.rows.map(row => decoded([row])), totalItems };
    },
    async update(rowId: string, data: Update, expectedVersion: number, scope: AccessScope): Promise<Row | null> {
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || expectedVersion >= Number.MAX_SAFE_INTEGER) throw new BackendError("INVALID_INPUT");
      const changes = dataEntries(data);
      if (!changes.length) throw new BackendError("INVALID_INPUT");
      const conditions = [...scopeEntries(scope), [id, rowId] as [string, unknown], [version, expectedVersion] as [string, unknown]];
      const values = [...changes, ...conditions].map(([, value]) => value);
      const assignments = changes.map(([name], i) => `${name} = $${i + 1}`);
      assignments.push(`${version} = ${version} + 1`);
      const result = await options.query(`UPDATE ${table} SET ${assignments.join(", ")} WHERE ${where(conditions, changes.length + 1)} RETURNING *`, values);
      return result.rows.length === 0 ? null : decoded(result.rows);
    },
    async delete(rowId: string, expectedVersion: number, scope: AccessScope): Promise<boolean> {
      if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new BackendError("INVALID_INPUT");
      const conditions = [...scopeEntries(scope), [id, rowId] as [string, unknown], [version, expectedVersion] as [string, unknown]];
      const result = await options.query(`DELETE FROM ${table} WHERE ${where(conditions)} RETURNING ${id}`, conditions.map(([, value]) => value));
      if (result.rows.length > 1) throw new BackendError("UNAVAILABLE");
      return result.rows.length === 1;
    },
    async insert(data: Create, scope: AccessScope): Promise<Row> {
      const entries = [...dataEntries(data), ...scopeEntries(scope)];
      const result = await options.query(`INSERT INTO ${table} (${entries.map(([name]) => name).join(", ")}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`, entries.map(([, value]) => value));
      return decoded(result.rows);
    },
  };
}

/** Use a committed single statement, or a transaction runner that resolves only after commit.
 * Do not return true while the outer transaction is still pending; the verifier may then ACK too early.
 */
export function createPostgresWebhookInbox(options: { query: PgQuery; schema?: string; table: string }) {
  const table = options.schema ? `${identifier(options.schema)}.${identifier(options.table)}` : identifier(options.table);
  if (typeof options.query !== "function") throw new BackendError("INVALID_INPUT");
  return {
    async storeEvent(event: import("./webhook.js").WebhookEvent): Promise<boolean> {
      const result = await options.query(`INSERT INTO ${table} ("namespace", "delivery_id", "signed_at", "raw_body", "retain_until") VALUES ($1, $2, $3, $4, $5) ON CONFLICT ("namespace", "delivery_id") DO NOTHING RETURNING "delivery_id"`,
        [event.namespace, event.id, event.timestamp, event.body, event.retainUntil]);
      if (result.rows.length > 1) throw new BackendError("UNAVAILABLE");
      return result.rows.length === 1;
    },
  };
}

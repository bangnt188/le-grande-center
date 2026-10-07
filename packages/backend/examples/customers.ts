/** Copy into an app server-only module; replace relative source import with @shared/backend. */
import {
  AccessError, BackendError, createAccessBackend, createCrud, createCrudHandlers, createPostgresRepository,
  evaluateAccess, objectInput, textInput, integerInput,
  type AccessAdapters, type VerifiedSession, type CrudRow, type EncryptedField, type createFieldCipher, type PgQuery,
} from "../src/index.js";
export type CustomerRow = CrudRow & { name: string; taxIdCipher?: EncryptedField };
type Form = { name: string; taxId?: string };
type Patch = { name?: string; taxId?: string };
type StoredPatch = { name?: string; taxIdCipher?: EncryptedField };
export type CustomerDTO = { id: string; version: number; name: string; taxId?: string };
export type CustomerExampleOptions = {
  origin: string;
  cipher: ReturnType<typeof createFieldCipher>;
  verifySession: AccessAdapters["verifySession"];
  /** Use a real transaction with rollback and authoritative policy locking/revision checks. */
  runInTransaction: <T>(work: (query: PgQuery) => Promise<T>) => Promise<T>;
  resolveScope: (identity: VerifiedSession, query: PgQuery) => Promise<{ tenantId: string; propertyId: string }>;
  loadPrincipal: (identity: VerifiedSession, query: PgQuery) => Promise<unknown>;
  recordDecision: AccessAdapters["recordDecision"];
};
function decodeRow(input: unknown): CustomerRow {
  const row = objectInput(input, ["id", "version", "tenant_id", "property_id", "name", "tax_id_cipher"]);
  let taxIdCipher: EncryptedField | undefined;
  if (row.tax_id_cipher !== null && row.tax_id_cipher !== undefined) {
    const value = objectInput(row.tax_id_cipher, ["version", "algorithm", "keyId", "iv", "ciphertext"]);
    if (value.version !== 1 || value.algorithm !== "AES-256-GCM") throw new BackendError("UNAVAILABLE");
    taxIdCipher = { version: 1, algorithm: "AES-256-GCM", keyId: textInput(value.keyId), iv: textInput(value.iv), ciphertext: textInput(value.ciphertext, { maxLength: 90_000 }) };
  }
  return { id: textInput(row.id), version: integerInput(row.version, { min: 1, max: Number.MAX_SAFE_INTEGER }),
    tenantId: textInput(row.tenant_id), propertyId: textInput(row.property_id), name: textInput(row.name), taxIdCipher };
}
function parsePatch(input: unknown): Patch {
  const raw = objectInput(input, ["name", "taxId"]);
  const result: Patch = {};
  if (Object.hasOwn(raw, "name")) result.name = textInput(raw.name, { maxLength: 120 });
  if (Object.hasOwn(raw, "taxId")) result.taxId = textInput(raw.taxId, { maxLength: 64 });
  if (!Object.keys(result).length) throw new BackendError("INVALID_INPUT");
  return result;
}
/** Application composition, not a hardcoded role matrix inside the shared library. */
export function createCustomerExample(options: CustomerExampleOptions) {
  const fieldContext = (id: string, tenantId: string) => ({ tenantId, recordId: id, field: "taxId" });
  const service = createCrud<CustomerRow, Form, Patch, CustomerDTO>({
    type: "customers",
    parseCreate: input => { const data = parsePatch(input); return { ...data, name: textInput(data.name, { maxLength: 120 }) }; },
    parseUpdate: parsePatch,
    transaction: async (request, work) => {
      let session: VerifiedSession | null;
      try { session = await options.verifySession(request); }
      catch { throw new AccessError("UNAVAILABLE"); }
      if (!session || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) throw new AccessError("UNAUTHENTICATED");
      const identity = session;
      return options.runInTransaction(async query => {
        const scope = await options.resolveScope(identity, query);
        const access = createAccessBackend({ verifySession: async () => identity,
          loadPrincipal: verified => options.loadPrincipal(verified, query), recordDecision: options.recordDecision });
        const stored = createPostgresRepository<CustomerRow, StoredPatch, StoredPatch>({
          schema: "example_app", table: "customers", query, decode: decodeRow,
          scopeColumns: { tenantId: "tenant_id", propertyId: "property_id" }, columns: { name: "name", taxIdCipher: "tax_id_cipher" },
        });
        return work({ scope, access, repository: {
          ...stored,
          async insert(form, activeScope) {
            const id = crypto.randomUUID();
            const sealed = form.taxId === undefined ? null : await options.cipher.encrypt(form.taxId, fieldContext(id, activeScope.tenantId));
            // Encrypt BEFORE issuing SQL. ID and scope are server-owned; DB must default version to 1.
            const result = await query('INSERT INTO "example_app"."customers" ("id", "tenant_id", "property_id", "name", "tax_id_cipher") VALUES ($1, $2, $3, $4, $5) RETURNING *',
              [id, activeScope.tenantId, activeScope.propertyId, form.name, sealed]);
            if (result.rows.length !== 1) throw new BackendError("UNAVAILABLE");
            return decodeRow(result.rows[0]);
          },
          async update(id, patch, version, activeScope) {
            const data: StoredPatch = {};
            if (patch.name !== undefined) data.name = patch.name;
            if (patch.taxId !== undefined) data.taxIdCipher = await options.cipher.encrypt(patch.taxId, fieldContext(id, activeScope.tenantId));
            return stored.update(id, data, version, activeScope);
          },
        } });
      });
    },
    async project(row, context) {
      const result: CustomerDTO = { id: row.id, name: row.name, version: row.version };
      const resource = { kind: "object" as const, type: "customers", id: row.id, tenantId: row.tenantId, propertyId: row.propertyId };
      const decision = evaluateAccess(context, "customers:view-tax-id", resource);
      if (decision.allowed && row.taxIdCipher) {
        try { await options.recordDecision({ actorId: context.principal.actorId, policyVersion: context.principal.policyVersion, permission: "customers:view-tax-id", resource, ...decision, at: Date.now() }); }
        catch { throw new AccessError("UNAVAILABLE"); }
        result.taxId = await options.cipher.decrypt(row.taxIdCipher, fieldContext(row.id, row.tenantId));
      }
      return result;
    },
  });
  return { service, handlers: createCrudHandlers(service, { origin: options.origin }) };
}

import "server-only";
import { AccessError, BackendError, createEndpoint, integerInput, objectInput, readJson,
  type AccessContext, type AccessResource, type AccessScope, type createAccessBackend } from "@shared/backend";
import type { AdminCommand, AdminSnapshot } from "../features/admin/contracts";

export type MallWorkspaceUnit = {
  scope: AccessScope;
  access: ReturnType<typeof createAccessBackend>;
  /** Resolve DB-owned facts; never construct this resource from command tenant fields. */
  resource: (command: AdminCommand) => Promise<{ permission: string; resource: AccessResource }>;
  /** DTO projection for this actor; include only authorized data and field groups. */
  read: (context: AccessContext) => Promise<AdminSnapshot>;
  /** Atomic revision CAS + durable idempotency receipt + business invariants/outcome audit. */
  execute: (command: AdminCommand, expectedRevision: number, idempotencyKey: string, context: AccessContext) => Promise<void>;
};
/** App composition for the existing AdminRepository contract, not generic entity CRUD. */
export function createMallWorkspaceApi(options: {
  origin: string;
  verifySession: Parameters<typeof createAccessBackend>[0]["verifySession"];
  parseCommand: (input: unknown) => AdminCommand;
  /** Bind loaders/commands to one DB transaction, lock policy revision, rollback on any rejection. */
  transaction: <T>(request: Request, work: (unit: MallWorkspaceUnit) => Promise<T>) => Promise<T>;
}) {
  const authorize = async (request: Request) => {
    let session;
    try { session = await options.verifySession(request); } catch { throw new AccessError("UNAVAILABLE"); }
    if (!session || !session.issuer || !session.subject || !Number.isFinite(session.expiresAt) || session.expiresAt <= Date.now()) throw new AccessError("UNAUTHENTICATED");
  };
  const rejectQuery = (request: Request) => { if (new URL(request.url).search) throw new BackendError("INVALID_INPUT"); };
  const execute = (request: Request, command?: { value: AdminCommand; expectedRevision: number; key: string }) => options.transaction(request, unit => {
    const workspace = { permission: "workspace:view", resource: { ...unit.scope, kind: "collection" as const, type: "workspace" } };
    return unit.access.withOperation(request, workspace, async operation => {
      const context = await operation.requireAccess(workspace);
      if (command) {
        const input = await unit.resource(command.value);
        const actor = await operation.requireAccess(input);
        await unit.execute(command.value, command.expectedRevision, command.key, actor);
      }
      return unit.read(context);
    });
  });
  const success = (snapshot: AdminSnapshot) => Response.json(snapshot);
  return {
    workspace: createEndpoint({ method: "GET", authorize, parse: rejectQuery, execute: (_input, request) => execute(request), success }),
    commands: createEndpoint({ method: "POST", origin: options.origin, authorize,
      parse: async request => {
        rejectQuery(request);
        const key = request.headers.get("idempotency-key");
        if (!key || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key)) throw new BackendError("INVALID_INPUT");
        return readJson(request, input => {
          const data = objectInput(input, ["command", "expectedRevision"]);
          return { value: options.parseCommand(data.command), expectedRevision: integerInput(data.expectedRevision, { min: 0, max: Number.MAX_SAFE_INTEGER }), key };
        });
      },
      execute: (command, request) => execute(request, command), success,
    }),
  };
}

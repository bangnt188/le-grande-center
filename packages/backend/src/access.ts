import { evaluateAccess, isAccessPrincipal, type AccessContext, type AccessDecision, type AccessResource } from "./policy.js";
export * from "./policy.js";

export type VerifiedSession = { issuer: string; subject: string; expiresAt: number };
export type AccessInput = { permission: string; resource: AccessResource };
export type DecisionAudit = AccessInput & {
  actorId: string | null;
  policyVersion: string | null;
  allowed: boolean;
  reason: AccessDecision["reason"] | "unauthenticated" | "identity-mismatch";
  at: number;
};
export type AccessAdapters = {
  /** Verify signature/session/revocation using the chosen auth provider. null means invalid/no session. */
  verifySession: (request: Request) => Promise<VerifiedSession | null>;
  /** Fresh authoritative lookup per call; do not derive grants from request headers/body or stale token roles. */
  loadPrincipal: (identity: VerifiedSession) => Promise<unknown>;
  /** Persist policy evaluations, not proof a domain operation completed. Keep IDs opaque; never log tokens or bodies. */
  recordDecision: (event: DecisionAudit) => Promise<void>;
  now?: () => number;
};
export class AccessError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "UNAVAILABLE") {
    super(code);
    this.name = "AccessError";
  }
  get status(): number { return this.code === "UNAUTHENTICATED" ? 401 : this.code === "FORBIDDEN" ? 403 : 503; }
}
function validSession(value: VerifiedSession | null): value is VerifiedSession {
  return !!value && typeof value.issuer === "string" && value.issuer.trim().length > 0
    && typeof value.subject === "string" && value.subject.trim().length > 0
    && Number.isFinite(value.expiresAt) && value.expiresAt > 0;
}

/** Server orchestration seam; adapters are explicit and missing/failing infrastructure never permits access. */
export function createAccessBackend(adapters: AccessAdapters) {
  if (![adapters?.verifySession, adapters?.loadPrincipal, adapters?.recordDecision].every(fn => typeof fn === "function")) {
    throw new Error("Session, principal, and audit adapters are required.");
  }
  const clock = () => {
    try {
      const value = (adapters.now ?? Date.now)();
      if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid clock");
      return value;
    } catch { throw new AccessError("UNAVAILABLE"); }
  };
  return {
    async requireAccess(request: Request, input: AccessInput): Promise<AccessContext> {
      let actorId: string | null = null;
      let policyVersion: string | null = null;
      const audit = async (allowed: boolean, reason: DecisionAudit["reason"], at: number) => {
        try { await adapters.recordDecision({ ...input, actorId, policyVersion, allowed, reason, at }); }
        catch { throw new AccessError("UNAVAILABLE"); }
      };
      let session: VerifiedSession | null;
      try { session = await adapters.verifySession(request); }
      catch { throw new AccessError("UNAVAILABLE"); }
      let now = clock();
      if (!Number.isFinite(now) || now <= 0) throw new AccessError("UNAVAILABLE");
      if (!validSession(session) || now >= session.expiresAt) {
        await audit(false, "unauthenticated", now);
        throw new AccessError("UNAUTHENTICATED");
      }
      let principal: unknown;
      try { principal = await adapters.loadPrincipal(session); }
      catch { throw new AccessError("UNAVAILABLE"); }
      if (!isAccessPrincipal(principal)) {
        await audit(false, "invalid-context", now);
        throw new AccessError("FORBIDDEN");
      }
      if (principal.issuer !== session.issuer || principal.subject !== session.subject) {
        await audit(false, "identity-mismatch", now);
        throw new AccessError("FORBIDDEN");
      }
      actorId = principal.actorId;
      policyVersion = principal.policyVersion;
      const context = { principal, sessionExpiresAt: session.expiresAt };
      now = clock();
      const decision = evaluateAccess(context, input.permission, input.resource, now);
      await audit(decision.allowed, decision.reason, now);
      if (!decision.allowed) throw new AccessError(decision.reason === "expired-session" ? "UNAUTHENTICATED" : "FORBIDDEN");
      // Audit adapters may perform I/O; an expired session must not be returned after that delay.
      const afterAudit = evaluateAccess(context, input.permission, input.resource, clock());
      if (!afterAudit.allowed) throw new AccessError(afterAudit.reason === "expired-session" ? "UNAUTHENTICATED" : "FORBIDDEN");
      return context;
    },
  };
}

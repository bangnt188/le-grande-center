/** Portable policy contracts. Session/DB adapters belong to the server application. */
export const basicActions = ["view", "create", "update", "delete", "approve"] as const;
export type BasicAction = typeof basicActions[number];
export type AccessScope = {
  tenantId: string;
  propertyId?: string;
  organizationId?: string;
  ownerId?: string;
  /** Application-owned exact-match dimensions; never accepted from form input. */
  dimensions?: Readonly<Record<string, string>>;
};
export type AccessGrant = {
  permission: string;
  effect: "allow" | "deny";
  scope: AccessScope;
  resourceId?: string;
  notBefore?: number;
  expiresAt?: number;
};
export type AccessPrincipal = {
  actorId: string;
  issuer: string;
  subject: string;
  disabled: boolean;
  policyVersion: string;
  grants: readonly AccessGrant[];
};
/** Resolve object facts on the server. A collection must be queried with these same scope filters. */
export type AccessResource = AccessScope & {
  kind: "object" | "collection";
  type: string;
  id?: string;
};
export type AccessContext = { principal: AccessPrincipal; sessionExpiresAt: number };
export type AccessDecision = {
  allowed: boolean;
  reason: "allowed" | "invalid-context" | "invalid-request" | "expired-session" | "explicit-deny" | "no-grant";
};
const scopeKeys = ["tenantId", "propertyId", "organizationId", "ownerId"] as const;
const permissionPattern = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const timestamp = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export function validScope(scope: unknown, allowOtherKeys = false): scope is AccessScope {
  return record(scope) && (allowOtherKeys || Object.keys(scope).every(key => [...scopeKeys, "dimensions"].includes(key as typeof scopeKeys[number]))) && nonEmpty(scope.tenantId) && scopeKeys.every(key => scope[key] === undefined || nonEmpty(scope[key]))
    && (scope.dimensions === undefined || (record(scope.dimensions)
      && Object.keys(scope.dimensions).length <= 32
      && Object.entries(scope.dimensions).every(([key, value]) => /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(key)
        && !["__proto__", "constructor", "prototype"].includes(key) && nonEmpty(value))));
}
function validGrant(grant: unknown): grant is AccessGrant {
  if (!record(grant) || typeof grant.permission !== "string" || !permissionPattern.test(grant.permission)) return false;
  if (grant.effect !== "allow" && grant.effect !== "deny") return false;
  if (!validScope(grant.scope) || (grant.resourceId !== undefined && !nonEmpty(grant.resourceId))) return false;
  if (grant.notBefore !== undefined && !timestamp(grant.notBefore)) return false;
  if (grant.expiresAt !== undefined && !timestamp(grant.expiresAt)) return false;
  return !(typeof grant.notBefore === "number" && typeof grant.expiresAt === "number" && grant.expiresAt <= grant.notBefore);
}
export function isAccessPrincipal(value: unknown): value is AccessPrincipal {
  return record(value) && nonEmpty(value.actorId) && nonEmpty(value.issuer) && nonEmpty(value.subject)
    && typeof value.disabled === "boolean" && nonEmpty(value.policyVersion)
    && Array.isArray(value.grants) && value.grants.every(validGrant);
}
function validResource(resource: unknown): resource is AccessResource {
  if (!record(resource)) return false;
  const { type, kind, id } = resource;
  if (!validScope(resource, true) || !nonEmpty(type)) return false;
  if (kind === "object") return nonEmpty(id);
  return kind === "collection" && id === undefined;
}
function matches(grant: AccessGrant, permission: string, resource: AccessResource, now: number): boolean {
  if (grant.permission !== permission) return false;
  if (grant.notBefore !== undefined && now < grant.notBefore) return false;
  if (grant.expiresAt !== undefined && now >= grant.expiresAt) return false;
  if (resource.kind === "object" && grant.resourceId !== undefined && grant.resourceId !== resource.id) return false;
  // Missing facts must not bypass a narrower deny. For collections, a denied
  // object might be in the result; this engine cannot build exclusion predicates.
  if (grant.effect === "deny") {
    return scopeKeys.every(key => resource[key] === undefined || grant.scope[key] === undefined || grant.scope[key] === resource[key])
      && Object.entries(grant.scope.dimensions ?? {}).every(([key, value]) => resource.dimensions?.[key] === undefined || resource.dimensions[key] === value);
  }
  if (grant.resourceId !== undefined && (resource.kind !== "object" || grant.resourceId !== resource.id)) return false;
  return scopeKeys.every(key => grant.scope[key] === undefined || grant.scope[key] === resource[key])
    && Object.entries(grant.scope.dimensions ?? {}).every(([key, value]) => resource.dimensions?.[key] === value);
}

/** Deny by default. No wildcard, role-name shortcut, or administrator bypass. */
export function evaluateAccess(context: AccessContext, permission: string, resource: AccessResource, now = Date.now()): AccessDecision {
  if (!timestamp(now) || !isAccessPrincipal(context?.principal) || context.principal.disabled || !timestamp(context.sessionExpiresAt)) {
    return { allowed: false, reason: "invalid-context" };
  }
  if (now >= context.sessionExpiresAt) return { allowed: false, reason: "expired-session" };
  if (!permissionPattern.test(permission) || !validResource(resource) || permission.split(":")[0] !== resource.type) {
    return { allowed: false, reason: "invalid-request" };
  }
  const grants = context.principal.grants.filter(grant => matches(grant, permission, resource, now));
  if (grants.some(grant => grant.effect === "deny")) return { allowed: false, reason: "explicit-deny" };
  return grants.some(grant => grant.effect === "allow")
    ? { allowed: true, reason: "allowed" }
    : { allowed: false, reason: "no-grant" };
}

/** UI hints only; return this projection, never the principal/grant envelope, to the client. */
export function getCapabilities(context: AccessContext, permissions: readonly string[], resource: AccessResource, now = Date.now()): readonly string[] {
  return [...new Set(permissions)].filter(permission => evaluateAccess(context, permission, resource, now).allowed).sort();
}

import "server-only";
import { SignJWT, jwtVerify } from "jose";
import type { AdminIdentity } from "./database";
import { WorkspaceError } from "./errors";
import type { AdminSession } from "../shared/admin/contracts";

export const ADMIN_COOKIE = "__Host-lgc_admin";
export const ADMIN_SESSION_SECONDS = 900;
const issuer = "le-grande-centre:admin";
const audience = "le-grande-centre:admin-api";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class AdminSessionError extends WorkspaceError {
  constructor(readonly code: "SESSION_MISSING" | "SESSION_EXPIRED" | "SESSION_INVALID") { super("Phiên quản trị đã hết hạn. Thao tác để đăng nhập lại.", 401); }
}
async function signingKey(secret = process.env.NEON_AUTH_COOKIE_SECRET) {
  if (!secret || secret.length < 32) throw new WorkspaceError("Admin session signing configuration is missing.", 503);
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode(issuer), info: new TextEncoder().encode("signed-admin-session:v1") }, material, 256));
}
export function assertSessionActive(identity: AdminIdentity, now = Date.now()) {
  if (!identity.verifiedSession || identity.verifiedSession.expiresAt <= now) throw new AdminSessionError("SESSION_EXPIRED");
  if (!uuid.test(identity.id) || !uuid.test(identity.propertyId) || !["root", "administrator", "editor"].includes(identity.role)) throw new AdminSessionError("SESSION_INVALID");
}
export function requireAdministrator(identity: AdminIdentity) {
  assertSessionActive(identity);
  if (identity.role === "editor") throw new WorkspaceError("Chỉ quản trị viên được thực hiện thao tác này.", 403);
}
export function sessionDTO(identity: AdminIdentity): AdminSession {
  assertSessionActive(identity);
  return { actorId: identity.id, propertyId: identity.propertyId, role: identity.role === "root" ? "administrator" : identity.role, expiresAt: identity.verifiedSession!.expiresAt };
}
export async function mintAdminSession(identity: AdminIdentity, provider: { issuer: string; subject: string; expiresAt: number }, now = Date.now(), secret?: string) {
  const issuedAt = Math.floor(now / 1000), expiresAt = Math.min(Math.floor(provider.expiresAt / 1000), issuedAt + ADMIN_SESSION_SECONDS);
  if (expiresAt <= issuedAt || !provider.issuer || !provider.subject) throw new AdminSessionError("SESSION_EXPIRED");
  const signedIdentity = { ...identity, verifiedSession: { ...provider, expiresAt: expiresAt * 1000 } };
  assertSessionActive(signedIdentity, now);
  const token = await new SignJWT({ v: 1, actorId: identity.id, propertyId: identity.propertyId, role: identity.role === "root" ? "administrator" : identity.role, owner: identity.role === "root", providerIssuer: provider.issuer, providerSubject: provider.subject })
    .setProtectedHeader({ alg: "HS256", typ: "lgc-admin+jwt" }).setIssuer(issuer).setAudience(audience).setSubject(identity.id).setIssuedAt(issuedAt).setExpirationTime(expiresAt).sign(await signingKey(secret));
  return { token, identity: signedIdentity };
}
export async function verifyAdminToken(token: string, now = Date.now(), secret?: string): Promise<AdminIdentity> {
  const key = await signingKey(secret);
  try {
    const { payload, protectedHeader } = await jwtVerify(token, key, { algorithms: ["HS256"], issuer, audience, typ: "lgc-admin+jwt", currentDate: new Date(now), requiredClaims: ["sub", "iat", "exp"] });
    if (protectedHeader.typ !== "lgc-admin+jwt" || payload.v !== 1 || typeof payload.actorId !== "string" || !uuid.test(payload.actorId) || payload.sub !== payload.actorId || typeof payload.propertyId !== "string" || !uuid.test(payload.propertyId) || !["administrator", "editor"].includes(String(payload.role)) || typeof payload.owner !== "boolean" || (payload.owner && payload.role !== "administrator") || typeof payload.providerIssuer !== "string" || !payload.providerIssuer || payload.providerIssuer.length > 512 || typeof payload.providerSubject !== "string" || !payload.providerSubject || payload.providerSubject.length > 255 || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.iat! > Math.floor(now / 1000) || payload.exp! <= payload.iat! || payload.exp! - payload.iat! > ADMIN_SESSION_SECONDS) throw new AdminSessionError("SESSION_INVALID");
    return { id: payload.actorId, propertyId: payload.propertyId, role: payload.owner ? "root" : payload.role as "administrator" | "editor", email: "", verifiedSession: { issuer: payload.providerIssuer, subject: payload.providerSubject, expiresAt: payload.exp! * 1000 } };
  } catch (error) {
    if (error instanceof AdminSessionError) throw error;
    if (error instanceof Error && "code" in error && error.code === "ERR_JWT_EXPIRED") throw new AdminSessionError("SESSION_EXPIRED");
    throw new AdminSessionError("SESSION_INVALID");
  }
}
export function adminCookie(token: string, expiresAt: number) { return `${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`; }
export function clearAdminCookie() { return `${ADMIN_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }

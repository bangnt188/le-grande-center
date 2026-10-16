import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { resolveAdminIdentity } from "./database";
import { headers } from "next/headers";
import { siteUrl } from "@/config/site";
import { ADMIN_COOKIE, AdminSessionError, verifyAdminToken } from "./admin-session";

export class AuthError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export function getAuth() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const secret = process.env.NEON_AUTH_COOKIE_SECRET;
  if (!baseUrl || !secret || secret.length < 32) throw new Error("Neon Auth server configuration is missing.");
  return createNeonAuth({ baseUrl, cookies: { secret } });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AuthError("Yêu cầu phải đến từ website này.", 403);
  }
}

export type VerifiedAuthSession = { issuer: string; subject: string; email: string; emailVerified: boolean; expiresAt: number };
export async function verifyAuthSession(request?: Request, responseHeaders?: Headers): Promise<VerifiedAuthSession | null> {
  const url = new URL("/api/auth/get-session?disableCookieCache=true", request?.url ?? siteUrl);
  let response: Response;
  try { response = await getAuth().handler().GET(new Request(url, { headers: request?.headers ?? await headers() }), { params: Promise.resolve({ path: ["get-session"] }) }); }
  catch { throw new AuthError("Dịch vụ đăng nhập tạm thời không khả dụng.", 503); }
  if (responseHeaders) for (const cookie of response.headers.getSetCookie()) responseHeaders.append("Set-Cookie", cookie);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return null;
    throw new AuthError("Dịch vụ đăng nhập tạm thời không khả dụng.", 503);
  }
  let session: unknown;
  try { session = await response.json(); } catch { throw new AuthError("Dịch vụ đăng nhập trả phản hồi không hợp lệ.", 503); }
  if (!session || typeof session !== "object" || !("user" in session) || !session.user || typeof session.user !== "object" || !("session" in session) || !session.session || typeof session.session !== "object") return null;
  const user = session.user;
  if (!("id" in user) || typeof user.id !== "string" || !("email" in user) || typeof user.email !== "string" || !("expiresAt" in session.session) || typeof session.session.expiresAt !== "string") return null;
  const expiresAt=Date.parse(session.session.expiresAt);
  if(!Number.isFinite(expiresAt)||expiresAt<=Date.now())return null;
  return {issuer:process.env.NEON_AUTH_BASE_URL!,subject:user.id,email:user.email,emailVerified:"emailVerified" in user&&user.emailVerified===true,expiresAt};
}
export async function requireAdmin(request?: Request) {
  const incoming = request?.headers ?? await headers();
  const tokens = (incoming.get("cookie") ?? "").split(";").map(value => value.trim()).filter(value => value.startsWith(ADMIN_COOKIE + "="));
  if (tokens.length !== 1) throw new AdminSessionError("SESSION_MISSING");
  return verifyAdminToken(tokens[0]!.slice(ADMIN_COOKIE.length + 1));
}

export async function refreshAdminIdentity(request: Request, responseHeaders: Headers) {
  const session = await verifyAuthSession(request, responseHeaders);
  if (!session) throw new AuthError("Vui lòng đăng nhập.", 401);
  if (!session.emailVerified) throw new AuthError("Xác minh email trước khi vào quản trị.", 403);
  let identity;
  try { identity = await resolveAdminIdentity(session); }
  catch { throw new AuthError("Dịch vụ tài khoản tạm thời không khả dụng.", 503); }
  if (!identity) throw new AuthError("Tài khoản không có quyền quản trị.", 403);
  return { identity, session };
}

export function getPasswordPrefix(): string {
  return process.env.PASSWORD_PREFIX ?? process.env.AUTH_PASSWORD_PREFIX ?? "";
}

export function applyPasswordPrefix(password: string): string {
  const prefix = getPasswordPrefix();
  return prefix ? `${prefix}${password}` : password;
}

export async function transformPasswordRequest(request: Request): Promise<Request> {
  const prefix = getPasswordPrefix();
  if (!prefix) return request;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return request;

  try {
    const rawBody = await request.clone().text();
    if (!rawBody) return request;

    const data = JSON.parse(rawBody);
    if (data && typeof data === "object" && !Array.isArray(data)) {
      let modified = false;
      if (typeof data.password === "string") {
        data.password = `${prefix}${data.password}`;
        modified = true;
      }
      if (typeof data.newPassword === "string") {
        data.newPassword = `${prefix}${data.newPassword}`;
        modified = true;
      }
      if (typeof data.currentPassword === "string") {
        data.currentPassword = `${prefix}${data.currentPassword}`;
        modified = true;
      }

      if (modified) {
        const headers = new Headers(request.headers);
        headers.delete("content-length");
        return new Request(request.url, {
          method: request.method,
          headers,
          body: JSON.stringify(data),
        });
      }
    }
  } catch {
    // If body parsing fails, fallback to passing original request
  }

  return request;
}


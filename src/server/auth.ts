import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { resolveAdminIdentity } from "./database";
import { headers } from "next/headers";
import { siteUrl } from "@/config/site";

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

export async function requireAdmin(request?: Request) {
  // The SDK proxy query bypasses its signed session cache and verifies the current managed session.
  const url = new URL("/api/auth/get-session?disableCookieCache=true", request?.url ?? siteUrl);
  const response = await getAuth().handler().GET(new Request(url, { headers: request?.headers ?? await headers() }), { params: Promise.resolve({ path: ["get-session"] }) });
  if (!response.ok) throw new AuthError("Vui lòng đăng nhập.", 401);
  const session: unknown = await response.json();
  if (!session || typeof session !== "object" || !("user" in session) || !session.user || typeof session.user !== "object" || !("session" in session) || !session.session || typeof session.session !== "object") throw new AuthError("Vui lòng đăng nhập.", 401);
  const user = session.user;
  if (!("id" in user) || typeof user.id !== "string" || !("email" in user) || typeof user.email !== "string" || !("expiresAt" in session.session) || typeof session.session.expiresAt !== "string" || !(Date.parse(session.session.expiresAt) > Date.now())) throw new AuthError("Phiên đăng nhập không hợp lệ.", 401);
  if (!("emailVerified" in user) || user.emailVerified !== true) throw new AuthError("Xác minh email trước khi vào quản trị.", 403);
  const identity = await resolveAdminIdentity({ issuer: process.env.NEON_AUTH_BASE_URL!, subject: user.id, email: user.email, emailVerified: true });
  if (!identity) throw new AuthError("Tài khoản không có quyền quản trị.", 403);
  return identity;
}

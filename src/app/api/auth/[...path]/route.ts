import { assertSameOrigin, AuthError, getAuth, transformPasswordRequest } from "@/server/auth";
import { clearAdminCookie } from "@/server/admin-session";
import type { NextRequest } from "next/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  const response = await getAuth().handler().GET(request, context);
  const { path } = await context.params;
  if (path.some(segment => segment === "callback" || segment === "sign-out")) response.headers.append("Set-Cookie", clearAdminCookie());
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
async function mutate(request: NextRequest, context: Context, method: "POST" | "PUT" | "DELETE" | "PATCH") {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try {
    assertSameOrigin(request);
    headers.append("Set-Cookie", clearAdminCookie());
    const response = await getAuth().handler()[method](await transformPasswordRequest(request), context);
    for (const [key, value] of response.headers) if (key.toLowerCase() !== "set-cookie") headers.set(key, value);
    for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
    headers.set("Cache-Control", "private, no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) { return Response.json({ error: error instanceof AuthError ? error.message : "Dịch vụ đăng nhập tạm thời không khả dụng.", code: error instanceof AuthError ? "FORBIDDEN" : "AUTH_UNAVAILABLE" }, { status: error instanceof AuthError ? error.status : 503, headers }); }
}
export async function POST(request: NextRequest, context: Context) { return mutate(request, context, "POST"); }
export async function PUT(request: NextRequest, context: Context) { return mutate(request, context, "PUT"); }
export async function DELETE(request: NextRequest, context: Context) { return mutate(request, context, "DELETE"); }
export async function PATCH(request: NextRequest, context: Context) { return mutate(request, context, "PATCH"); }

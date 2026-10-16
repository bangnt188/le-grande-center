import { assertSameOrigin, AuthError, getAuth, refreshAdminIdentity, requireAdmin } from "@/server/auth";
import { WorkspaceError } from "@/server/database";
import { AdminSessionError, adminCookie, clearAdminCookie, mintAdminSession, sessionDTO } from "@/server/admin-session";
export const dynamic = "force-dynamic";
function errorResponse(error: unknown, headers: Headers) {
  const status = error instanceof AuthError || error instanceof WorkspaceError ? error.status : 500;
  return Response.json({ error: status === 500 ? "Không thể tải phiên quản trị." : (error as Error).message, code: error instanceof AdminSessionError ? error.code : status === 403 ? "FORBIDDEN" : status === 503 ? "AUTH_UNAVAILABLE" : status === 401 ? "SESSION_MISSING" : "REQUEST_FAILED" }, { status, headers });
}
export async function GET(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try { if (new URL(request.url).search) throw new WorkspaceError("Unexpected query parameters"); return Response.json(sessionDTO(await requireAdmin(request)), { headers }); }
  catch (error) { return errorResponse(error, headers); }
}
export async function POST(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try {
    assertSameOrigin(request);
    if (new URL(request.url).search || request.headers.get("content-length") && request.headers.get("content-length") !== "0") throw new WorkspaceError("Session refresh takes no input");
    const { identity, session } = await refreshAdminIdentity(request, headers);
    const minted = await mintAdminSession(identity, session);
    headers.append("Set-Cookie", adminCookie(minted.token, minted.identity.verifiedSession.expiresAt));
    return Response.json(sessionDTO(minted.identity), { headers });
  } catch (error) { headers.append("Set-Cookie", clearAdminCookie()); return errorResponse(error, headers); }
}
export async function DELETE(request: Request) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  try { assertSameOrigin(request); } catch (error) { return errorResponse(error, headers); }
  headers.append("Set-Cookie", clearAdminCookie());
  try {
    const url = new URL("/api/auth/sign-out", request.url);
    const outgoing = new Headers(request.headers); outgoing.set("content-type", "application/json"); outgoing.delete("content-length");
    const response = await getAuth().handler().POST(new Request(url, { method: "POST", headers: outgoing, body: "{}" }), { params: Promise.resolve({ path: ["sign-out"] }) });
    for (const cookie of response.headers.getSetCookie()) headers.append("Set-Cookie", cookie);
    if (!response.ok) throw new AuthError("Phiên ứng dụng đã xóa; chưa xác nhận đăng xuất nhà cung cấp.", 503);
    return new Response(null, { status: 204, headers });
  } catch (error) { return errorResponse(error instanceof AuthError ? error : new AuthError("Phiên ứng dụng đã xóa; dịch vụ đăng xuất tạm thời không khả dụng.", 503), headers); }
}

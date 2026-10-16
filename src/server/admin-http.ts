import { AuthError } from "./auth";
import { AdminSessionError } from "./admin-session";
import { WorkspaceError } from "./database";
import { MediaError } from "./media/validation";
export function adminErrorResponse(error: unknown, fallback = "Không thể hoàn tất yêu cầu.") {
  const known = error instanceof AuthError || error instanceof WorkspaceError || error instanceof MediaError;
  const status = known ? error.status : 503;
  const code = error instanceof AdminSessionError ? error.code : status === 401 ? "SESSION_MISSING" : status === 403 ? "FORBIDDEN" : status === 409 ? "CONFLICT" : status >= 500 ? "UPSTREAM_UNAVAILABLE" : "INVALID_REQUEST";
  return Response.json({ error: { message: known ? error.message : fallback, code }, code }, { status, headers: { "Cache-Control": "private, no-store" } });
}

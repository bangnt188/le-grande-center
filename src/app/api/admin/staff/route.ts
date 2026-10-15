import { assertSameOrigin, AuthError, requireAdmin } from "@/server/auth";
import { WorkspaceError } from "@/server/database";
import { listStaffAccounts, revokeStaffAccount, saveStaffAccount } from "@/server/staff-accounts";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function errorResponse(error: unknown) {
  const known = error instanceof AuthError || error instanceof WorkspaceError;
  const status = known ? error.status : 500;
  return Response.json({ error: status === 500 ? "Không thể xử lý tài khoản." : (error as Error).message }, { status, headers });
}
async function body(request: Request) {
  if (new URL(request.url).search || !request.headers.get("content-type")?.startsWith("application/json")) throw new WorkspaceError("Yêu cầu không hợp lệ.");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 2048) throw new WorkspaceError("Nội dung yêu cầu quá lớn.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WorkspaceError("Thiếu nội dung yêu cầu.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 2048) {
        await reader.cancel();
        throw new WorkspaceError("Nội dung yêu cầu quá lớn.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new WorkspaceError("JSON không hợp lệ."); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError("Nội dung yêu cầu không hợp lệ.");
  return value as Record<string, unknown>;
}
export async function GET(request: Request) {
  try {
    if (new URL(request.url).search) throw new WorkspaceError("Unexpected query parameters");
    const identity = await requireAdmin(request);
    return Response.json(await listStaffAccounts(identity), { headers });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireAdmin(request);
    const value = await body(request);
    if (Object.keys(value).some(key => key !== "email" && key !== "role") || typeof value.email !== "string" || typeof value.role !== "string") throw new WorkspaceError("Email và vai trò bắt buộc.");
    return Response.json(await saveStaffAccount(identity, value.email, value.role), { headers });
  } catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireAdmin(request);
    const value = await body(request);
    if (Object.keys(value).length !== 1 || typeof value.email !== "string") throw new WorkspaceError("Email tài khoản không hợp lệ.");
    await revokeStaffAccount(identity, value.email);
    return new Response(null, { status: 204, headers });
  } catch (error) { return errorResponse(error); }
}

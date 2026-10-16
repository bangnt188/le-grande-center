import { requireAdmin } from "@/server/auth";
import { adminErrorResponse } from "@/server/admin-http";
import { WorkspaceError } from "@/server/database";
import { readMediaDetail } from "@/server/media/queries";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireAdmin(request);
    if (new URL(request.url).search) throw new WorkspaceError("Unexpected query parameters");
    return Response.json(await readMediaDetail(identity, (await context.params).id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return adminErrorResponse(error, "Không thể tải thông tin tệp."); }
}

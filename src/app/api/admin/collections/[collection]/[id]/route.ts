import { requireAdmin } from "@/server/auth";
import { adminErrorResponse } from "@/server/admin-http";
import { WorkspaceError } from "@/server/database";
import { parseCollectionName, parseCollectionId, readAdminCollectionItem } from "@/server/admin-collections";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ collection: string; id: string }> }) {
  try {
    const identity = await requireAdmin(request);
    if (new URL(request.url).search) throw new WorkspaceError("Unexpected query parameters");
    const values = await params;
    const collection = parseCollectionName(values.collection), id = parseCollectionId(values.id);
    return Response.json(await readAdminCollectionItem(identity, collection, id, request), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminErrorResponse(error, "Không thể tải dữ liệu.");
  }
}

import { requireAdmin, AuthError } from "@/server/auth";
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
    const status = error instanceof AuthError || error instanceof WorkspaceError ? error.status : 500;
    return Response.json({ error: status === 500 ? "Không thể tải dữ liệu." : (error as Error).message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}

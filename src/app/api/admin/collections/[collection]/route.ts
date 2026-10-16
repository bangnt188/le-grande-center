import { requireAdmin, AuthError } from "@/server/auth";
import { WorkspaceError } from "@/server/database";
import { parseCollectionName, parseCollectionQuery, readAdminCollection } from "@/server/admin-collections";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ collection: string }> }) {
  try {
    const identity = await requireAdmin(request);
    const collection = parseCollectionName((await params).collection);
    const query = parseCollectionQuery(collection, new URL(request.url).searchParams);
    return Response.json(await readAdminCollection(identity, collection, query, request), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AuthError || error instanceof WorkspaceError ? error.status : 500;
    return Response.json({ error: status === 500 ? "Không thể tải dữ liệu." : (error as Error).message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}

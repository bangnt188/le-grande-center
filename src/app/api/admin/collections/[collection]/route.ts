import { requireAdmin } from "@/server/auth";
import { adminErrorResponse } from "@/server/admin-http";
import { parseCollectionName, parseCollectionQuery, readAdminCollection } from "@/server/admin-collections";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ collection: string }> }) {
  try {
    const identity = await requireAdmin(request);
    const collection = parseCollectionName((await params).collection);
    const query = parseCollectionQuery(collection, new URL(request.url).searchParams);
    return Response.json(await readAdminCollection(identity, collection, query, request), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return adminErrorResponse(error, "Không thể tải dữ liệu.");
  }
}

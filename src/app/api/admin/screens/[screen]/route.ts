import { requireAdmin } from "@/server/auth";
import { adminErrorResponse } from "@/server/admin-http";
import { parseScreenName, parseScreenQuery, readAdminScreen } from "@/server/admin-screens";
export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ screen: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const identity = await requireAdmin(request), screen = parseScreenName((await context.params).screen);
    return Response.json(await readAdminScreen(identity, screen, parseScreenQuery(screen, new URL(request.url).searchParams)), { headers });
  } catch (error) {
    return adminErrorResponse(error, "Không thể tải dữ liệu.");
  }
}

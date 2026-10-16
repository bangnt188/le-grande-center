import { requireAdmin } from "../../../../../../server/auth";
import { adminErrorResponse } from "@/server/admin-http";
import { viewMedia } from "../../../../../../server/media/repository";
import { MediaError } from "../../../../../../server/media/validation";
export const dynamic = "force-dynamic";
async function deliver(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const identity = await requireAdmin(request);
    const query = new URL(request.url).searchParams;
    if ([...query.keys()].some(key=>key!=="review") || query.getAll("review").length>1 || (query.has("review")&&query.get("review")!=="1"))throw new MediaError("Yêu cầu xem tệp không hợp lệ.");
    return await viewMedia(identity,(await context.params).id,request);
  } catch(error) {
    const response = adminErrorResponse(error, "Không đọc được tệp.");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("Content-Security-Policy", "sandbox; default-src 'none'");
    return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
  }
}
export const GET = deliver;
export const HEAD = deliver;

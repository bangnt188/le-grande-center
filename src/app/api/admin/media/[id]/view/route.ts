import { AuthError, requireAdmin } from "../../../../../../server/auth";
import { WorkspaceError } from "../../../../../../server/database";
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
    const known=error instanceof AuthError||error instanceof MediaError||error instanceof WorkspaceError;
    return new Response(request.method==='HEAD'?null:JSON.stringify({error:{message:known?error.message:"Không đọc được tệp."}}),{status:known?error.status:503,headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"sandbox; default-src 'none'"}});
  }
}
export const GET = deliver;
export const HEAD = deliver;

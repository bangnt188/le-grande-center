import { requireAdmin, AuthError } from "@/server/auth";
import { readWorkspace } from "@/server/workspace";
import { WorkspaceError } from "@/server/database";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
 try {
  const identity=await requireAdmin(request);
  if(new URL(request.url).search)throw new WorkspaceError('Unexpected query parameters');
  return Response.json(await readWorkspace(identity,request),{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){const status=error instanceof AuthError||error instanceof WorkspaceError?error.status:500;return Response.json({error:status===500?'Không thể tải dữ liệu.':(error as Error).message},{status,headers:{'Cache-Control':'private, no-store'}});}
}

import { assertSameOrigin, AuthError, requireAdmin } from "../../../../server/auth";
import { WorkspaceError } from "../../../../server/database";
import { uploadMedia } from "../../../../server/media/repository";
import { boundedMultipart, MediaError } from "../../../../server/media/validation";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireAdmin(request);
    const key = request.headers.get("idempotency-key");
    if (!key || !/^[a-f0-9-]{36}$/i.test(key) || new URL(request.url).search) throw new MediaError("Thông tin tải lên không hợp lệ.");
    const {files,scope,expectedRevision} = await boundedMultipart(request);
    return Response.json(await uploadMedia(identity,files,scope,expectedRevision,key),{headers:{"cache-control":"private, no-store"}});
  } catch(error) {
    if(error instanceof AuthError||error instanceof MediaError||error instanceof WorkspaceError)return Response.json({error:{message:error.message}},{status:error.status,headers:{"cache-control":"private, no-store"}});
    return Response.json({error:{message:"Không hoàn tất được tải lên. Dữ liệu/dung lượng chưa được báo thành công; hãy tải lại và thử lại."}},{status:503,headers:{"cache-control":"private, no-store"}});
  }
}

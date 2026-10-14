import { assertSameOrigin, AuthError, requireAdmin } from "../../../../../server/auth";
import { WorkspaceError } from "../../../../../server/database";
import { reconcileMedia } from "../../../../../server/media/repository";
import { MediaError } from "../../../../../server/media/validation";
export const dynamic = "force-dynamic";
export async function POST(request:Request) {
  try {
    assertSameOrigin(request);
    const identity=await requireAdmin(request);
    const key=request.headers.get('idempotency-key');
    if(!key||!request.body||!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??'')||new URL(request.url).search)throw new MediaError("Thông tin đối soát không hợp lệ.");
    let bytes=0;
    const body=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){bytes+=chunk.length;if(bytes>1024)throw new MediaError("Nội dung đối soát quá dài.",413);controller.enqueue(chunk);}}));
    const data:unknown=await new Response(body).json();
    if(!data||typeof data!=='object'||!('expectedRevision' in data)||typeof data.expectedRevision!=='number'||!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0||Object.keys(data).length!==1)throw new MediaError("Phiên bản dữ liệu đối soát không hợp lệ.");
    return Response.json(await reconcileMedia(identity,data.expectedRevision,key),{headers:{'cache-control':'private, no-store'}});
  } catch(error) {
    const known=error instanceof AuthError||error instanceof MediaError||error instanceof WorkspaceError;
    return Response.json({error:{message:known?error.message:"Không hoàn tất được đối soát. Không xác nhận dung lượng trống."}},{status:known?error.status:503,headers:{'cache-control':'private, no-store'}});
  }
}

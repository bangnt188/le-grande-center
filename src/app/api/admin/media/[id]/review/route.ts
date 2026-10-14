import { assertSameOrigin, AuthError, requireAdmin } from "../../../../../../server/auth";
import { WorkspaceError } from "../../../../../../server/database";
import { reviewMedia } from "../../../../../../server/media/repository";
import { MediaError } from "../../../../../../server/media/validation";
export const dynamic = "force-dynamic";
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    assertSameOrigin(request);
    const identity=await requireAdmin(request);
    const key=request.headers.get('idempotency-key');
    if(!key||!request.body||!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??'')||new URL(request.url).search)throw new MediaError("Thông tin duyệt tệp không hợp lệ.");
    let bytes=0;
    const body=request.body.pipeThrough(new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){bytes+=chunk.length;if(bytes>8192)throw new MediaError("Nội dung duyệt quá dài.",413);controller.enqueue(chunk);}}));
    const data:unknown=await new Response(body).json();
    if(!data||typeof data!=='object'||!('confirmedExternalReview' in data)||data.confirmedExternalReview!==true||!('note' in data)||typeof data.note!=='string'||!('expectedRevision' in data)||typeof data.expectedRevision!=='number'||!Number.isSafeInteger(data.expectedRevision)||data.expectedRevision<0||Object.keys(data).some(field=>!['confirmedExternalReview','note','expectedRevision'].includes(field)))throw new MediaError("Xác nhận đã kiểm tra tệp bên ngoài trước khi duyệt. Không có quét virus tự động.");
    return Response.json(await reviewMedia(identity,(await context.params).id,data.note,data.expectedRevision,key),{headers:{'cache-control':'private, no-store'}});
  } catch(error) {
    const known=error instanceof AuthError||error instanceof MediaError||error instanceof WorkspaceError;
    return Response.json({error:{message:known?error.message:"Không hoàn tất được duyệt tệp."}},{status:known?error.status:503,headers:{'cache-control':'private, no-store'}});
  }
}

import { assertSameOrigin, requireAdmin } from "../../../../../server/auth";
import { adminErrorResponse } from "@/server/admin-http";
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
    return Response.json(await reconcileMedia(identity,data.expectedRevision,key,request),{headers:{'cache-control':'private, no-store'}});
  } catch(error) {
    return adminErrorResponse(error, "Không hoàn tất được đối soát. Không xác nhận dung lượng trống.");
  }
}

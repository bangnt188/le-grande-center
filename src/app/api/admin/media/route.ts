import { assertSameOrigin, requireAdmin } from "../../../../server/auth";
import { uploadMedia } from "../../../../server/media/repository";
import { adminErrorResponse } from "@/server/admin-http";
import { parseMediaQuery, readMediaPage } from "@/server/media/queries";
import { boundedMultipart, MediaError } from "../../../../server/media/validation";
import { invalidatePublicWebsite } from "@/server/public";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const identity = await requireAdmin(request);
    return Response.json(await readMediaPage(identity, parseMediaQuery(new URL(request.url).searchParams)), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return adminErrorResponse(error, "Không thể tải thư viện."); }
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const identity = await requireAdmin(request);
    const key = request.headers.get("idempotency-key");
    if (!key || !/^[a-f0-9-]{36}$/i.test(key) || new URL(request.url).search) throw new MediaError("Thông tin tải lên không hợp lệ.");
    const {files,scope,expectedRevision} = await boundedMultipart(request);
    const receipt = await uploadMedia(identity,files,scope,expectedRevision,key,request);
    await invalidatePublicWebsite();
    return Response.json(receipt,{headers:{"cache-control":"private, no-store"}});
  } catch(error) {
    return adminErrorResponse(error, "Không hoàn tất được tải lên. Hãy thử lại cùng mã yêu cầu.");
  }
}

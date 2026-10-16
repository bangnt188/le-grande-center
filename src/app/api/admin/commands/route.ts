import { requireAdmin, assertSameOrigin } from "@/server/auth";
import { adminErrorResponse } from "@/server/admin-http";
import { executeCommand } from "@/server/workspace";
import { WorkspaceError } from "@/server/database";
import { invalidatePublicWebsite } from "@/server/public";
export const dynamic = "force-dynamic";
export async function POST(request:Request) {
 try {
  assertSameOrigin(request);const identity=await requireAdmin(request);
  if(new URL(request.url).search||!request.headers.get('content-type')?.startsWith('application/json'))throw new WorkspaceError('Expected JSON command');
  const reader=request.body?.getReader();if(!reader)throw new WorkspaceError('Missing command');
  const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>32*1024){await reader.cancel();throw new WorkspaceError('Command exceeds 32 KiB',413);}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body:unknown;try{body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new WorkspaceError('Invalid JSON');}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>key!=='command'&&key!=='expectedRevision')||!('command' in body)||!('expectedRevision' in body)||typeof body.expectedRevision!=='number')throw new WorkspaceError('Invalid command envelope');
  const receipt = await executeCommand(identity,{command:body.command,expectedRevision:body.expectedRevision,idempotencyKey:request.headers.get('idempotency-key')??''},request);
  // executeCommand resolves only after COMMIT; failed/replayed writes retain their receipt semantics.
  await invalidatePublicWebsite();
  return Response.json(receipt,{headers:{'Cache-Control':'private, no-store'}});
 } catch (error) {
  return adminErrorResponse(error, "Không thể lưu dữ liệu. Tải lại hoặc thử cùng mã yêu cầu.");
 }
}

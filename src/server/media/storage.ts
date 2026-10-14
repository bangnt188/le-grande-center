import "server-only";
import { createR2Storage } from "@shared/backend/r2";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MediaError } from "./validation";
import type { MediaRange } from "./validation";

export type MediaLocation = { storage_provider: string; bucket_name: string; object_key: string };
function required(key: string) { const value = process.env[key]; if (!value) throw new MediaError("Chưa cấu hình dịch vụ lưu trữ.",503); return value; }
async function neonRequest(method: "PUT" | "GET" | "DELETE", location: MediaLocation, bytes?: Uint8Array<ArrayBuffer>, mime?: string, range?: MediaRange | null) {
  if (location.bucket_name !== "media") throw new MediaError("Tệp không hợp lệ.");
  const url = new URL(required("NEON_MEDIA_FUNCTION_URL"));
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new MediaError("Cấu hình media origin không hợp lệ.",503);
  url.searchParams.set("key",location.object_key);
  const headers = new Headers({"x-secret":required("MEDIA_ORIGIN_SECRET")});
  if (mime) headers.set("content-type",mime);
  if (range) headers.set("range",`bytes=${range.offset}-${range.offset+range.length-1}`);
  return fetch(url,{method,headers,body:bytes,redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(45_000)});
}
type PrivateBucket = {
  put(key: string, bytes: Uint8Array<ArrayBuffer>, options: {httpMetadata:{contentType:string;cacheControl:string}}): Promise<unknown>;
  get(key: string, options?: {range:MediaRange}): Promise<{body:ReadableStream<Uint8Array>;size:number} | null>;
  delete(key:string):Promise<void>;
};
async function privateBucket(location: MediaLocation): Promise<PrivateBucket | null> {
  if (location.bucket_name !== required("R2_PRIVATE_BUCKET")) throw new MediaError("Bucket tài liệu riêng tư không hợp lệ.",503);
  let context;
  try { context = await getCloudflareContext({async:true}); } catch { return null; }
  if (!("PRIVATE_DOCUMENTS" in context.env)) return null;
  const candidate = context.env.PRIVATE_DOCUMENTS;
  if (!candidate || typeof candidate !== "object" || !("put" in candidate) || typeof candidate.put !== "function" || !("get" in candidate) || typeof candidate.get !== "function" || !("delete" in candidate) || typeof candidate.delete !== "function") throw new MediaError("Binding R2 không hợp lệ.",503);
  // Native Workers R2 binding has validated methods; these signatures match its documented platform contract.
  const bucket = candidate as PrivateBucket;
  return bucket;
}
function r2(location: MediaLocation) {
  // Never fall back to the existing public project-assets bucket for private documents.
  if (location.bucket_name !== required("R2_PRIVATE_BUCKET")) throw new MediaError("Bucket tài liệu riêng tư không hợp lệ.",503);
  return createR2Storage({accountId:required("R2_ACCOUNT_ID"),bucket:location.bucket_name,accessKeyId:required("R2_ACCESS_KEY_ID"),secretAccessKey:required("R2_SECRET_ACCESS_KEY")});
}
export function mediaLocation(provider: "neon" | "r2", key: string): MediaLocation { return {storage_provider:provider,bucket_name:provider === "neon" ? "media" : required("R2_PRIVATE_BUCKET"),object_key:key}; }
export async function putObject(location: MediaLocation, bytes: Uint8Array<ArrayBuffer>, mime: string) {
  if (location.storage_provider === "r2") {
    const bucket = await privateBucket(location);
    if (bucket) { await bucket.put(location.object_key,bytes,{httpMetadata:{contentType:mime,cacheControl:"private, no-store"}}); return; }
    const signed = await r2(location).signUpload({key:location.object_key,contentType:mime});
    const response = await fetch(signed.url,{method:"PUT",headers:signed.headers,body:bytes,redirect:"manual",signal:AbortSignal.timeout(30_000)});
    await response.body?.cancel(); if (!response.ok) throw new MediaError("Tải tệp lên R2 không thành công.",502); return;
  }
  if (location.storage_provider !== "neon") throw new MediaError("Nhà cung cấp không hợp lệ.");
  const response = await neonRequest("PUT",location,bytes,mime);
  if (!response.ok) { await response.body?.cancel(); throw new MediaError("Tải ảnh lên Neon không thành công.",502); }
  await response.body?.cancel();
}
export async function deleteObject(location: MediaLocation) {
  if (location.storage_provider === "r2") { const bucket = await privateBucket(location); if(bucket) { await bucket.delete(location.object_key); return; } await r2(location).delete(location.object_key); return; }
  if (location.storage_provider !== "neon") throw new MediaError("Nhà cung cấp không hợp lệ.");
  const response = await neonRequest("DELETE",location); await response.body?.cancel(); if (![200,204,404].includes(response.status)) throw new MediaError("Chưa xóa được tệp Neon.",502);
}
export async function getObject(location: MediaLocation, range: MediaRange | null) {
  if (location.storage_provider === "r2") {
    const bucket = await privateBucket(location);
    if (bucket) { const object = await bucket.get(location.object_key,range ? {range} : undefined); if (!object) throw new MediaError("Không tìm thấy tệp.",404); return new Response(object.body,{status:range?206:200}); }
    const signed = await r2(location).signDownload({key:location.object_key});
    const response = await fetch(signed.url,{headers:range?{range:`bytes=${range.offset}-${range.offset+range.length-1}`}:{},redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(30_000)});
    if (response.status !== (range?206:200)) { await response.body?.cancel(); throw new MediaError("Không đọc được tệp R2.",response.status===404?404:502); } return response;
  }
  if (location.storage_provider !== "neon") throw new MediaError("Nhà cung cấp không hợp lệ.");
  const response = await neonRequest("GET",location,undefined,undefined,range);
  if (response.status !== (range?206:200)) { await response.body?.cancel(); throw new MediaError("Không đọc được tệp Neon.",response.status===404?404:502); } return response;
}

export type InventoryPage = { objects: { key:string;size:number }[]; truncated:boolean; cursor?:string };
export async function inventoryPage(scope:"public"|"private",cursor?:string):Promise<InventoryPage> {
  let context;
  try { context=await getCloudflareContext({async:true}); } catch { throw new MediaError("Chưa kết nối binding kiểm kê R2.",503); }
  const binding=scope==='public'?'PUBLIC_ASSETS':'PRIVATE_DOCUMENTS';
  if (!(binding in context.env)) throw new MediaError("Thiếu binding kiểm kê R2.",503);
  const candidate:unknown=Reflect.get(context.env,binding);
  if(!candidate||typeof candidate!=='object'||!('list' in candidate)||typeof candidate.list!=='function')throw new MediaError("Binding kiểm kê R2 không hợp lệ.",503);
  const result:unknown=await candidate.list({limit:1000,...(cursor?{cursor}:{})});
  if(!result||typeof result!=='object'||!('objects' in result)||!Array.isArray(result.objects)||result.objects.length>1000||!('truncated' in result)||typeof result.truncated!=='boolean')throw new MediaError("Kiểm kê R2 không đầy đủ.",503);
  const objects:{key:string;size:number}[]=[];
  for(const object of result.objects){
    if(!object||typeof object!=='object'||!('key' in object)||typeof object.key!=='string'||!('size' in object)||typeof object.size!=='number'||!Number.isSafeInteger(object.size)||object.size<0)throw new MediaError("Số liệu R2 không hợp lệ.",503);
    objects.push({key:object.key,size:object.size});
  }
  if(result.truncated&&(!('cursor' in result)||typeof result.cursor!=='string'||!result.cursor||result.cursor===cursor))throw new MediaError("Kiểm kê R2 bị ngắt.",503);
  return {objects,truncated:result.truncated,cursor:result.truncated&&'cursor' in result?String(result.cursor):undefined};
}

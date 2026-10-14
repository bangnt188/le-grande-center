import { MediaError, type MediaRange } from "./validation";

const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2,"0")).join("");
export async function sha256(bytes: Uint8Array<ArrayBuffer>) { return hex(await crypto.subtle.digest("SHA-256", bytes)); }
function required(key: string) { const value = process.env[key]; if (!value) throw new MediaError("Chưa cấu hình dịch vụ lưu trữ.",503); return value; }
export function publicNeonUrl(key: string) {
  const endpoint = new URL(required("AWS_ENDPOINT_URL_S3"));
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new MediaError("Cấu hình Neon không hợp lệ.",503);
  return `${endpoint.href.replace(/\/$/,"")}/media/${key.split("/").map(encode).join("/")}`;
}

// Executed on the Neon Function origin. S3 credentials never reach the browser or Worker.
export async function neonS3Request(method: "PUT" | "GET" | "DELETE", objectKey: string, bytes?: Uint8Array<ArrayBuffer>, mime?: string, range?: MediaRange | null) {
  const url = new URL(publicNeonUrl(objectKey));
  const timestamp = new Date().toISOString().replace(/[:-]|\.\d{3}/g,"");
  const date = timestamp.slice(0,8), region = required("AWS_REGION"), credential = required("AWS_ACCESS_KEY_ID");
  const payloadHash = await sha256(bytes ?? new Uint8Array());
  const headers = new Headers({ host: url.host, "x-amz-date": timestamp, "x-amz-content-sha256": payloadHash });
  if (mime) headers.set("content-type",mime);
  if (method === "PUT") headers.set("cache-control","public, max-age=31536000, immutable");
  if (range) headers.set("range",`bytes=${range.offset}-${range.offset+range.length-1}`);
  const names = [...headers.keys()].sort();
  const canonicalHeaders = names.map(name=>`${name}:${headers.get(name)}\n`).join("");
  const signed = names.join(";");
  const scope = `${date}/${region}/s3/aws4_request`;
  const canonical = `${method}\n${url.pathname}\n\n${canonicalHeaders}\n${signed}\n${payloadHash}`;
  const encoder = new TextEncoder();
  const hmac = async (key: Uint8Array<ArrayBuffer>, text: string) => new Uint8Array(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw",key,{name:"HMAC",hash:"SHA-256"},false,["sign"]),encoder.encode(text)));
  let key = encoder.encode(`AWS4${required("AWS_SECRET_ACCESS_KEY")}`);
  for (const value of [date,region,"s3","aws4_request"]) key = await hmac(key,value);
  const signature = hex((await hmac(key,`AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${await sha256(encoder.encode(canonical))}`)).buffer);
  headers.set("authorization",`AWS4-HMAC-SHA256 Credential=${credential}/${scope}, SignedHeaders=${signed}, Signature=${signature}`);
  headers.delete("host");
  return fetch(url,{method,headers,body:bytes,redirect:"manual",signal:AbortSignal.timeout(30_000)});
}

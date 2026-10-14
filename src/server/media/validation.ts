export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_BATCH_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 4;
export class MediaError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export async function boundedMultipart(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;\s*boundary=/i.test(contentType) || contentType.length > 256) throw new MediaError("Yêu cầu tải tệp không hợp lệ.");
  const maximum = MAX_BATCH_BYTES + 64 * 1024;
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum)) throw new MediaError("Tổng tệp vượt giới hạn 20 MiB.", 413);
  if (!request.body) throw new MediaError("Thiếu nội dung tải lên.");
  let received = 0;
  const bounded = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > maximum) throw new MediaError("Tổng tệp vượt giới hạn 20 MiB.", 413);
      controller.enqueue(chunk);
    },
  }));
  // Native multipart parsing is bounded before it can allocate the whole request.
  let form: FormData;
  try { form = await new Response(bounded, { headers: { "content-type": contentType } }).formData(); }
  catch (error) { if (error instanceof MediaError) throw error; throw new MediaError("Không đọc được nội dung tải lên."); }
  if ([...form.keys()].some(key => !["files", "scope", "expectedRevision"].includes(key))) throw new MediaError("Trường tải lên không hợp lệ.");
  const files = form.getAll("files");
  const scope = form.get("scope");
  const revision = form.get("expectedRevision");
  if (!files.length || files.length > MAX_FILES || files.some(file => !(file instanceof File)) || typeof scope !== "string" || scope.length > 160 || typeof revision !== "string" || !/^\d+$/.test(revision) || !Number.isSafeInteger(Number(revision)) || form.getAll("scope").length !== 1 || form.getAll("expectedRevision").length !== 1) throw new MediaError("Thông tin tải lên không hợp lệ.");
  const uploads = files as File[];
  if (uploads.reduce((total, file) => total + file.size, 0) > MAX_BATCH_BYTES) throw new MediaError("Tổng tệp vượt giới hạn 20 MiB.", 413);
  return { files: uploads, scope, expectedRevision: Number(revision) };
}
export function fileType(bytes: Uint8Array, declared: string) {
  const text = new TextDecoder("ascii").decode(bytes.subarray(0, 12));
  const valid = declared === "application/pdf" ? text.startsWith("%PDF-")
    : declared === "image/png" ? [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value)
    : declared === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : declared === "image/webp" && text.startsWith("RIFF") && text.slice(8,12) === "WEBP";
  if (!valid) throw new MediaError("Nội dung tệp không khớp định dạng PNG/JPEG/WebP/PDF.");
  return declared;
}
// Inspect dimensions before WASM decoding: a tiny compressed bomb must not allocate gigabytes.
export function imageDimensions(bytes: Uint8Array, mime: string) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0;
  try {
    if (mime === "image/png") { if (new TextDecoder().decode(bytes.subarray(12,16)) !== "IHDR") throw new Error(); width = view.getUint32(16); height = view.getUint32(20); }
    else if (mime === "image/webp") {
      const kind = new TextDecoder().decode(bytes.subarray(12,16));
      if (kind === "VP8X") { width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16); height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16); }
      else if (kind === "VP8L" && bytes[20] === 47) { width = 1 + bytes[21] + ((bytes[22] & 63) << 8); height = 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10); }
      else if (kind === "VP8 " && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) { width = view.getUint16(26,true) & 16383; height = view.getUint16(28,true) & 16383; }
    } else if (mime === "image/jpeg") {
      let offset = 2;
      while (offset < bytes.length) {
        if (bytes[offset++] !== 255) throw new Error();
        while (bytes[offset] === 255) offset++;
        const marker = bytes[offset++];
        if (marker === 217 || marker === 218) break;
        if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
        const size = view.getUint16(offset);
        if (size < 2 || offset + size > bytes.length) throw new Error();
        if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) { height = view.getUint16(offset + 3); width = view.getUint16(offset + 5); break; }
        offset += size;
      }
    }
  } catch { throw new MediaError("Ảnh hỏng hoặc không đọc được kích thước."); }
  if (!width || !height || width > 4096 || height > 4096 || width * height > 4_000_000) throw new MediaError("Ảnh phải có kích thước tối đa 4096 px và 4 megapixel.");
  return { width, height };
}
export type MediaRange = { offset: number; length: number };
export function byteRange(value: string | null, size: number): MediaRange | null {
  if (!value) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) throw new MediaError("Khoảng byte không hợp lệ.", 416);
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] ? (match[2] ? Math.min(Number(match[2]), size - 1) : size - 1) : size - 1;
  if (![start,end].every(Number.isSafeInteger) || start < 0 || start >= size || end < start || (!match[1] && Number(match[2]) === 0)) throw new MediaError("Khoảng byte không hợp lệ.", 416);
  return { offset: start, length: end - start + 1 };
}
export function mediaHeaders(mime: string, name: string, size: number, range: MediaRange | null) {
  const headers = new Headers({ "content-type": mime, "content-length": String(range?.length ?? size), "accept-ranges": "bytes", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "sandbox; default-src 'none'; frame-ancestors 'self'", "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(name).replace(/[!'()*]/g, value => `%${value.charCodeAt(0).toString(16)}`)}` });
  if (range) headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`);
  return headers;
}

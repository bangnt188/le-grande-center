import { timingSafeEqual } from "node:crypto";
import { neonS3Request } from "./neon-origin";
import { fileType, imageDimensions, MAX_FILE_BYTES, MediaError, type MediaRange } from "./validation";

const secret = process.env.MEDIA_ORIGIN_SECRET;
if (!secret || secret.length < 64) throw new Error("MEDIA_ORIGIN_SECRET is required (at least 64 characters)");
const expectedSecret = Buffer.from(secret);
const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const brandingKey = new RegExp(`^branding/${uuid}/${uuid}$`, "i");
const approvedLogoKey = "client-reference/legacy/logo-without-text.png";

function authenticated(request: Request) {
  const provided = request.headers.get("x-secret");
  if (provided === null || provided.length > 512) return false;
  const bytes = Buffer.from(provided);
  return bytes.byteLength === expectedSecret.byteLength && timingSafeEqual(bytes, expectedSecret);
}
async function imageBody(request: Request) {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_FILE_BYTES)) throw new MediaError("Ảnh vượt giới hạn 10 MiB.", 413);
  if (!request.body) throw new MediaError("Thiếu ảnh.");
  let received = 0;
  const bounded = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > MAX_FILE_BYTES) throw new MediaError("Ảnh vượt giới hạn 10 MiB.", 413);
      controller.enqueue(chunk);
    },
  }));
  const bytes = new Uint8Array(await new Response(bounded).arrayBuffer());
  if (!bytes.byteLength) throw new MediaError("Ảnh rỗng.");
  const mime = request.headers.get("content-type") ?? "";
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) throw new MediaError("Chỉ nhận PNG/JPEG/WebP.");
  fileType(bytes, mime);
  imageDimensions(bytes, mime);
  return { bytes, mime };
}

export default {
  async fetch(request: Request): Promise<Response> {
    // Trusted server hop only: reject before reading the body or accessing storage.
    // The app verifies the real session, project ownership, quota and durable reservation first.
    if (!authenticated(request)) return new Response("Unauthorized", { status: 401, headers: { "cache-control": "no-store" } });
    try {
      const method = request.method;
      if (method !== "PUT" && method !== "GET" && method !== "DELETE") throw new MediaError("Method not allowed", 405);
      const url = new URL(request.url);
      const key = url.searchParams.get("key");
      if (url.pathname !== "/" || url.searchParams.size !== 1 || !key || !(brandingKey.test(key) || (key === approvedLogoKey && request.method !== "PUT"))) throw new MediaError("Object key không hợp lệ.");
      let range: MediaRange | undefined;
      const rangeHeader = request.headers.get("range");
      if (rangeHeader) {
        const match = /^bytes=(\d+)-(\d+)$/.exec(rangeHeader);
        const start = Number(match?.[1]), end = Number(match?.[2]);
        if (request.method !== "GET" || !match || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= MAX_FILE_BYTES) throw new MediaError("Khoảng byte không hợp lệ.", 416);
        range = { offset: start, length: end - start + 1 };
      }
      const image = request.method === "PUT" ? await imageBody(request) : undefined;
      const response = await neonS3Request(method, key, image?.bytes, image?.mime, range);
      const expected = request.method === "GET" ? [range ? 206 : 200] : request.method === "DELETE" ? [200, 204, 404] : [200, 201, 204];
      if (!expected.includes(response.status)) {
        await response.body?.cancel();
        throw new MediaError("Neon storage request failed.", response.status === 404 ? 404 : 502);
      }
      const headers = new Headers({ "cache-control": "no-store", "x-content-type-options": "nosniff" });
      if (request.method === "GET") for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
        const value = response.headers.get(name);
        if (value !== null) headers.set(name, value);
      }
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      return Response.json({ error: error instanceof MediaError ? error.message : "Storage origin failed." }, { status: error instanceof MediaError ? error.status : 502, headers: { "cache-control": "no-store" } });
    }
  },
};

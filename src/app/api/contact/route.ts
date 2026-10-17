import { assertSameOrigin, AuthError } from "@/server/auth";
import { parseContactInput } from "@/server/contact-input";
import { submitContact } from "@/server/public";
import { readPublicWebsiteData } from "@/server/public-data";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "Cần gửi JSON." }, { status: 415 });
    const key = request.headers.get("idempotency-key") ?? "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) return Response.json({ error: "Thiếu mã yêu cầu hợp lệ." }, { status: 400 });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Thiếu nội dung." }, { status: 400 });
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 16384) { await reader.cancel(); return Response.json({ error: "Nội dung quá lớn." }, { status: 413 }); } chunks.push(part.value); }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    let input;
    try { input = parseContactInput(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body))); }
    catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Thông tin không hợp lệ." }, { status: 400 }); }
    if (input.unitId) {
      const published = await readPublicWebsiteData();
      if (!published.units.some(unit => unit.code === input.unitId)) return Response.json({ error: "Mặt bằng không tồn tại." }, { status: 400 });
      if (input.scope === "pair" && !/^[AB]\.\d+$/.test(input.unitId)) return Response.json({ error: "Mặt bằng không có cặp shophouse." }, { status: 400 });
    } else if (input.scope === "pair") return Response.json({ error: "Thiếu mặt bằng quan tâm." }, { status: 400 });
    const secret = process.env.CONTACT_RATE_LIMIT_SECRET;
    if (!secret || secret.length < 32) throw new Error("Contact rate-limit secret is missing.");
    const signingKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const digest = await crypto.subtle.sign("HMAC", signingKey, new TextEncoder().encode(request.headers.get("cf-connecting-ip") ?? "local"));
    const ipHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    await submitContact(input, { idempotencyKey: key, ipHash });
    return Response.json({ accepted: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof AuthError ? error.status : error && typeof error === "object" && "status" in error && typeof error.status === "number" ? error.status : 503;
    return Response.json({ error: status === 429 ? "Vui lòng đợi trước khi gửi yêu cầu mới." : "Không thể tiếp nhận yêu cầu lúc này." }, { status, headers: status === 429 ? { "Retry-After": "300" } : {} });
  }
}

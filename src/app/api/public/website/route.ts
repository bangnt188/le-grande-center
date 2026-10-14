import { readPublicWebsite } from "@/server/public";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return Response.json(await readPublicWebsite(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return Response.json({ error: "Không thể tải thông tin website." }, { status: 503 }); }
}

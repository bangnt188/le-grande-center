import { getAuth, transformPasswordRequest } from "@/server/auth";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) { return getAuth().handler().GET(request, context); }
export async function POST(request: NextRequest, context: Context) {
  const forwarded = await transformPasswordRequest(request);
  return getAuth().handler().POST(forwarded, context);
}
export async function PUT(request: NextRequest, context: Context) {
  const forwarded = await transformPasswordRequest(request);
  return getAuth().handler().PUT(forwarded, context);
}
export async function DELETE(request: NextRequest, context: Context) { return getAuth().handler().DELETE(request, context); }
export async function PATCH(request: NextRequest, context: Context) {
  const forwarded = await transformPasswordRequest(request);
  return getAuth().handler().PATCH(forwarded, context);
}

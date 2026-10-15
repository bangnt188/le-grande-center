import type { NextRequest } from "next/server";
import { getAuth } from "@/server/auth";

// Verify managed sessions before the independent page/API administrator guard.
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/admin/" })(request);
}
export const config = { matcher: ["/admin/workspace/:path*"] };

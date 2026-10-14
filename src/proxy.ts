import type { NextRequest } from "next/server";
import { getAuth } from "@/server/auth";

// Exchange managed OAuth verifier callbacks before the independent page/API staff guard.
export default function proxy(request: NextRequest) {
  return getAuth().middleware({ loginUrl: "/admin/" })(request);
}
export const config = { matcher: ["/admin/workspace/:path*"] };

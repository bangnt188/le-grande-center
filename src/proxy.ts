import { NextResponse, type NextRequest } from "next/server";

// Zero provider/database lookups in the proxy layer.
// Protected APIs validate signed app cookies locally; sign-out clears the app cookie.
export default function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/auth/sign-out")) {
    response.cookies.set("__Host-lgc_admin", "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/admin/workspace/:path*",
    "/api/auth/sign-out/:path*",
  ],
};

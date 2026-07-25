import { NextResponse, type NextRequest } from "next/server";

/**
 * Product routes no longer require a private-beta invite cookie.
 * Session auth remains Privy (client) + Hub wallet cookie / API tokens.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/treasury",
    "/treasury/:path*",
    "/policy",
    "/policy/:path*",
    "/agents",
    "/agents/:path*",
    "/transactions",
    "/transactions/:path*",
    "/reputation",
    "/reputation/:path*",
    "/connect",
    "/connect/:path*",
    "/api-keys",
    "/api-keys/:path*",
    "/settings",
    "/settings/:path*",
    "/onboarding",
    "/onboarding/:path*",
  ],
};

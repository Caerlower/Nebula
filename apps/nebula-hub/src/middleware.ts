import { NextResponse, type NextRequest } from "next/server";

import { BETA_COOKIE, isValidBetaCode } from "@/lib/auth/beta";

/**
 * Private-beta gate for product routes.
 * Session auth is Privy (client) + Hub wallet cookie / API tokens — not this middleware.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/treasury",
  "/policy",
  "/agents",
  "/transactions",
  "/reputation",
  "/connect",
  "/api-keys",
  "/settings",
  "/onboarding",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return NextResponse.next();

  if (isValidBetaCode(request.cookies.get(BETA_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
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

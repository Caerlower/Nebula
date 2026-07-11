import { NextResponse, type NextRequest } from "next/server";

import { BETA_COOKIE, isValidBetaCode } from "@/lib/beta";

/**
 * Private-beta gate: every product route requires a valid invite cookie,
 * enforced server-side so the dashboard can't be reached by URL alone.
 * The landing (/), auth pages, and APIs stay public.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/treasury",
  "/policy",
  "/agents",
  "/transactions",
  "/reputation",
  "/connect",
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
    "/dashboard/:path*",
    "/treasury/:path*",
    "/policy/:path*",
    "/agents/:path*",
    "/transactions/:path*",
    "/reputation/:path*",
    "/connect/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};

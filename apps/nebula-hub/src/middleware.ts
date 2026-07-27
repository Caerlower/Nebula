import { NextResponse, type NextRequest } from "next/server";

import {
  hubOriginFor,
  isApexOrWwwHost,
  isLocalHostname,
  mainnetPreferenceAllowed,
  networkFromHostname,
} from "@/lib/network";

/**
 * Host → ledger:
 * - apex/www Hub product routes → testnet subdomain (marketing `/` stays)
 * - mainnet.* when MAINNET_ENABLED=0 → testnet
 * Session cookies stay host-only (re-login per subdomain).
 */
export function middleware(request: NextRequest) {
  const hostHeader =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim() ||
    "";
  const hostname = hostHeader.toLowerCase().split(":")[0] ?? "";
  const { pathname, search } = request.nextUrl;

  if (isLocalHostname(hostname)) {
    return NextResponse.next();
  }

  // Marketing root + static landing stay on apex/www.
  const isLanding =
    pathname === "/" ||
    pathname.startsWith("/landing/") ||
    pathname === "/landing";
  // Waitlist posts from the marketing site on apex/www.
  const isApexApi =
    pathname === "/api/waitlist" || pathname.startsWith("/api/waitlist/");

  if (isApexOrWwwHost(hostname) && !isLanding && !isApexApi) {
    const dest = new URL(`${hubOriginFor("testnet")}${pathname}${search}`);
    return NextResponse.redirect(dest, 308);
  }

  if (
    networkFromHostname(hostname) === "mainnet" &&
    !mainnetPreferenceAllowed()
  ) {
    const dest = new URL(`${hubOriginFor("testnet")}${pathname}${search}`);
    return NextResponse.redirect(dest, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Hub product + auth + MCP/API — not marketing `/` or static assets.
     * Apex/www hits on these paths 308 → testnet.*.
     */
    "/login",
    "/login/:path*",
    "/signup",
    "/signup/:path*",
    "/authorize",
    "/authorize/:path*",
    "/approve",
    "/approve/:path*",
    "/oauth",
    "/oauth/:path*",
    "/onboarding",
    "/onboarding/:path*",
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
    "/mcp",
    "/mcp/:path*",
    "/api/:path*",
    "/.well-known/:path*",
  ],
};

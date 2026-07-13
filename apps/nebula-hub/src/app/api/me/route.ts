import { NextRequest } from "next/server";

import { resolveAuth, unauthorized } from "@/lib/auth";

/** Current Hub user from Privy access token or Nebula MCP token. */
export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  return Response.json({
    userId: principal.userId,
    email: principal.email,
    source: principal.source,
    stellarAddress: principal.stellarAddress,
    privyWalletId: principal.privyWalletId,
    walletProvisioned: Boolean(
      principal.stellarAddress && principal.privyWalletId,
    ),
  });
}

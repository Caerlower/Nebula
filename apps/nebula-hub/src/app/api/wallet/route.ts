import { NextRequest } from "next/server";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchBalances } from "@/lib/stellar";

/**
 * Wallet balances (XLM + USDC).
 *
 * Agent-scoped: pass `?agentId=<id>` to read a specific agent's OWN wallet.
 * Dashboard sessions MUST pass an agentId — the owner/login wallet is auth-only
 * and its balance is never surfaced. Agent-bound tokens (MCP) keep reading their
 * own overlaid wallet with no param.
 */
export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) {
    return unauthorized();
  }

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  const agentId = new URL(req.url).searchParams.get("agentId");

  let address: string | null = principal.stellarAddress;

  if (agentId) {
    const agent = await prisma.agent.findFirst({
      where: { id: agentId, userId: principal.userId },
      select: { stellarAddress: true },
    });
    if (!agent) {
      return Response.json(
        { status: "error", reason: "not_found" },
        { status: 404 },
      );
    }
    address = agent.stellarAddress;
  } else if (isDashboardAuth(principal)) {
    // Owner/login wallet is auth-only — never expose its balance to the dashboard.
    return Response.json({
      address: null,
      network,
      balances: [],
      note: "select_or_create_agent",
    });
  }

  if (!address) {
    return Response.json({
      address: null,
      network,
      balances: [],
      note: "Agent wallet not provisioned yet.",
    });
  }

  const balances = await fetchBalances(address, network);
  return Response.json({ address, network, balances });
}

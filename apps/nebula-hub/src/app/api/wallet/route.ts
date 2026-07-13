import { NextRequest } from "next/server";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { fetchBalances } from "@/lib/stellar";

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) {
    return unauthorized();
  }

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  if (!principal.stellarAddress) {
    return Response.json({
      address: null,
      network,
      balances: [],
      note: "Wallet not provisioned yet. Complete Privy login once.",
    });
  }

  const balances = await fetchBalances(principal.stellarAddress, network);
  return Response.json({
    address: principal.stellarAddress,
    network,
    balances,
  });
}

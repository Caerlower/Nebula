import { NextRequest } from "next/server";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { privyConfigured } from "@/lib/auth";
import { privySigner } from "@/lib/signing";
import {
  ensureUsdcTrustline,
  explorerTxUrl,
  hasUsdcTrustline,
} from "@/lib/stellar";

const CIRCLE_USDC_ISSUER = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  mainnet: "GA5ZSEJYB37JRC5RJRC75UPGWKOWTXQYPFJXXQE2RXYI763DGSJDFLVQ",
} as const;

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  if (!principal.stellarAddress) {
    return Response.json(
      {
        status: "error",
        reason: "wallet_not_provisioned",
      },
      { status: 400 },
    );
  }

  const ready = await hasUsdcTrustline(principal.stellarAddress, network);
  return Response.json({
    status: "ok",
    ready,
    asset: "USDC",
    issuer: CIRCLE_USDC_ISSUER[network],
    network,
    faucet: network === "testnet" ? "https://faucet.circle.com/" : null,
  });
}

export async function POST(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal || !isDashboardAuth(principal)) {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "mcp_tokens_cannot_mutate_wallet" },
      { status: 403 },
    );
  }

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  if (!principal.stellarAddress || !principal.privyWalletId) {
    return Response.json(
      { status: "error", reason: "wallet_not_provisioned" },
      { status: 400 },
    );
  }

  if (!privyConfigured() || principal.privyWalletId === "dev-wallet") {
    return Response.json(
      {
        status: "error",
        reason:
          "privy_not_configured: trustline requires Privy signing on a real wallet",
      },
      { status: 400 },
    );
  }

  try {
    const result = await ensureUsdcTrustline({
      address: principal.stellarAddress,
      signer: privySigner(principal.privyWalletId, principal.stellarAddress),
      network,
    });
    return Response.json({
      status: "ok",
      already_had: result.alreadyHad,
      tx_hash: result.txHash,
      explorer_url: result.txHash
        ? explorerTxUrl(network, result.txHash)
        : null,
      faucet: network === "testnet" ? "https://faucet.circle.com/" : null,
      message: result.alreadyHad
        ? "USDC trustline already open"
        : "USDC trustline opened — fund via Circle faucet next",
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        reason: error instanceof Error ? error.message : String(error),
      },
      { status: 400 },
    );
  }
}

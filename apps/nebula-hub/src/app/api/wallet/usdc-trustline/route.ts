import { NextRequest } from "next/server";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { privyConfigured } from "@/lib/auth";
import { privySigner } from "@/lib/signing";
import { prisma } from "@/lib/db";
import {
  ensureUsdcTrustline,
  explorerTxUrl,
  hasUsdcTrustline,
} from "@/lib/stellar";

const CIRCLE_USDC_ISSUER = {
  testnet: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  mainnet: "GA5ZSEJYB37JRC5RJRC75UPGWKOWTXQYPFJXXQE2RXYI763DGSJDFLVQ",
} as const;

/** Resolve the target wallet — an owned agent's wallet when `agentId` is given,
 * otherwise the principal's own wallet. */
async function resolveWallet(
  principal: Awaited<ReturnType<typeof resolveAuth>>,
  agentId: string | null,
): Promise<
  | { ok: true; address: string | null; privyWalletId: string | null }
  | { ok: false; status: number; reason: string }
> {
  if (!principal) return { ok: false, status: 401, reason: "unauthorized" };
  if (!agentId) {
    return {
      ok: true,
      address: principal.stellarAddress,
      privyWalletId: principal.privyWalletId,
    };
  }
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, userId: principal.userId },
    select: { stellarAddress: true, privyWalletId: true },
  });
  if (!agent) return { ok: false, status: 404, reason: "not_found" };
  return {
    ok: true,
    address: agent.stellarAddress,
    privyWalletId: agent.privyWalletId,
  };
}

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  const agentId = new URL(req.url).searchParams.get("agentId");
  const resolved = await resolveWallet(principal, agentId);
  if (!resolved.ok) {
    return Response.json(
      { status: "error", reason: resolved.reason },
      { status: resolved.status },
    );
  }

  if (!resolved.address) {
    return Response.json(
      {
        status: "error",
        reason: "wallet_not_provisioned",
      },
      { status: 400 },
    );
  }

  const ready = await hasUsdcTrustline(resolved.address, network);
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

  const body = (await req.json().catch(() => ({}))) as { agentId?: string };
  const agentId = body.agentId ?? null;
  const resolved = await resolveWallet(principal, agentId);
  if (!resolved.ok) {
    return Response.json(
      { status: "error", reason: resolved.reason },
      { status: resolved.status },
    );
  }

  if (!resolved.address || !resolved.privyWalletId) {
    return Response.json(
      { status: "error", reason: "wallet_not_provisioned" },
      { status: 400 },
    );
  }

  if (!privyConfigured() || resolved.privyWalletId === "dev-wallet") {
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
      address: resolved.address,
      signer: privySigner(resolved.privyWalletId, resolved.address),
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

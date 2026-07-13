import type { PolicySnapshot, ToolContext, ToolResult } from "@nebula/core";

import type { AuthPrincipal } from "../auth";
import { prisma } from "../db";
import { sumSpendUsdcSince } from "../fx";

export { SPEND_TX_TYPES } from "../fx";

export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "https://nebulaonchain.xyz"
).replace(/\/$/, "");

export const MIN_TREASURY_MOVE = 0.000001;
/** Ignore dust rebalances after transfers (float / tiny deficits). */
export const MIN_AUTO_REBALANCE = 1;

export function formatAmt(n: number): string {
  return n.toFixed(7).replace(/\.?0+$/, "") || "0";
}

/** Ledger `amountXlm` is USDC for x402/MPP; native XLM otherwise. */
export function ledgerAsset(type: string): "USDC" | "XLM" {
  if (
    type === "x402" ||
    type === "mpp" ||
    type === "mpp_open" ||
    type === "mpp_close"
  ) {
    return "USDC";
  }
  return "XLM";
}

export async function loadPolicySnapshot(
  userId: string,
): Promise<PolicySnapshot> {
  const settings =
    (await prisma.policySettings.findUnique({ where: { userId } })) ??
    (await prisma.policySettings.create({
      data: { userId },
    }));

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [whitelist, denylist, spend] = await Promise.all([
    prisma.whitelistEntry.findMany({ where: { userId } }),
    prisma.denylistEntry.findMany({ where: { userId } }),
    sumSpendUsdcSince(userId, since),
  ]);

  return {
    microThreshold: Number(settings.microThreshold),
    perTxCap: Number(settings.perTxCap),
    dailyCap: Number(settings.dailyCap),
    paused: settings.paused,
    whitelist: whitelist.map((w) => w.address),
    denylist: denylist.map((d) => d.address),
    dailySpentUsdc: spend.total,
  };
}

export async function loadTreasurySettings(userId: string) {
  return (
    (await prisma.policySettings.findUnique({ where: { userId } })) ??
    (await prisma.policySettings.create({ data: { userId } }))
  );
}

export function buildToolContext(principal: AuthPrincipal): ToolContext | null {
  if (!principal.stellarAddress || !principal.privyWalletId) {
    return null;
  }

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  return {
    userId: principal.userId,
    agentId: principal.agentId,
    tokenId: principal.tokenId,
    stellarAddress: principal.stellarAddress,
    privyWalletId: principal.privyWalletId,
    network,
    async signTransactionXdr(_xdr: string): Promise<string> {
      throw new Error("Use signAndSubmitWithPrivy for Stellar Tier-2 raw_sign");
    },
    async submitTransactionXdr(_signedXdr: string): Promise<string> {
      throw new Error("Use signAndSubmitWithPrivy for Stellar Tier-2 raw_sign");
    },
    log: (event, data) => {
      console.error(`[hub] ${event}`, data ?? {});
    },
  };
}

export async function requireNotPaused(userId: string): Promise<ToolResult | null> {
  const settings = await loadTreasurySettings(userId);
  if (settings.paused) {
    return { status: "rejected", reason: "policy_paused" };
  }
  return null;
}

export async function recordBlendTx(params: {
  principal: AuthPrincipal;
  type: "blend_deposit" | "blend_withdraw";
  amount: number;
  poolId: string;
  txHash: string | null;
  status: "confirmed" | "rejected";
  reason: string;
}) {
  await prisma.transaction.create({
    data: {
      userId: params.principal.userId,
      agentId: params.principal.agentId,
      type: params.type,
      destination: params.poolId,
      amountXlm: params.amount,
      reason: params.reason,
      txHash: params.txHash,
      status: params.status,
    },
  });
}

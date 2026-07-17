import type { PolicySnapshot, ToolContext, ToolResult } from "nebulamcp-core";

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

/** Effective spend caps for a scope. Agent-scoped when the agent has its own
 * AgentPolicy row; otherwise inherits the owner's PolicySettings cap values. */
export type EffectiveCaps = {
  microThreshold: number;
  perTxCap: number;
  dailyCap: number;
  paused: boolean;
  catTransfer: number;
  catX402: number;
  catMpp: number;
};

export async function loadEffectiveCaps(
  userId: string,
  agentId?: string | null,
): Promise<EffectiveCaps> {
  if (agentId) {
    const ap = await prisma.agentPolicy.findUnique({ where: { agentId } });
    if (ap) {
      return {
        microThreshold: Number(ap.microThreshold),
        perTxCap: Number(ap.perTxCap),
        dailyCap: Number(ap.dailyCap),
        paused: ap.paused,
        catTransfer: Number(ap.catTransfer),
        catX402: Number(ap.catX402),
        catMpp: Number(ap.catMpp),
      };
    }
  }
  const s = await loadTreasurySettings(userId);
  return {
    microThreshold: Number(s.microThreshold),
    perTxCap: Number(s.perTxCap),
    dailyCap: Number(s.dailyCap),
    paused: s.paused,
    catTransfer: Number(s.catTransfer),
    catX402: Number(s.catX402),
    catMpp: Number(s.catMpp),
  };
}

/** Build the on-chain policy init payload for a scope: agent-scoped spend caps
 * combined with the owner's (per-user) treasury band + autoYield. */
export async function loadOnchainPolicyInit(
  userId: string,
  agentId?: string | null,
) {
  const [caps, t] = await Promise.all([
    loadEffectiveCaps(userId, agentId),
    loadTreasurySettings(userId),
  ]);
  return {
    maxPerCallXlm: caps.perTxCap,
    maxPerDayXlm: caps.dailyCap,
    categories: {
      transfer: caps.catTransfer,
      x402: caps.catX402,
      mpp: caps.catMpp,
    },
    liquidLowXlm: Number(t.liquidThreshold),
    liquidHighXlm: Number(t.liquidHigh),
    autoYield: t.autoYield,
  };
}

export async function loadPolicySnapshot(
  userId: string,
  agentId?: string | null,
): Promise<PolicySnapshot> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [caps, whitelist, denylist, spend] = await Promise.all([
    loadEffectiveCaps(userId, agentId),
    prisma.whitelistEntry.findMany({ where: { userId } }),
    prisma.denylistEntry.findMany({ where: { userId } }),
    sumSpendUsdcSince(userId, since, { agentId }),
  ]);

  return {
    microThreshold: caps.microThreshold,
    perTxCap: caps.perTxCap,
    dailyCap: caps.dailyCap,
    paused: caps.paused,
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
  // Every account needs a Stellar address; only custodial (Privy) accounts
  // need a Privy wallet id. Partner / EOA accounts sign via other strategies.
  if (!principal.stellarAddress) {
    return null;
  }
  if (principal.signerStrategy === "privy" && !principal.privyWalletId) {
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
    privyWalletId: principal.privyWalletId ?? "",
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

export async function requireNotPaused(
  userId: string,
  agentId?: string | null,
): Promise<ToolResult | null> {
  const caps = await loadEffectiveCaps(userId, agentId);
  if (caps.paused) {
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

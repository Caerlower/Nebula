import { randomBytes } from "crypto";

import { NextRequest } from "next/server";

import { bustRouteCache, cachedJsonResponse, rateLimitOrThrow } from "@/lib/route-cache";
import { z } from "zod";

import { isDashboardAuth, resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadPolicySnapshot } from "@/lib/hub-tools";
import {
  ensurePolicyInitialized,
  onchainSetCategoryLimits,
  onchainSetLimits,
  onchainSetTreasuryBand,
  policyContractConfigured,
  policyContractId,
} from "@/lib/policy-onchain";

const userPolicyTails = new Map<string, Promise<unknown>>();
function withUserPolicyLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = userPolicyTails.get(userId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  userPolicyTails.set(
    userId,
    run.finally(() => {
      if (userPolicyTails.get(userId) === run) userPolicyTails.delete(userId);
    }),
  );
  return run;
}



const patchSchema = z.object({
  microThreshold: z.number().nonnegative().optional(),
  perTxCap: z.number().positive().optional(),
  dailyCap: z.number().positive().optional(),
  paused: z.boolean().optional(),
  autoYield: z.boolean().optional(),
  liquidThreshold: z.number().nonnegative().optional(),
  liquidHigh: z.number().nonnegative().optional(),
  catTransfer: z.number().nonnegative().optional(),
  catX402: z.number().nonnegative().optional(),
  catMpp: z.number().nonnegative().optional(),
  /// When set (treasury UI), on-chain band writes use this agent's managed
  /// wallet — not the owner's login wallet (often unfunded for Privy users).
  agentId: z.string().min(1).optional(),
});

function policyChangeReason(
  body: z.infer<typeof patchSchema>,
  updated: {
    dailyCap: { toString(): string } | number;
    perTxCap: { toString(): string } | number;
    catTransfer: { toString(): string } | number;
    catX402: { toString(): string } | number;
    catMpp: { toString(): string } | number;
    liquidThreshold: { toString(): string } | number;
    liquidHigh: { toString(): string } | number;
    autoYield: boolean;
    paused: boolean;
    microThreshold: { toString(): string } | number;
  },
  extras?: { perTxClamped?: boolean },
): string {
  const parts: string[] = [];
  if (body.dailyCap !== undefined) {
    parts.push(`daily_cap=${Number(updated.dailyCap)}`);
  }
  if (body.perTxCap !== undefined || extras?.perTxClamped) {
    parts.push(`per_tx=${Number(updated.perTxCap)}`);
  }
  if (body.catTransfer !== undefined) {
    parts.push(`cat_transfer=${Number(updated.catTransfer)}`);
  }
  if (body.catX402 !== undefined) {
    parts.push(`cat_x402=${Number(updated.catX402)}`);
  }
  if (body.catMpp !== undefined) {
    parts.push(`cat_mpp=${Number(updated.catMpp)}`);
  }
  if (body.liquidThreshold !== undefined) {
    parts.push(`liquid_low=${Number(updated.liquidThreshold)}`);
  }
  if (body.liquidHigh !== undefined) {
    parts.push(`liquid_high=${Number(updated.liquidHigh)}`);
  }
  if (body.autoYield !== undefined) {
    parts.push(`auto_yield=${updated.autoYield}`);
  }
  if (body.paused !== undefined) {
    parts.push(`paused=${updated.paused}`);
  }
  if (body.microThreshold !== undefined) {
    parts.push(`micro_threshold=${Number(updated.microThreshold)}`);
  }
  return parts.join("; ") || "policy_updated";
}

async function uncachedGET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();
  const policy = await loadPolicySnapshot(principal.userId);
  const settings = await prisma.policySettings.findUnique({
    where: { userId: principal.userId },
  });
  return Response.json({
    policy: {
      ...policy,
      catTransfer: settings ? Number(settings.catTransfer) : policy.perTxCap,
      catX402: settings ? Number(settings.catX402) : policy.perTxCap,
      catMpp: settings ? Number(settings.catMpp) : policy.perTxCap,
    },
    onchainConfigured: policyContractConfigured(),
    contractId: process.env.POLICY_CONTRACT_ID?.trim() || null,
  });
}

async function uncachedPATCH(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal || !isDashboardAuth(principal)) {
    if (!principal) return unauthorized();
    return Response.json(
      { status: "rejected", reason: "mcp_tokens_cannot_mutate_policy" },
      { status: 403 },
    );
  }

  const limited = await rateLimitOrThrow(`policy:${principal.userId}`);
  if (!limited.success) {
    return Response.json(
      { status: "error", reason: "rate_limited" },
      { status: 429 },
    );
  }

  const body = patchSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json({ status: "error", reason: body.error.message }, { status: 400 });
  }

  // Serialize per-user so concurrent PATCH requests don't race Soroban sequences.
  return withUserPolicyLock(principal.userId, async () => {
    try {
      return await applyPolicyPatch(principal, body.data);
    } catch (error) {
      console.error("[policy] PATCH failed", error);
      const message = error instanceof Error ? error.message : String(error);
      return Response.json(
        { status: "error", reason: `policy_patch_failed:${message}` },
        { status: 500 },
      );
    }
  });
}

async function applyPolicyPatch(
  principal: {
    userId: string;
    stellarAddress?: string | null;
    privyWalletId?: string | null;
  },
  data: z.infer<typeof patchSchema>,
) {
    // Contract requires max_per_call <= max_per_day. Keep Hub DB consistent.
    const existing = await prisma.policySettings.findUnique({
      where: { userId: principal.userId },
    });
    const snapshot = existing
      ? {
          microThreshold: existing.microThreshold,
          perTxCap: existing.perTxCap,
          dailyCap: existing.dailyCap,
          paused: existing.paused,
          autoYield: existing.autoYield,
          liquidThreshold: existing.liquidThreshold,
          liquidHigh: existing.liquidHigh,
          catTransfer: existing.catTransfer,
          catX402: existing.catX402,
          catMpp: existing.catMpp,
        }
      : null;

    const nextDaily =
      data.dailyCap ?? (existing ? Number(existing.dailyCap) : 20);
    const nextPerTx =
      data.perTxCap ?? (existing ? Number(existing.perTxCap) : 5);
    const nextLow =
      data.liquidThreshold ??
      (existing ? Number(existing.liquidThreshold) : 2);
    const nextHigh =
      data.liquidHigh ?? (existing ? Number(existing.liquidHigh) : 10);
    // agentId is only for resolving the on-chain signer — never a PolicySettings column.
    const { agentId: targetAgentId, ...settingsPatch } = data;
    const patchData: Record<string, unknown> = { ...settingsPatch };
    let perTxClamped = false;
    if (nextPerTx > nextDaily) {
      patchData.perTxCap = nextDaily;
      perTxClamped = true;
    }
    if (nextHigh < nextLow) {
      patchData.liquidHigh = nextLow;
    }

    const updated = await prisma.policySettings.upsert({
      where: { userId: principal.userId },
      create: { userId: principal.userId, ...patchData },
      update: patchData,
    });

    const revertDb = async () => {
      if (!snapshot) {
        await prisma.policySettings.delete({
          where: { userId: principal.userId },
        }).catch(() => undefined);
        return;
      }
      await prisma.policySettings.update({
        where: { userId: principal.userId },
        data: snapshot,
      });
    };

    const failOnchain = async (reason: string) => {
      await revertDb();
      return Response.json(
        {
          status: "error",
          reason,
          policy: snapshot
            ? {
                ...snapshot,
                microThreshold: Number(snapshot.microThreshold),
                perTxCap: Number(snapshot.perTxCap),
                dailyCap: Number(snapshot.dailyCap),
                liquidThreshold: Number(snapshot.liquidThreshold),
                liquidHigh: Number(snapshot.liquidHigh),
                catTransfer: Number(snapshot.catTransfer),
                catX402: Number(snapshot.catX402),
                catMpp: Number(snapshot.catMpp),
              }
            : null,
        },
        { status: 400 },
      );
    };

    const limitsTouched =
      data.perTxCap !== undefined ||
      data.dailyCap !== undefined ||
      perTxClamped;
    const catsTouched =
      data.catTransfer !== undefined ||
      data.catX402 !== undefined ||
      data.catMpp !== undefined;
    const treasuryTouched =
      data.liquidThreshold !== undefined ||
      data.liquidHigh !== undefined ||
      data.autoYield !== undefined;
    const onchainFieldsTouched = limitsTouched || catsTouched || treasuryTouched;

    let onchain: string = "hub_only";
    let txHash: string | null = null;

    const network =
      (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
      "testnet";

    // Prefer the selected agent's managed wallet for on-chain writes. Owner
    // Privy wallets are often empty (EOA/Privy login ≠ funded agent treasury).
    let onchainWalletId: string | null = null;
    let onchainAddress: string | null = null;
    if (targetAgentId) {
      const agent = await prisma.agent.findFirst({
        where: { id: targetAgentId, userId: principal.userId },
        select: { privyWalletId: true, stellarAddress: true },
      });
      if (!agent) {
        await revertDb();
        return Response.json(
          { status: "error", reason: "agent_not_found" },
          { status: 404 },
        );
      }
      if (!agent.stellarAddress || !agent.privyWalletId) {
        await revertDb();
        return Response.json(
          {
            status: "error",
            reason:
              "agent_wallet_not_ready: wait for provisioning, then fund the agent with a little XLM for fees",
          },
          { status: 400 },
        );
      }
      onchainWalletId = agent.privyWalletId;
      onchainAddress = agent.stellarAddress;
    } else if (
      principal.stellarAddress &&
      principal.privyWalletId &&
      principal.privyWalletId !== "dev-wallet"
    ) {
      onchainWalletId = principal.privyWalletId;
      onchainAddress = principal.stellarAddress;
    }

    if (
      onchainFieldsTouched &&
      policyContractConfigured() &&
      onchainWalletId &&
      onchainAddress
    ) {
      const maxPerDayXlm = Number(updated.dailyCap);
      const maxPerCallXlm = Math.min(Number(updated.perTxCap), maxPerDayXlm);
      const categories = {
        transfer: Number(updated.catTransfer),
        x402: Number(updated.catX402),
        mpp: Number(updated.catMpp),
      };
      const liquidLowXlm = Number(updated.liquidThreshold);
      const liquidHighXlm = Math.max(
        liquidLowXlm,
        Number(updated.liquidHigh),
      );

      const init = await ensurePolicyInitialized({
        walletId: onchainWalletId,
        stellarAddress: onchainAddress,
        network,
        maxPerCallXlm,
        maxPerDayXlm,
        categories,
        liquidLowXlm,
        liquidHighXlm,
        autoYield: updated.autoYield,
      });

      if (!init.ok) {
        console.error("[policy] initialize failed", init.error);
        return failOnchain(`onchain_initialize_failed:${init.error}`);
      }

      // Fresh initialize already wrote current limits/band — skip redundant txs.
      const freshlyInitialized = Boolean(init.hash);
      if (freshlyInitialized) {
        txHash = init.hash ?? null;
        onchain = "initialize_ok";
      }

      if (!freshlyInitialized && limitsTouched) {
        const res = await onchainSetLimits({
          walletId: onchainWalletId,
          stellarAddress: onchainAddress,
          network,
          maxPerCallXlm,
          maxPerDayXlm,
        });
        if (!res.ok) {
          console.error("[policy] set_limits failed", res.error);
          return failOnchain(`onchain_set_limits_failed:${res.error}`);
        }
        txHash = res.hash;
        onchain = "set_limits_ok";
      }

      if (!freshlyInitialized && catsTouched) {
        const res = await onchainSetCategoryLimits({
          walletId: onchainWalletId,
          stellarAddress: onchainAddress,
          network,
          categories,
        });
        if (!res.ok) {
          console.error("[policy] set_category_limits failed", res.error);
          return failOnchain(`onchain_set_category_limits_failed:${res.error}`);
        }
        txHash = res.hash;
        onchain = "set_category_limits_ok";
      }

      if (!freshlyInitialized && treasuryTouched) {
        const res = await onchainSetTreasuryBand({
          walletId: onchainWalletId,
          stellarAddress: onchainAddress,
          network,
          liquidLowXlm,
          liquidHighXlm,
          autoYield: updated.autoYield,
        });
        if (!res.ok) {
          console.error("[policy] set_treasury_band failed", res.error);
          return failOnchain(`onchain_set_treasury_band_failed:${res.error}`);
        }
        txHash = res.hash;
        onchain = "set_treasury_band_ok";
      }
    } else if (onchainFieldsTouched && !policyContractConfigured()) {
      onchain = "skipped_no_contract";
    } else if (
      onchainFieldsTouched &&
      policyContractConfigured() &&
      treasuryTouched &&
      !onchainWalletId
    ) {
      // Freighter / no custody key — Hub DB only (same as before).
      onchain = "hub_only_no_custodial_signer";
    }

    const reason = policyChangeReason(data, updated, { perTxClamped });
    const logHash =
      txHash ??
      `hub_policy_${Date.now().toString(16)}_${randomBytes(4).toString("hex")}`;
    const destination =
      txHash && policyContractConfigured()
        ? policyContractId()
        : "hub-policy";

    try {
      await prisma.transaction.create({
        data: {
          userId: principal.userId,
          agentId: targetAgentId ?? null,
          type: "policy_change",
          destination,
          amountXlm: 0,
          reason,
          txHash: logHash,
          status: "confirmed",
        },
      });
    } catch (error) {
      console.warn("[policy] transaction log skipped", error);
    }

    return Response.json({
      status: "ok",
      policy: {
        ...updated,
        microThreshold: Number(updated.microThreshold),
        perTxCap: Number(updated.perTxCap),
        dailyCap: Number(updated.dailyCap),
        liquidThreshold: Number(updated.liquidThreshold),
        liquidHigh: Number(updated.liquidHigh),
        catTransfer: Number(updated.catTransfer),
        catX402: Number(updated.catX402),
        catMpp: Number(updated.catMpp),
      },
      onchain,
      tx_hash: logHash,
    });
}

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();
  return cachedJsonResponse(`policy:${principal.userId}`, 15000, () => uncachedGET(req));
}

export async function PATCH(req: NextRequest) {
  const res = await uncachedPATCH(req);
  if (res.ok) {
    bustRouteCache("policy:");
    bustRouteCache("wl:");
    bustRouteCache("dl:");
  }
  return res;
}

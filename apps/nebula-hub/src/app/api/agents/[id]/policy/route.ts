import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadEffectiveCaps, loadTreasurySettings } from "@/lib/hub-tools/context";
import {
  ensurePolicyInitialized,
  onchainSetCategoryLimits,
  onchainSetLimits,
  policyContractConfigured,
  policyContractId,
} from "@/lib/policy-onchain";
import { bustRouteCache } from "@/lib/route-cache";

/** Per-agent spend caps. Absent row = agent inherits owner cap values. */
const putSchema = z.object({
  microThreshold: z.number().nonnegative().optional(),
  perTxCap: z.number().positive().optional(),
  dailyCap: z.number().positive().optional(),
  paused: z.boolean().optional(),
  catTransfer: z.number().nonnegative().optional(),
  catX402: z.number().nonnegative().optional(),
  catMpp: z.number().nonnegative().optional(),
});

async function ownAgentOr403(req: NextRequest, id: string) {
  const principal = await resolveAuth(req);
  if (!principal || principal.source === "nebula_token") {
    return {
      principal: null,
      response: principal
        ? Response.json(
            { status: "rejected", reason: "dashboard_auth_required" },
            { status: 403 },
          )
        : unauthorized(),
    };
  }
  const agent = await prisma.agent.findFirst({
    where: { id, userId: principal.userId },
    select: { id: true },
  });
  if (!agent) {
    return {
      principal: null,
      response: Response.json(
        { status: "error", reason: "not_found" },
        { status: 404 },
      ),
    };
  }
  return { principal, response: null as Response | null };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { principal, response } = await ownAgentOr403(req, id);
  if (!principal) return response!;

  const [row, caps] = await Promise.all([
    prisma.agentPolicy.findUnique({ where: { agentId: id } }),
    loadEffectiveCaps(principal.userId, id),
  ]);

  return Response.json({
    // Effective caps in force (agent row if set, else inherited owner values).
    policy: caps,
    // Whether this agent has its own caps or is inheriting the owner's.
    custom: Boolean(row),
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { principal, response } = await ownAgentOr403(req, id);
  if (!principal) return response!;

  const body = putSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { status: "error", reason: body.error.message },
      { status: 400 },
    );
  }

  // Seed unset fields from the currently-effective caps so first-time PUT
  // writes a complete, self-consistent row.
  const current = await loadEffectiveCaps(principal.userId, id);
  const merged = {
    microThreshold: body.data.microThreshold ?? current.microThreshold,
    perTxCap: body.data.perTxCap ?? current.perTxCap,
    dailyCap: body.data.dailyCap ?? current.dailyCap,
    paused: body.data.paused ?? current.paused,
    catTransfer: body.data.catTransfer ?? current.catTransfer,
    catX402: body.data.catX402 ?? current.catX402,
    catMpp: body.data.catMpp ?? current.catMpp,
  };
  // Contract invariant: per-call cap never exceeds the daily cap.
  const perTxClamped = merged.perTxCap > merged.dailyCap;
  if (perTxClamped) {
    merged.perTxCap = merged.dailyCap;
  }

  const updated = await prisma.agentPolicy.upsert({
    where: { agentId: id },
    create: { agentId: id, ...merged },
    update: merged,
  });

  // Mirror the change onto the agent's own on-chain policy slot (the same slot
  // check_spend reads at spend time), so limits are enforced by the contract —
  // not just the Hub DB. Keyed to the AGENT's wallet, signed by its Privy key.
  const agent = await prisma.agent.findFirst({
    where: { id, userId: principal.userId },
    select: { privyWalletId: true, stellarAddress: true },
  });

  const limitsTouched =
    body.data.perTxCap !== undefined ||
    body.data.dailyCap !== undefined ||
    perTxClamped;
  const catsTouched =
    body.data.catTransfer !== undefined ||
    body.data.catX402 !== undefined ||
    body.data.catMpp !== undefined;

  const network =
    (process.env.STELLAR_NETWORK as "testnet" | "mainnet" | undefined) ??
    "testnet";

  let txHash: string | null = null;
  let onchain = "hub_only";

  if (
    (limitsTouched || catsTouched) &&
    policyContractConfigured() &&
    agent?.stellarAddress &&
    agent.privyWalletId &&
    agent.privyWalletId !== "dev-wallet"
  ) {
    const maxPerDayXlm = merged.dailyCap;
    const maxPerCallXlm = Math.min(merged.perTxCap, maxPerDayXlm);
    const categories = {
      transfer: merged.catTransfer,
      x402: merged.catX402,
      mpp: merged.catMpp,
    };
    const t = await loadTreasurySettings(principal.userId);
    const liquidLowXlm = Number(t.liquidThreshold);
    const liquidHighXlm = Math.max(liquidLowXlm, Number(t.liquidHigh));

    const init = await ensurePolicyInitialized({
      walletId: agent.privyWalletId,
      stellarAddress: agent.stellarAddress,
      network,
      maxPerCallXlm,
      maxPerDayXlm,
      categories,
      liquidLowXlm,
      liquidHighXlm,
      autoYield: t.autoYield,
    });
    if (!init.ok) {
      return Response.json(
        { status: "error", reason: `onchain_initialize_failed:${init.error}` },
        { status: 400 },
      );
    }

    // A fresh initialize already writes the current limits + categories, so we
    // only issue extra txs when the slot already existed.
    const freshlyInitialized = Boolean(init.hash);
    if (freshlyInitialized) {
      txHash = init.hash ?? null;
      onchain = "initialize_ok";
    }
    if (!freshlyInitialized && limitsTouched) {
      const res = await onchainSetLimits({
        walletId: agent.privyWalletId,
        stellarAddress: agent.stellarAddress,
        network,
        maxPerCallXlm,
        maxPerDayXlm,
      });
      if (!res.ok) {
        return Response.json(
          { status: "error", reason: `onchain_set_limits_failed:${res.error}` },
          { status: 400 },
        );
      }
      txHash = res.hash;
      onchain = "set_limits_ok";
    }
    if (!freshlyInitialized && catsTouched) {
      const res = await onchainSetCategoryLimits({
        walletId: agent.privyWalletId,
        stellarAddress: agent.stellarAddress,
        network,
        categories,
      });
      if (!res.ok) {
        return Response.json(
          {
            status: "error",
            reason: `onchain_set_category_limits_failed:${res.error}`,
          },
          { status: 400 },
        );
      }
      txHash = res.hash;
      onchain = "set_category_limits_ok";
    }
  } else if ((limitsTouched || catsTouched) && !policyContractConfigured()) {
    onchain = "skipped_no_contract";
  }

  // Ledger entry so policy changes show up in the agent's transactions.
  if (limitsTouched || catsTouched) {
    const logHash =
      txHash ??
      `hub_policy_${Date.now().toString(16)}_${randomBytes(4).toString("hex")}`;
    try {
      await prisma.transaction.create({
        data: {
          userId: principal.userId,
          agentId: id,
          type: "policy_change",
          destination:
            txHash && policyContractConfigured() ? policyContractId() : "hub-policy",
          amountXlm: 0,
          reason: "user_requested; agent_policy_update",
          txHash: logHash,
          status: "confirmed",
        },
      });
    } catch (error) {
      console.warn("[agent-policy] transaction log skipped", error);
    }
  }

  bustRouteCache("agents:");

  return Response.json({
    status: "ok",
    onchain,
    tx_hash: txHash,
    policy: {
      microThreshold: Number(updated.microThreshold),
      perTxCap: Number(updated.perTxCap),
      dailyCap: Number(updated.dailyCap),
      paused: updated.paused,
      catTransfer: Number(updated.catTransfer),
      catX402: Number(updated.catX402),
      catMpp: Number(updated.catMpp),
    },
    custom: true,
  });
}

import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadEffectiveCaps, loadOnchainPolicyInit } from "@/lib/hub-tools/context";
import {
  ensurePolicyInitialized,
  onchainSetCategoryLimits,
  onchainSetLimits,
  onchainSetPaused,
  policyContractConfigured,
  policyContractId,
} from "@/lib/policy/onchain";
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
      principal: null as null,
      agent: null as null,
      response: principal
        ? Response.json(
            { status: "rejected", reason: "dashboard_auth_required" },
            { status: 403 },
          )
        : unauthorized(),
    };
  }
  const agent = await prisma.agent.findFirst({
    where: { id, userId: principal.userId, network: principal.network },
    select: { id: true, privyWalletId: true, stellarAddress: true },
  });
  if (!agent) {
    return {
      principal: null,
      agent: null,
      response: Response.json(
        { status: "error", reason: "not_found" },
        { status: 404 },
      ),
    };
  }
  return { principal, agent, response: null as Response | null };
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
    loadEffectiveCaps(principal.userId, principal.network, id),
  ]);

  return Response.json({
    policy: caps,
    custom: Boolean(row),
  });
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const { principal, agent, response } = await ownAgentOr403(req, id);
  if (!principal || !agent) return response!;

  const body = putSchema.safeParse(await req.json());
  if (!body.success) {
    return Response.json(
      { status: "error", reason: body.error.message },
      { status: 400 },
    );
  }

  const current = await loadEffectiveCaps(
    principal.userId,
    principal.network,
    id,
  );
  const merged = {
    microThreshold: body.data.microThreshold ?? current.microThreshold,
    perTxCap: body.data.perTxCap ?? current.perTxCap,
    dailyCap: body.data.dailyCap ?? current.dailyCap,
    paused: body.data.paused ?? current.paused,
    catTransfer: body.data.catTransfer ?? current.catTransfer,
    catX402: body.data.catX402 ?? current.catX402,
    catMpp: body.data.catMpp ?? current.catMpp,
  };
  const perTxClamped = merged.perTxCap > merged.dailyCap;
  if (perTxClamped) merged.perTxCap = merged.dailyCap;

  const updated = await prisma.agentPolicy.upsert({
    where: { agentId: id },
    create: { agentId: id, ...merged },
    update: merged,
  });

  const limitsTouched =
    body.data.perTxCap !== undefined ||
    body.data.dailyCap !== undefined ||
    perTxClamped;
  const catsTouched =
    body.data.catTransfer !== undefined ||
    body.data.catX402 !== undefined ||
    body.data.catMpp !== undefined;
  const pauseTouched = body.data.paused !== undefined;
  const touched = limitsTouched || catsTouched || pauseTouched;

  const network = principal.network;

  let txHash: string | null = null;
  let onchain = "hub_only";

  const custodial =
    agent.stellarAddress &&
    agent.privyWalletId &&
    agent.privyWalletId !== "dev-wallet";

  if (touched && policyContractConfigured(principal.network) && custodial) {
    const initPayload = await loadOnchainPolicyInit(
      principal.userId,
      principal.network,
      id,
    );
    const wallet = {
      walletId: agent.privyWalletId!,
      stellarAddress: agent.stellarAddress!,
      network,
    };
    const init = await ensurePolicyInitialized({
      ...wallet,
      maxPerCallXlm: Math.min(merged.perTxCap, merged.dailyCap),
      maxPerDayXlm: merged.dailyCap,
      categories: {
        transfer: merged.catTransfer,
        x402: merged.catX402,
        mpp: merged.catMpp,
      },
      liquidLowXlm: initPayload.liquidLowXlm,
      liquidHighXlm: Math.max(
        initPayload.liquidLowXlm,
        initPayload.liquidHighXlm,
      ),
      autoYield: initPayload.autoYield,
    });
    if (!init.ok) {
      return Response.json(
        { status: "error", reason: `onchain_initialize_failed:${init.error}` },
        { status: 400 },
      );
    }

    const fresh = Boolean(init.hash);
    if (fresh) {
      txHash = init.hash ?? null;
      onchain = "initialize_ok";
    }
    if (!fresh && limitsTouched) {
      const res = await onchainSetLimits({
        ...wallet,
        maxPerCallXlm: Math.min(merged.perTxCap, merged.dailyCap),
        maxPerDayXlm: merged.dailyCap,
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
    if (!fresh && catsTouched) {
      const res = await onchainSetCategoryLimits({
        ...wallet,
        categories: {
          transfer: merged.catTransfer,
          x402: merged.catX402,
          mpp: merged.catMpp,
        },
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

    // Initialize leaves paused=false; always sync when pause field is written.
    if (pauseTouched) {
      const res = await onchainSetPaused({
        ...wallet,
        paused: merged.paused,
      });
      if (!res.ok) {
        return Response.json(
          { status: "error", reason: `onchain_set_paused_failed:${res.error}` },
          { status: 400 },
        );
      }
      txHash = res.hash;
      onchain = "set_paused_ok";
    }
  } else if (touched && !policyContractConfigured(principal.network)) {
    onchain = "skipped_no_contract";
  }

  if (touched) {
    const logHash =
      txHash ??
      `hub_policy_${Date.now().toString(16)}_${randomBytes(4).toString("hex")}`;
    try {
      await prisma.transaction.create({
        data: {
          userId: principal.userId,
          agentId: id,
          network: principal.network,
          type: "policy_change",
          destination:
            txHash && policyContractConfigured(principal.network)
              ? policyContractId(principal.network)
              : "hub-policy",
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

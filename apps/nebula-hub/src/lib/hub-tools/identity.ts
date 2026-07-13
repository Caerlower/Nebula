import type { ToolResult } from "@nebula/core";

import type { AuthPrincipal } from "../auth";
import { privyConfigured } from "../auth";
import {
  formatRegisterIdentityResult,
  registerAgentIdentity,
} from "../8004/identity";
import {
  formatMyReputation,
  getMyReputation,
  hubScoreFrom8004,
} from "../8004/reputation";
import { prisma } from "../db";
import { buildToolContext } from "./context";

export async function resolve8004Wallet(
  principal: AuthPrincipal,
): Promise<
  | {
      ok: true;
      wallet: {
        publicKey: string;
        walletId: string;
        network: "testnet" | "mainnet";
        cachedAgentId: number | null;
      };
    }
  | { ok: false; result: ToolResult }
> {
  const ctx = buildToolContext(principal);
  if (!ctx) {
    return {
      ok: false,
      result: {
        status: "error",
        reason:
          "wallet_not_ready: Connect a Stellar wallet in the Hub before registering Stellar8004 identity.",
      },
    };
  }
  if (!privyConfigured() || ctx.privyWalletId === "dev-wallet") {
    return {
      ok: false,
      result: {
        status: "error",
        reason:
          "privy_required: Stellar8004 registration requires a Privy-backed Hub wallet (on-chain signing).",
      },
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: principal.userId },
    select: { stellar8004AgentId: true },
  });
  return {
    ok: true,
    wallet: {
      publicKey: ctx.stellarAddress,
      walletId: ctx.privyWalletId,
      network: ctx.network,
      cachedAgentId: user?.stellar8004AgentId ?? null,
    },
  };
}

export async function mirrorReputationToDb(params: {
  userId: string;
  agentId: string | null;
  stellar8004AgentId: number;
  score: number;
  tier: string;
}): Promise<void> {
  await prisma.user.update({
    where: { id: params.userId },
    data: {
      stellar8004AgentId: params.stellar8004AgentId,
      reputationScore: params.score,
      reputationTier: params.tier,
    },
  });
  if (params.agentId) {
    await prisma.agent.updateMany({
      where: { id: params.agentId, userId: params.userId },
      data: {
        reputationScore: params.score,
        reputationTier: params.tier,
      },
    });
  } else {
    // Keep all agents on this wallet in sync with the shared on-chain identity.
    await prisma.agent.updateMany({
      where: { userId: params.userId },
      data: {
        reputationScore: params.score,
        reputationTier: params.tier,
      },
    });
  }
}

export async function executeRegisterIdentity(
  principal: AuthPrincipal,
): Promise<ToolResult> {
  const resolved = await resolve8004Wallet(principal);
  if (!resolved.ok) return resolved.result;

  let hints: { name?: string; description?: string } | undefined;
  if (principal.agentId) {
    const agent = await prisma.agent.findUnique({
      where: { id: principal.agentId },
    });
    if (!agent || agent.userId !== principal.userId) {
      return { status: "error", reason: "agent_not_found" };
    }
    hints = {
      name: agent.name,
      description: `Nebula Hub agent "${agent.name}" (${resolved.wallet.publicKey.slice(0, 8)}…).`,
    };
  }

  const result = await registerAgentIdentity(resolved.wallet, hints);
  if (!result.ok) {
    return {
      status: "error",
      reason: `register_identity_failed: ${result.error}`,
    };
  }

  // Fresh registration has identity only; already-registered wallets may have feedback.
  let score = 0;
  let confidence = "unrated";
  let mirroredFromLive = false;

  if (result.alreadyRegistered) {
    const rep = await getMyReputation(resolved.wallet);
    if (rep.ok) {
      const mapped = hubScoreFrom8004({
        registered: true,
        averageScore: rep.averageScore,
        feedbackCount: rep.feedbackCount,
      });
      score = mapped.score;
      confidence = mapped.confidence;
      mirroredFromLive = true;
    } else {
      // Keep existing Hub mirror — do not wipe a good score on a transient read failure.
      const user = await prisma.user.findUnique({
        where: { id: principal.userId },
        select: { reputationScore: true, reputationTier: true },
      });
      score = user?.reputationScore ?? 0;
      confidence = user?.reputationTier || "unrated";
    }
  } else {
    const mapped = hubScoreFrom8004({
      registered: true,
      averageScore: null,
      feedbackCount: 0,
    });
    score = mapped.score;
    confidence = mapped.confidence;
    mirroredFromLive = true;
  }

  if (mirroredFromLive || !result.alreadyRegistered) {
    await mirrorReputationToDb({
      userId: principal.userId,
      agentId: principal.agentId,
      stellar8004AgentId: result.agentId,
      score,
      tier: confidence,
    });
  } else {
    // Still persist agent id if missing, without clobbering score.
    await prisma.user.update({
      where: { id: principal.userId },
      data: { stellar8004AgentId: result.agentId },
    });
  }

  return {
    status: "ok",
    tx_hash: result.txHash ?? undefined,
    explorer_url: result.explorerUrl,
    data: {
      stellar8004_agent_id: result.agentId,
      owner: result.owner,
      average_score: score,
      confidence,
      scale: 100,
      already_registered: result.alreadyRegistered,
      lookup_source: result.lookupSource,
      explorer_url: result.explorerUrl,
      hub_agent_id: principal.agentId,
    },
    message: [
      formatRegisterIdentityResult(result, resolved.wallet.network),
      "",
      `Average score: ${score} / 100 (confidence: ${confidence})`,
      ...(score === 0
        ? ["Score stays 0 until counterparties leave on-chain feedback."]
        : []),
    ].join("\n"),
  };
}

export async function executeGetMyReputation(
  principal: AuthPrincipal,
): Promise<ToolResult> {
  const resolved = await resolve8004Wallet(principal);
  if (!resolved.ok) return resolved.result;

  const result = await getMyReputation(resolved.wallet);
  if (!result.ok) {
    if (result.notRegistered) {
      return {
        status: "error",
        reason: `not_registered: ${result.error}`,
      };
    }
    return {
      status: "error",
      reason: `reputation_read_failed: ${result.error}`,
    };
  }

  const mapped = hubScoreFrom8004({
    registered: true,
    averageScore: result.averageScore,
    feedbackCount: result.feedbackCount,
  });

  await mirrorReputationToDb({
    userId: principal.userId,
    agentId: principal.agentId,
    stellar8004AgentId: result.agentId,
    score: mapped.score,
    tier: mapped.confidence,
  });

  return {
    status: "ok",
    explorer_url: result.explorerUrl,
    data: {
      stellar8004_agent_id: result.agentId,
      owner: result.owner,
      average_score: mapped.score,
      confidence: mapped.confidence,
      scale: 100,
      feedback_count: result.feedbackCount,
      total_score: result.totalScore,
      unique_clients: result.uniqueClients,
      source: result.source,
      explorer_url: result.explorerUrl,
      hub_agent_id: principal.agentId,
    },
    message: formatMyReputation(
      result,
      resolved.wallet.network,
      mapped.score,
      mapped.confidence,
    ),
  };
}

import { NextRequest } from "next/server";

import { cachedJsonResponse } from "@/lib/route-cache";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { hubNetwork } from "@/lib/8004/config";
import { getMyReputation, hubScoreFrom8004 } from "@/lib/8004/reputation";
import { prisma } from "@/lib/db";
import { privyConfigured } from "@/lib/auth";

async function uncachedGET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: principal.userId },
  });
  if (!user) return unauthorized();

  const agent =
    principal.agentId != null
      ? await prisma.agent.findUnique({ where: { id: principal.agentId } })
      : null;

  if (
    user.stellarAddress &&
    user.privyWalletId &&
    privyConfigured() &&
    user.privyWalletId !== "dev-wallet"
  ) {
    const live = await getMyReputation({
      publicKey: user.stellarAddress,
      walletId: user.privyWalletId,
      network: hubNetwork(),
      cachedAgentId: user.stellar8004AgentId,
    });

    if (live.ok) {
      const mapped = hubScoreFrom8004({
        registered: true,
        averageScore: live.averageScore,
        feedbackCount: live.feedbackCount,
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          stellar8004AgentId: live.agentId,
          reputationScore: mapped.score,
          reputationTier: mapped.confidence,
        },
      });
      await prisma.agent.updateMany({
        where: { userId: user.id },
        data: {
          reputationScore: mapped.score,
          reputationTier: mapped.confidence,
        },
      });

      return Response.json({
        score: mapped.score,
        scale: 100,
        confidence: mapped.confidence,
        tier: mapped.confidence,
        registered: true,
        stellar8004AgentId: live.agentId,
        feedbackCount: live.feedbackCount,
        averageScore: live.averageScore,
        totalScore: live.totalScore,
        uniqueClients: live.uniqueClients,
        source: live.source,
        explorerUrl: live.explorerUrl,
        agentId: agent?.id,
        agentName: agent?.name,
        note: "Stellar8004 avgScore is 0–100 from on-chain feedback (not a Hub-invented 1000 scale).",
      });
    }

    if (live.notRegistered) {
      return Response.json({
        score: 0,
        scale: 100,
        confidence: "unrated",
        tier: "unrated",
        registered: false,
        stellar8004AgentId: user.stellar8004AgentId,
        feedbackCount: 0,
        averageScore: null,
        totalScore: null,
        uniqueClients: 0,
        agentId: agent?.id,
        agentName: agent?.name,
        note: "No on-chain Stellar8004 identity yet. Call register_identity from MCP.",
      });
    }
  }

  // Prefer wallet-level mirror (source of truth); agent row may lag.
  const score = user.reputationScore;
  const confidence = user.reputationTier;
  const registered = user.stellar8004AgentId != null;

  return Response.json({
    score: registered ? score : 0,
    scale: 100,
    confidence,
    tier: confidence,
    registered,
    stellar8004AgentId: user.stellar8004AgentId,
    feedbackCount: null,
    averageScore: registered ? score : null,
    totalScore: null,
    uniqueClients: null,
    agentId: agent?.id,
    agentName: agent?.name,
    note: registered
      ? "Cached Stellar8004 mirror (live read unavailable — may be stale)."
      : "Call register_identity to mint on-chain Stellar8004 identity.",
    stale: registered,
  });
}

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();
  return cachedJsonResponse(`rep:${principal.userId}`, 60000, () => uncachedGET(req));
}

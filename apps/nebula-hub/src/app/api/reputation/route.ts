import { NextRequest } from "next/server";

import { cachedJsonResponse } from "@/lib/route-cache";

import { resolveAuth, unauthorized } from "@/lib/auth";
import { hubNetwork } from "@/lib/8004/config";
import { getMyReputation, hubScoreFrom8004 } from "@/lib/8004/reputation";
import { prisma } from "@/lib/db";
import { privyConfigured } from "@/lib/auth";
import { privySigner } from "@/lib/signing";

/**
 * Reputation is per-agent: each agent has its OWN wallet and its OWN Stellar8004
 * identity. Pass `?agentId=<id>` (dashboard) to read that agent's reputation;
 * agent-bound tokens (MCP) resolve their own agent automatically. The owner /
 * login wallet is auth-only and is never used as a reputation source.
 */
async function uncachedGET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();

  const agentIdParam = new URL(req.url).searchParams.get("agentId");
  const targetAgentId = agentIdParam ?? principal.agentId ?? null;

  const agent = targetAgentId
    ? await prisma.agent.findFirst({
        where: { id: targetAgentId, userId: principal.userId },
      })
    : null;

  if (targetAgentId && !agent) {
    return Response.json(
      { status: "error", reason: "not_found" },
      { status: 404 },
    );
  }

  // Dashboard sessions must scope to an agent — never fall back to the owner.
  if (!agent) {
    return Response.json({
      score: 0,
      scale: 100,
      confidence: "unrated",
      tier: "unrated",
      registered: false,
      stellar8004AgentId: null,
      feedbackCount: 0,
      averageScore: null,
      totalScore: null,
      uniqueClients: 0,
      note: "select_or_create_agent",
    });
  }

  const canReadLive =
    Boolean(agent.stellarAddress) &&
    Boolean(agent.privyWalletId) &&
    privyConfigured() &&
    agent.privyWalletId !== "dev-wallet";

  if (canReadLive) {
    const live = await getMyReputation({
      publicKey: agent.stellarAddress!,
      signer: privySigner(agent.privyWalletId!, agent.stellarAddress!),
      network: hubNetwork(),
      cachedAgentId: agent.stellar8004AgentId,
    });

    if (live.ok) {
      const mapped = hubScoreFrom8004({
        registered: true,
        averageScore: live.averageScore,
        feedbackCount: live.feedbackCount,
      });

      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          stellar8004AgentId: live.agentId,
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
        agentId: agent.id,
        agentName: agent.name,
        note: "Stellar8004 avgScore is 0–100 from on-chain feedback (per-agent identity).",
      });
    }

    if (live.notRegistered) {
      return Response.json({
        score: 0,
        scale: 100,
        confidence: "unrated",
        tier: "unrated",
        registered: false,
        stellar8004AgentId: agent.stellar8004AgentId,
        feedbackCount: 0,
        averageScore: null,
        totalScore: null,
        uniqueClients: 0,
        agentId: agent.id,
        agentName: agent.name,
        note: "No on-chain Stellar8004 identity yet for this agent. Call register_identity from this agent's MCP.",
      });
    }
  }

  // Cached mirror on the agent row (live read unavailable / non-custodial agent).
  const registered = agent.stellar8004AgentId != null;
  return Response.json({
    score: registered ? agent.reputationScore : 0,
    scale: 100,
    confidence: agent.reputationTier,
    tier: agent.reputationTier,
    registered,
    stellar8004AgentId: agent.stellar8004AgentId,
    feedbackCount: null,
    averageScore: registered ? agent.reputationScore : null,
    totalScore: null,
    uniqueClients: null,
    agentId: agent.id,
    agentName: agent.name,
    note: registered
      ? "Cached Stellar8004 mirror for this agent (live read unavailable — may be stale)."
      : "Call register_identity from this agent's MCP to mint its on-chain identity.",
    stale: registered,
  });
}

export async function GET(req: NextRequest) {
  const principal = await resolveAuth(req);
  if (!principal) return unauthorized();
  const agentId = new URL(req.url).searchParams.get("agentId") ?? principal.agentId ?? "owner";
  return cachedJsonResponse(`rep:${principal.userId}:${agentId}`, 60000, () =>
    uncachedGET(req),
  );
}

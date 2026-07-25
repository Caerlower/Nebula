import {
  ExplorerClient,
  NotFoundError,
  formatSorobanError,
} from "@trionlabs/stellar8004";

import { create8004Clients, type Privy8004Wallet } from "./wallet";
import {
  get8004ExplorerUrl,
  stellar8004WebAgentUrl,
  stellarExpertAccountUrl,
} from "./config";
import { lookupAgentByOwner } from "./identity";
import {
  isExplorerUnavailableError,
  readOnChainReputationSummary,
} from "./onchain";

/**
 * Stellar8004 / ERC-8004 reputation is a 0–100 average of on-chain feedback
 * (`avgScore`), plus feedbackCount / uniqueClients / totalScore.
 *
 * Hub does not invent a 0–1000 scale or payment/volume/longevity sub-scores.
 */

export type ReputationConfidence = "unrated" | "low" | "medium" | "high";

/** Explorer-style confidence from interaction count (ERC-8004 explorer v1). */
export function confidenceFromFeedbackCount(
  feedbackCount: number,
): ReputationConfidence {
  if (feedbackCount <= 0) return "unrated";
  if (feedbackCount < 5) return "low";
  if (feedbackCount < 50) return "medium";
  return "high";
}

export function hubScoreFrom8004(params: {
  registered: boolean;
  averageScore: number | null;
  feedbackCount: number;
}): { score: number; confidence: ReputationConfidence; scale: 100 } {
  if (!params.registered) {
    return { score: 0, confidence: "unrated", scale: 100 };
  }

  const confidence = confidenceFromFeedbackCount(params.feedbackCount);

  if (params.feedbackCount <= 0 || params.averageScore == null) {
    return { score: 0, confidence: "unrated", scale: 100 };
  }

  const raw = Number(params.averageScore);
  // Feedback values are normalized to 0–100 (value / 10**decimals).
  const score = Math.min(100, Math.max(0, Math.round(raw)));
  return { score, confidence, scale: 100 };
}

/** @deprecated use confidence; kept for DB column name compatibility */
export function tierFromConfidence(confidence: ReputationConfidence): string {
  return confidence;
}

export type MyReputationResult =
  | {
      ok: true;
      agentId: number;
      owner: string;
      feedbackCount: number;
      averageScore: number | null;
      totalScore: number | null;
      uniqueClients: number;
      explorerUrl: string;
      source: "explorer" | "onchain";
      explorerUnavailable?: boolean;
    }
  | { ok: false; notRegistered: true; error: string }
  | { ok: false; notRegistered: false; error: string };

function explorerClient(): ExplorerClient {
  return new ExplorerClient(get8004ExplorerUrl());
}

async function getReputationFromExplorer(agentId: number) {
  const detail = await explorerClient().getAgent(agentId);
  const agent = detail.data;

  return {
    feedbackCount: agent.feedbackCount ?? agent.scores?.feedbackCount ?? 0,
    averageScore: agent.avgScore ?? agent.scores?.average ?? null,
    totalScore: agent.totalScore ?? agent.scores?.total ?? null,
    uniqueClients: agent.uniqueClients ?? agent.scores?.uniqueClients ?? 0,
    owner: agent.owner,
  };
}

export async function getMyReputation(
  wallet: Privy8004Wallet,
): Promise<MyReputationResult> {
  const lookup = await lookupAgentByOwner(wallet);

  if (!lookup.ok) {
    if (lookup.notRegistered) {
      return {
        ok: false,
        notRegistered: true,
        error:
          "No 8004 identity found for this wallet. Call register_identity first.",
      };
    }

    return { ok: false, notRegistered: false, error: lookup.error };
  }

  const explorerUrl = stellar8004WebAgentUrl(lookup.agentId);

  if (lookup.source === "onchain") {
    const clients = create8004Clients(wallet);
    const onChain = await readOnChainReputationSummary(
      clients,
      lookup.agentId,
    );

    if (!onChain.ok) {
      return { ok: false, notRegistered: false, error: onChain.error };
    }

    return {
      ok: true,
      agentId: lookup.agentId,
      owner: lookup.owner,
      feedbackCount: onChain.summary.feedbackCount,
      averageScore: onChain.summary.averageScore,
      totalScore: null,
      uniqueClients: onChain.summary.uniqueClients,
      explorerUrl,
      source: "onchain",
      explorerUnavailable: true,
    };
  }

  try {
    const explorer = await getReputationFromExplorer(lookup.agentId);

    return {
      ok: true,
      agentId: lookup.agentId,
      owner: explorer.owner ?? lookup.owner,
      feedbackCount: explorer.feedbackCount,
      averageScore: explorer.averageScore,
      totalScore: explorer.totalScore,
      uniqueClients: explorer.uniqueClients,
      explorerUrl,
      source: "explorer",
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return {
        ok: false,
        notRegistered: true,
        error:
          "No 8004 identity found for this wallet. Call register_identity first.",
      };
    }

    if (isExplorerUnavailableError(error)) {
      const clients = create8004Clients(wallet);
      const onChain = await readOnChainReputationSummary(
        clients,
        lookup.agentId,
      );

      if (!onChain.ok) {
        return { ok: false, notRegistered: false, error: onChain.error };
      }

      return {
        ok: true,
        agentId: lookup.agentId,
        owner: lookup.owner,
        feedbackCount: onChain.summary.feedbackCount,
        averageScore: onChain.summary.averageScore,
        totalScore: null,
        uniqueClients: onChain.summary.uniqueClients,
        explorerUrl,
        source: "onchain",
        explorerUnavailable: true,
      };
    }

    return {
      ok: false,
      notRegistered: false,
      error: formatSorobanError(error),
    };
  }
}

export function formatMyReputation(
  result: Extract<MyReputationResult, { ok: true }>,
  network: Privy8004Wallet["network"],
  averageScore: number,
  confidence: string,
): string {
  const lines = [
    `Network: ${network}`,
    `Stellar8004 agent ID: ${result.agentId}`,
    `Owner: ${result.owner}`,
    `Average score: ${averageScore} / 100`,
    `Confidence: ${confidence}`,
    `Feedback count: ${result.feedbackCount}`,
    `Total score: ${result.totalScore ?? "n/a"}`,
    `Unique clients: ${result.uniqueClients}`,
    `Data source: ${result.source}`,
    "",
    `StellarExpert: ${stellarExpertAccountUrl(network, result.owner)}`,
    `Stellar8004: ${result.explorerUrl}`,
  ];

  if (result.explorerUnavailable) {
    lines.push(
      "",
      "Note: Stellar8004 explorer API is currently unavailable; data was read on-chain.",
    );
  }

  return lines.join("\n");
}

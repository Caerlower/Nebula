import {
  ExplorerClient,
  NotFoundError,
  formatSorobanError,
} from "@trionlabs/stellar8004";

import type { Keypair } from "@stellar/stellar-sdk";

import type { NetworkConfig } from "../config.js";
import { get8004ExplorerUrl } from "./config.js";
import { lookupAgentByOwner } from "./identity.js";
import {
  isExplorerUnavailableError,
  readOnChainReputationSummary,
} from "./onchain.js";
import { create8004Clients } from "./client.js";

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
  keypair: Keypair,
  network: NetworkConfig,
): Promise<MyReputationResult> {
  const publicKey = keypair.publicKey();
  const lookup = await lookupAgentByOwner(keypair, network, publicKey);

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

  const explorerUrl = `${get8004ExplorerUrl()}/agents/${lookup.agentId}`;

  if (lookup.source === "onchain") {
    const clients = create8004Clients(keypair, network);
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
      const clients = create8004Clients(keypair, network);
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
): string {
  const lines = [
    `Agent ID: ${result.agentId}`,
    `Owner: ${result.owner}`,
    `Feedback count: ${result.feedbackCount}`,
    `Average score: ${result.averageScore ?? "n/a"}`,
    `Total score: ${result.totalScore ?? "n/a"}`,
    `Unique clients: ${result.uniqueClients}`,
    `Data source: ${result.source}`,
  ];

  if (result.explorerUnavailable) {
    lines.push(
      "Note: Stellar8004 explorer API is currently unavailable; data was read on-chain.",
    );
  }

  return lines.join("\n");
}

import type { ClientSet } from "@trionlabs/stellar8004";
import { formatSorobanError } from "@trionlabs/stellar8004";

export type OnChainAgentLookup =
  | { ok: true; agentId: number }
  | { ok: false; notRegistered: true }
  | { ok: false; notRegistered: false; error: string };

export async function findAgentIdOnChain(
  clients: Pick<ClientSet, "identity">,
  publicKey: string,
  cachedAgentId?: number | null,
): Promise<OnChainAgentLookup> {
  try {
    if (
      cachedAgentId != null &&
      Number.isFinite(cachedAgentId) &&
      cachedAgentId > 0
    ) {
      const ownerTx = await clients.identity.find_owner({
        agent_id: cachedAgentId,
      });
      await ownerTx.simulate();
      if (ownerTx.result === publicKey) {
        return { ok: true, agentId: cachedAgentId };
      }
    }

    const balanceTx = await clients.identity.balance({ account: publicKey });
    await balanceTx.simulate();
    const balance = Number(balanceTx.result ?? 0);

    if (!Number.isFinite(balance) || balance <= 0) {
      return { ok: false, notRegistered: true };
    }

    const totalTx = await clients.identity.total_agents();
    await totalTx.simulate();
    const total = Number(totalTx.result ?? 0);

    for (let agentId = total; agentId >= 1; agentId -= 1) {
      const ownerTx = await clients.identity.find_owner({ agent_id: agentId });
      await ownerTx.simulate();
      const owner = ownerTx.result;

      if (owner === publicKey) {
        return { ok: true, agentId };
      }
    }

    return {
      ok: false,
      notRegistered: false,
      error:
        "Wallet owns 8004 identity tokens but agent ID could not be resolved on-chain.",
    };
  } catch (error) {
    return {
      ok: false,
      notRegistered: false,
      error: formatSorobanError(error),
    };
  }
}

export type OnChainReputationSummary = {
  feedbackCount: number;
  averageScore: number | null;
  uniqueClients: number;
};

export async function readOnChainReputationSummary(
  clients: Pick<ClientSet, "reputation">,
  agentId: number,
): Promise<
  | { ok: true; summary: OnChainReputationSummary }
  | { ok: false; error: string }
> {
  try {
    const clientsTx = await clients.reputation.get_clients_paginated({
      agent_id: agentId,
      start: 0,
      limit: 200,
    });
    await clientsTx.simulate();
    const clientAddresses = clientsTx.result ?? [];
    const uniqueClients = clientAddresses.length;

    if (uniqueClients === 0) {
      return {
        ok: true,
        summary: {
          feedbackCount: 0,
          averageScore: null,
          uniqueClients: 0,
        },
      };
    }

    const summaryTx = await clients.reputation.get_summary({
      agent_id: agentId,
      client_addresses: clientAddresses,
      tag1: "",
      tag2: "",
    });
    await summaryTx.simulate();
    const summary = summaryTx.result;

    if (
      !summary ||
      typeof summary !== "object" ||
      !("count" in summary) ||
      !("summary_value" in summary) ||
      !("summary_value_decimals" in summary)
    ) {
      return {
        ok: true,
        summary: {
          feedbackCount: 0,
          averageScore: null,
          uniqueClients,
        },
      };
    }

    const summaryRecord = summary as {
      count: bigint | number;
      summary_value: bigint | number;
      summary_value_decimals: number;
    };

    const decimals = Number(summaryRecord.summary_value_decimals);
    const summaryValue = Number(summaryRecord.summary_value) / 10 ** decimals;
    const feedbackCount = Number(summaryRecord.count);

    return {
      ok: true,
      summary: {
        feedbackCount,
        averageScore: feedbackCount > 0 ? summaryValue : null,
        uniqueClients,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: formatSorobanError(error),
    };
  }
}

export function isExplorerUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const status = (error as { status?: number }).status;
  if (typeof status === "number" && status >= 500) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /server error|invalidworkercreation|worker boot error/i.test(message);
}

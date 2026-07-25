import type { Agent, ApiKey, Framework } from "@/types/domain";

import { getSelectedAgentId } from "@/stores/agent";

import {
  FRAMEWORK_TO_API,
  hubJson,
  loadAllTxs,
  mapAgent,
  mapTxStatus,
  startOfToday,
  type HubAgent,
  type HubToken,
} from "./client";

/* ------------------------------- agents ------------------------------- */

export async function getAgents(): Promise<Agent[]> {
  const [{ agents }, txs] = await Promise.all([
    hubJson<{ agents: HubAgent[] }>("/api/agents"),
    loadAllTxs(100),
  ]);
  const today = startOfToday().getTime();
  return (agents ?? []).map((a) => {
    const txToday = txs.filter(
      (t) =>
        t.agentId === a.id &&
        mapTxStatus(t.status) === "confirmed" &&
        new Date(t.createdAt).getTime() >= today,
    ).length;
    return mapAgent(a, txToday);
  });
}

export interface CreateAgentInput {
  name: string;
  framework: Framework;
  description?: string;
  /** Avatar hue (0–359) as string; omitted = deterministic from name. */
  avatarColor?: string;
  /** Optional starting spend caps (USD). Applied via the per-agent policy. */
  perTxCapUSD?: number | null;
  dailyCapUSD?: number | null;
}

export interface CreatedAgent {
  agent: Agent;
  /** The agent's own provisioned wallet address (null if still provisioning). */
  walletAddress: string | null;
}

export async function createAgent(input: CreateAgentInput): Promise<CreatedAgent> {
  const res = await hubJson<{
    agent: HubAgent;
    wallet?: { address: string | null };
  }>("/api/agents", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      framework: FRAMEWORK_TO_API[input.framework],
      description: input.description?.trim() || undefined,
      avatarColor: input.avatarColor || undefined,
    }),
  });

  // Optional starting caps → per-agent policy row (reuses the existing endpoint).
  const caps: Record<string, number> = {};
  if (typeof input.perTxCapUSD === "number" && input.perTxCapUSD > 0) {
    caps.perTxCap = input.perTxCapUSD;
  }
  if (typeof input.dailyCapUSD === "number" && input.dailyCapUSD > 0) {
    caps.dailyCap = input.dailyCapUSD;
  }
  if (Object.keys(caps).length > 0) {
    await hubJson(`/api/agents/${encodeURIComponent(res.agent.id)}/policy`, {
      method: "PUT",
      body: JSON.stringify(caps),
    }).catch(() => null);
  }

  return {
    agent: mapAgent(res.agent),
    walletAddress: res.wallet?.address ?? res.agent.stellarAddress ?? null,
  };
}

export async function updateAgent(
  id: string,
  patch: Partial<Pick<Agent, "name" | "status">>,
): Promise<Agent> {
  const res = await hubJson<{ agent: HubAgent }>(`/api/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return mapAgent(res.agent);
}

export async function deleteAgent(id: string): Promise<void> {
  await hubJson(`/api/agents/${id}`, { method: "DELETE" });
}

/* ------------------------------ api keys ------------------------------ */

/**
 * Tokens are per-agent: each nbl_live_ key authenticates as exactly one agent
 * and operates only that agent's wallet (enforced in resolveAuth).
 *
 * Also surfaces legacy account-level tokens (agentId null) — e.g. early Claude
 * OAuth grants that hit the owner's EOA — so users can find and revoke them.
 */
export async function getApiKeys(): Promise<ApiKey[]> {
  const agentId = getSelectedAgentId();
  const { tokens } = await hubJson<{
    tokens: Array<HubToken & { expiresAt?: string | null }>;
  }>("/api/tokens");

  const mapToken = (
    t: HubToken & { expiresAt?: string | null },
  ): ApiKey => {
    const isOauth =
      t.label.startsWith("oauth-mcp") || t.label.startsWith("Claude.ai");
    const kind: ApiKey["kind"] = !t.agentId
      ? "unscoped"
      : isOauth
        ? "oauth"
        : "manual";
    let name = t.label;
    if (t.label.startsWith("oauth-mcp:")) {
      name = `Claude.ai · ${t.label.slice("oauth-mcp:".length)}`;
    } else if (t.label === "oauth-mcp") {
      name = "Claude.ai connector (legacy)";
    }
    return {
      id: t.id,
      name,
      // Only a hash is stored — synthesize a stable display id from the row.
      prefix: `nbl_live_${t.id.slice(0, 4)}…${t.id.slice(-4)}`,
      createdAt: t.createdAt,
      lastUsed: t.lastUsedAt,
      expiresAt: t.expiresAt ?? null,
      agentId: t.agentId,
      kind,
    };
  };

  const list = tokens ?? [];
  const forAgent = agentId
    ? list.filter((t) => t.agentId === agentId).map(mapToken)
    : [];
  // Orphans always listed so Claude EOA grants can be revoked from any agent keys page.
  const orphans = list
    .filter((t) => !t.agentId)
    .map(mapToken)
    // Avoid duplicating if somehow already included
    .filter((o) => !forAgent.some((k) => k.id === o.id));

  return [...forAgent, ...orphans];
}

export async function createApiKey(input: {
  name: string;
  expiresInDays: number | null;
}): Promise<{ key: ApiKey; secret: string }> {
  const agentId = getSelectedAgentId();
  if (!agentId) {
    throw new Error("Select an agent before creating a key — keys are per-agent.");
  }
  const minted = await hubJson<{
    id: string;
    label: string;
    token: string;
    expiresAt?: string | null;
  }>("/api/tokens", {
    method: "POST",
    body: JSON.stringify({
      label: input.name,
      expiresInDays: input.expiresInDays,
      agentId,
    }),
  });
  const key: ApiKey = {
    id: minted.id,
    name: minted.label,
    prefix: minted.token.slice(0, 13),
    createdAt: new Date().toISOString(),
    lastUsed: null,
    expiresAt: minted.expiresAt ?? null,
    agentId,
    kind: "manual",
  };
  return { key, secret: minted.token };
}

export async function revokeApiKey(id: string): Promise<void> {
  await hubJson(`/api/tokens/${id}`, { method: "DELETE" });
}

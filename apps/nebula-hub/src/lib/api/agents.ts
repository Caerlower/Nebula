import type {
  Agent,
  AgentPolicyOverride,
  ApiKey,
  Framework,
} from "@/types/domain";

import {
  ApiError,
  FRAMEWORK_TO_API,
  hubJson,
  loadWalletAndTxs,
  mapAgent,
  mapTxStatus,
  nativeBalance,
  startOfToday,
  type HubAgent,
  type HubToken,
  type HubWallet,
} from "./client";

/* ------------------------------- agents ------------------------------- */

export async function getAgents(): Promise<Agent[]> {
  const [{ agents }, { wallet, txs }] = await Promise.all([
    hubJson<{ agents: HubAgent[] }>("/api/agents"),
    loadWalletAndTxs(100),
  ]);
  const address = wallet.address ?? "—";
  const balanceXLM = nativeBalance(wallet);
  const today = startOfToday().getTime();
  return (agents ?? []).map((a) => {
    const txToday = txs.filter(
      (t) =>
        t.agentId === a.id &&
        mapTxStatus(t.status) === "confirmed" &&
        new Date(t.createdAt).getTime() >= today,
    ).length;
    return mapAgent(a, { address, balanceXLM, txToday });
  });
}

export async function getAgent(id: string): Promise<Agent | null> {
  try {
    const [{ agent }, { wallet, txs }] = await Promise.all([
      hubJson<{ agent: HubAgent }>(`/api/agents/${id}`),
      loadWalletAndTxs(100),
    ]);
    const today = startOfToday().getTime();
    const txToday = txs.filter(
      (t) =>
        t.agentId === id &&
        mapTxStatus(t.status) === "confirmed" &&
        new Date(t.createdAt).getTime() >= today,
    ).length;
    return mapAgent(agent, {
      address: wallet.address ?? "—",
      balanceXLM: nativeBalance(wallet),
      txToday,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export interface CreateAgentInput {
  name: string;
  framework: Framework;
}

export async function createAgent(input: CreateAgentInput): Promise<Agent> {
  const res = await hubJson<{ agent: HubAgent }>("/api/agents", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      framework: FRAMEWORK_TO_API[input.framework],
    }),
  });
  const wallet = await hubJson<HubWallet>("/api/wallet");
  return mapAgent(res.agent, {
    address: wallet.address ?? "—",
    balanceXLM: nativeBalance(wallet),
    txToday: 0,
  });
}

export async function updateAgent(
  id: string,
  patch: Partial<Pick<Agent, "name" | "status">>,
): Promise<Agent> {
  const res = await hubJson<{ agent: HubAgent }>(`/api/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  const wallet = await hubJson<HubWallet>("/api/wallet");
  return mapAgent(res.agent, {
    address: wallet.address ?? "—",
    balanceXLM: nativeBalance(wallet),
    txToday: 0,
  });
}

export async function deleteAgent(id: string): Promise<void> {
  await hubJson(`/api/agents/${id}`, { method: "DELETE" });
}

export async function rotateAgentKeys(
  id: string,
): Promise<{ prefix: string }> {
  const minted = await hubJson<{
    id: string;
    label: string;
    token: string;
  }>("/api/tokens", {
    method: "POST",
    body: JSON.stringify({ label: `agent-${id.slice(0, 8)}`, agentId: id }),
  });
  // Revoke prior tokens for this agent (best-effort).
  const { tokens } = await hubJson<{ tokens: HubToken[] }>("/api/tokens");
  await Promise.all(
    (tokens ?? [])
      .filter((t) => t.agentId === id && t.id !== minted.id)
      .map((t) =>
        hubJson(`/api/tokens/${t.id}`, { method: "DELETE" }).catch(() => null),
      ),
  );
  return { prefix: minted.token.slice(0, 13) };
}

export async function getAgentPolicyOverride(
  _agentId: string,
): Promise<AgentPolicyOverride> {
  return {
    dailyCapUSD: null,
    perTxCapUSD: null,
    note: "Inherits the global Hub policy (per-agent overrides coming soon).",
  };
}

export async function updateAgentPolicyOverride(
  _agentId: string,
  patch: Partial<AgentPolicyOverride>,
): Promise<AgentPolicyOverride> {
  return {
    dailyCapUSD: patch.dailyCapUSD ?? null,
    perTxCapUSD: patch.perTxCapUSD ?? null,
    note:
      patch.note ??
      "Inherits the global Hub policy (per-agent overrides coming soon).",
  };
}

/* ------------------------------ api keys ------------------------------ */

export async function getApiKeys(): Promise<ApiKey[]> {
  const { tokens } = await hubJson<{
    tokens: Array<HubToken & { expiresAt?: string | null }>;
  }>("/api/tokens");
  return (tokens ?? []).map((t) => ({
    id: t.id,
    name: t.label,
    prefix: "nbl_live_••••",
    createdAt: t.createdAt,
    lastUsed: t.lastUsedAt,
    expiresAt: t.expiresAt ?? null,
    agentId: t.agentId,
  }));
}

export async function createApiKey(input: {
  name: string;
  expiresInDays: number | null;
}): Promise<{ key: ApiKey; secret: string }> {
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
    }),
  });
  const key: ApiKey = {
    id: minted.id,
    name: minted.label,
    prefix: minted.token.slice(0, 13),
    createdAt: new Date().toISOString(),
    lastUsed: null,
    expiresAt: minted.expiresAt ?? null,
    agentId: null,
  };
  return { key, secret: minted.token };
}

export async function revokeApiKey(id: string): Promise<void> {
  await hubJson(`/api/tokens/${id}`, { method: "DELETE" });
}

export async function testConnection(
  _framework: Framework,
): Promise<{ latencyMs: number }> {
  const started = performance.now();
  await hubJson("/api/me");
  return { latencyMs: Math.round(performance.now() - started) };
}

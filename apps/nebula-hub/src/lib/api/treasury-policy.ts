import type {
  BlendPosition,
  Policy,
  PolicyCategory,
  PolicyEntry,
  Reputation,
  TreasurySettings,
} from "@/types/domain";

import { getAgents, updateAgent } from "./agents";
import {
  composePolicy,
  hubJson,
  withPolicyWriteLock,
  type HubDenylist,
  type HubPolicyPatchResponse,
  type HubWhitelist,
} from "./client";

/* ------------------------------ treasury ------------------------------ */

export async function getBlendPositions(): Promise<BlendPosition[]> {
  const data = await hubJson<{
    blendDeposited: number | null;
    supplyApy: number | null;
    poolId: string | null;
    poolName: string | null;
  }>("/api/treasury");

  const deposited = data.blendDeposited ?? 0;
  if (deposited <= 0) return [];

  return [
    {
      id: data.poolId ?? "testnet-v2",
      pool: data.poolName ?? "TestnetV2",
      asset: "XLM",
      deposited,
      apyPct: data.supplyApy != null ? data.supplyApy * 100 : 0,
      earned: 0,
    },
  ];
}

export async function getTreasurySettings(): Promise<TreasurySettings> {
  const data = await hubJson<{
    autoYield: boolean;
    liquidThreshold: number;
    liquidHigh?: number;
  }>("/api/treasury");
  const low = data.liquidThreshold ?? 2;
  return {
    autoYield: data.autoYield ?? true,
    liquidityFloorXLM: low,
    liquidityCeilingXLM: data.liquidHigh ?? Math.max(low, 10),
  };
}

export async function updateTreasurySettings(
  patch: Partial<TreasurySettings>,
): Promise<TreasurySettings> {
  return withPolicyWriteLock(async () => {
    const body: Record<string, unknown> = {};
    if (patch.autoYield !== undefined) body.autoYield = patch.autoYield;
    if (patch.liquidityFloorXLM !== undefined) {
      body.liquidThreshold = patch.liquidityFloorXLM;
    }
    if (patch.liquidityCeilingXLM !== undefined) {
      body.liquidHigh = patch.liquidityCeilingXLM;
    }
    await hubJson("/api/policy", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    return getTreasurySettings();
  });
}

export async function transferXlm(input: {
  destination: string;
  amountXlm: number;
  memo?: string;
}): Promise<
  | { kind: "ok"; txHash: string; explorerUrl?: string }
  | { kind: "confirmation"; approveUrl: string; confirmationId: string }
> {
  const res = await hubJson<{
    status: string;
    tx_hash?: string;
    explorer_url?: string;
    approve_url?: string;
    confirmation_id?: string;
    reason?: string;
    message?: string;
  }>("/api/tools/transfer", {
    method: "POST",
    body: JSON.stringify({
      destination: input.destination.trim(),
      amount_xlm: input.amountXlm,
      memo: input.memo?.trim() || undefined,
      reason: "user_requested",
    }),
  });

  if (res.status === "confirmation_required" && res.approve_url) {
    return {
      kind: "confirmation",
      approveUrl: res.approve_url,
      confirmationId: res.confirmation_id ?? "",
    };
  }

  if (res.status !== "ok" || !res.tx_hash) {
    throw new Error(res.reason ?? res.message ?? "transfer_failed");
  }

  return {
    kind: "ok",
    txHash: res.tx_hash,
    explorerUrl: res.explorer_url,
  };
}

/** Dashboard withdraw of XLM or Circle USDC (Privy-signed). */
export async function withdrawFunds(input: {
  asset: "XLM" | "USDC";
  destination: string;
  amount: number;
  memo?: string;
}): Promise<{ txHash: string; explorerUrl?: string; asset: "XLM" | "USDC" }> {
  const res = await hubJson<{
    status: string;
    tx_hash?: string;
    explorer_url?: string;
    asset?: string;
    reason?: string;
    message?: string;
  }>("/api/wallet/withdraw", {
    method: "POST",
    body: JSON.stringify({
      asset: input.asset,
      destination: input.destination.trim(),
      amount: input.amount,
      memo: input.memo?.trim() || undefined,
    }),
  });
  if (res.status !== "ok" || !res.tx_hash) {
    throw new Error(res.reason ?? res.message ?? "withdraw_failed");
  }
  return {
    txHash: res.tx_hash,
    explorerUrl: res.explorer_url,
    asset: input.asset,
  };
}

export async function deposit(amountXLM: number): Promise<{ txHash: string }> {
  const res = await hubJson<{
    status: string;
    tx_hash?: string;
    reason?: string;
  }>("/api/tools/blend_deposit", {
    method: "POST",
    body: JSON.stringify({ amount_xlm: amountXLM }),
  });
  if (res.status !== "ok" || !res.tx_hash) {
    throw new Error(res.reason ?? "blend_deposit_failed");
  }
  return { txHash: res.tx_hash };
}

export async function withdraw(amountXLM: number): Promise<{ txHash: string }> {
  const res = await hubJson<{
    status: string;
    tx_hash?: string;
    reason?: string;
  }>("/api/tools/blend_withdraw", {
    method: "POST",
    body: JSON.stringify({ amount_xlm: amountXLM }),
  });
  if (res.status !== "ok" || !res.tx_hash) {
    throw new Error(res.reason ?? "blend_withdraw_failed");
  }
  return { txHash: res.tx_hash };
}

export async function withdrawPosition(
  positionId: string,
): Promise<{ txHash: string }> {
  const positions = await getBlendPositions();
  const position =
    positions.find((p) => p.id === positionId) ?? positions[0];
  if (!position || position.deposited <= 0) {
    throw new Error("No Blend position to withdraw");
  }
  return withdraw(position.deposited);
}

/* ------------------------------- policy ------------------------------- */

export async function getPolicy(): Promise<Policy> {
  return composePolicy();
}

type LimitsPatch = {
  dailyCapUSD?: number;
  perCallCapXLM?: number;
};

type LimitsResult = { policy: Policy; txHash: string };

let pendingLimits: LimitsPatch = {};
let limitsWaiters: Array<{
  resolve: (value: LimitsResult) => void;
  reject: (reason?: unknown) => void;
}> = [];
let limitsFlushScheduled = false;

async function patchPolicyLimitsOnce(
  patch: LimitsPatch,
): Promise<LimitsResult> {
  const body: Record<string, number> = {};
  if (patch.dailyCapUSD !== undefined) body.dailyCap = patch.dailyCapUSD;
  if (patch.perCallCapXLM !== undefined) body.perTxCap = patch.perCallCapXLM;
  if (Object.keys(body).length === 0) {
    throw new Error("No policy limits to update");
  }
  const res = await hubJson<HubPolicyPatchResponse>("/api/policy", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const txHash = res.tx_hash?.trim() || `hub_${Date.now().toString(16)}`;

  try {
    return { policy: await composePolicy(), txHash };
  } catch {
    const daily =
      patch.dailyCapUSD ??
      (typeof res.policy?.dailyCap === "number"
        ? res.policy.dailyCap
        : Number(res.policy?.dailyCap ?? 0));
    const perCall =
      patch.perCallCapXLM ??
      (typeof res.policy?.perTxCap === "number"
        ? res.policy.perTxCap
        : Number(res.policy?.perTxCap ?? 0));
    return {
      txHash,
      policy: {
        contractId: "hub-policy",
        perCallCapXLM: perCall,
        dailyCapUSD: daily,
        weeklyCapUSD: daily * 7,
        monthlyCapUSD: daily * 30,
        categories: { x402: 0, mpp: 0, transfer: 0 },
        entries: [],
        paused: false,
      },
    };
  }
}

function scheduleLimitsFlush() {
  if (limitsFlushScheduled) return;
  limitsFlushScheduled = true;
  void withPolicyWriteLock(async () => {
    limitsFlushScheduled = false;
    const patch = pendingLimits;
    const waiters = limitsWaiters;
    pendingLimits = {};
    limitsWaiters = [];
    if (waiters.length === 0) return;
    try {
      const result = await patchPolicyLimitsOnce(patch);
      for (const waiter of waiters) waiter.resolve(result);
    } catch (error) {
      for (const waiter of waiters) waiter.reject(error);
    }
    if (limitsWaiters.length > 0) scheduleLimitsFlush();
  });
}

/** Coalesces rapid per-call/daily edits into one on-chain PATCH. */
export function updatePolicyLimits(
  patch: LimitsPatch,
): Promise<LimitsResult> {
  pendingLimits = { ...pendingLimits, ...patch };
  return new Promise<LimitsResult>((resolve, reject) => {
    limitsWaiters.push({ resolve, reject });
    scheduleLimitsFlush();
  });
}

const CATEGORY_PATCH_KEY: Record<PolicyCategory, string> = {
  transfer: "catTransfer",
  x402: "catX402",
  mpp: "catMpp",
};

type CategoryResult = { policy: Policy; txHash: string };

let pendingCategories: Partial<Record<PolicyCategory, number>> = {};
let categoryWaiters: Array<{
  resolve: (value: CategoryResult) => void;
  reject: (reason?: unknown) => void;
}> = [];
let categoryFlushScheduled = false;

async function patchCategoriesOnce(
  cats: Partial<Record<PolicyCategory, number>>,
): Promise<CategoryResult> {
  const body: Record<string, number> = {};
  for (const category of Object.keys(cats) as PolicyCategory[]) {
    const cap = cats[category];
    if (cap !== undefined) body[CATEGORY_PATCH_KEY[category]] = cap;
  }
  if (Object.keys(body).length === 0) {
    throw new Error("No category limits to update");
  }
  const res = await hubJson<HubPolicyPatchResponse>("/api/policy", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const txHash = res.tx_hash?.trim() || `hub_${Date.now().toString(16)}`;
  try {
    return { policy: await composePolicy(), txHash };
  } catch {
    const base = await composePolicy().catch(() => null);
    if (!base) {
      return {
        txHash,
        policy: {
          contractId: "hub-policy",
          perCallCapXLM: 0,
          dailyCapUSD: 0,
          weeklyCapUSD: 0,
          monthlyCapUSD: 0,
          categories: {
            transfer: cats.transfer ?? 0,
            x402: cats.x402 ?? 0,
            mpp: cats.mpp ?? 0,
          },
          entries: [],
          paused: false,
        },
      };
    }
    return {
      txHash,
      policy: {
        ...base,
        categories: { ...base.categories, ...cats } as Policy["categories"],
      },
    };
  }
}

function scheduleCategoryFlush() {
  if (categoryFlushScheduled) return;
  categoryFlushScheduled = true;
  void withPolicyWriteLock(async () => {
    categoryFlushScheduled = false;
    const cats = pendingCategories;
    const waiters = categoryWaiters;
    pendingCategories = {};
    categoryWaiters = [];
    if (waiters.length === 0) return;
    try {
      const result = await patchCategoriesOnce(cats);
      for (const waiter of waiters) waiter.resolve(result);
    } catch (error) {
      for (const waiter of waiters) waiter.reject(error);
    }
    if (categoryWaiters.length > 0) scheduleCategoryFlush();
  });
}

/** Coalesces rapid category edits into one on-chain PATCH. */
export function updateCategoryLimit(
  category: PolicyCategory,
  capUSD: number,
): Promise<CategoryResult> {
  pendingCategories = { ...pendingCategories, [category]: capUSD };
  return new Promise<CategoryResult>((resolve, reject) => {
    categoryWaiters.push({ resolve, reject });
    scheduleCategoryFlush();
  });
}

export async function addPolicyEntry(
  entry: Omit<PolicyEntry, "id" | "addedAt">,
): Promise<{ entry: PolicyEntry; txHash: string }> {
  if (entry.kind === "allow") {
    const res = await hubJson<{ entry: HubWhitelist }>(
      "/api/policy/whitelist",
      {
        method: "POST",
        body: JSON.stringify({ address: entry.address, label: entry.label }),
      },
    );
    return {
      entry: {
        id: res.entry.id,
        address: res.entry.address,
        label: res.entry.label,
        kind: "allow",
        addedAt: res.entry.createdAt,
      },
      txHash: `hub_${Date.now().toString(16)}`,
    };
  }
  const res = await hubJson<{ entry: HubDenylist }>("/api/policy/denylist", {
    method: "POST",
    body: JSON.stringify({
      address: entry.address,
      reason: entry.label,
    }),
  });
  return {
    entry: {
      id: res.entry.id,
      address: res.entry.address,
      label: res.entry.reason?.trim() || entry.label,
      kind: "deny",
      addedAt: res.entry.createdAt,
    },
    txHash: `hub_${Date.now().toString(16)}`,
  };
}

export async function removePolicyEntry(
  id: string,
): Promise<{ txHash: string }> {
  const policy = await composePolicy();
  const entry = policy.entries.find((e) => e.id === id);
  if (!entry) throw new Error("Entry not found");
  const path =
    entry.kind === "allow"
      ? `/api/policy/whitelist/${id}`
      : `/api/policy/denylist/${id}`;
  await hubJson(path, { method: "DELETE" });
  return { txHash: `hub_${Date.now().toString(16)}` };
}

export async function setPolicyPaused(
  paused: boolean,
): Promise<{ txHash: string }> {
  return withPolicyWriteLock(async () => {
    await hubJson("/api/policy", {
      method: "PATCH",
      body: JSON.stringify({ paused }),
    });
    return { txHash: `hub_${Date.now().toString(16)}` };
  });
}

export async function revokeAgentAccess(): Promise<{ txHash: string }> {
  const agents = await getAgents();
  await Promise.all(
    agents
      .filter((a) => a.status === "active")
      .map((a) => updateAgent(a.id, { status: "offline" })),
  );
  return { txHash: `hub_${Date.now().toString(16)}` };
}

/* ----------------------------- reputation ----------------------------- */

export async function getReputation(): Promise<Reputation> {
  const data = await hubJson<{
    score: number | null;
    scale?: number;
    confidence?: string | null;
    tier: string | null;
    registered: boolean;
    note?: string;
    agentId?: string;
    agentName?: string;
    stellar8004AgentId?: number | null;
    feedbackCount?: number | null;
    averageScore?: number | null;
    totalScore?: number | null;
    uniqueClients?: number | null;
    source?: string | null;
    explorerUrl?: string | null;
  }>("/api/reputation");

  const scoreMax = data.scale === 1000 ? 100 : (data.scale ?? 100);
  // Migrate any leftover Hub 0–1000 mirrors down to 0–100.
  let score = data.score ?? 0;
  if (score > 100) score = Math.round(score / 10);
  score = Math.min(100, Math.max(0, score));

  const confidence = (data.confidence ?? data.tier ?? "unrated") as Reputation["confidence"];

  const feedbackCount = data.feedbackCount ?? 0;
  const uniqueClients = data.uniqueClients ?? 0;

  return {
    score,
    scoreMax,
    confidence,
    tier: confidence,
    registered: data.registered,
    feedbackCount,
    uniqueClients,
    totalScore: data.totalScore ?? null,
    averageScore: data.averageScore ?? score,
    stellar8004AgentId: data.stellar8004AgentId ?? null,
    explorerUrl: data.explorerUrl ?? null,
    source: data.source ?? null,
    deltaWeek: 0,
    history: [{ time: new Date().toISOString(), score }],
    components: [
      {
        key: "average",
        label: "Average score",
        score,
        max: 100,
        explainer:
          "Stellar8004 avgScore — mean of on-chain feedback values normalized to 0–100.",
      },
      {
        key: "feedback",
        label: "Feedback count",
        score: feedbackCount,
        max: Math.max(feedbackCount, 10),
        explainer: "Number of non-revoked feedback records for this agent.",
      },
      {
        key: "clients",
        label: "Unique clients",
        score: uniqueClients,
        max: Math.max(uniqueClients, 10),
        explainer: "Distinct addresses that left feedback (sybil-relevant).",
      },
      {
        key: "total",
        label: "Total score",
        score: data.totalScore ?? 0,
        max: Math.max(data.totalScore ?? 0, 100),
        explainer: "Explorer aggregate totalScore when indexed; else 0.",
      },
    ],
    events: data.registered && data.stellar8004AgentId != null
      ? [
          {
            id: "8004",
            time: new Date().toISOString(),
            text: `Stellar8004 agent #${data.stellar8004AgentId}${data.source ? ` · ${data.source}` : ""}`,
            delta: score,
          },
        ]
      : [
          {
            id: "pending",
            time: new Date().toISOString(),
            text: data.note ?? "Call register_identity to mint on-chain identity",
            delta: 0,
          },
        ],
  };
}

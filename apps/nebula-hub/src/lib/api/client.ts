/**
 * Dashboard client API — shared fetch helpers, types, and mappers.
 */

import { hubFetch } from "@/lib/hub-session";
import { getSelectedAgentId } from "@/stores/agent";
import { useAuthStore } from "@/stores/auth";
import type {
  Agent,
  BalancePoint,
  Framework,
  Policy,
  PolicyEntry,
  TimeRange,
  Transaction,
  TxOperation,
  TxStatus,
  TxType,
} from "@/types/domain";

let policyWriteTail: Promise<unknown> = Promise.resolve();
export function withPolicyWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = policyWriteTail.then(fn, fn);
  policyWriteTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}


/* -------------------------------- helpers -------------------------------- */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let redirectingToLogin = false;

/**
 * A 401 means the server no longer recognizes the session (expired cookie /
 * revoked Privy token) while the client still thinks it's signed in. Clear the
 * local session and bounce to /login so the user can re-authenticate instead of
 * silently hitting "unauthorized" on every action.
 */
function handleDeadSession(): void {
  if (typeof window === "undefined" || redirectingToLogin) return;
  if (window.location.pathname.startsWith("/login")) return;
  redirectingToLogin = true;
  try {
    useAuthStore.getState().signOut();
  } catch {
    /* ignore */
  }
  window.location.href = "/login";
}

export async function hubJsonUncached<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await hubFetch(input, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      reason?: string;
      status?: string;
    };
    if (res.status === 401) {
      handleDeadSession();
    }
    throw new ApiError(
      body.reason ?? body.status ?? `request_failed_${res.status}`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

/**
 * GET dedup + short cache. Several screens and widgets independently ask for
 * the same endpoints (wallet, transactions, agents…) — without this, one page
 * mount fires 10–15 identical requests. Concurrent calls share one in-flight
 * promise; results live for a short TTL; ANY mutation clears the whole cache
 * so reload-after-write always sees fresh data.
 */
const FRESH_MS = 15_000;
const STALE_MS = 5 * 60_000;
const getCache = new Map<string, { at: number; promise: Promise<unknown> }>();

export function refreshInBackground(input: string): void {
  const promise = hubJsonUncached<unknown>(input)
    .then((value) => {
      getCache.set(input, { at: Date.now(), promise: Promise.resolve(value) });
      return value;
    })
    .catch(() => {
      getCache.delete(input);
    });
  void promise;
}

export async function hubJson<T>(input: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  if (method !== "GET") {
    try {
      return await hubJsonUncached<T>(input, init);
    } finally {
      getCache.clear();
    }
  }
  const hit = getCache.get(input);
  if (hit) {
    const age = Date.now() - hit.at;
    // Fresh: share it. Stale-but-usable: paint instantly with what we have
    // and refresh behind the scenes — the next visit gets the new data.
    if (age < FRESH_MS) return hit.promise as Promise<T>;
    if (age < STALE_MS) {
      refreshInBackground(input);
      return hit.promise as Promise<T>;
    }
  }
  const promise = hubJsonUncached<T>(input, init).catch((error: unknown) => {
    getCache.delete(input);
    throw error;
  });
  getCache.set(input, { at: Date.now(), promise });
  return promise;
}

/**
 * Fire-and-forget warm-up of every dashboard data source. Called once when
 * the app shell mounts so the first visit to each page paints from cache
 * instead of staring at a skeleton while a cold route compiles + queries.
 */
export function warmHubCaches(): void {
  // Per-agent data (wallet/treasury/reputation) is warmed lazily once an agent
  // is selected — warming owner-scoped endpoints here would only ever return
  // empty for dashboard sessions.
  const endpoints = [
    "/api/agents",
    "/api/wallet/transactions?limit=100",
    "/api/policy/whitelist",
    "/api/policy/denylist",
    "/api/fx/xlm-usd",
  ];
  for (const endpoint of endpoints) {
    void hubJson(endpoint).catch(() => {});
  }
}

export type HubWallet = {
  address: string | null;
  network: string;
  balances: { asset: string; balance: string }[];
  note?: string;
};

export type HubTx = {
  id: string;
  agentId: string | null;
  type: string;
  destination: string;
  amountXlm: string | number;
  memo: string | null;
  reason: string;
  txHash: string | null;
  status: string;
  createdAt: string;
};

export type HubAgent = {
  id: string;
  name: string;
  framework: string;
  status: string;
  createdAt: string;
  description?: string | null;
  avatarColor?: string | null;
  /** Agent's own wallet address (null until provisioned). */
  stellarAddress?: string | null;
  /** Native XLM in the agent's own wallet (set by the agents API). */
  balanceXlm?: number;
  /** USDC in the agent's own wallet (set by the agents API). */
  balanceUsdc?: number;
  tokens?: {
    id: string;
    label: string;
    lastUsedAt: string | null;
    createdAt: string;
  }[];
};

export type HubPolicySnapshot = {
  microThreshold: number;
  perTxCap: number;
  dailyCap: number;
  paused: boolean;
  whitelist: string[];
  denylist: string[];
  dailySpentUsdc?: number;
  /** @deprecated use dailySpentUsdc */
  dailySpentXlm?: number;
  catTransfer?: number;
  catX402?: number;
  catMpp?: number;
};

export type HubPolicyPatchResponse = {
  status: string;
  policy: HubPolicySnapshot & Record<string, unknown>;
  onchain?: string;
  tx_hash?: string | null;
};

export type HubWhitelist = {
  id: string;
  address: string;
  label: string;
  createdAt: string;
};

export type HubDenylist = {
  id: string;
  address: string;
  reason: string | null;
  createdAt: string;
};

export type HubToken = {
  id: string;
  label: string;
  agentId: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export const FRAMEWORK_TO_API: Record<Framework, string> = {
  "claude-desktop": "claude_desktop",
  "claude-code": "claude_code",
  "custom-mcp": "custom",
  "openai-sdk": "chatgpt",
};

export const FRAMEWORK_FROM_API: Record<string, Framework> = {
  claude_desktop: "claude-desktop",
  claude_code: "claude-code",
  custom: "custom-mcp",
  chatgpt: "openai-sdk",
  cursor: "custom-mcp",
};

export function parseXlm(value: string | number | undefined | null): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function nativeBalance(wallet: HubWallet): number {
  const row = wallet.balances.find(
    (b) => b.asset === "XLM" || b.asset === "native",
  );
  return parseXlm(row?.balance);
}

export function usdcBalance(wallet: HubWallet): number {
  const row = wallet.balances.find(
    (b) => b.asset === "USDC" || b.asset.startsWith("USDC:"),
  );
  return parseXlm(row?.balance);
}

export function mapTxStatus(status: string): TxStatus {
  if (status === "confirmed" || status === "ok") return "confirmed";
  if (status === "failed" || status === "rejected") return "failed";
  return "pending";
}

export function mapTxType(type: string): TxType {
  if (type === "x402") return "x402";
  // Channel open / micropayments / close are one MPP session in the UI.
  if (type === "mpp" || type === "mpp_open" || type === "mpp_close") return "mpp";
  if (type === "blend_deposit") return "blend_deposit";
  if (type === "blend_withdraw") return "blend_withdraw";
  if (type === "policy_change") return "policy_change";
  if (type === "swap") return "swap";
  return "transfer";
}

/**
 * Resolve the asset for a transaction. Transfers/withdraws encode the asset in
 * the reason string (`asset=USDC|XLM`); x402 / MPP are always USDC; everything
 * else (native transfers, Blend) is XLM.
 */
export function mapTxAsset(row: HubTx): "XLM" | "USDC" {
  const tagged = /asset=(USDC|XLM)/i.exec(row.reason ?? "");
  if (tagged) return tagged[1]!.toUpperCase() as "XLM" | "USDC";

  const type = row.type;
  if (
    type === "x402" ||
    type === "mpp" ||
    type === "mpp_open" ||
    type === "mpp_close"
  ) {
    return "USDC";
  }
  return "XLM";
}

export function mapTxOperations(row: HubTx): TxOperation[] {
  const detail = row.reason?.trim() || row.type;
  if (row.type === "mpp_open") {
    return [{ type: "mpp_open", detail: `Channel open · ${detail}` }];
  }
  if (row.type === "mpp_close") {
    return [{ type: "mpp_close", detail: `Channel close · ${detail}` }];
  }
  if (row.type === "mpp") {
    return [{ type: "mpp_payment", detail: `Micropayment · ${detail}` }];
  }
  return [{ type: row.type, detail }];
}

export function mapAgentStatus(status: string): Agent["status"] {
  if (status === "paused") return "paused";
  if (status === "offline") return "offline";
  return "active";
}

export function mapTransaction(row: HubTx, walletAddress: string): Transaction {
  return {
    id: row.id,
    hash: row.txHash ?? row.id,
    time:
      typeof row.createdAt === "string"
        ? row.createdAt
        : new Date(row.createdAt).toISOString(),
    agentId: row.agentId ?? "",
    type: mapTxType(row.type),
    from: walletAddress,
    to: row.destination,
    amount: parseXlm(row.amountXlm),
    asset: mapTxAsset(row),
    status: mapTxStatus(row.status),
    fee: 0,
    memo: row.memo,
    operations: mapTxOperations(row),
  };
}

export function mapAgent(row: HubAgent, txToday = 0): Agent {
  const lastToken = row.tokens?.[0];
  return {
    id: row.id,
    name: row.name,
    framework: FRAMEWORK_FROM_API[row.framework] ?? "custom-mcp",
    status: mapAgentStatus(row.status),
    description: row.description ?? null,
    avatarColor: row.avatarColor ?? null,
    // Agent's OWN wallet only — never fall back to the owner/login wallet.
    address: row.stellarAddress ?? "—",
    balanceXLM: row.balanceXlm ?? 0,
    balanceUSDC: row.balanceUsdc ?? 0,
    txToday,
    lastActive: lastToken?.lastUsedAt ?? row.createdAt,
    createdAt:
      typeof row.createdAt === "string"
        ? row.createdAt
        : new Date(row.createdAt).toISOString(),
  };
}

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Reconstruct a balance series from the live balance + outbound Hub txs. */
export function buildHistory(
  range: TimeRange,
  currentBalance: number,
  txs: HubTx[],
): BalancePoint[] {
  const now = Date.now();
  const spanMs: Record<TimeRange, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
    "90d": 90 * 24 * 60 * 60 * 1000,
    all: 90 * 24 * 60 * 60 * 1000,
  };
  const countByRange: Record<TimeRange, number> = {
    "24h": 25,
    "7d": 28,
    "30d": 30,
    "90d": 30,
    all: 30,
  };

  const spends = txs
    .filter((t) => mapTxStatus(t.status) === "confirmed")
    .map((t) => ({
      at: new Date(t.createdAt).getTime(),
      amount: parseXlm(t.amountXlm),
    }))
    .filter((t) => Number.isFinite(t.at))
    .sort((a, b) => a.at - b.at);

  const windowStart = now - spanMs[range];
  const count = countByRange[range];
  const step = spanMs[range] / Math.max(count - 1, 1);
  const points: BalancePoint[] = [];

  for (let i = 0; i < count; i++) {
    const t = i === count - 1 ? now : windowStart + step * i;
    // Balance at time t ≈ current + sum(spends after t)
    let balance = currentBalance;
    for (const s of spends) {
      if (s.at > t) balance += s.amount;
    }
    points.push({
      time: new Date(t).toISOString(),
      balance: Math.max(0, Math.round(balance * 1e7) / 1e7),
      yield: 0,
    });
  }
  return points;
}

export const EMPTY_WALLET: HubWallet = {
  address: null,
  network: "testnet",
  balances: [],
};

/**
 * Wallet + transactions for the CURRENTLY SELECTED AGENT. Returns empty data
 * (never the owner wallet) when no agent is selected, so data pages show a
 * clean zero/empty state instead of leaking login-wallet balances.
 */
export async function loadAgentWalletAndTxs(limit = 100): Promise<{
  wallet: HubWallet;
  txs: HubTx[];
}> {
  const agentId = getSelectedAgentId();
  if (!agentId) return { wallet: EMPTY_WALLET, txs: [] };
  const scope = encodeURIComponent(agentId);
  const [wallet, txRes] = await Promise.all([
    hubJson<HubWallet>(`/api/wallet?agentId=${scope}`),
    hubJson<{ transactions: HubTx[] }>(
      `/api/wallet/transactions?agentId=${scope}&limit=${limit}`,
    ),
  ]);
  return { wallet, txs: txRes.transactions ?? [] };
}

/** All of the user's transactions across every agent (for per-agent counts). */
export async function loadAllTxs(limit = 100): Promise<HubTx[]> {
  const txRes = await hubJson<{ transactions: HubTx[] }>(
    `/api/wallet/transactions?limit=${limit}`,
  );
  return txRes.transactions ?? [];
}

export type HubAgentCaps = {
  microThreshold: number;
  perTxCap: number;
  dailyCap: number;
  paused: boolean;
  catTransfer: number;
  catX402: number;
  catMpp: number;
};

const EMPTY_CAPS: HubAgentCaps = {
  microThreshold: 0,
  perTxCap: 0,
  dailyCap: 0,
  paused: false,
  catTransfer: 0,
  catX402: 0,
  catMpp: 0,
};

/**
 * Policy for the SELECTED AGENT. Spend caps are per-agent (via
 * /api/agents/[id]/policy); allow/deny lists remain account-level for now.
 */
export async function composePolicy(): Promise<Policy> {
  const agentId = getSelectedAgentId();
  const [capsRes, wl, dl, chain] = await Promise.all([
    agentId
      ? hubJson<{ policy: HubAgentCaps; custom: boolean }>(
          `/api/agents/${encodeURIComponent(agentId)}/policy`,
        ).catch(() => null)
      : Promise.resolve(null),
    hubJson<{ whitelist: HubWhitelist[] }>("/api/policy/whitelist"),
    hubJson<{ denylist: HubDenylist[] }>("/api/policy/denylist"),
    hubJson<{ contractId: string | null; onchainConfigured: boolean }>(
      "/api/policy",
    ).catch(() => null),
  ]);
  const p = capsRes?.policy ?? EMPTY_CAPS;
  const entries: PolicyEntry[] = [
    ...(wl.whitelist ?? []).map((e) => ({
      id: e.id,
      address: e.address,
      label: e.label,
      kind: "allow" as const,
      addedAt: e.createdAt,
    })),
    ...(dl.denylist ?? []).map((e) => ({
      id: e.id,
      address: e.address,
      label: e.reason?.trim() || "Denied",
      kind: "deny" as const,
      addedAt: e.createdAt,
    })),
  ].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));

  const daily = p.dailyCap;
  const perTx = p.perTxCap;
  const onchainContractId =
    chain?.contractId && chain.contractId.startsWith("C")
      ? chain.contractId
      : "hub-policy";
  return {
    contractId: onchainContractId,
    perCallCapXLM: perTx,
    dailyCapUSD: daily,
    weeklyCapUSD: daily * 7,
    monthlyCapUSD: daily * 30,
    categories: {
      x402: p.catX402 ?? perTx,
      mpp: p.catMpp ?? perTx,
      transfer: p.catTransfer ?? perTx,
    },
    entries,
    paused: p.paused,
  };
}

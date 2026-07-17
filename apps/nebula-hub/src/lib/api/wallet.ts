import type {
  BalancePoint,
  TimeRange,
  Transaction,
  TxStatus,
  TxType,
  WalletSummary,
} from "@/types/domain";

import {
  hubJson,
  loadAgentWalletAndTxs,
  loadAllTxs,
  mapTransaction,
  mapTxStatus,
  nativeBalance,
  parseXlm,
  startOfToday,
  buildHistory,
  usdcBalance,
} from "./client";
import { getSelectedAgentId } from "@/stores/agent";

/* ------------------------------ onboarding ----------------------------- */

export async function generateFundingAddress(): Promise<string> {
  const { wallet } = await loadAgentWalletAndTxs(1);
  if (!wallet.address) {
    throw new Error("Select an agent first — funding goes to the agent's wallet.");
  }
  return wallet.address;
}

/* ------------------------------- wallet ------------------------------- */

/**
 * Balance summary for the SELECTED AGENT's own wallet (XLM + USDC). Treasury /
 * Blend numbers are intentionally 0 here — per-agent treasury lands in its own
 * stage; this read never touches the owner wallet or a shared treasury.
 */
export async function getWallet(): Promise<WalletSummary> {
  const { wallet, txs } = await loadAgentWalletAndTxs(100);

  const nativeXLM = nativeBalance(wallet);
  const liquidXLM = nativeXLM;
  const blendXLM = 0;
  const balanceXLM = nativeXLM;
  const apyPct = 0;

  const today = startOfToday().getTime();
  const fx = await hubJson<{ usd_per_xlm?: number }>("/api/fx/xlm-usd").catch(
    () => null,
  );
  const usdPerXlm = fx?.usd_per_xlm && fx.usd_per_xlm > 0 ? fx.usd_per_xlm : null;
  const spendToday = txs
    .filter(
      (t) =>
        mapTxStatus(t.status) === "confirmed" &&
        new Date(t.createdAt).getTime() >= today &&
        (t.type === "transfer" || t.type === "x402" || t.type === "mpp"),
    )
    .reduce((sum, t) => {
      const raw = parseXlm(t.amountXlm);
      if (t.type === "transfer") {
        return sum + (usdPerXlm != null ? raw * usdPerXlm : 0);
      }
      return sum + raw;
    }, 0);

  const history = buildHistory("24h", balanceXLM, txs);
  const first = history[0]?.balance ?? balanceXLM;
  const change24hPct =
    first > 0 ? ((balanceXLM - first) / first) * 100 : 0;

  return {
    address: wallet.address ?? "—",
    balanceXLM,
    change24hPct,
    liquidXLM,
    blendXLM,
    idleXLM: blendXLM,
    apyPct,
    yield30dXLM: 0,
    spendTodayUSD: spendToday,
    usdPerXlm,
    liquidityFloorXLM: undefined,
    poolName: null,
    network: wallet.network === "mainnet" ? "mainnet" : "testnet",
    usdcBalance: usdcBalance(wallet),
  };
}

/** Open Circle USDC trustline on the SELECTED AGENT's wallet (Privy-signed). */
export async function ensureUsdcTrustline(): Promise<{
  alreadyHad: boolean;
  txHash: string | null;
  faucet: string | null;
  message: string;
}> {
  const agentId = getSelectedAgentId();
  if (!agentId) {
    throw new Error("Select an agent before opening its USDC trustline.");
  }
  const res = await hubJson<{
    status: string;
    already_had?: boolean;
    tx_hash?: string | null;
    faucet?: string | null;
    message?: string;
    reason?: string;
  }>("/api/wallet/usdc-trustline", {
    method: "POST",
    body: JSON.stringify({ agentId }),
  });
  if (res.status !== "ok") {
    throw new Error(res.reason ?? "usdc_trustline_failed");
  }
  return {
    alreadyHad: Boolean(res.already_had),
    txHash: res.tx_hash ?? null,
    faucet: res.faucet ?? null,
    message: res.message ?? "USDC trustline ready",
  };
}

export async function getUsdcTrustlineStatus(): Promise<{
  ready: boolean;
  faucet: string | null;
  issuer: string;
}> {
  const agentId = getSelectedAgentId();
  const res = await hubJson<{
    status: string;
    ready?: boolean;
    faucet?: string | null;
    issuer?: string;
    reason?: string;
  }>(
    agentId
      ? `/api/wallet/usdc-trustline?agentId=${encodeURIComponent(agentId)}`
      : "/api/wallet/usdc-trustline",
  );
  if (res.status !== "ok") {
    throw new Error(res.reason ?? "usdc_trustline_status_failed");
  }
  return {
    ready: Boolean(res.ready),
    faucet: res.faucet ?? null,
    issuer: res.issuer ?? "",
  };
}

export async function getBalanceHistory(
  range: TimeRange,
): Promise<BalancePoint[]> {
  const { wallet, txs } = await loadAgentWalletAndTxs(100);
  return buildHistory(range, nativeBalance(wallet), txs);
}

/* ---------------------------- transactions ---------------------------- */

export interface TxFilter {
  search?: string;
  agentIds?: string[];
  types?: TxType[];
  statuses?: TxStatus[];
  from?: string;
  to?: string;
}

export async function getTransactions(
  filter?: TxFilter,
): Promise<Transaction[]> {
  const { wallet, txs } = await loadAgentWalletAndTxs(100);
  const address = wallet.address ?? "";
  let rows = txs.map((t) => mapTransaction(t, address));
  if (filter) {
    const search = filter.search?.trim().toLowerCase();
    rows = rows.filter((tx) => {
      if (search) {
        const haystack = `${tx.hash} ${tx.from} ${tx.to}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (filter.agentIds?.length && !filter.agentIds.includes(tx.agentId)) {
        return false;
      }
      if (filter.types?.length && !filter.types.includes(tx.type)) return false;
      if (filter.statuses?.length && !filter.statuses.includes(tx.status)) {
        return false;
      }
      if (filter.from && tx.time < filter.from) return false;
      if (filter.to && tx.time > filter.to) return false;
      return true;
    });
  }
  return rows;
}

export async function getRecentTransactions(
  count: number,
): Promise<Transaction[]> {
  const rows = await getTransactions();
  return rows.slice(0, count);
}

export async function getAgentTransactions(
  agentId: string,
): Promise<Transaction[]> {
  // Resolve a specific agent's history regardless of the current selection.
  const txs = await loadAllTxs(100);
  return txs
    .filter((t) => t.agentId === agentId)
    .map((t) => mapTransaction(t, ""));
}

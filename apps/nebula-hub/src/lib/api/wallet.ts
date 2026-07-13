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
  loadWalletAndTxs,
  mapTransaction,
  mapTxStatus,
  nativeBalance,
  parseXlm,
  startOfToday,
  buildHistory,
  usdcBalance,
  type HubWallet,
  type HubTx,
} from "./client";

/* ------------------------------ onboarding ----------------------------- */

export async function generateFundingAddress(): Promise<string> {
  const wallet = await hubJson<HubWallet>("/api/wallet");
  if (!wallet.address) {
    throw new Error("Wallet not provisioned yet — finish Privy sign-in first.");
  }
  return wallet.address;
}

/* ------------------------------- wallet ------------------------------- */

export async function getWallet(): Promise<WalletSummary> {
  const [{ wallet, txs }, treasury] = await Promise.all([
    loadWalletAndTxs(100),
    hubJson<{
      liquid: number | null;
      blendDeposited: number | null;
      supplyApy: number | null;
      liquidThreshold: number;
      poolName: string | null;
      rawNativeXlm: number | null;
    }>("/api/treasury").catch(() => null),
  ]);

  const nativeXLM = nativeBalance(wallet);
  const liquidXLM = treasury?.liquid ?? nativeXLM;
  const blendXLM = treasury?.blendDeposited ?? 0;
  const balanceXLM = liquidXLM + blendXLM;
  const apyPct =
    treasury?.supplyApy != null && Number.isFinite(treasury.supplyApy)
      ? treasury.supplyApy * 100
      : 0;

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
    liquidityFloorXLM: treasury?.liquidThreshold,
    poolName: treasury?.poolName ?? null,
    network: wallet.network === "mainnet" ? "mainnet" : "testnet",
    usdcBalance: usdcBalance(wallet),
  };
}

/** Open Circle USDC trustline on the Hub wallet (Privy-signed). */
export async function ensureUsdcTrustline(): Promise<{
  alreadyHad: boolean;
  txHash: string | null;
  faucet: string | null;
  message: string;
}> {
  const res = await hubJson<{
    status: string;
    already_had?: boolean;
    tx_hash?: string | null;
    faucet?: string | null;
    message?: string;
    reason?: string;
  }>("/api/wallet/usdc-trustline", { method: "POST" });
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
  const res = await hubJson<{
    status: string;
    ready?: boolean;
    faucet?: string | null;
    issuer?: string;
    reason?: string;
  }>("/api/wallet/usdc-trustline");
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
  const { wallet, txs } = await loadWalletAndTxs(100);
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
  const { wallet, txs } = await loadWalletAndTxs(100);
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
  return getTransactions({ agentIds: [agentId] });
}

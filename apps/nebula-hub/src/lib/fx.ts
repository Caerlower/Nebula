import { prisma } from "@/lib/db";

/**
 * XLM ↔ USDC for spend-policy accounting + balance display.
 * Live rate: CoinGecko `stellar` → USD (60s cache).
 * Optional `XLM_USD_PRICE` skips the network call (tests / offline only).
 */

const PRICE_TTL_MS = 60_000;
let cached: { usdPerXlm: number; at: number } | null = null;

export type FxQuote = {
  usdPerXlm: number;
  source: "coingecko" | "override";
};

async function fetchCoinGeckoUsdPerXlm(): Promise<number> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd",
    { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) },
  );
  if (!res.ok) {
    throw new Error(`xlm_usd_price_unavailable: coingecko ${res.status}`);
  }
  const json = (await res.json()) as { stellar?: { usd?: number } };
  const usd = json.stellar?.usd;
  if (!Number.isFinite(usd) || (usd as number) <= 0) {
    throw new Error("xlm_usd_price_unavailable: invalid coingecko response");
  }
  return usd as number;
}

/** Prefer this for API routes — returns rate + source. */
export async function quoteXlmUsd(): Promise<FxQuote> {
  const override = process.env.XLM_USD_PRICE?.trim();
  if (override) {
    const n = Number(override);
    if (Number.isFinite(n) && n > 0) {
      return { usdPerXlm: n, source: "override" };
    }
  }

  if (cached && Date.now() - cached.at < PRICE_TTL_MS) {
    return { usdPerXlm: cached.usdPerXlm, source: "coingecko" };
  }

  const usdPerXlm = await fetchCoinGeckoUsdPerXlm();
  cached = { usdPerXlm, at: Date.now() };
  return { usdPerXlm, source: "coingecko" };
}

/** @deprecated alias — Turbopack HMR sometimes stuck on old export names */
export const getUsdPerXlmQuote = quoteXlmUsd;

export async function getUsdPerXlm(): Promise<number> {
  return (await quoteXlmUsd()).usdPerXlm;
}

export async function xlmToUsdc(amountXlm: number): Promise<number> {
  if (!Number.isFinite(amountXlm) || amountXlm === 0) return 0;
  const rate = await getUsdPerXlm();
  return Math.round(amountXlm * rate * 1e7) / 1e7;
}

export async function usdcToXlm(amountUsdc: number): Promise<number> {
  if (!Number.isFinite(amountUsdc) || amountUsdc === 0) return 0;
  const rate = await getUsdPerXlm();
  return Math.round((amountUsdc / rate) * 1e7) / 1e7;
}


/**
 * Liquid band is stored/configured in USDC.
 * Blend balances are native XLM — convert the band at use time via CoinGecko.
 */
export async function liquidBandToXlm(params: {
  lowUsdc: number;
  highUsdc: number;
}): Promise<{ lowXlm: number; highXlm: number; lowUsdc: number; highUsdc: number }> {
  const lowUsdc = Number.isFinite(params.lowUsdc) ? Math.max(0, params.lowUsdc) : 0;
  const highUsdc = Math.max(
    lowUsdc,
    Number.isFinite(params.highUsdc) ? params.highUsdc : lowUsdc,
  );
  const [lowXlm, highXlm] = await Promise.all([
    usdcToXlm(lowUsdc),
    usdcToXlm(highUsdc),
  ]);
  return { lowUsdc, highUsdc, lowXlm, highXlm };
}

/** Outbound spend types counted toward USDC daily / category caps. */
export const SPEND_TX_TYPES = ["transfer", "x402", "mpp"] as const;

/**
 * Convert a ledger row into USDC for policy accounting.
 * - transfer: native XLM → USDC via oracle
 * - x402 / mpp: amountXlm column already stores USDC face value
 */
export async function rowSpendUsdc(row: {
  type: string;
  amountXlm: { toString(): string } | number;
}): Promise<number> {
  const raw = Number(row.amountXlm);
  if (!Number.isFinite(raw) || raw === 0) return 0;
  if (row.type === "transfer") {
    return xlmToUsdc(raw);
  }
  if (row.type === "x402" || row.type === "mpp") {
    return raw;
  }
  return 0;
}

export async function sumSpendUsdcSince(
  userId: string,
  since: Date,
  opts?: { types?: readonly string[]; agentId?: string | null },
): Promise<{ total: number; byType: Record<string, number> }> {
  const types = opts?.types ?? SPEND_TX_TYPES;
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      // When scoped to an agent, count only that agent's spend so each agent
      // gets an isolated daily/category budget.
      ...(opts?.agentId ? { agentId: opts.agentId } : {}),
      status: "confirmed",
      type: { in: [...types] },
      createdAt: { gte: since },
    },
    select: { type: true, amountXlm: true },
  });

  const byType: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    const usdc = await rowSpendUsdc(row);
    byType[row.type] = (byType[row.type] ?? 0) + usdc;
    total += usdc;
  }
  return { total, byType };
}

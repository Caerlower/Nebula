import {
  PoolMetadata,
  PoolV2,
  TokenMetadata,
  type Reserve,
} from "@blend-capital/blend-sdk";

import {
  getBlendPoolsForNetwork,
  getBlendSdkNetwork,
  type BlendPoolConfig,
} from "./config";

export interface ReserveRate {
  symbol: string;
  assetId: string;
  supplyApy: string;
  supplyApr: string;
  borrowApy: string;
  borrowApr: string;
  utilization: string;
  supplyApyFloat: number;
}

export interface PoolRatesResult {
  pool: BlendPoolConfig;
  poolName: string;
  reserves: ReserveRate[];
}

export type BlendRatesResponse =
  | { ok: true; network: string; pools: PoolRatesResult[]; errors: string[] }
  | { ok: false; error: string };

function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(2)}%`;
}

async function resolveSymbol(
  assetId: string,
  network: ReturnType<typeof getBlendSdkNetwork>,
): Promise<string> {
  try {
    const metadata = await TokenMetadata.load(network, assetId);
    return metadata.symbol || assetId;
  } catch {
    return assetId;
  }
}

function reserveToRate(reserve: Reserve, symbol: string): ReserveRate {
  return {
    symbol,
    assetId: reserve.assetId,
    supplyApy: formatRate(reserve.estSupplyApy),
    supplyApr: formatRate(reserve.supplyApr),
    borrowApy: formatRate(reserve.estBorrowApy),
    borrowApr: formatRate(reserve.borrowApr),
    utilization: formatRate(reserve.getUtilizationFloat()),
    supplyApyFloat: reserve.estSupplyApy,
  };
}

async function loadPoolRates(
  pool: BlendPoolConfig,
  networkName: "testnet" | "mainnet",
): Promise<PoolRatesResult> {
  const network = getBlendSdkNetwork(networkName);
  const metadata = await PoolMetadata.load(network, pool.poolId);
  const poolData = await PoolV2.load(network, pool.poolId);

  const reserves: ReserveRate[] = [];
  for (const reserve of poolData.reserves.values()) {
    const symbol = await resolveSymbol(reserve.assetId, network);
    reserves.push(reserveToRate(reserve, symbol));
  }
  reserves.sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    pool,
    poolName: metadata.name,
    reserves,
  };
}

export async function fetchBlendSupplyRates(
  networkName: "testnet" | "mainnet" = "testnet",
): Promise<BlendRatesResponse> {
  const pools = getBlendPoolsForNetwork(networkName);
  if (pools.length === 0) {
    return {
      ok: false,
      error:
        "No Blend pools are configured for this network. Rate checks are available on testnet only.",
    };
  }

  const results: PoolRatesResult[] = [];
  const errors: string[] = [];

  for (const pool of pools) {
    try {
      results.push(await loadPoolRates(pool, networkName));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Blend RPC error";
      errors.push(`Pool ${pool.name} (${pool.poolId}): ${message}`);
    }
  }

  if (results.length === 0) {
    return {
      ok: false,
      error: errors.join("\n") || "Failed to load any Blend pool data.",
    };
  }

  return {
    ok: true,
    network: networkName,
    pools: results,
    errors,
  };
}

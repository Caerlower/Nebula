import {
  PoolMetadata,
  PoolV2,
  TokenMetadata,
  type Reserve,
} from "@blend-capital/blend-sdk";

import {
  formatBlendRate,
  field,
  formatContractReference,
  linkField,
  section,
} from "../lib/format-output.js";
import { getNetworkConfig } from "../config.js";
import { stellarExpertContractUrl } from "../lib/explorer.js";
import {
  getBlendPoolsForNetwork,
  getBlendSdkNetwork,
  type BlendPoolConfig,
} from "./config.js";

export interface ReserveRate {
  symbol: string;
  assetId: string;
  supplyApy: string;
  supplyApr: string;
  borrowApy: string;
  borrowApr: string;
  utilization: string;
}

export interface PoolRatesResult {
  pool: BlendPoolConfig;
  poolName: string;
  reserves: ReserveRate[];
}

export type BlendRatesResponse =
  | { ok: true; network: string; pools: PoolRatesResult[]; errors: string[] }
  | { ok: false; error: string };

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
    supplyApy: formatBlendRate(reserve.estSupplyApy),
    supplyApr: formatBlendRate(reserve.supplyApr),
    borrowApy: formatBlendRate(reserve.estBorrowApy),
    borrowApr: formatBlendRate(reserve.borrowApr),
    utilization: formatBlendRate(reserve.getUtilizationFloat()),
  };
}

async function loadPoolRates(
  pool: BlendPoolConfig,
): Promise<PoolRatesResult> {
  const network = getBlendSdkNetwork();
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

export async function fetchBlendSupplyRates(): Promise<BlendRatesResponse> {
  const pools = getBlendPoolsForNetwork();

  if (pools.length === 0) {
    return {
      ok: false,
      error:
        "No Blend pools are configured for this network. Rate checks are available on testnet only.",
    };
  }

  const network = getBlendSdkNetwork();
  const results: PoolRatesResult[] = [];
  const errors: string[] = [];

  for (const pool of pools) {
    try {
      results.push(await loadPoolRates(pool));
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
    network: network.passphrase.includes("Test") ? "testnet" : "mainnet",
    pools: results,
    errors,
  };
}

export function formatBlendRatesResponse(response: Extract<
  BlendRatesResponse,
  { ok: true }
>): string {
  const network = getNetworkConfig().name;
  const lines: string[] = [
    `Nebula · Blend supply rates`,
    `Network: ${response.network}`,
    `Source: Blend SDK (Soroban RPC)`,
  ];

  for (const pool of response.pools) {
    lines.push(
      section(pool.poolName),
      ...formatContractReference(network, pool.pool.poolId, "Pool"),
      "",
      "Reserves:",
    );

    for (const reserve of pool.reserves) {
      lines.push(
        "",
        `  ${reserve.symbol}`,
        field("Supply APY", reserve.supplyApy),
        field("Supply APR", reserve.supplyApr),
        field("Borrow APY", reserve.borrowApy),
        field("Utilization", reserve.utilization),
        field("Asset", reserve.assetId),
        linkField(
          "Asset explorer",
          stellarExpertContractUrl(network, reserve.assetId),
        ),
      );
    }
  }

  if (response.errors.length > 0) {
    lines.push(section("Warnings"));
    for (const error of response.errors) {
      lines.push(`  • ${error}`);
    }
  }

  return lines.join("\n").trim();
}

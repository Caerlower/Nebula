import { PoolV2 } from "@blend-capital/blend-sdk";

import { fetchBalances } from "../stellar";
import {
  type BlendAsset,
  type HubNetwork,
  blendAssetId,
  getBlendPoolsForNetwork,
  getBlendSdkNetwork,
  resolvePool,
  supportedBlendAssets,
  xlmFeeBuffer,
} from "./config";

export interface BlendPositionRow {
  id: string;
  pool: string;
  poolId: string;
  asset: BlendAsset;
  deposited: number;
  apyPct: number;
}

export interface TreasuryBalances {
  liquid: number;
  blendDeposited: number;
  /** Sum of USDC collateral across pools (mainnet). */
  blendUsdcDeposited: number;
  supplyApy: number | null;
  rawNativeXlm: number;
  feeBuffer: number;
  poolId: string;
  poolName: string;
  positions: BlendPositionRow[];
}

export async function getNativeXlmBalance(
  publicKey: string,
  network: HubNetwork,
): Promise<number> {
  const balances = await fetchBalances(publicKey, network);
  for (const balance of balances) {
    if (balance.asset === "XLM") {
      return Number(balance.balance);
    }
  }
  return 0;
}

export async function getLiquidUsdc(
  publicKey: string,
  network: HubNetwork,
): Promise<number> {
  const balances = await fetchBalances(publicKey, network);
  for (const balance of balances) {
    if (balance.asset === "USDC" || balance.asset.startsWith("USDC:")) {
      return Number(balance.balance);
    }
  }
  return 0;
}

export async function getLiquidXlm(
  publicKey: string,
  network: HubNetwork,
): Promise<{ liquid: number; rawNativeXlm: number; feeBuffer: number }> {
  const feeBuffer = xlmFeeBuffer();
  const rawNativeXlm = await getNativeXlmBalance(publicKey, network);
  return {
    liquid: Math.max(0, rawNativeXlm - feeBuffer),
    rawNativeXlm,
    feeBuffer,
  };
}

export async function getBlendDeposited(
  publicKey: string,
  network: HubNetwork,
  asset: BlendAsset,
  poolId?: string | null,
): Promise<{ deposited: number; supplyApy: number | null }> {
  const poolCfg = resolvePool(network, poolId);
  if (!poolCfg) {
    return { deposited: 0, supplyApy: null };
  }

  const blendNetwork = getBlendSdkNetwork(network);
  const pool = await PoolV2.load(blendNetwork, poolCfg.poolId);
  const reserve = pool.reserves.get(blendAssetId(network, asset));

  if (!reserve) {
    return { deposited: 0, supplyApy: null };
  }

  try {
    const poolUser = await pool.loadUser(publicKey);
    return {
      deposited: poolUser.getCollateralFloat(reserve),
      supplyApy: reserve.estSupplyApy,
    };
  } catch {
    return { deposited: 0, supplyApy: reserve.estSupplyApy };
  }
}

export async function getBlendDepositedXlm(
  publicKey: string,
  network: HubNetwork,
  poolId?: string | null,
): Promise<{ deposited: number; supplyApy: number | null }> {
  return getBlendDeposited(publicKey, network, "XLM", poolId);
}

/** Non-zero collateral positions across every configured pool × asset. */
export async function listBlendPositions(
  publicKey: string,
  network: HubNetwork,
): Promise<BlendPositionRow[]> {
  const blendNetwork = getBlendSdkNetwork(network);
  const assets = supportedBlendAssets(network);
  const rows: BlendPositionRow[] = [];

  for (const poolCfg of getBlendPoolsForNetwork(network)) {
    try {
      const pool = await PoolV2.load(blendNetwork, poolCfg.poolId);
      let poolUser: Awaited<ReturnType<typeof pool.loadUser>> | null = null;
      try {
        poolUser = await pool.loadUser(publicKey);
      } catch {
        poolUser = null;
      }

      for (const asset of assets) {
        const reserve = pool.reserves.get(blendAssetId(network, asset));
        if (!reserve) continue;
        const deposited = poolUser
          ? poolUser.getCollateralFloat(reserve)
          : 0;
        if (deposited <= 0 && !(reserve.estSupplyApy > 0)) {
          // Still surface zero rows only when deposited — skip empty.
          if (deposited <= 0) continue;
        }
        if (deposited <= 0) continue;
        rows.push({
          id: `${poolCfg.poolId}:${asset}`,
          pool: poolCfg.name,
          poolId: poolCfg.poolId,
          asset,
          deposited,
          apyPct: Number.isFinite(reserve.estSupplyApy)
            ? reserve.estSupplyApy * 100
            : 0,
        });
      }
    } catch {
      // Skip pools that fail to load; others may still succeed.
    }
  }

  return rows;
}

export async function getTreasuryBalances(
  publicKey: string,
  network: HubNetwork,
): Promise<TreasuryBalances> {
  const poolCfg = resolvePool(network);
  const [liquidInfo, xlmPosition, positions] = await Promise.all([
    getLiquidXlm(publicKey, network),
    getBlendDeposited(publicKey, network, "XLM", poolCfg?.poolId),
    listBlendPositions(publicKey, network),
  ]);

  const blendUsdcDeposited = positions
    .filter((p) => p.asset === "USDC")
    .reduce((sum, p) => sum + p.deposited, 0);

  // Prefer summing XLM across pools when multi-pool positions exist.
  const blendXlmFromPositions = positions
    .filter((p) => p.asset === "XLM")
    .reduce((sum, p) => sum + p.deposited, 0);
  const blendDeposited =
    blendXlmFromPositions > 0 ? blendXlmFromPositions : xlmPosition.deposited;

  return {
    liquid: liquidInfo.liquid,
    blendDeposited,
    blendUsdcDeposited,
    supplyApy: xlmPosition.supplyApy,
    rawNativeXlm: liquidInfo.rawNativeXlm,
    feeBuffer: liquidInfo.feeBuffer,
    poolId: poolCfg?.poolId ?? "",
    poolName: poolCfg?.name ?? "Blend",
    positions,
  };
}

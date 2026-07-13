import { PoolV2 } from "@blend-capital/blend-sdk";

import { fetchBalances } from "../stellar";
import {
  BLEND_TESTNET_POOL,
  BLEND_TESTNET_XLM_ASSET,
  xlmFeeBuffer,
  getBlendSdkNetwork,
} from "./config";

export interface TreasuryBalances {
  liquid: number;
  blendDeposited: number;
  supplyApy: number | null;
  rawNativeXlm: number;
  feeBuffer: number;
  poolId: string;
  poolName: string;
}

export async function getNativeXlmBalance(
  publicKey: string,
  network: "testnet" | "mainnet",
): Promise<number> {
  const balances = await fetchBalances(publicKey, network);
  for (const balance of balances) {
    if (balance.asset === "XLM") {
      return Number(balance.balance);
    }
  }
  return 0;
}

export async function getLiquidXlm(
  publicKey: string,
  network: "testnet" | "mainnet",
): Promise<{ liquid: number; rawNativeXlm: number; feeBuffer: number }> {
  const feeBuffer = xlmFeeBuffer();
  const rawNativeXlm = await getNativeXlmBalance(publicKey, network);
  return {
    liquid: Math.max(0, rawNativeXlm - feeBuffer),
    rawNativeXlm,
    feeBuffer,
  };
}

export async function getBlendDepositedXlm(
  publicKey: string,
  network: "testnet" | "mainnet",
): Promise<{ deposited: number; supplyApy: number | null }> {
  if (network !== "testnet") {
    return { deposited: 0, supplyApy: null };
  }

  const blendNetwork = getBlendSdkNetwork(network);
  const pool = await PoolV2.load(blendNetwork, BLEND_TESTNET_POOL.poolId);
  const reserve = pool.reserves.get(BLEND_TESTNET_XLM_ASSET);

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

export async function getTreasuryBalances(
  publicKey: string,
  network: "testnet" | "mainnet",
): Promise<TreasuryBalances> {
  const [liquidInfo, blendPosition] = await Promise.all([
    getLiquidXlm(publicKey, network),
    getBlendDepositedXlm(publicKey, network),
  ]);

  return {
    liquid: liquidInfo.liquid,
    blendDeposited: blendPosition.deposited,
    supplyApy: blendPosition.supplyApy,
    rawNativeXlm: liquidInfo.rawNativeXlm,
    feeBuffer: liquidInfo.feeBuffer,
    poolId: BLEND_TESTNET_POOL.poolId,
    poolName: BLEND_TESTNET_POOL.name,
  };
}

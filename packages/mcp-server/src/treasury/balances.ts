import { PoolV2 } from "@blend-capital/blend-sdk";

import {
  BLEND_TESTNET_POOL,
  BLEND_TESTNET_USDC_ISSUER,
  getBlendSdkNetwork,
} from "../blend/config.js";
import { getNetworkConfig } from "../config.js";
import { fetchAccountBalances } from "../wallet.js";
import {
  getTreasuryAssetConfig,
  type TreasuryAssetConfig,
} from "./asset.js";

export interface TreasuryBalances {
  asset: TreasuryAssetConfig;
  liquid: number;
  blendDeposited: number;
  supplyApy: number | null;
  /** Raw native XLM before fee buffer (xlm treasury only). */
  rawNativeXlm?: number;
  /** Circle faucet USDC — not usable in Blend (shown for status only). */
  circleUsdc?: number;
}

export async function getNativeXlmBalance(publicKey: string): Promise<number> {
  const network = getNetworkConfig();
  const balances = await fetchAccountBalances(publicKey, network);

  if (!balances.ok) {
    return 0;
  }

  for (const balance of balances.balances) {
    if (balance.asset_type === "native") {
      return Number(balance.balance);
    }
  }

  return 0;
}

export async function getBlendLiquidUsdcBalance(
  publicKey: string,
): Promise<number> {
  const network = getNetworkConfig();
  const balances = await fetchAccountBalances(publicKey, network);

  if (!balances.ok) {
    return 0;
  }

  for (const balance of balances.balances) {
    if (
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === "USDC" &&
      balance.asset_issuer === BLEND_TESTNET_USDC_ISSUER
    ) {
      return Number(balance.balance);
    }
  }

  return 0;
}

export async function getCircleUsdcBalance(publicKey: string): Promise<number> {
  const network = getNetworkConfig();
  const balances = await fetchAccountBalances(publicKey, network);

  if (!balances.ok || !network.usdcIssuer) {
    return 0;
  }

  for (const balance of balances.balances) {
    if (
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === "USDC" &&
      balance.asset_issuer === network.usdcIssuer
    ) {
      return Number(balance.balance);
    }
  }

  return 0;
}

export async function getLiquidBalance(
  publicKey: string,
  asset: TreasuryAssetConfig,
): Promise<number> {
  if (asset.id === "xlm") {
    const native = await getNativeXlmBalance(publicKey);
    return Math.max(0, native - asset.feeBuffer);
  }

  return getBlendLiquidUsdcBalance(publicKey);
}

export async function getBlendDepositedBalance(
  publicKey: string,
  asset: TreasuryAssetConfig,
): Promise<{ deposited: number; supplyApy: number | null }> {
  const blendNetwork = getBlendSdkNetwork();
  const pool = await PoolV2.load(blendNetwork, BLEND_TESTNET_POOL.poolId);
  const reserve = pool.reserves.get(asset.reserveContract);

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

/** @deprecated Use getBlendLiquidUsdcBalance for treasury */
export async function getLiquidUsdcBalance(publicKey: string): Promise<number> {
  return getBlendLiquidUsdcBalance(publicKey);
}

/** @deprecated Use getBlendDepositedBalance */
export async function getBlendUsdcPosition(
  publicKey: string,
): Promise<{ supplied: number; supplyApy: number | null }> {
  const asset = getTreasuryAssetConfig();
  const position = await getBlendDepositedBalance(publicKey, asset);
  return { supplied: position.deposited, supplyApy: position.supplyApy };
}

export async function getTreasuryBalances(
  publicKey: string,
): Promise<TreasuryBalances> {
  const asset = getTreasuryAssetConfig();
  const [liquid, blendPosition, circleUsdc, rawNativeXlm] = await Promise.all([
    getLiquidBalance(publicKey, asset),
    getBlendDepositedBalance(publicKey, asset),
    asset.id === "usdc" ? getCircleUsdcBalance(publicKey) : Promise.resolve(0),
    asset.id === "xlm" ? getNativeXlmBalance(publicKey) : Promise.resolve(undefined),
  ]);

  return {
    asset,
    liquid,
    blendDeposited: blendPosition.deposited,
    supplyApy: blendPosition.supplyApy,
    rawNativeXlm,
    circleUsdc: asset.id === "usdc" ? circleUsdc : undefined,
  };
}

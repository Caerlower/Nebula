import { Networks } from "@stellar/stellar-sdk";
import type { Network } from "@blend-capital/blend-sdk";

export interface BlendPoolConfig {
  name: string;
  poolId: string;
  backstopId: string;
}

export type BlendAsset = "XLM" | "USDC";
export type HubNetwork = "testnet" | "mainnet";

/**
 * Official Blend v2 deployments from blend-capital/blend-utils
 * (testnet.contracts.json / mainnet.contracts.json).
 */

/** Blend SAC XLM on testnet */
export const BLEND_TESTNET_XLM_ASSET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/** Blend SAC USDC on testnet */
export const BLEND_TESTNET_USDC_ASSET =
  "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU";

/** Blend SAC XLM on mainnet (native wrapped) */
export const BLEND_MAINNET_XLM_ASSET =
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";

/** Circle USDC SAC on mainnet (same id as blend-utils / Circle) */
export const BLEND_MAINNET_USDC_ASSET =
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75";

export const BLEND_TESTNET_POOLS: BlendPoolConfig[] = [
  {
    name: "TestnetV2",
    poolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
    backstopId: "CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA",
  },
];

/**
 * Mainnet: both Fixed + YieldBlox (each has XLM and USDC reserves).
 * Default treasury pool = Fixed.
 */
export const BLEND_MAINNET_POOLS: BlendPoolConfig[] = [
  {
    name: "Fixed",
    poolId: "CAJJZSGMMM3PD7N33TAPHGBUGTB43OC73HVIK2L2G6BNGGGYOSSYBXBD",
    backstopId: "CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7",
  },
  {
    name: "YieldBlox",
    poolId: "CCCCIQSDILITHMM7PBSLVDT5MISSY7R26MNZXCX4H7J5JQ5FPIYOGYFS",
    backstopId: "CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7",
  },
];

export const BLEND_TESTNET_POOL = BLEND_TESTNET_POOLS[0]!;
export const BLEND_MAINNET_POOL = BLEND_MAINNET_POOLS[0]!;

const DEFAULT_XLM_FEE_BUFFER = 5;

export function xlmFeeBuffer(): number {
  const raw = process.env.XLM_FEE_BUFFER?.trim();
  if (!raw) return DEFAULT_XLM_FEE_BUFFER;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_XLM_FEE_BUFFER;
  return value;
}

/** Testnet: XLM only. Mainnet: XLM + USDC. */
export function supportedBlendAssets(network: HubNetwork): BlendAsset[] {
  return network === "mainnet" ? ["XLM", "USDC"] : ["XLM"];
}

export function assertBlendAssetSupported(
  network: HubNetwork,
  asset: BlendAsset,
): void {
  if (!supportedBlendAssets(network).includes(asset)) {
    throw new Error(
      `blend_asset_unsupported: ${asset} is not available on ${network} (mainnet supports XLM+USDC; testnet is XLM-only)`,
    );
  }
}

export function blendAssetId(network: HubNetwork, asset: BlendAsset): string {
  if (asset === "USDC") {
    return network === "mainnet"
      ? BLEND_MAINNET_USDC_ASSET
      : BLEND_TESTNET_USDC_ASSET;
  }
  return network === "mainnet"
    ? BLEND_MAINNET_XLM_ASSET
    : BLEND_TESTNET_XLM_ASSET;
}

export function blendXlmAsset(network: HubNetwork): string {
  return blendAssetId(network, "XLM");
}

export function getBlendSdkNetwork(
  network: HubNetwork = "testnet",
): Network {
  if (network === "mainnet") {
    return {
      rpc: "https://mainnet.sorobanrpc.com",
      passphrase: Networks.PUBLIC,
    };
  }
  return {
    rpc: "https://soroban-testnet.stellar.org",
    passphrase: Networks.TESTNET,
  };
}

export function getBlendPoolsForNetwork(
  network: HubNetwork,
): BlendPoolConfig[] {
  return network === "mainnet" ? BLEND_MAINNET_POOLS : BLEND_TESTNET_POOLS;
}

/** Resolve pool_id / name; default = first pool for that network. */
export function resolvePool(
  network: HubNetwork,
  poolId?: string | null,
): BlendPoolConfig | null {
  const pools = getBlendPoolsForNetwork(network);
  if (pools.length === 0) return null;
  if (!poolId) return pools[0]!;
  const match = pools.find(
    (p) => p.poolId === poolId || p.name.toLowerCase() === poolId.toLowerCase(),
  );
  return match ?? pools[0]!;
}

/** Stellar / Blend amounts use 7 decimal places (1 stroop = 1e-7). */
const STROOP = 1e7;

export function roundXlm(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * STROOP) / STROOP;
}

/** Floor to 7 decimals so we never request more than a float can hold. */
export function floorXlm(amount: number): number {
  if (!Number.isFinite(amount)) return 0;
  return Math.floor(amount * STROOP + 1e-9) / STROOP;
}

export const roundBlendAmount = roundXlm;
export const floorBlendAmount = floorXlm;

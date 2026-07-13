import { Networks } from "@stellar/stellar-sdk";
import type { Network } from "@blend-capital/blend-sdk";

export interface BlendPoolConfig {
  name: string;
  poolId: string;
  backstopId: string;
}

/** Blend SAC XLM on testnet (from blend-utils/testnet.contracts.json) */
export const BLEND_TESTNET_XLM_ASSET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/** Official testnet deployment from blend-capital/blend-utils testnet.contracts.json */
export const BLEND_TESTNET_POOLS: BlendPoolConfig[] = [
  {
    name: "TestnetV2",
    poolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
    backstopId: "CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA",
  },
];

export const BLEND_TESTNET_POOL = BLEND_TESTNET_POOLS[0]!;

const DEFAULT_XLM_FEE_BUFFER = 5;

export function xlmFeeBuffer(): number {
  const raw = process.env.XLM_FEE_BUFFER?.trim();
  if (!raw) return DEFAULT_XLM_FEE_BUFFER;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_XLM_FEE_BUFFER;
  return value;
}

export function getBlendSdkNetwork(
  network: "testnet" | "mainnet" = "testnet",
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
  network: "testnet" | "mainnet",
): BlendPoolConfig[] {
  if (network === "testnet") return BLEND_TESTNET_POOLS;
  return [];
}

/** Resolve pool_id to a known pool; default TestnetV2 when omitted. */
export function resolvePool(
  network: "testnet" | "mainnet",
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

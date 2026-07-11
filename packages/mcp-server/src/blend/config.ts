import { Networks } from "@stellar/stellar-sdk";

import { getNetworkConfig, type NetworkName } from "../config.js";
import type { Network } from "@blend-capital/blend-sdk";

export interface BlendPoolConfig {
  name: string;
  poolId: string;
  backstopId: string;
}

/** Blend SAC XLM on testnet (from blend-utils/testnet.contracts.json) */
export const BLEND_TESTNET_XLM_ASSET =
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

/** Blend SAC USDC on testnet (from blend-utils/testnet.contracts.json) */
export const BLEND_TESTNET_USDC_ASSET =
  "CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU";

/** Classic issuer backing the Blend testnet USDC SAC (NOT Circle's GBBD... issuer) */
export const BLEND_TESTNET_USDC_ISSUER =
  "GATALTGTWIOT6BUDBCZM3Q4OQ4BO2COLOAZ7IYSKPLC2PMSOPPGF5V56";

/** Official testnet deployment from blend-capital/blend-utils testnet.contracts.json */
export const BLEND_TESTNET_POOLS: BlendPoolConfig[] = [
  {
    name: "TestnetV2",
    poolId: "CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF",
    backstopId: "CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA",
  },
];

export const BLEND_TESTNET_POOL = BLEND_TESTNET_POOLS[0]!;

const RPC_URLS: Record<NetworkName, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://mainnet.sorobanrpc.com",
};

export function getBlendSdkNetwork(): Network {
  const config = getNetworkConfig();
  return {
    rpc: RPC_URLS[config.name],
    passphrase: config.networkPassphrase,
  };
}

export function getBlendPoolsForNetwork(): BlendPoolConfig[] {
  const config = getNetworkConfig();
  if (config.name === "testnet") {
    return BLEND_TESTNET_POOLS;
  }
  return [];
}

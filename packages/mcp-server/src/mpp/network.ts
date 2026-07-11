import {
  NETWORK_PASSPHRASE,
  SOROBAN_RPC_URLS,
  STELLAR_PUBNET,
  STELLAR_TESTNET,
  USDC_SAC_MAINNET,
  USDC_SAC_TESTNET,
  type NetworkId,
} from "@stellar/mpp";

import { getNetworkConfig, type NetworkConfig } from "../config.js";

export function getMppNetworkId(network: NetworkConfig): NetworkId {
  return network.name === "mainnet" ? STELLAR_PUBNET : STELLAR_TESTNET;
}

export function getMppRpcUrl(networkId: NetworkId): string {
  return SOROBAN_RPC_URLS[networkId];
}

export function getMppNetworkPassphrase(networkId: NetworkId): string {
  return NETWORK_PASSPHRASE[networkId];
}

export function getMppUsdcSac(network: NetworkConfig): string {
  return network.name === "mainnet" ? USDC_SAC_MAINNET : USDC_SAC_TESTNET;
}

export function loadMppNetwork(): { ok: true; network: NetworkConfig; networkId: NetworkId }
  | { ok: false; error: string } {
  try {
    const network = getNetworkConfig();
    return { ok: true, network, networkId: getMppNetworkId(network) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

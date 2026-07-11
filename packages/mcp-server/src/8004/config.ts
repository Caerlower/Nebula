import {
  MAINNET_CONFIG,
  TESTNET_CONFIG,
  type StellarConfig,
} from "@trionlabs/stellar8004";

import type { NetworkConfig } from "../config.js";

const EXPLORER_BASE_URL =
  process.env.STELLAR8004_EXPLORER_URL?.trim() ?? "https://stellar8004.com";

export function get8004Config(network: NetworkConfig): StellarConfig {
  return network.name === "mainnet" ? MAINNET_CONFIG : TESTNET_CONFIG;
}

export function get8004ExplorerUrl(): string {
  return EXPLORER_BASE_URL;
}

export const STELLAR8004_TESTNET_CONTRACTS = TESTNET_CONFIG.contracts;
export const STELLAR8004_MAINNET_CONTRACTS = MAINNET_CONFIG.contracts;

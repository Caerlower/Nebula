import {
  MAINNET_CONFIG,
  TESTNET_CONFIG,
  type StellarConfig,
} from "@trionlabs/stellar8004";

export type HubNetwork = "testnet" | "mainnet";

const EXPLORER_BASE_URL =
  process.env.STELLAR8004_EXPLORER_URL?.trim() ?? "https://stellar8004.com";

export function hubNetwork(): HubNetwork {
  return process.env.STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

export function get8004Config(network: HubNetwork = hubNetwork()): StellarConfig {
  return network === "mainnet" ? MAINNET_CONFIG : TESTNET_CONFIG;
}

export function get8004ExplorerUrl(): string {
  return EXPLORER_BASE_URL.replace(/\/$/, "");
}

export function stellar8004WebAgentUrl(agentId: number): string {
  return `${get8004ExplorerUrl()}/agents/${agentId}`;
}

export function stellarExpertAccountUrl(
  network: HubNetwork,
  address: string,
): string {
  const segment = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${segment}/account/${address}`;
}

export function stellarExpertTxUrl(network: HubNetwork, hash: string): string {
  const segment = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${segment}/tx/${hash}`;
}

export function stellarExpertContractUrl(
  network: HubNetwork,
  contractId: string,
): string {
  const segment = network === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${segment}/contract/${contractId}`;
}

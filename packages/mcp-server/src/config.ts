import { Networks } from "@stellar/stellar-sdk";

export type NetworkName = "testnet" | "mainnet";

export interface NetworkConfig {
  name: NetworkName;
  horizonUrl: string;
  networkPassphrase: string;
  friendbotUrl: string | null;
}

const NETWORKS: Record<NetworkName, NetworkConfig> = {
  testnet: {
    name: "testnet",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    name: "mainnet",
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: Networks.PUBLIC,
    friendbotUrl: null,
  },
};

export function getNetworkConfig(): NetworkConfig {
  const network = (process.env.NETWORK ?? "testnet").trim().toLowerCase();

  if (network !== "testnet" && network !== "mainnet") {
    throw new Error(
      `Invalid NETWORK "${process.env.NETWORK}". Use "testnet" or "mainnet".`,
    );
  }

  return NETWORKS[network];
}

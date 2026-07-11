import type { NetworkName } from "../config.js";

function stellarExpertSegment(network: NetworkName): "testnet" | "public" {
  return network === "mainnet" ? "public" : "testnet";
}

export function stellarExpertAccountUrl(
  network: NetworkName,
  address: string,
): string {
  return `https://stellar.expert/explorer/${stellarExpertSegment(network)}/account/${address}`;
}

export function stellarExpertTxUrl(network: NetworkName, hash: string): string {
  return `https://stellar.expert/explorer/${stellarExpertSegment(network)}/tx/${hash}`;
}

export function stellarExpertContractUrl(
  network: NetworkName,
  contractId: string,
): string {
  return `https://stellar.expert/explorer/${stellarExpertSegment(network)}/contract/${contractId}`;
}

export function stellarLabFundUrl(address: string): string {
  return `https://lab.stellar.org/account/fund?network=test&addr=${address}`;
}

export function friendbotUrl(friendbotBase: string, address: string): string {
  return `${friendbotBase}?addr=${address}`;
}

export function stellar8004WebAgentUrl(agentId: number): string {
  return `https://stellar8004.com/agents/${agentId}`;
}

export function stellar8004NetworkWarning(network: NetworkName): string | null {
  if (network === "testnet") {
    return [
      "stellar8004.com indexes MAINNET agents by default.",
      "Do not use stellar8004.com/agents/{id} to verify testnet registrations.",
      "Use the StellarExpert testnet links instead.",
    ].join(" ");
  }

  return null;
}

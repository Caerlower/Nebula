import type { NetworkConfig, NetworkName } from "../config.js";
import {
  friendbotUrl,
  stellarExpertAccountUrl,
  stellarExpertContractUrl,
  stellarExpertTxUrl,
  stellarLabFundUrl,
} from "./explorer.js";

/** Blend SDK rates are decimal fractions where 1.0 = 100% (e.g. 3.04 → 304% APY). */
export function formatBlendRate(rate: number, decimals = 2): string {
  if (!Number.isFinite(rate)) {
    return "—";
  }
  return `${(rate * 100).toFixed(decimals)}%`;
}

export function section(title: string): string {
  return `\n── ${title} ──`;
}

export function field(label: string, value: string): string {
  return `  ${label}: ${value}`;
}

export function linkField(label: string, url: string): string {
  return field(label, url);
}

export function formatNetworkHeader(
  network: NetworkName,
  title: string,
): string[] {
  return [`Nebula · ${title}`, `Network: ${network}`];
}

export function formatWalletBlock(
  network: NetworkName,
  address: string,
): string[] {
  return [
    ...formatNetworkHeader(network, "Wallet"),
    field("Address", address),
    linkField("Explorer", stellarExpertAccountUrl(network, address)),
  ];
}

export function formatFundingInstructions(
  network: NetworkConfig,
  address: string,
): string {
  const lines = [...formatWalletBlock(network.name, address)];

  if (network.name === "testnet" && network.friendbotUrl) {
    lines.push(
      section("Fund on testnet"),
      field("Friendbot (XLM)", friendbotUrl(network.friendbotUrl, address)),
      linkField("Stellar Lab", stellarLabFundUrl(address)),
      "",
      "USDC (x402 / MPP):",
      "  1. Add a Circle USDC trustline to this wallet",
      "  2. Claim at https://faucet.circle.com/ (Stellar testnet)",
      field("USDC issuer", network.usdcIssuer ?? "not configured"),
    );
  } else {
    lines.push(
      section("Fund wallet"),
      "Send native XLM or USDC to the address above.",
    );
    if (network.usdcIssuer) {
      lines.push(field("USDC issuer", network.usdcIssuer));
    }
    lines.push("", "After funding, run wallet_dashboard or check_balance.");
  }

  return lines.join("\n").trim();
}

export function formatTransferSuccess(parameters: {
  network: NetworkName;
  asset: string;
  amount: string;
  destination: string;
  hash: string;
}): string {
  return [
    ...formatNetworkHeader(parameters.network, "Transfer complete"),
    field("Asset", parameters.asset),
    field("Amount", parameters.amount),
    field("To", parameters.destination),
    field("Tx hash", parameters.hash),
    linkField(
      "Explorer",
      stellarExpertTxUrl(parameters.network, parameters.hash),
    ),
  ].join("\n");
}

export function formatTxReference(
  network: NetworkName,
  hash: string,
  label = "Tx",
): string[] {
  return [
    field(`${label} hash`, hash),
    linkField("Explorer", stellarExpertTxUrl(network, hash)),
  ];
}

export function formatContractReference(
  network: NetworkName,
  contractId: string,
  label = "Contract",
): string[] {
  return [
    field(label, contractId),
    linkField("Explorer", stellarExpertContractUrl(network, contractId)),
  ];
}

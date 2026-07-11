import type { NetworkConfig } from "../config.js";
import { get8004Config } from "./config.js";
import type { RegisterIdentityResult } from "./identity.js";
import type { MyReputationResult } from "./reputation.js";
import {
  stellar8004NetworkWarning,
  stellar8004WebAgentUrl,
  stellarExpertAccountUrl,
  stellarExpertContractUrl,
  stellarExpertTxUrl,
} from "./links.js";

export function formatRegisterIdentityResult(
  result: Extract<RegisterIdentityResult, { ok: true }>,
  network: NetworkConfig,
): string {
  const config = get8004Config(network);
  const lines = [
    result.alreadyRegistered
      ? "8004 identity already registered for this wallet."
      : "8004 identity registered on-chain.",
    `Network: ${network.name}`,
    `Agent ID: ${result.agentId} (${network.name} namespace)`,
    `Owner: ${result.owner}`,
    `Identity contract: ${config.contracts.identity}`,
    `Reputation contract: ${config.contracts.reputation}`,
    "",
    `StellarExpert (${network.name}):`,
    `  Owner: ${stellarExpertAccountUrl(network.name, result.owner)}`,
    `  Identity contract: ${stellarExpertContractUrl(network.name, config.contracts.identity)}`,
  ];

  if (result.txHash) {
    lines.push(
      `  Registration tx: ${stellarExpertTxUrl(network.name, result.txHash)}`,
    );
  }

  if (result.explorerUnavailable) {
    lines.push(
      "",
      "Note: Stellar8004 explorer API is currently unavailable; identity was verified on-chain.",
    );
  }

  const webWarning = stellar8004NetworkWarning(network.name);
  if (webWarning) {
    lines.push(
      "",
      `Warning: ${webWarning}`,
      `  (Mainnet page for reference only: ${stellar8004WebAgentUrl(result.agentId)})`,
    );
  } else {
    lines.push("", `Stellar8004 web: ${stellar8004WebAgentUrl(result.agentId)}`);
  }

  return lines.join("\n");
}

export function formatMyReputationResult(
  result: Extract<MyReputationResult, { ok: true }>,
  network: NetworkConfig,
): string {
  const lines = [
    `Network: ${network.name}`,
    `Agent ID: ${result.agentId} (${network.name} namespace)`,
    `Owner: ${result.owner}`,
    `Feedback count: ${result.feedbackCount}`,
    `Average score: ${result.averageScore ?? "n/a"}`,
    `Total score: ${result.totalScore ?? "n/a"}`,
    `Unique clients: ${result.uniqueClients}`,
    `Data source: ${result.source}`,
    "",
    `StellarExpert (${network.name}):`,
    `  Owner: ${stellarExpertAccountUrl(network.name, result.owner)}`,
  ];

  if (result.explorerUnavailable) {
    lines.push(
      "",
      "Note: Stellar8004 explorer API is currently unavailable; reputation was read on-chain.",
    );
  }

  const webWarning = stellar8004NetworkWarning(network.name);
  if (webWarning) {
    lines.push("", `Warning: ${webWarning}`);
  }

  return lines.join("\n");
}

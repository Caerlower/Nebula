import type { NetworkConfig } from "../config.js";
import type { PolicyStatus } from "./status.js";
import {
  field,
  formatContractReference,
  formatNetworkHeader,
  linkField,
  section,
} from "../lib/format-output.js";
import { stellarExpertAccountUrl } from "../lib/explorer.js";

export function formatPolicyStatus(
  status: PolicyStatus,
  network: NetworkConfig,
): string {
  const lines = [
    ...formatNetworkHeader(network.name, "On-chain policy"),
    ...formatContractReference(network.name, status.contractId, "Contract"),
    field("Owner", status.owner),
    linkField("Owner explorer", stellarExpertAccountUrl(network.name, status.owner)),
    section("Limits"),
    field("Per-call limit", String(status.maxPerCall)),
    field("Daily limit", String(status.maxPerDay)),
    field("Spent (rolling window)", String(status.dailySpent)),
    field("Remaining today", String(status.dailyRemaining)),
    field("Window", `${status.periodLedgers} ledgers (~24h)`),
    field("Spend history entries", String(status.historyLen)),
  ];

  return lines.join("\n");
}

export function formatDeployPolicyResult(parameters: {
  contractId: string;
  wasmHash: string;
  owner: string;
  maxPerCall: number;
  maxPerDay: number;
  network: NetworkConfig;
}): string {
  return [
    ...formatNetworkHeader(parameters.network.name, "Policy deployed"),
    ...formatContractReference(
      parameters.network.name,
      parameters.contractId,
      "Contract ID",
    ),
    field("WASM hash", parameters.wasmHash),
    field("Owner", parameters.owner),
    field("Per-call limit", String(parameters.maxPerCall)),
    field("Daily limit", String(parameters.maxPerDay)),
    section("Next step"),
    "Add to your MCP environment:",
    `  POLICY_CONTRACT_ID=${parameters.contractId}`,
  ].join("\n");
}

export function formatSetPolicyLimitsResult(parameters: {
  maxPerCall: number;
  maxPerDay: number;
  contractId: string;
  network: NetworkConfig;
}): string {
  return [
    ...formatNetworkHeader(parameters.network.name, "Policy limits updated"),
    ...formatContractReference(
      parameters.network.name,
      parameters.contractId,
      "Contract",
    ),
    field("Per-call limit", String(parameters.maxPerCall)),
    field("Daily limit", String(parameters.maxPerDay)),
    "",
    "Limits take effect immediately (no redeploy).",
  ].join("\n");
}

import { StrKey } from "@stellar/stellar-sdk";

import type { NetworkConfig } from "../config.js";
import { getMppNetworkId, getMppRpcUrl, getMppNetworkPassphrase } from "../mpp/network.js";

/** SHA-256 of bundled `contracts/policy.wasm` (nebula-policy). */
export const POLICY_WASM_HASH =
  "602234ec2f170f5c3b728ea0e788c9067a839940dcc59ecec68c3d3aecfd8088";

/** User's verified testnet deployment (2026-04). Set via POLICY_CONTRACT_ID in .env. */
export const POLICY_TESTNET_EXAMPLE_ID =
  "CDAXOPVILENGGLPU3CNOOS53P255PUAVODI4EAJC6A4VIZQT3BAMVTXP";

export function getPolicyContractId(): string | null {
  const raw = process.env.POLICY_CONTRACT_ID?.trim();
  return raw || null;
}

export function loadPolicyContractId():
  | { ok: true; contractId: string }
  | { ok: false; error: string } {
  const contractId = getPolicyContractId();
  if (!contractId) {
    return {
      ok: false,
      error:
        "POLICY_CONTRACT_ID is not set. Deploy with deploy_policy or set it in the MCP environment.",
    };
  }

  if (!StrKey.isValidContract(contractId)) {
    return {
      ok: false,
      error: `POLICY_CONTRACT_ID "${contractId}" is not a valid Stellar contract address (C...).`,
    };
  }

  return { ok: true, contractId };
}

export function isPolicyEnabled(): boolean {
  const contractId = getPolicyContractId();
  return contractId !== null && StrKey.isValidContract(contractId);
}

export function getPolicyRpcConfig(network: NetworkConfig): {
  rpcUrl: string;
  networkPassphrase: string;
} {
  const networkId = getMppNetworkId(network);
  return {
    rpcUrl: getMppRpcUrl(networkId),
    networkPassphrase: getMppNetworkPassphrase(networkId),
  };
}

import type { Keypair } from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";

import type { NetworkConfig } from "../config.js";
import { Client } from "./bindings/src/index.js";
import { getPolicyRpcConfig, loadPolicyContractId } from "./config.js";

export type PolicyClientResult =
  | { ok: true; client: Client; contractId: string }
  | { ok: false; error: string };

export function createPolicyClient(
  keypair: Keypair,
  network: NetworkConfig,
  contractId?: string,
): PolicyClientResult {
  const resolvedId = contractId ?? loadPolicyContractId();
  if (typeof resolvedId === "object" && !resolvedId.ok) {
    return resolvedId;
  }

  const id = typeof resolvedId === "string" ? resolvedId : resolvedId.contractId;
  const { rpcUrl, networkPassphrase } = getPolicyRpcConfig(network);
  const publicKey = keypair.publicKey();
  const { signTransaction } = basicNodeSigner(keypair, networkPassphrase);

  const client = new Client({
    contractId: id,
    rpcUrl,
    networkPassphrase,
    publicKey,
    signTransaction,
  });

  return { ok: true, client, contractId: id };
}

export function formatPolicyError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (/PerCallLimitExceeded|#5/i.test(message)) {
      return "On-chain policy rejected the spend: per-call limit exceeded.";
    }
    if (/DailyLimitExceeded|#6/i.test(message)) {
      return "On-chain policy rejected the spend: daily limit exceeded.";
    }
    if (/Unauthorized|#3/i.test(message)) {
      return "On-chain policy rejected the call: wallet is not the policy owner.";
    }
    if (/NotInitialized|#1/i.test(message)) {
      return "Policy contract is not initialized. Call deploy_policy or initialize it on-chain.";
    }
    return message;
  }

  return error instanceof Error ? error.message : String(error);
}

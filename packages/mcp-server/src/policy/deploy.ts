import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  Keypair,
  Operation,
  rpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { basicNodeSigner } from "@stellar/stellar-sdk/contract";

import type { NetworkConfig } from "../config.js";
import { pollRpcTransaction } from "../mpp/deploy.js";
import { toUsdcAmount } from "../utils/amount.js";
import { Client } from "./bindings/src/index.js";
import { createPolicyClient, formatPolicyError } from "./client.js";
import { getPolicyRpcConfig } from "./config.js";
import { resolvePolicyWasmPath } from "./wasm-path.js";

const DEPLOY_FEE = "1000000";

export type DeployPolicyResult =
  | {
      ok: true;
      contractId: string;
      wasmHash: string;
      owner: string;
      maxPerCall: number;
      maxPerDay: number;
    }
  | { ok: false; error: string };

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function uploadPolicyWasm(
  keypair: Keypair,
  network: NetworkConfig,
  wasm: Buffer,
): Promise<{ ok: true; hash: string } | { ok: false; error: string }> {
  const { rpcUrl, networkPassphrase } = getPolicyRpcConfig(network);
  const server = new rpc.Server(rpcUrl);

  try {
    const source = await server.getAccount(keypair.publicKey());
    const transaction = new TransactionBuilder(source, {
      fee: DEPLOY_FEE,
      networkPassphrase,
    })
      .addOperation(Operation.uploadContractWasm({ wasm }))
      .setTimeout(180)
      .build();

    const prepared = await server.prepareTransaction(transaction);
    prepared.sign(keypair);
    const sendResponse = await server.sendTransaction(prepared);

    if (sendResponse.status === "ERROR") {
      return {
        ok: false,
        error:
          sendResponse.errorResult?.toXDR("base64") ??
          "Policy WASM upload rejected.",
      };
    }

    const confirmation = await pollRpcTransaction(rpcUrl, sendResponse.hash);
    if (!confirmation.ok) {
      return confirmation;
    }

    const hash = createHash("sha256").update(wasm).digest("hex");
    return { ok: true, hash };
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }
}

export async function deployAndInitializePolicy(parameters: {
  keypair: Keypair;
  network: NetworkConfig;
  maxPerCall: number;
  maxPerDay: number;
}): Promise<DeployPolicyResult> {
  const wasmResolved = resolvePolicyWasmPath();
  if (!wasmResolved.ok) {
    return wasmResolved;
  }

  let wasm: Buffer;
  try {
    wasm = readFileSync(wasmResolved.path);
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }

  const upload = await uploadPolicyWasm(parameters.keypair, parameters.network, wasm);
  if (!upload.ok) {
    return { ok: false, error: `WASM upload failed: ${upload.error}` };
  }

  const { rpcUrl, networkPassphrase } = getPolicyRpcConfig(parameters.network);
  const owner = parameters.keypair.publicKey();
  const { signTransaction } = basicNodeSigner(parameters.keypair, networkPassphrase);

  try {
    const deployTx = await Client.deploy({
      wasmHash: upload.hash,
      rpcUrl,
      networkPassphrase,
      publicKey: owner,
    });

    const deployed = await deployTx.signAndSend({ signTransaction });
    if (deployed.sendTransactionResponse?.status === "ERROR") {
      return {
        ok: false,
        error:
          deployed.sendTransactionResponse.errorResult?.toXDR("base64") ??
          "Policy deploy submission rejected.",
      };
    }

    const contractId = deployed.result?.options?.contractId;
    if (!contractId) {
      return {
        ok: false,
        error:
          "Policy deploy succeeded but no contract ID was returned. Check the deploy tx on Stellar Expert.",
      };
    }

    const clientResult = createPolicyClient(
      parameters.keypair,
      parameters.network,
      contractId,
    );
    if (!clientResult.ok) {
      return clientResult;
    }

    const initTx = await clientResult.client.initialize({
      owner,
      max_per_call: toUsdcAmount(parameters.maxPerCall),
      max_per_day: toUsdcAmount(parameters.maxPerDay),
    });
    const initialized = await initTx.signAndSend({ signTransaction });
    if (initialized.sendTransactionResponse?.status === "ERROR") {
      return {
        ok: false,
        error:
          initialized.sendTransactionResponse.errorResult?.toXDR("base64") ??
          "Policy initialize rejected.",
      };
    }

    return {
      ok: true,
      contractId,
      wasmHash: upload.hash,
      owner,
      maxPerCall: parameters.maxPerCall,
      maxPerDay: parameters.maxPerDay,
    };
  } catch (error) {
    return { ok: false, error: `Policy deploy failed: ${formatPolicyError(error)}` };
  }
}

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import {
  Address,
  Keypair,
  Operation,
  rpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import {
  basicNodeSigner,
  Client as SorobanClient,
} from "@stellar/stellar-sdk/contract";

import type { NetworkId } from "@stellar/mpp";

import {
  getMppNetworkPassphrase,
  getMppRpcUrl,
  getMppUsdcSac,
} from "./network.js";
import type { NetworkConfig } from "../config.js";
import { resolveChannelWasmPath } from "./wasm-path.js";

const REFUND_WAITING_PERIOD = 100;
const DEPLOY_FEE = "1000000";

export type DeployChannelResult =
  | { ok: true; contractId: string; wasmHash: string }
  | { ok: false; error: string };

function resolveWasmPath(): { ok: true; path: string } | { ok: false; error: string } {
  const resolved = resolveChannelWasmPath();
  if (!resolved.ok) {
    return resolved;
  }
  return { ok: true, path: resolved.path };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function submitSorobanOperation(
  keypair: Keypair,
  networkPassphrase: string,
  rpcUrl: string,
  buildOperation: () => ReturnType<typeof Operation.uploadContractWasm>,
  fee = DEPLOY_FEE,
): Promise<{ ok: true; hash: string } | { ok: false; error: string }> {
  const server = new rpc.Server(rpcUrl);

  try {
    const source = await server.getAccount(keypair.publicKey());
    const transaction = new TransactionBuilder(source, {
      fee,
      networkPassphrase,
    })
      .addOperation(buildOperation())
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
          "Soroban transaction submission rejected.",
      };
    }

    const confirmation = await pollRpcTransaction(rpcUrl, sendResponse.hash);
    if (!confirmation.ok) {
      return confirmation;
    }

    return { ok: true, hash: sendResponse.hash };
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }
}

export async function deployPaymentChannel(parameters: {
  keypair: Keypair;
  network: NetworkConfig;
  networkId: NetworkId;
  recipient: string;
  budgetStroops: bigint;
  commitmentPubkeyHex: string;
}): Promise<DeployChannelResult> {
  const wasmResolved = resolveWasmPath();
  if (!wasmResolved.ok) {
    return wasmResolved;
  }

  const rpcUrl = getMppRpcUrl(parameters.networkId);
  const networkPassphrase = getMppNetworkPassphrase(parameters.networkId);
  const tokenSac = getMppUsdcSac(parameters.network);
  const source = parameters.keypair.publicKey();

  let wasm: Buffer;
  try {
    wasm = readFileSync(wasmResolved.path);
  } catch (error) {
    return { ok: false, error: formatError(error) };
  }

  const wasmHash = createHash("sha256").update(wasm).digest();

  const upload = await submitSorobanOperation(
    parameters.keypair,
    networkPassphrase,
    rpcUrl,
    () => Operation.uploadContractWasm({ wasm }),
  );
  if (!upload.ok) {
    return { ok: false, error: `WASM upload failed: ${upload.error}` };
  }

  try {
    const { signTransaction } = basicNodeSigner(
      parameters.keypair,
      networkPassphrase,
    );

    const deployTx = await SorobanClient.deploy(
      {
        token: new Address(tokenSac),
        from: new Address(source),
        commitment_key: Buffer.from(parameters.commitmentPubkeyHex, "hex"),
        to: new Address(parameters.recipient),
        amount: parameters.budgetStroops,
        refund_waiting_period: REFUND_WAITING_PERIOD,
      },
      {
        rpcUrl,
        networkPassphrase,
        publicKey: source,
        wasmHash,
      },
    );

    const sent = await deployTx.signAndSend({ signTransaction });
    if (sent.sendTransactionResponse?.status === "ERROR") {
      return {
        ok: false,
        error:
          sent.sendTransactionResponse.errorResult?.toXDR("base64") ??
          "Channel deploy submission rejected.",
      };
    }

    const contractId = sent.result?.options?.contractId;
    if (!contractId) {
      return {
        ok: false,
        error:
          "Channel deploy succeeded but no contract ID was returned. Check the deploy tx on Stellar Expert.",
      };
    }

    return {
      ok: true,
      contractId,
      wasmHash: wasmHash.toString("hex"),
    };
  } catch (error) {
    return { ok: false, error: `Channel deploy failed: ${formatError(error)}` };
  }
}

export async function pollRpcTransaction(
  rpcUrl: string,
  hash: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const server = new rpc.Server(rpcUrl);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const result = await server.getTransaction(hash);
    if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { ok: true };
    }
    if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
      return { ok: false, error: "Channel transaction failed on ledger." };
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return { ok: false, error: "Timed out waiting for channel transaction confirmation." };
}

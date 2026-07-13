import { createHash } from "crypto";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import {
  Address,
  Contract,
  Keypair,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import { Client as SorobanClient } from "@stellar/stellar-sdk/contract";
import type { NetworkId } from "@stellar/mpp";
import { stellar } from "@stellar/mpp/channel/client";
import { Mppx } from "mppx/client";

import { privyRawSignHash } from "@/lib/auth";
import { signAndSubmitSorobanWithPrivy } from "@/lib/stellar";

import type { HubMppSession } from "./session";
import {
  getMppNetworkPassphrase,
  getMppRpcUrl,
  getMppUsdcSac,
  updateMppCumulative,
} from "./session";

export class MppBudgetExceededError extends Error {
  constructor(
    public readonly cumulativeStroops: bigint,
    public readonly budgetStroops: bigint,
  ) {
    super(
      `MPP payment blocked: cumulative ${cumulativeStroops} stroops would exceed budget ${budgetStroops}.`,
    );
    this.name = "MppBudgetExceededError";
  }
}

/** Thrown on challenge so Hub can run policy gates before signing. */
export class MppChallengePendingError extends Error {
  constructor(
    public readonly cumulativeStroops: bigint,
    public readonly deltaStroops: bigint,
  ) {
    super(
      `MPP challenge pending policy gate: cumulative ${cumulativeStroops} stroops (delta ${deltaStroops}).`,
    );
    this.name = "MppChallengePendingError";
  }
}

export class MppPolicyRejectedError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
    this.name = "MppPolicyRejectedError";
  }
}

export function createMppChannelClient(params: {
  session: HubMppSession;
  networkId: NetworkId;
  /** When set, challenges above this cumulative are rejected until Hub raises it. */
  approvedCumulativeStroops?: bigint;
  /** Persist cumulative only after Hub has gated the spend. */
  persistCumulative?: boolean;
}): ReturnType<typeof Mppx.create> {
  const commitmentKey = Keypair.fromRawEd25519Seed(
    Buffer.from(params.session.commitmentSecretHex, "hex"),
  );
  const approved =
    params.approvedCumulativeStroops ?? params.session.cumulativeStroops;
  const persist = params.persistCumulative ?? false;

  return Mppx.create({
    polyfill: false,
    methods: [
      stellar.channel({
        commitmentKey,
        allowedChannels: [params.session.channel],
        network: params.networkId,
        onProgress(event) {
          if (event.type === "challenge") {
            const cumulative = BigInt(event.cumulativeAmount);
            if (cumulative > params.session.budgetStroops) {
              throw new MppBudgetExceededError(
                cumulative,
                params.session.budgetStroops,
              );
            }
            if (cumulative > approved) {
              const delta = cumulative - params.session.cumulativeStroops;
              throw new MppChallengePendingError(cumulative, delta);
            }
          }

          if (event.type === "signed") {
            const cumulative = BigInt(event.cumulativeAmount);
            params.session.cumulativeStroops = cumulative;
            if (persist) {
              void updateMppCumulative(params.session.id, cumulative);
            }
          }
        },
      }),
    ],
  });
}

export async function mppFetchUrl(params: {
  session: HubMppSession;
  networkId: NetworkId;
  url: string;
  /** Cumulative stroops already approved by Hub policy for this request. */
  approvedCumulativeStroops?: bigint;
  persistCumulative?: boolean;
}): Promise<
  | { ok: true; status: number; body: string; cumulativeStroops: bigint }
  | {
      ok: false;
      error: string;
      pending?: { cumulativeStroops: bigint; deltaStroops: bigint };
    }
> {
  const mppx = createMppChannelClient({
    session: params.session,
    networkId: params.networkId,
    approvedCumulativeStroops: params.approvedCumulativeStroops,
    persistCumulative: params.persistCumulative,
  });

  try {
    const response = await mppx.fetch(params.url);
    const body = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        error: `MPP fetch failed with HTTP ${response.status}: ${body.slice(0, 500)}`,
      };
    }
    return {
      ok: true,
      status: response.status,
      body,
      cumulativeStroops: params.session.cumulativeStroops,
    };
  } catch (error) {
    if (error instanceof MppChallengePendingError) {
      return {
        ok: false,
        error: error.message,
        pending: {
          cumulativeStroops: error.cumulativeStroops,
          deltaStroops: error.deltaStroops,
        },
      };
    }
    if (error instanceof MppBudgetExceededError) {
      return { ok: false, error: error.message };
    }
    if (error instanceof MppPolicyRejectedError) {
      return { ok: false, error: error.message };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Settle channel via contract `close(amount, signature)`, signed by Privy.
 * Commitment key (session) signs prepare_commitment bytes; Hub wallet pays fees.
 */
export async function closeMppChannel(params: {
  channel: string;
  commitmentSecretHex: string;
  walletId: string;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  networkId: NetworkId;
  amountStroops: bigint;
}): Promise<
  | { ok: true; txHash: string; settledStroops: bigint }
  | { ok: false; error: string }
> {
  const commitmentKey = Keypair.fromRawEd25519Seed(
    Buffer.from(params.commitmentSecretHex, "hex"),
  );
  const rpcUrl = getMppRpcUrl(params.networkId);
  const networkPassphrase = getMppNetworkPassphrase(params.networkId);
  const server = new rpc.Server(rpcUrl);
  const contract = new Contract(params.channel);

  try {
    const account = await server.getAccount(params.stellarAddress);
    const simTx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          "prepare_commitment",
          nativeToScVal(params.amountStroops, { type: "i128" }),
        ),
      )
      .setTimeout(180)
      .build();

    const simResult = await server.simulateTransaction(simTx);
    if (!rpc.Api.isSimulationSuccess(simResult)) {
      const detail =
        "error" in simResult && typeof simResult.error === "string"
          ? simResult.error
          : "prepare_commitment simulation failed";
      return { ok: false, error: detail };
    }

    const commitmentBytes = simResult.result?.retval.bytes();
    if (!commitmentBytes) {
      return {
        ok: false,
        error: "prepare_commitment returned no commitment bytes.",
      };
    }

    const signature = commitmentKey.sign(Buffer.from(commitmentBytes));

    const closeAccount = await server.getAccount(params.stellarAddress);
    const closeTx = new TransactionBuilder(closeAccount, {
      fee: "1000000",
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          "close",
          nativeToScVal(params.amountStroops, { type: "i128" }),
          nativeToScVal(Buffer.from(signature), { type: "bytes" }),
        ),
      )
      .setTimeout(180)
      .build();

    const prepared = await server.prepareTransaction(closeTx);
    const txHash = await signAndSubmitSorobanWithPrivy({
      preparedTx: prepared,
      walletId: params.walletId,
      sourceAddress: params.stellarAddress,
      network: params.network,
    });

    return {
      ok: true,
      txHash,
      settledStroops: params.amountStroops,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const REFUND_WAITING_PERIOD = 100;
const DEPLOY_FEE = "1000000";

function channelWasmPath(): string {
  const override = process.env.MPP_CHANNEL_WASM_PATH?.trim();
  if (override) return override;
  // apps/nebula-hub/contracts/channel.wasm
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, "../../../contracts/channel.wasm");
}

function createPrivySignTransaction(params: {
  walletId: string;
  stellarAddress: string;
  networkPassphrase: string;
}) {
  return async (
    xdr: string,
    opts?: { networkPassphrase?: string },
  ): Promise<{ signedTxXdr: string; signerAddress?: string }> => {
    const passphrase = opts?.networkPassphrase || params.networkPassphrase;
    const tx = TransactionBuilder.fromXDR(xdr, passphrase);
    const signatureHex = await privyRawSignHash(
      params.walletId,
      tx.hash().toString("hex"),
    );
    const sigBytes = Buffer.from(
      signatureHex.startsWith("0x") ? signatureHex.slice(2) : signatureHex,
      "hex",
    );
    const hint = Keypair.fromPublicKey(params.stellarAddress).signatureHint();
    const { xdr: xdrNs } = await import("@stellar/stellar-sdk");
    tx.signatures.push(
      new xdrNs.DecoratedSignature({ hint, signature: sigBytes }),
    );
    return {
      signedTxXdr: tx.toXDR(),
      signerAddress: params.stellarAddress,
    };
  };
}

export async function deployPaymentChannel(params: {
  walletId: string;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  networkId: NetworkId;
  recipient: string;
  budgetStroops: bigint;
  commitmentPubkeyHex: string;
}): Promise<
  | { ok: true; contractId: string; wasmHash: string }
  | { ok: false; error: string }
> {
  const rpcUrl = getMppRpcUrl(params.networkId);
  const networkPassphrase = getMppNetworkPassphrase(params.networkId);
  const tokenSac = getMppUsdcSac(params.network);
  const server = new rpc.Server(rpcUrl);

  let wasm: Buffer;
  try {
    wasm = readFileSync(channelWasmPath());
  } catch (error) {
    return {
      ok: false,
      error: `channel.wasm missing: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const wasmHash = createHash("sha256").update(wasm).digest();

  try {
    const source = await server.getAccount(params.stellarAddress);
    const uploadTx = new TransactionBuilder(source, {
      fee: DEPLOY_FEE,
      networkPassphrase,
    })
      .addOperation(Operation.uploadContractWasm({ wasm }))
      .setTimeout(180)
      .build();

    const preparedUpload = await server.prepareTransaction(uploadTx);
    await signAndSubmitSorobanWithPrivy({
      preparedTx: preparedUpload,
      walletId: params.walletId,
      sourceAddress: params.stellarAddress,
      network: params.network,
    });
  } catch (error) {
    // Upload may already exist for this wasm hash — continue to deploy.
    const message = error instanceof Error ? error.message : String(error);
    if (!/already|exist|duplicate/i.test(message)) {
      // Still try deploy; some networks return odd errors on re-upload.
      console.warn("[mpp] wasm upload:", message);
    }
  }

  try {
    const signTransaction = createPrivySignTransaction({
      walletId: params.walletId,
      stellarAddress: params.stellarAddress,
      networkPassphrase,
    });

    const deployTx = await SorobanClient.deploy(
      {
        token: new Address(tokenSac),
        from: new Address(params.stellarAddress),
        commitment_key: Buffer.from(params.commitmentPubkeyHex, "hex"),
        to: new Address(params.recipient),
        amount: params.budgetStroops,
        refund_waiting_period: REFUND_WAITING_PERIOD,
      },
      {
        rpcUrl,
        networkPassphrase,
        publicKey: params.stellarAddress,
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
          "Channel deploy succeeded but no contract ID was returned. Check Stellar Expert.",
      };
    }

    return {
      ok: true,
      contractId,
      wasmHash: wasmHash.toString("hex"),
    };
  } catch (error) {
    return {
      ok: false,
      error: `Channel deploy failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

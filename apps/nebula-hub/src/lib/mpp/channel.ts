import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
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

import type { HashSigner } from "@/lib/signing";
import { signAndSubmitSoroban } from "@/lib/stellar";

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
 * Settle / reclaim a channel as the **funder** (Nebula agent wallet).
 *
 * The contract's `close(amount, sig)` requires the *recipient* (`to`) to auth —
 * which we never have. Funder reclaim is: `close_start` → wait refund period →
 * `refund`. See stellar-experimental/one-way-channel.
 */
export async function closeStartMppChannel(params: {
  channel: string;
  signer: HashSigner;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  networkId: NetworkId;
}): Promise<{ ok: true; txHash: string } | { ok: false; error: string }> {
  const rpcUrl = getMppRpcUrl(params.networkId);
  const networkPassphrase = getMppNetworkPassphrase(params.networkId);
  const server = new rpc.Server(rpcUrl);
  const contract = new Contract(params.channel);

  try {
    const account = await server.getAccount(params.stellarAddress);
    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase,
    })
      .addOperation(contract.call("close_start"))
      .setTimeout(180)
      .build();

    const prepared = await server.prepareTransaction(tx);
    const txHash = await signAndSubmitSoroban({
      preparedTx: prepared,
      signer: params.signer,
      sourceAddress: params.stellarAddress,
      network: params.network,
    });
    return { ok: true, txHash };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Already past effective close — treat as ready for refund.
    if (/AlreadyClosed|already.?closed/i.test(message)) {
      return { ok: true, txHash: "already_closed" };
    }
    return { ok: false, error: `mpp_close_start_failed: ${message}` };
  }
}

export async function refundMppChannel(params: {
  channel: string;
  signer: HashSigner;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  networkId: NetworkId;
}): Promise<{ ok: true; txHash: string } | { ok: false; error: string }> {
  const rpcUrl = getMppRpcUrl(params.networkId);
  const networkPassphrase = getMppNetworkPassphrase(params.networkId);
  const server = new rpc.Server(rpcUrl);
  const contract = new Contract(params.channel);

  try {
    const account = await server.getAccount(params.stellarAddress);
    const tx = new TransactionBuilder(account, {
      fee: "1000000",
      networkPassphrase,
    })
      .addOperation(contract.call("refund"))
      .setTimeout(180)
      .build();

    const prepared = await server.prepareTransaction(tx);
    const txHash = await signAndSubmitSoroban({
      preparedTx: prepared,
      signer: params.signer,
      sourceAddress: params.stellarAddress,
      network: params.network,
    });
    return { ok: true, txHash };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/RefundWaitingPeriodNotElapsed|waiting.?period/i.test(message)) {
      return {
        ok: false,
        error:
          "mpp_refund_waiting: close was started but the on-chain waiting period has not elapsed yet. Call mpp_close_session again in about a minute.",
      };
    }
    if (/NotClosed|not.?closed/i.test(message)) {
      return {
        ok: false,
        error:
          "mpp_not_closed: call mpp_close_session once to start close, then again after the waiting period to refund.",
      };
    }
    return { ok: false, error: `mpp_refund_failed: ${message}` };
  }
}

/** @deprecated Use closeStartMppChannel + refundMppChannel (funder path). */
export async function closeMppChannel(params: {
  channel: string;
  commitmentSecretHex: string;
  signer: HashSigner;
  stellarAddress: string;
  network: "testnet" | "mainnet";
  networkId: NetworkId;
  amountStroops: bigint;
}): Promise<
  | { ok: true; txHash: string; settledStroops: bigint }
  | { ok: false; error: string }
> {
  // Kept for type compatibility; funder cannot call contract.close (needs recipient auth).
  void params.commitmentSecretHex;
  void params.amountStroops;
  const started = await closeStartMppChannel(params);
  if (!started.ok) return started;
  const refunded = await refundMppChannel(params);
  if (!refunded.ok) return refunded;
  return {
    ok: true,
    txHash: refunded.txHash,
    settledStroops: 0n,
  };
}

const REFUND_WAITING_PERIOD = 5; // ledgers (~25s on testnet) — short so one close can finish in-session
const DEPLOY_FEE = "1000000";

/**
 * Resolve channel.wasm for MPP deploy.
 *
 * On Vercel, `import.meta.url` points at a bundled chunk under `.next/server`,
 * so a relative path from there misses the file. Prefer `process.cwd()` (the
 * traced app root where outputFileTracingIncludes places the wasm).
 */
function channelWasmPath(): string {
  const override = process.env.MPP_CHANNEL_WASM_PATH?.trim();
  if (override) return override;

  const fromModule = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../contracts/channel.wasm",
  );
  const candidates = [
    join(process.cwd(), "contracts/channel.wasm"),
    // Monorepo local / mis-set cwd
    join(process.cwd(), "apps/nebula-hub/contracts/channel.wasm"),
    fromModule,
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return candidates[0]!;
}

function createSignerSignTransaction(params: {
  signer: HashSigner;
  stellarAddress: string;
  networkPassphrase: string;
}) {
  return async (
    xdr: string,
    opts?: { networkPassphrase?: string },
  ): Promise<{ signedTxXdr: string; signerAddress?: string }> => {
    const passphrase = opts?.networkPassphrase || params.networkPassphrase;
    const tx = TransactionBuilder.fromXDR(xdr, passphrase);
    const signatureHex = await params.signer.signHash(
      tx.hash().toString("hex"),
      { unsignedXdr: tx.toXDR(), network: passphrase },
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
  signer: HashSigner;
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
    const wasmPath = channelWasmPath();
    wasm = readFileSync(wasmPath);
  } catch (error) {
    return {
      ok: false,
      error: `channel.wasm missing at ${channelWasmPath()} (cwd=${process.cwd()}): ${error instanceof Error ? error.message : String(error)}`,
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
    await signAndSubmitSoroban({
      preparedTx: preparedUpload,
      signer: params.signer,
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
    const signTransaction = createSignerSignTransaction({
      signer: params.signer,
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

import {
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
} from "@stellar/stellar-sdk";
import { close } from "@stellar/mpp/channel/server";

import type { NetworkId } from "@stellar/mpp";

import {
  getMppNetworkPassphrase,
  getMppRpcUrl,
} from "./network.js";

export type CloseChannelResult =
  | { ok: true; txHash: string; settledStroops: bigint }
  | { ok: false; error: string };

export async function closeMppChannel(parameters: {
  channel: string;
  commitmentSecretHex: string;
  feePayer: Keypair;
  networkId: NetworkId;
  amountStroops: bigint;
}): Promise<CloseChannelResult> {
  const commitmentKey = Keypair.fromRawEd25519Seed(
    Buffer.from(parameters.commitmentSecretHex, "hex"),
  );
  const rpcUrl = getMppRpcUrl(parameters.networkId);
  const networkPassphrase = getMppNetworkPassphrase(parameters.networkId);
  const server = new rpc.Server(rpcUrl);
  const contract = new Contract(parameters.channel);

  try {
    const account = await server.getAccount(parameters.feePayer.publicKey());
    const simTx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          "prepare_commitment",
          nativeToScVal(parameters.amountStroops, { type: "i128" }),
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
    const txHash = await close({
      channel: parameters.channel,
      amount: parameters.amountStroops,
      signature,
      feePayer: { envelopeSigner: parameters.feePayer },
      network: parameters.networkId,
      rpcUrl,
    });

    return {
      ok: true,
      txHash,
      settledStroops: parameters.amountStroops,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

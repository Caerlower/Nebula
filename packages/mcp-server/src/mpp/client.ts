import { Keypair } from "@stellar/stellar-sdk";
import { stellar } from "@stellar/mpp/channel/client";
import { Mppx } from "mppx/client";

import type { NetworkId } from "@stellar/mpp";

import type { NetworkConfig } from "../config.js";
import type { MppSession } from "./session.js";
import { updateSessionCumulative } from "./session.js";
import { isPolicyEnabled } from "../policy/config.js";
import { recordAgentSpend } from "../policy/spending.js";
import { spendingLimitEngine } from "../spending-limits.js";

export class MppBudgetExceededError extends Error {
  constructor(
    public readonly cumulativeStroops: bigint,
    public readonly budgetStroops: bigint,
  ) {
    super(
      `MPP payment blocked: cumulative ${cumulativeStroops} stroops would exceed the session budget of ${budgetStroops} stroops.`,
    );
    this.name = "MppBudgetExceededError";
  }
}

export function createMppChannelClient(parameters: {
  commitmentSecretHex: string;
  channel: string;
  networkId: NetworkId;
  budgetStroops: bigint;
  session: MppSession;
  keypair: Keypair;
  network: NetworkConfig;
}): ReturnType<typeof Mppx.create> {
  const commitmentKey = Keypair.fromRawEd25519Seed(
    Buffer.from(parameters.commitmentSecretHex, "hex"),
  );

  return Mppx.create({
    polyfill: false,
    methods: [
      stellar.channel({
        commitmentKey,
        allowedChannels: [parameters.channel],
        network: parameters.networkId,
        onProgress(event) {
          if (event.type === "challenge") {
            const cumulative = BigInt(event.cumulativeAmount);
            if (cumulative > parameters.budgetStroops) {
              throw new MppBudgetExceededError(
                cumulative,
                parameters.budgetStroops,
              );
            }
          }

          if (event.type === "signed") {
            const cumulative = BigInt(event.cumulativeAmount);
            const previous = parameters.session.cumulativeStroops;
            const deltaStroops = cumulative - previous;
            if (deltaStroops > 0n) {
              const deltaUsdc = Number(deltaStroops) / 10_000_000;
              if (isPolicyEnabled()) {
                void recordAgentSpend(
                  parameters.keypair,
                  parameters.network,
                  deltaUsdc,
                  "USDC",
                ).catch(() => {
                  // Best-effort on-chain record; session cumulative still updates.
                });
              } else {
                spendingLimitEngine.recordTransfer(deltaUsdc, "USDC");
              }
            }
            updateSessionCumulative(parameters.session, cumulative);
          }
        },
      }),
    ],
  });
}

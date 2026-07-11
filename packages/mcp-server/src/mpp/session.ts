import { Keypair } from "@stellar/stellar-sdk";
import { randomBytes } from "node:crypto";
import type { Mppx } from "mppx/client";

import type { NetworkId } from "@stellar/mpp";

import type { NetworkName } from "../config.js";
import {
  field,
  formatContractReference,
  linkField,
  section,
} from "../lib/format-output.js";
import { stellarExpertAccountUrl } from "../lib/explorer.js";

export interface MppSession {
  channel: string;
  recipient: string;
  budgetUsdc: number;
  budgetStroops: bigint;
  cumulativeStroops: bigint;
  commitmentSecretHex: string;
  commitmentPubkeyHex: string;
  openedAt: string;
  networkId: NetworkId;
  mppx: ReturnType<typeof Mppx.create>;
}

let activeSession: MppSession | null = null;

export function getActiveMppSession(): MppSession | null {
  return activeSession;
}

export function requireActiveMppSession():
  | { ok: true; session: MppSession }
  | { ok: false; error: string } {
  if (!activeSession) {
    return {
      ok: false,
      error:
        "No MPP session is open. Call mpp_open_session first (only one session at a time).",
    };
  }

  return { ok: true, session: activeSession };
}

export function setActiveMppSession(session: MppSession): void {
  if (activeSession) {
    throw new Error(
      "An MPP session is already open. Call mpp_close_session before opening another.",
    );
  }
  activeSession = session;
}

export function clearActiveMppSession(): void {
  activeSession = null;
}

export function updateSessionCumulative(
  session: MppSession,
  cumulativeStroops: bigint,
): void {
  session.cumulativeStroops = cumulativeStroops;
}

export function formatMppSessionStatus(
  session: MppSession,
  network: NetworkName = "testnet",
): string {
  const spent = Number(session.cumulativeStroops) / 10_000_000;
  const remaining = Math.max(session.budgetUsdc - spent, 0);

  return [
    ...formatContractReference(network, session.channel, "Channel contract"),
    field("Recipient", session.recipient),
    linkField(
      "Recipient explorer",
      stellarExpertAccountUrl(network, session.recipient),
    ),
    section("Budget"),
    field("Session budget", `${session.budgetUsdc} USDC`),
    field(
      "Committed off-chain",
      `${spent.toFixed(7).replace(/\.?0+$/, "")} USDC`,
    ),
    field(
      "Remaining",
      `${remaining.toFixed(7).replace(/\.?0+$/, "")} USDC`,
    ),
    field("Commitment pubkey (hex)", session.commitmentPubkeyHex),
    field("Opened at", session.openedAt),
    section("Next steps"),
    "  • Use mpp_fetch for paid requests (off-chain commitments)",
    "  • Call mpp_close_session to settle on-chain and refund unused deposit",
  ].join("\n");
}

export function generateCommitmentKeypair(): {
  commitmentKey: Keypair;
  secretHex: string;
  pubkeyHex: string;
} {
  const seed = randomBytes(32);
  const commitmentKey = Keypair.fromRawEd25519Seed(seed);
  const pubkeyHex = Buffer.from(commitmentKey.rawPublicKey()).toString("hex");

  return {
    commitmentKey,
    secretHex: seed.toString("hex"),
    pubkeyHex,
  };
}

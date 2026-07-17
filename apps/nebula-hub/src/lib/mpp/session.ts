import { randomBytes } from "crypto";

import {
  NETWORK_PASSPHRASE,
  SOROBAN_RPC_URLS,
  STELLAR_PUBNET,
  STELLAR_TESTNET,
  USDC_SAC_MAINNET,
  USDC_SAC_TESTNET,
  type NetworkId,
} from "@stellar/mpp";
import { Keypair } from "@stellar/stellar-sdk";

import { prisma } from "@/lib/db";

export type HubMppSession = {
  id: string;
  userId: string;
  agentId: string | null;
  channel: string;
  recipient: string;
  budgetUsdc: number;
  budgetStroops: bigint;
  cumulativeStroops: bigint;
  commitmentSecretHex: string;
  commitmentPubkeyHex: string;
  networkId: string;
  status: string;
  openedAt: Date;
};

export function generateCommitmentKeypair(): {
  secretHex: string;
  pubkeyHex: string;
} {
  const seed = randomBytes(32);
  const commitmentKey = Keypair.fromRawEd25519Seed(seed);
  return {
    secretHex: seed.toString("hex"),
    pubkeyHex: Buffer.from(commitmentKey.rawPublicKey()).toString("hex"),
  };
}

function rowToSession(row: {
  id: string;
  userId: string;
  agentId: string | null;
  channel: string;
  recipient: string;
  budgetUsdc: { toString(): string } | number;
  budgetStroops: string;
  cumulativeStroops: string;
  commitmentSecretHex: string;
  commitmentPubkeyHex: string;
  networkId: string;
  status: string;
  openedAt: Date;
}): HubMppSession {
  return {
    id: row.id,
    userId: row.userId,
    agentId: row.agentId,
    channel: row.channel,
    recipient: row.recipient,
    budgetUsdc: Number(row.budgetUsdc),
    budgetStroops: BigInt(row.budgetStroops),
    cumulativeStroops: BigInt(row.cumulativeStroops),
    commitmentSecretHex: row.commitmentSecretHex,
    commitmentPubkeyHex: row.commitmentPubkeyHex,
    networkId: row.networkId,
    status: row.status,
    openedAt: row.openedAt,
  };
}

export async function getOpenMppSession(
  userId: string,
  agentId?: string | null,
): Promise<HubMppSession | null> {
  const row = await prisma.mppSession.findFirst({
    // Scope to the agent (null = owner-level) so each agent has its own channel.
    where: { userId, agentId: agentId ?? null, status: "open" },
    orderBy: { openedAt: "desc" },
  });
  return row ? rowToSession(row) : null;
}

export async function requireOpenMppSession(
  userId: string,
  agentId?: string | null,
): Promise<
  { ok: true; session: HubMppSession } | { ok: false; error: string }
> {
  const session = await getOpenMppSession(userId, agentId);
  if (!session) {
    return {
      ok: false,
      error:
        "No MPP session is open. Call mpp_open_session first (one session at a time).",
    };
  }
  return { ok: true, session };
}

export async function createMppSession(data: {
  userId: string;
  agentId?: string | null;
  channel: string;
  recipient: string;
  budgetUsdc: number;
  budgetStroops: bigint;
  commitmentSecretHex: string;
  commitmentPubkeyHex: string;
  networkId: string;
  deployWasmHash?: string;
}): Promise<HubMppSession> {
  const existing = await getOpenMppSession(data.userId, data.agentId);
  if (existing) {
    throw new Error(
      "An MPP session is already open. Call mpp_close_session before opening another.",
    );
  }

  const row = await prisma.mppSession.create({
    data: {
      userId: data.userId,
      agentId: data.agentId ?? null,
      channel: data.channel,
      recipient: data.recipient,
      budgetUsdc: data.budgetUsdc,
      budgetStroops: data.budgetStroops.toString(),
      cumulativeStroops: "0",
      commitmentSecretHex: data.commitmentSecretHex,
      commitmentPubkeyHex: data.commitmentPubkeyHex,
      networkId: data.networkId,
      status: "open",
      deployWasmHash: data.deployWasmHash,
    },
  });
  return rowToSession(row);
}

export async function updateMppCumulative(
  sessionId: string,
  cumulativeStroops: bigint,
): Promise<void> {
  await prisma.mppSession.update({
    where: { id: sessionId },
    data: { cumulativeStroops: cumulativeStroops.toString() },
  });
}

export async function markMppSessionClosed(params: {
  sessionId: string;
  closeTxHash: string;
}): Promise<void> {
  await prisma.mppSession.update({
    where: { id: params.sessionId },
    data: {
      status: "closed",
      closedAt: new Date(),
      closeTxHash: params.closeTxHash,
    },
  });
}

export function getMppNetworkId(
  network: "testnet" | "mainnet",
): NetworkId {
  return network === "mainnet" ? STELLAR_PUBNET : STELLAR_TESTNET;
}

export function getMppRpcUrl(networkId: NetworkId): string {
  return SOROBAN_RPC_URLS[networkId];
}

export function getMppNetworkPassphrase(networkId: NetworkId): string {
  return NETWORK_PASSPHRASE[networkId];
}

export function getMppUsdcSac(network: "testnet" | "mainnet"): string {
  return network === "mainnet" ? USDC_SAC_MAINNET : USDC_SAC_TESTNET;
}

export function usdcToStroops(amountUsdc: number): bigint {
  return BigInt(Math.round(amountUsdc * 10_000_000));
}

export function stroopsToUsdc(stroops: bigint): number {
  return Number(stroops) / 10_000_000;
}

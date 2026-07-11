import {
  ExplorerClient,
  NotFoundError,
  buildMetadataJson,
  formatSorobanError,
} from "@trionlabs/stellar8004";
import { DataUriStorage } from "@trionlabs/stellar8004/storage/data-uri";
import type { Keypair } from "@stellar/stellar-sdk";

import type { NetworkConfig } from "../config.js";
import { create8004Clients } from "./client.js";
import { get8004ExplorerUrl } from "./config.js";
import {
  findAgentIdOnChain,
  isExplorerUnavailableError,
} from "./onchain.js";

export type RegisterIdentityResult =
  | {
      ok: true;
      alreadyRegistered: boolean;
      agentId: number;
      owner: string;
      txHash: string | null;
      explorerUrl: string;
      lookupSource: "explorer" | "onchain";
      explorerUnavailable?: boolean;
    }
  | { ok: false; error: string };

export type AgentLookupResult =
  | {
      ok: true;
      agentId: number;
      owner: string;
      source: "explorer" | "onchain";
    }
  | { ok: false; notRegistered: true; explorerUnavailable?: boolean }
  | { ok: false; notRegistered: false; error: string };

function explorerClient(): ExplorerClient {
  return new ExplorerClient(get8004ExplorerUrl());
}

async function lookupAgentByOwnerOnChain(
  keypair: Keypair,
  network: NetworkConfig,
  publicKey: string,
): Promise<AgentLookupResult> {
  const clients = create8004Clients(keypair, network);
  const onChain = await findAgentIdOnChain(clients, publicKey);

  if (onChain.ok) {
    return {
      ok: true,
      agentId: onChain.agentId,
      owner: publicKey,
      source: "onchain",
    };
  }

  if (onChain.notRegistered) {
    return { ok: false, notRegistered: true };
  }

  return { ok: false, notRegistered: false, error: onChain.error };
}

export async function lookupAgentByOwner(
  keypair: Keypair,
  network: NetworkConfig,
  publicKey: string,
): Promise<AgentLookupResult> {
  let explorerUnavailable = false;

  try {
    const response = await explorerClient().getAgentsByAddress(publicKey);
    const agents = response.data ?? [];

    if (agents.length === 0) {
      return lookupAgentByOwnerOnChain(keypair, network, publicKey);
    }

    const agent = agents[0];
    return {
      ok: true,
      agentId: agent.id,
      owner: agent.owner,
      source: "explorer",
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return lookupAgentByOwnerOnChain(keypair, network, publicKey);
    }

    if (isExplorerUnavailableError(error)) {
      explorerUnavailable = true;
      const onChain = await lookupAgentByOwnerOnChain(
        keypair,
        network,
        publicKey,
      );

      if (onChain.ok) {
        return onChain;
      }

      if (onChain.notRegistered) {
        return { ok: false, notRegistered: true, explorerUnavailable };
      }

      return onChain;
    }

    return {
      ok: false,
      notRegistered: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildAgentMetadata(publicKey: string) {
  const name = process.env.AGENT8004_NAME?.trim() || "Nebula Agent";
  const description =
    process.env.AGENT8004_DESCRIPTION?.trim() ||
    `Autonomous Stellar agent wallet (${publicKey.slice(0, 8)}…).`;

  return buildMetadataJson({
    name,
    description,
    imageUrl: process.env.AGENT8004_IMAGE_URL?.trim() || "",
    services: [],
    supportedTrust: ["reputation"],
    x402Enabled: true,
  });
}

export async function registerAgentIdentity(
  keypair: Keypair,
  network: NetworkConfig,
): Promise<RegisterIdentityResult> {
  const publicKey = keypair.publicKey();

  const existing = await lookupAgentByOwner(keypair, network, publicKey);
  if (existing.ok) {
    return {
      ok: true,
      alreadyRegistered: true,
      agentId: existing.agentId,
      owner: existing.owner,
      txHash: null,
      explorerUrl: `${get8004ExplorerUrl()}/agents/${existing.agentId}`,
      lookupSource: existing.source,
    };
  }

  if (!existing.notRegistered) {
    return { ok: false, error: existing.error };
  }

  try {
    const { identity } = create8004Clients(keypair, network);
    const storage = new DataUriStorage();
    const metadata = buildAgentMetadata(publicKey);
    const agentUri = await storage.upload(metadata);

    const tx = await identity.register_with_uri({
      caller: publicKey,
      agent_uri: agentUri,
    });
    const sent = await tx.signAndSend();
    const agentId = Number(sent.result);

    if (!Number.isFinite(agentId) || agentId <= 0) {
      return {
        ok: false,
        error:
          "Registration transaction succeeded but no agent ID was returned.",
      };
    }

    return {
      ok: true,
      alreadyRegistered: false,
      agentId,
      owner: publicKey,
      txHash: sent.sendTransactionResponse?.hash ?? null,
      explorerUrl: `${get8004ExplorerUrl()}/agents/${agentId}`,
      lookupSource: "onchain",
      explorerUnavailable: existing.explorerUnavailable,
    };
  } catch (error) {
    const message = formatSorobanError(error);

    if (/already|exist|registered/i.test(message)) {
      const retryLookup = await lookupAgentByOwner(keypair, network, publicKey);
      if (retryLookup.ok) {
        return {
          ok: true,
          alreadyRegistered: true,
          agentId: retryLookup.agentId,
          owner: retryLookup.owner,
          txHash: null,
          explorerUrl: `${get8004ExplorerUrl()}/agents/${retryLookup.agentId}`,
          lookupSource: retryLookup.source,
        };
      }
    }

    return {
      ok: false,
      error: message,
    };
  }
}

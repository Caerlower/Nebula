import {
  ExplorerClient,
  NotFoundError,
  buildMetadataJson,
  formatSorobanError,
} from "@trionlabs/stellar8004";
import { DataUriStorage } from "@trionlabs/stellar8004/storage/data-uri";

import { create8004Clients, type Privy8004Wallet } from "./wallet";
import {
  get8004Config,
  get8004ExplorerUrl,
  stellar8004WebAgentUrl,
  stellarExpertAccountUrl,
  stellarExpertContractUrl,
  stellarExpertTxUrl,
} from "./config";
import {
  findAgentIdOnChain,
  isExplorerUnavailableError,
} from "./onchain";

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
  wallet: Privy8004Wallet,
): Promise<AgentLookupResult> {
  const clients = create8004Clients(wallet);
  const onChain = await findAgentIdOnChain(
    clients,
    wallet.publicKey,
    wallet.cachedAgentId,
  );

  if (onChain.ok) {
    return {
      ok: true,
      agentId: onChain.agentId,
      owner: wallet.publicKey,
      source: "onchain",
    };
  }

  if (onChain.notRegistered) {
    return { ok: false, notRegistered: true };
  }

  return { ok: false, notRegistered: false, error: onChain.error };
}

export async function lookupAgentByOwner(
  wallet: Privy8004Wallet,
): Promise<AgentLookupResult> {
  let explorerUnavailable = false;

  try {
    const response = await explorerClient().getAgentsByAddress(wallet.publicKey);
    const agents = response.data ?? [];

    if (agents.length === 0) {
      return lookupAgentByOwnerOnChain(wallet);
    }

    const agent = agents[0];
    if (!agent) {
      return lookupAgentByOwnerOnChain(wallet);
    }
    return {
      ok: true,
      agentId: agent.id,
      owner: agent.owner,
      source: "explorer",
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      return lookupAgentByOwnerOnChain(wallet);
    }

    if (isExplorerUnavailableError(error)) {
      explorerUnavailable = true;
      const onChain = await lookupAgentByOwnerOnChain(wallet);

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

export type RegisterMetadataHints = {
  name?: string;
  description?: string;
};

function buildAgentMetadata(
  publicKey: string,
  hints?: RegisterMetadataHints,
) {
  const name =
    hints?.name?.trim() ||
    process.env.AGENT8004_NAME?.trim() ||
    "Nebula Agent";
  const description =
    hints?.description?.trim() ||
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
  wallet: Privy8004Wallet,
  hints?: RegisterMetadataHints,
): Promise<RegisterIdentityResult> {
  const existing = await lookupAgentByOwner(wallet);
  if (existing.ok) {
    return {
      ok: true,
      alreadyRegistered: true,
      agentId: existing.agentId,
      owner: existing.owner,
      txHash: null,
      explorerUrl: stellar8004WebAgentUrl(existing.agentId),
      lookupSource: existing.source,
    };
  }

  if (!existing.notRegistered) {
    return { ok: false, error: existing.error };
  }

  try {
    const { identity } = create8004Clients(wallet);
    const storage = new DataUriStorage();
    const metadata = buildAgentMetadata(wallet.publicKey, hints);
    const agentUri = await storage.upload(metadata);

    const tx = await identity.register_with_uri({
      caller: wallet.publicKey,
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
      owner: wallet.publicKey,
      txHash: sent.sendTransactionResponse?.hash ?? null,
      explorerUrl: stellar8004WebAgentUrl(agentId),
      lookupSource: "onchain",
      explorerUnavailable: existing.explorerUnavailable,
    };
  } catch (error) {
    const message = formatSorobanError(error);

    if (/already|exist|registered/i.test(message)) {
      const retryLookup = await lookupAgentByOwner(wallet);
      if (retryLookup.ok) {
        return {
          ok: true,
          alreadyRegistered: true,
          agentId: retryLookup.agentId,
          owner: retryLookup.owner,
          txHash: null,
          explorerUrl: stellar8004WebAgentUrl(retryLookup.agentId),
          lookupSource: retryLookup.source,
        };
      }
    }

    return { ok: false, error: message };
  }
}

export function formatRegisterIdentityResult(
  result: Extract<RegisterIdentityResult, { ok: true }>,
  network: Privy8004Wallet["network"],
): string {
  const config = get8004Config(network);
  const lines = [
    result.alreadyRegistered
      ? "8004 identity already registered for this wallet."
      : "8004 identity registered on-chain.",
    `Network: ${network}`,
    `Agent ID: ${result.agentId}`,
    `Owner: ${result.owner}`,
    `Identity contract: ${config.contracts.identity}`,
    `Reputation contract: ${config.contracts.reputation}`,
    "",
    `StellarExpert (${network}):`,
    `  Owner: ${stellarExpertAccountUrl(network, result.owner)}`,
    `  Identity contract: ${stellarExpertContractUrl(network, config.contracts.identity)}`,
  ];

  if (result.txHash) {
    lines.push(
      `  Registration tx: ${stellarExpertTxUrl(network, result.txHash)}`,
    );
  }

  if (result.explorerUnavailable) {
    lines.push(
      "",
      "Note: Stellar8004 explorer API is currently unavailable; identity was verified on-chain.",
    );
  }

  lines.push("", `Stellar8004: ${result.explorerUrl}`);
  return lines.join("\n");
}

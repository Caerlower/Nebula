"use client";

import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signMessage,
} from "@stellar/freighter-api";
import { Networks } from "@stellar/stellar-sdk";

import {
  envHubNetwork,
  networkFromHostname,
  type HubNetwork,
} from "@/lib/network";

export class WalletConnectError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_installed"
      | "access_denied"
      | "no_address"
      | "sign_rejected"
      | "challenge_failed"
      | "verify_failed"
      | "network_mismatch",
  ) {
    super(message);
    this.name = "WalletConnectError";
  }
}

/** Normalize Freighter's signMessage output (V4 base64 string | V3 Buffer) to base64. */
function toBase64Signature(sm: unknown): string {
  if (!sm) throw new WalletConnectError("No signature returned", "sign_rejected");
  if (typeof sm === "string") return sm;
  let bytes: Uint8Array;
  if (sm instanceof Uint8Array) {
    bytes = sm;
  } else if (sm instanceof ArrayBuffer) {
    bytes = new Uint8Array(sm);
  } else if (Array.isArray((sm as { data?: number[] }).data)) {
    bytes = new Uint8Array((sm as { data: number[] }).data);
  } else {
    bytes = new Uint8Array(Object.values(sm as Record<string, number>));
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Hub ledger for this page (Host subdomain, else deploy/env default). */
function expectedHubNetwork(): HubNetwork {
  if (typeof window !== "undefined") {
    const fromHost = networkFromHostname(window.location.hostname);
    if (fromHost) return fromHost;
  }
  return envHubNetwork();
}

function freighterToHub(
  network: string,
  passphrase?: string,
): HubNetwork | null {
  const n = network.trim().toUpperCase();
  if (n === "PUBLIC" || n === "PUBLIC_NETWORK" || n === "MAINNET") {
    return "mainnet";
  }
  if (n === "TESTNET" || n === "TEST") return "testnet";
  if (passphrase === Networks.PUBLIC) return "mainnet";
  if (passphrase === Networks.TESTNET) return "testnet";
  return null;
}

/**
 * Refuse Freighter sign-in when the extension is on the other Stellar ledger
 * than this Hub host (e.g. Freighter TESTNET on mainnet.nebulaonchain.xyz).
 */
async function assertFreighterMatchesHub(): Promise<HubNetwork> {
  const expected = expectedHubNetwork();
  const details = await getNetwork();
  if (details.error) {
    throw new WalletConnectError(
      details.error.message ?? "Couldn't read Freighter's network.",
      "network_mismatch",
    );
  }
  const walletNet = freighterToHub(details.network, details.networkPassphrase);
  if (!walletNet) {
    throw new WalletConnectError(
      `Freighter is on an unsupported network (${details.network}). Switch to ${expected === "mainnet" ? "Mainnet (PUBLIC)" : "Testnet"} and try again.`,
      "network_mismatch",
    );
  }
  if (walletNet !== expected) {
    throw new WalletConnectError(
      expected === "mainnet"
        ? "This Hub is mainnet — switch Freighter to Mainnet (PUBLIC), then try again."
        : "This Hub is testnet — switch Freighter to Testnet, then try again.",
      "network_mismatch",
    );
  }
  return expected;
}

/** Connect Freighter, retrieve the address (prompting for access if needed). */
export async function connectFreighter(): Promise<string> {
  const conn = await isConnected();
  if (conn.error || !conn.isConnected) {
    throw new WalletConnectError(
      "Freighter isn't installed. Get it at freighter.app.",
      "not_installed",
    );
  }

  const existing = await getAddress();
  if (!existing.error && existing.address) return existing.address;

  const access = await requestAccess();
  if (access.error || !access.address) {
    throw new WalletConnectError(
      access.error?.message ?? "Wallet access was denied.",
      "access_denied",
    );
  }
  return access.address;
}

/**
 * Full Sign-In-With-Stellar flow: connect Freighter, fetch a challenge, sign it
 * (SEP-53), and verify server-side. On success the Hub sets an httpOnly session
 * cookie and returns the account.
 */
export async function signInWithFreighter(): Promise<{
  userId: string;
  address: string;
}> {
  const hubNetwork = await assertFreighterMatchesHub();
  const address = await connectFreighter();
  const networkPassphrase =
    hubNetwork === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

  const challengeRes = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!challengeRes.ok) {
    throw new WalletConnectError("Couldn't start sign-in.", "challenge_failed");
  }
  const { message, challengeToken } = (await challengeRes.json()) as {
    message: string;
    challengeToken: string;
  };

  const signed = await signMessage(message, { address, networkPassphrase });
  if (signed.error) {
    throw new WalletConnectError(
      signed.error.message ?? "Message signing was rejected.",
      "sign_rejected",
    );
  }
  const signature = toBase64Signature(signed.signedMessage);

  const verifyRes = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, message, signature, challengeToken }),
  });
  if (!verifyRes.ok) {
    const body = (await verifyRes.json().catch(() => ({}))) as {
      reason?: string;
    };
    throw new WalletConnectError(
      body.reason ?? "Signature verification failed.",
      "verify_failed",
    );
  }

  const data = (await verifyRes.json()) as { userId: string; address: string };
  return { userId: data.userId, address: data.address };
}

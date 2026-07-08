import { Horizon, Keypair, StrKey } from "@stellar/stellar-sdk";

import { getNetworkConfig, type NetworkConfig } from "./config.js";

export type WalletLoadResult =
  | { ok: true; keypair: Keypair; network: NetworkConfig }
  | { ok: false; error: string };

export function loadWalletFromEnv(): WalletLoadResult {
  let network: NetworkConfig;

  try {
    network = getNetworkConfig();
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const secret = process.env.STELLAR_SECRET_KEY?.trim();

  if (!secret) {
    return {
      ok: false,
      error:
        "STELLAR_SECRET_KEY is not set. Add it to your MCP server environment configuration.",
    };
  }

  if (!StrKey.isValidEd25519SecretSeed(secret)) {
    return {
      ok: false,
      error:
        'STELLAR_SECRET_KEY is malformed. Expected a valid Stellar secret key (starts with "S").',
    };
  }

  try {
    const keypair = Keypair.fromSecret(secret);
    return { ok: true, keypair, network };
  } catch {
    return {
      ok: false,
      error:
        "STELLAR_SECRET_KEY is invalid. Could not derive a keypair from the provided secret.",
    };
  }
}

type AccountBalance = Horizon.HorizonApi.BalanceLine;

export function formatBalances(balances: AccountBalance[]): string {
  if (balances.length === 0) {
    return "No balances found.";
  }

  const lines = balances.map((balance) => {
    if (balance.asset_type === "native") {
      return `XLM: ${balance.balance}`;
    }

    if (
      balance.asset_type === "credit_alphanum4" ||
      balance.asset_type === "credit_alphanum12"
    ) {
      return `${balance.asset_code} (${balance.asset_issuer}): ${balance.balance}`;
    }

    if (balance.asset_type === "liquidity_pool_shares") {
      return `Liquidity pool ${balance.liquidity_pool_id}: ${balance.balance} shares`;
    }

    const unknown = balance as { asset_type: string; balance: string };
    return `${unknown.asset_type}: ${unknown.balance}`;
  });

  return lines.join("\n");
}

export function unfundedAccountMessage(
  publicKey: string,
  network: NetworkConfig,
): string {
  const lines = [
    `Account ${publicKey} is not funded on ${network.name} yet.`,
    "",
    "Fund it with Friendbot (testnet only):",
  ];

  if (network.friendbotUrl) {
    lines.push(
      `  curl "${network.friendbotUrl}?addr=${publicKey}"`,
      "",
      "Or open this URL in a browser:",
      `  ${network.friendbotUrl}?addr=${publicKey}`,
    );
  } else {
    lines.push("  Friendbot is only available on testnet.");
  }

  return lines.join("\n");
}

export function isAccountNotFound(error: unknown): boolean {
  if (error instanceof Error && error.constructor.name === "NotFoundError") {
    return true;
  }

  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { status?: number } }).response;
    return response?.status === 404;
  }

  return false;
}

export async function fetchAccountBalances(
  publicKey: string,
  network: NetworkConfig,
): Promise<
  | { ok: true; balances: AccountBalance[] }
  | { ok: false; notFound: true }
  | { ok: false; notFound: false; error: string }
> {
  const server = new Horizon.Server(network.horizonUrl);

  try {
    const account = await server.loadAccount(publicKey);
    return { ok: true, balances: account.balances };
  } catch (error) {
    if (isAccountNotFound(error)) {
      return { ok: false, notFound: true };
    }

    const message =
      error instanceof Error ? error.message : "Unknown Horizon error";
    return { ok: false, notFound: false, error: message };
  }
}

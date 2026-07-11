import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import type { NetworkConfig } from "./config.js";
import { checkAgentSpend, recordAgentSpend } from "./policy/spending.js";
import { fetchAccountBalances, isAccountNotFound } from "./wallet.js";

export type TransferAsset = "XLM" | "USDC";

export type PaymentRequest = {
  keypair: Keypair;
  network: NetworkConfig;
  destination: string;
  amount: string;
  asset: TransferAsset;
};

export type PaymentResult =
  | { ok: true; hash: string; amount: string; asset: TransferAsset; destination: string }
  | { ok: false; error: string };

function parseAmount(amount: string): { ok: true; numeric: number; formatted: string } | { ok: false; error: string } {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, error: `Invalid amount "${amount}". Use a positive number.` };
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }

  const parts = trimmed.split(".");
  if (parts[1] && parts[1].length > 7) {
    return { ok: false, error: "Amount supports at most 7 decimal places." };
  }

  return { ok: true, numeric, formatted: trimmed };
}

function validateDestination(destination: string): { ok: true } | { ok: false; error: string } {
  const trimmed = destination.trim();
  if (!StrKey.isValidEd25519PublicKey(trimmed)) {
    return {
      ok: false,
      error: `Invalid destination "${destination}". Expected a Stellar public address (G...).`,
    };
  }

  return { ok: true };
}

function formatHorizonSubmitError(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (
      error as {
        response?: {
          data?: {
            detail?: string;
            title?: string;
            extras?: { result_codes?: { operations?: string[]; transaction?: string } };
          };
        };
      }
    ).response;

    const resultCodes = response?.data?.extras?.result_codes;
    if (resultCodes?.operations?.length) {
      const code = resultCodes.operations[0];
      if (code === "op_no_destination") {
        return "Destination account does not exist or is not funded. Fund it via Friendbot before sending XLM.";
      }
      if (code === "op_no_trust") {
        return "Destination account does not trust this asset. The recipient must add a trustline first.";
      }
      if (code === "op_underfunded") {
        return "Insufficient balance to complete this transfer (including minimum balance reserve).";
      }
      return `Transaction failed: ${resultCodes.operations.join(", ")}`;
    }

    if (response?.data?.detail) {
      return response.data.detail;
    }

    if (response?.data?.title) {
      return response.data.title;
    }
  }

  return error instanceof Error ? error.message : "Unknown transaction error";
}

async function hasUsdcTrustline(
  publicKey: string,
  network: NetworkConfig,
): Promise<boolean> {
  const balances = await fetchAccountBalances(publicKey, network);
  if (!balances.ok) {
    return false;
  }

  return balances.balances.some(
    (balance) =>
      (balance.asset_type === "credit_alphanum4" ||
        balance.asset_type === "credit_alphanum12") &&
      balance.asset_code === "USDC" &&
      balance.asset_issuer === network.usdcIssuer,
  );
}

function usdcTrustlineError(network: NetworkConfig): string {
  return [
    `Your account does not have a USDC trustline on ${network.name}.`,
    "",
    "Add a trustline before sending USDC:",
    "  https://lab.stellar.org/account/fund?network=test",
    "",
    `USDC issuer (${network.name}): ${network.usdcIssuer}`,
    "",
    "For testnet USDC balance, use the Circle faucet:",
    "  https://faucet.circle.com/",
  ].join("\n");
}

/**
 * Single gateway for all outbound payments. Limits are enforced before signing.
 */
export async function submitPayment(
  request: PaymentRequest,
): Promise<PaymentResult> {
  const destinationCheck = validateDestination(request.destination);
  if (!destinationCheck.ok) {
    return { ok: false, error: destinationCheck.error };
  }

  const amountCheck = parseAmount(request.amount);
  if (!amountCheck.ok) {
    return { ok: false, error: amountCheck.error };
  }

  const limitCheck = await checkAgentSpend(
    request.keypair,
    request.network,
    amountCheck.numeric,
  );
  if (!limitCheck.ok) {
    return {
      ok: false,
      error: "reason" in limitCheck ? limitCheck.reason : limitCheck.error,
    };
  }

  const sourcePublicKey = request.keypair.publicKey();
  const destination = request.destination.trim();

  if (destination === sourcePublicKey) {
    return { ok: false, error: "Cannot transfer to the same account." };
  }

  if (request.asset === "USDC") {
    if (!request.network.usdcIssuer) {
      return { ok: false, error: "USDC is not configured for this network." };
    }

    const trustline = await hasUsdcTrustline(sourcePublicKey, request.network);
    if (!trustline) {
      return { ok: false, error: usdcTrustlineError(request.network) };
    }
  }

  const server = new Horizon.Server(request.network.horizonUrl);

  let account;
  try {
    account = await server.loadAccount(sourcePublicKey);
  } catch (error) {
    if (isAccountNotFound(error)) {
      return {
        ok: false,
        error: "Source account is not funded. Fund it via Friendbot before transferring.",
      };
    }

    return {
      ok: false,
      error: `Failed to load source account: ${formatHorizonSubmitError(error)}`,
    };
  }

  const paymentAsset =
    request.asset === "XLM"
      ? Asset.native()
      : new Asset("USDC", request.network.usdcIssuer!);

  let transaction;
  try {
    transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: request.network.networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: paymentAsset,
          amount: amountCheck.formatted,
        }),
      )
      .setTimeout(30)
      .build();
  } catch (error) {
    return {
      ok: false,
      error: `Failed to build transaction: ${formatHorizonSubmitError(error)}`,
    };
  }

  transaction.sign(request.keypair);

  try {
    const response = await server.submitTransaction(transaction);
    const recorded = await recordAgentSpend(
      request.keypair,
      request.network,
      amountCheck.numeric,
      request.asset,
    );
    if (!recorded.ok) {
      return {
        ok: false,
        error:
          `Transfer succeeded (hash ${response.hash}) but spending record failed: ${recorded.error}`,
      };
    }

    return {
      ok: true,
      hash: response.hash,
      amount: amountCheck.formatted,
      asset: request.asset,
      destination,
    };
  } catch (error) {
    return { ok: false, error: formatHorizonSubmitError(error) };
  }
}

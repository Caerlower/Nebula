import type { Keypair } from "@stellar/stellar-sdk";

import type { NetworkConfig } from "../config.js";
import type { Status } from "./bindings/src/index.js";
import { createPolicyClient, formatPolicyError } from "./client.js";
import { fromUsdcAmount, toUsdcAmount } from "../utils/amount.js";

export type PolicyStatus = {
  contractId: string;
  owner: string;
  maxPerCall: number;
  maxPerDay: number;
  dailySpent: number;
  dailyRemaining: number;
  periodLedgers: number;
  historyLen: number;
};

export type PolicyStatusResult =
  | { ok: true; status: PolicyStatus }
  | { ok: false; error: string };

function mapStatus(contractId: string, raw: Status): PolicyStatus {
  return {
    contractId,
    owner: raw.owner,
    maxPerCall: fromUsdcAmount(BigInt(raw.max_per_call)),
    maxPerDay: fromUsdcAmount(BigInt(raw.max_per_day)),
    dailySpent: fromUsdcAmount(BigInt(raw.daily_spent)),
    dailyRemaining: fromUsdcAmount(BigInt(raw.daily_remaining)),
    periodLedgers: Number(raw.period_ledgers),
    historyLen: Number(raw.history_len),
  };
}

export async function readPolicyStatus(
  keypair: Keypair,
  network: NetworkConfig,
  contractId?: string,
): Promise<PolicyStatusResult> {
  const clientResult = createPolicyClient(keypair, network, contractId);
  if (!clientResult.ok) {
    return clientResult;
  }

  try {
    const tx = await clientResult.client.get_status();
    await tx.simulate();
    if (!tx.result) {
      return { ok: false, error: "Policy get_status returned no result." };
    }

    return {
      ok: true,
      status: mapStatus(clientResult.contractId, tx.result),
    };
  } catch (error) {
    return { ok: false, error: formatPolicyError(error) };
  }
}

export async function setPolicyLimits(parameters: {
  keypair: Keypair;
  network: NetworkConfig;
  maxPerCall: number;
  maxPerDay: number;
  contractId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const clientResult = createPolicyClient(
    parameters.keypair,
    parameters.network,
    parameters.contractId,
  );
  if (!clientResult.ok) {
    return clientResult;
  }

  try {
    const tx = await clientResult.client.set_limits({
      max_per_call: toUsdcAmount(parameters.maxPerCall),
      max_per_day: toUsdcAmount(parameters.maxPerDay),
    });
    const sent = await tx.signAndSend();
    if (sent.sendTransactionResponse?.status === "ERROR") {
      return {
        ok: false,
        error:
          sent.sendTransactionResponse.errorResult?.toXDR("base64") ??
          "set_limits submission rejected.",
      };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: formatPolicyError(error) };
  }
}

export async function recordPolicySpend(parameters: {
  keypair: Keypair;
  network: NetworkConfig;
  amount: number;
  contractId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const clientResult = createPolicyClient(
    parameters.keypair,
    parameters.network,
    parameters.contractId,
  );
  if (!clientResult.ok) {
    return clientResult;
  }

  try {
    const tx = await clientResult.client.check_spend({
      amount: toUsdcAmount(parameters.amount),
    });
    const sent = await tx.signAndSend();
    if (sent.sendTransactionResponse?.status === "ERROR") {
      return {
        ok: false,
        error:
          sent.sendTransactionResponse.errorResult?.toXDR("base64") ??
          "check_spend submission rejected.",
      };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, error: formatPolicyError(error) };
  }
}

export function checkAmountAgainstPolicyStatus(
  amount: number,
  status: PolicyStatus,
): { ok: true } | { ok: false; reason: string } {
  if (amount <= 0) {
    return { ok: false, reason: "Spend amount must be greater than zero." };
  }

  if (amount > status.maxPerCall) {
    return {
      ok: false,
      reason:
        `Transfer blocked: ${amount} exceeds on-chain per-call limit (${status.maxPerCall}).`,
    };
  }

  if (status.dailySpent + amount > status.maxPerDay) {
    const remaining = Math.max(status.maxPerDay - status.dailySpent, 0);
    return {
      ok: false,
      reason:
        `Transfer blocked: ${amount} would exceed on-chain daily limit. ` +
        `Spent in rolling window: ${status.dailySpent}. Remaining: ${remaining}.`,
    };
  }

  return { ok: true };
}

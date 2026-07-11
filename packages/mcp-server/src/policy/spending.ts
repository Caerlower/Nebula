import type { Keypair } from "@stellar/stellar-sdk";

import type { NetworkConfig } from "../config.js";
import {
  loadSpendingLimitsConfig,
  spendingLimitEngine,
  type LimitCheckResult,
} from "../spending-limits.js";
import type { TransferAsset } from "../transfers.js";
import { isPolicyEnabled } from "./config.js";
import {
  checkAmountAgainstPolicyStatus,
  readPolicyStatus,
  recordPolicySpend,
  type PolicyStatus,
} from "./status.js";

export async function checkAgentSpend(
  keypair: Keypair,
  network: NetworkConfig,
  amount: number,
): Promise<LimitCheckResult | { ok: false; error: string }> {
  if (isPolicyEnabled()) {
    const statusResult = await readPolicyStatus(keypair, network);
    if (!statusResult.ok) {
      return statusResult;
    }

    return checkAmountAgainstPolicyStatus(amount, statusResult.status);
  }

  const limitsConfig = loadSpendingLimitsConfig();
  if (!limitsConfig.ok) {
    return limitsConfig;
  }

  return spendingLimitEngine.checkTransfer(amount, limitsConfig.config);
}

export async function recordAgentSpend(
  keypair: Keypair,
  network: NetworkConfig,
  amount: number,
  asset: TransferAsset,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (isPolicyEnabled()) {
    return recordPolicySpend({ keypair, network, amount });
  }

  spendingLimitEngine.recordTransfer(amount, asset);
  return { ok: true };
}

export type { PolicyStatus };

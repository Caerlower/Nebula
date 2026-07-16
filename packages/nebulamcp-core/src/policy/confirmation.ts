import type { ConfirmationDecision, PolicySnapshot } from "../types/context.js";

/**
 * Confirmation matrix (exact product rules).
 * All amounts are USDC (XLM transfers must be converted before calling).
 * - Denylist → always reject
 * - ≤ micro_threshold → auto (unless denylist)
 * - Whitelisted + ≤ per_tx_cap → auto
 * - New address + ≤ per_tx_cap but > micro → confirm
 * - > per_tx_cap or > daily_cap → reject
 * Whitelist never bypasses above per_tx_cap.
 *
 * Set `ignoreSpendCaps` for flows that lock funds without counting as spend
 * (e.g. MPP channel open budget) — only paused / denylist / novel destination apply.
 */
export function evaluateConfirmation(params: {
  destination: string;
  /** Spend amount in USDC. */
  amountUsdc: number;
  policy: PolicySnapshot;
  ignoreSpendCaps?: boolean;
}): ConfirmationDecision {
  const dest = params.destination.trim();
  const amount = params.amountUsdc;
  const { policy } = params;

  if (policy.paused) {
    return { action: "reject", reason: "policy_paused" };
  }

  if (policy.denylist.includes(dest)) {
    return { action: "reject", reason: "destination_denylisted" };
  }

  const whitelisted = policy.whitelist.includes(dest);

  if (!params.ignoreSpendCaps) {
    const overDaily = policy.dailySpentUsdc + amount > policy.dailyCap;
    const overPerTx = amount > policy.perTxCap;

    if (overDaily) {
      return { action: "reject", reason: "exceeds_daily_cap" };
    }
    if (overPerTx) {
      return { action: "reject", reason: "exceeds_per_tx_cap" };
    }
  }

  const withinMicro = amount <= policy.microThreshold;
  if (withinMicro) {
    return { action: "auto", reason: "within_micro_threshold" };
  }
  if (whitelisted) {
    return { action: "auto", reason: "whitelisted_within_per_tx_cap" };
  }
  return { action: "confirm", reason: "new_destination_requires_confirmation" };
}

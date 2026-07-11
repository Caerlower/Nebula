/** Optional per-rebalance cap. Unset or 0 = move full excess/deficit in one tx. */
export function getTreasuryMaxPerRebalance(): number | null {
  const raw = process.env.TREASURY_MAX_PER_REBALANCE?.trim();
  if (!raw || raw === "0") {
    return null;
  }

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(
      `[treasury] Invalid TREASURY_MAX_PER_REBALANCE "${raw}". No cap applied.`,
    );
    return null;
  }

  return value;
}

export function capTreasuryMoveAmount(amount: number): number {
  const max = getTreasuryMaxPerRebalance();
  if (max === null) {
    return amount;
  }
  return Math.min(amount, max);
}

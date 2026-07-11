export const USDC_DECIMALS = 7;
export const USDC_SCALE = 10_000_000n;

export function parsePositiveAmount(
  amount: string | number,
): { ok: true; numeric: number; formatted: string } | { ok: false; error: string } {
  const raw = typeof amount === "number" ? String(amount) : amount.trim();

  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return {
      ok: false,
      error: `Invalid amount "${amount}". Use a positive number.`,
    };
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }

  const parts = raw.split(".");
  if (parts[1] && parts[1].length > USDC_DECIMALS) {
    return {
      ok: false,
      error: `Amount supports at most ${USDC_DECIMALS} decimal places.`,
    };
  }

  return { ok: true, numeric, formatted: raw };
}

export function toUsdcAmount(amount: number): bigint {
  return BigInt(Math.round(amount * Number(USDC_SCALE)));
}

export function fromUsdcAmount(amount: bigint): number {
  return Number(amount) / Number(USDC_SCALE);
}

export function parseThresholdValue(
  amount: string,
): { ok: true; numeric: number; formatted: string } | { ok: false; error: string } {
  const raw = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) {
    return {
      ok: false,
      error: `Invalid threshold "${amount}". Use a non-negative number.`,
    };
  }

  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return {
      ok: false,
      error: "Threshold must be zero or greater.",
    };
  }

  const parts = raw.split(".");
  if (parts[1] && parts[1].length > USDC_DECIMALS) {
    return {
      ok: false,
      error: `Threshold supports at most ${USDC_DECIMALS} decimal places.`,
    };
  }

  return { ok: true, numeric, formatted: raw };
}

export function formatUsdc(amount: number): string {
  return formatAmount(amount);
}

/** Format a 7-decimal Blend/Stellar asset amount for display. */
export function formatAmount(amount: number): string {
  return amount.toFixed(USDC_DECIMALS).replace(/\.?0+$/, "");
}

/** Convert a human amount to Blend's 7-decimal fixed point. */
export function toBlendAmount(amount: number): bigint {
  return toUsdcAmount(amount);
}

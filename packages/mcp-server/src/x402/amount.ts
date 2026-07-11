import type { PaymentRequirements } from "@x402/core/types";
import { DEFAULT_TOKEN_DECIMALS } from "@x402/stellar";

const AMOUNT_SCALE = 10 ** DEFAULT_TOKEN_DECIMALS;

function requirementsAmountRaw(requirements: PaymentRequirements): string {
  if (requirements.scheme && "amount" in requirements && requirements.amount) {
    return requirements.amount;
  }

  const legacy = requirements as PaymentRequirements & {
    maxAmountRequired?: string;
  };
  if (legacy.maxAmountRequired) {
    return legacy.maxAmountRequired;
  }

  throw new Error("Payment requirements are missing an amount field.");
}

export function paymentRequirementsToUsdc(
  requirements: PaymentRequirements,
): number {
  const units = BigInt(requirementsAmountRaw(requirements));
  return Number(units) / AMOUNT_SCALE;
}

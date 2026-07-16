import { z } from "zod";

import { isValidStellarAddress } from "../stellar/address.js";
import type { ToolContext, ToolResult } from "../types/context.js";

export const transferReasonSchema = z.enum([
  "user_requested",
  "x402_payment",
  "blend_operation",
  "other",
]);

export const transferSchema = z.object({
  destination: z
    .string()
    .refine(isValidStellarAddress, { message: "Invalid Stellar address (G...)" }),
  amount_xlm: z.number().positive().finite(),
  memo: z.string().max(28).optional(),
  reason: transferReasonSchema.default("user_requested"),
});

export type TransferInput = z.infer<typeof transferSchema>;

export const transferTool = {
  name: "transfer" as const,
  description:
    "Transfer XLM to a Stellar address. Amount counts toward USDC policy caps via live XLM/USD. High-risk when destination is new or amount exceeds caps.",
  schema: transferSchema,
  async handler(
    _input: TransferInput,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    // Hub implements: policy → confirmation → Privy sign → broadcast.
    // Core exposes the contract; default handler is intentionally unimplemented.
    return {
      status: "error",
      reason:
        "transfer handler must be bound by the Hub (signing via Privy). Use Hub /api/tools/transfer.",
    };
  },
};

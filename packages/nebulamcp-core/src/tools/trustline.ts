import { z } from "zod";

import type { ToolContext, ToolResult } from "../types/context.js";

async function hubOnly(name: string): Promise<ToolResult> {
  return {
    status: "error",
    reason: `${name} must be executed by the Hub (Privy-signed; no agent secret keys).`,
  };
}

export const trustlineStatusSchema = z.object({});

export const trustlineOnboardSchema = z.object({
  skip_proof: z
    .boolean()
    .optional()
    .describe(
      "If true, skip zkTLS off-chain proof (~20–90s) and score on-chain revenue only. Default false.",
    ),
  from_ledger: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional ledger to start revenue indexing from."),
});

export const trustlineBorrowSchema = z.object({
  amount_usdc: z.number().positive().finite(),
  reason: z.string().min(1).max(500),
});

export const trustlineRepaySchema = z.object({
  amount_usdc: z.number().positive().finite(),
  reason: z.string().min(1).max(500),
});

export const trustlineStatusTool = {
  name: "trustline_status" as const,
  description:
    "Read TrustLine credit terms, available credit, vault state, and wallet USDC (testnet). Tier 0 / limit 0 means Unrated or insufficient independent revenue — the agent may already be registered. Use trustline_onboard to register (idempotent) and/or re-underwrite. Docs: https://docs.0xtrustline.online",
  schema: trustlineStatusSchema,
  handler: async (
    _i: z.infer<typeof trustlineStatusSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("trustline_status"),
};

export const trustlineOnboardTool = {
  name: "trustline_onboard" as const,
  description:
    "Register this agent on TrustLine score_registry (idempotent if already registered) and run underwriting (testnet). Safe to call again to refresh the score. Privy signs register; underwrite is TrustLine's backend. A $0 limit after success is normal until independent x402 revenue scores high enough — not a failure.",
  schema: trustlineOnboardSchema,
  handler: async (
    _i: z.infer<typeof trustlineOnboardSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("trustline_onboard"),
};

export const trustlineBorrowTool = {
  name: "trustline_borrow" as const,
  description:
    "Draw USDC from this agent's TrustLine credit line into the wallet (testnet). Check trustline_status first.",
  schema: trustlineBorrowSchema,
  handler: async (
    _i: z.infer<typeof trustlineBorrowSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("trustline_borrow"),
};

export const trustlineRepayTool = {
  name: "trustline_repay" as const,
  description:
    "Repay USDC on TrustLine (interest first, then principal). On-time repayments ramp the credit limit (testnet).",
  schema: trustlineRepaySchema,
  handler: async (
    _i: z.infer<typeof trustlineRepaySchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("trustline_repay"),
};

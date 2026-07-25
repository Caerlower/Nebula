import { z } from "zod";

import type { ToolContext, ToolResult } from "../types/context.js";

export const blendCheckRatesSchema = z.object({});

const blendMoveBase = z.object({
  /** Preferred amount field (XLM or USDC depending on `asset`). */
  amount: z.number().positive().finite().optional(),
  /** @deprecated use `amount` + `asset` — kept for older MCP clients. */
  amount_xlm: z.number().positive().finite().optional(),
  /** Mainnet supports XLM + USDC; testnet is XLM-only. Default XLM. */
  asset: z.enum(["XLM", "USDC"]).optional(),
  pool_id: z.string().min(1).optional(),
});

function refineBlendMove(
  value: z.infer<typeof blendMoveBase>,
  ctx: z.RefinementCtx,
) {
  if (value.amount == null && value.amount_xlm == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "amount (or amount_xlm) is required",
      path: ["amount"],
    });
  }
}

export const blendDepositSchema = blendMoveBase.superRefine(refineBlendMove);
export const blendWithdrawSchema = blendMoveBase.superRefine(refineBlendMove);

export const getTreasuryStatusSchema = z.object({});
export const setLiquidityThresholdSchema = z.object({
  threshold: z.number().nonnegative().finite(),
});
export const optimizeTreasurySchema = z.object({});

async function hubOnly(name: string): Promise<ToolResult> {
  return {
    status: "error",
    reason: `${name} must be executed by the Hub treasury stack.`,
  };
}

export const blendCheckRatesTool = {
  name: "blend_check_rates" as const,
  description:
    "Read-only Blend supply APY for configured pools (testnet: TestnetV2; mainnet: Fixed + YieldBlox).",
  schema: blendCheckRatesSchema,
  handler: async (
    _i: z.infer<typeof blendCheckRatesSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("blend_check_rates"),
};

export const blendDepositTool = {
  name: "blend_deposit" as const,
  description:
    "Deposit into a Blend pool as collateral. Testnet: XLM only. Mainnet: XLM or USDC into Fixed (default) or YieldBlox (pool_id).",
  schema: blendDepositSchema,
  handler: async (
    _i: z.infer<typeof blendDepositSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("blend_deposit"),
};

export const blendWithdrawTool = {
  name: "blend_withdraw" as const,
  description:
    "Withdraw collateral from a Blend pool. Testnet: XLM only. Mainnet: XLM or USDC.",
  schema: blendWithdrawSchema,
  handler: async (
    _i: z.infer<typeof blendWithdrawSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("blend_withdraw"),
};

export const getTreasuryStatusTool = {
  name: "get_treasury_status" as const,
  description: "Liquid vs Blend balances, APY, threshold, last rebalance.",
  schema: getTreasuryStatusSchema,
  handler: async (
    _i: z.infer<typeof getTreasuryStatusSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("get_treasury_status"),
};

export const setLiquidityThresholdTool = {
  name: "set_liquidity_threshold" as const,
  description:
    "Set liquid_low (min liquid value in USDC). Hub converts to XLM for Blend. Dashboard / human only — not available to MCP agent tokens.",
  schema: setLiquidityThresholdSchema,
  handler: async (
    _i: z.infer<typeof setLiquidityThresholdSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("set_liquidity_threshold"),
};

export const optimizeTreasuryTool = {
  name: "optimize_treasury" as const,
  description: "Trigger one treasury rebalance immediately.",
  schema: optimizeTreasurySchema,
  handler: async (
    _i: z.infer<typeof optimizeTreasurySchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("optimize_treasury"),
};

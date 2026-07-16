import { z } from "zod";

import type { ToolContext, ToolResult } from "../types/context.js";

export const swapAssetSchema = z.enum(["XLM", "USDC"]);

export const getSwapQuoteSchema = z.object({
  from_asset: swapAssetSchema,
  to_asset: swapAssetSchema,
  /** Exact amount of from_asset to sell (path payment strict-send). */
  amount: z.number().positive().finite(),
});

export const swapSchema = z.object({
  from_asset: swapAssetSchema,
  to_asset: swapAssetSchema,
  /** Exact amount of from_asset to sell (path payment strict-send). */
  amount: z.number().positive().finite(),
  /**
   * Max slippage vs quoted receive, in basis points (100 = 1%).
   * Default 100 (1%).
   */
  max_slippage_bps: z.number().int().min(1).max(5_000).optional(),
  reason: z
    .enum(["user_requested", "fund_usdc", "rebalance", "other"])
    .default("user_requested"),
});

export type GetSwapQuoteInput = z.infer<typeof getSwapQuoteSchema>;
export type SwapInput = z.infer<typeof swapSchema>;

export const getSwapQuoteTool = {
  name: "get_swap_quote" as const,
  description:
    "Quote a Stellar DEX swap between XLM and Circle USDC (strict-send). No signing. Use before swap when you want the expected receive amount.",
  schema: getSwapQuoteSchema,
  async handler(
    _input: GetSwapQuoteInput,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    return {
      status: "error",
      reason:
        "get_swap_quote must be bound by the Hub. Use Hub /api/tools/get_swap_quote.",
    };
  },
};

export const swapTool = {
  name: "swap" as const,
  description:
    "Swap XLM ↔ Circle USDC on the Stellar DEX (path payment strict-send, Privy-signed). Does not count as outbound spend toward daily caps. Large notional may require human confirmation. Receiving USDC auto-opens a trustline if needed.",
  schema: swapSchema,
  async handler(_input: SwapInput, _ctx: ToolContext): Promise<ToolResult> {
    return {
      status: "error",
      reason: "swap must be bound by the Hub. Use Hub /api/tools/swap.",
    };
  },
};

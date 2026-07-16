import { z } from "zod";

import type { ToolContext, ToolResult } from "../types/context.js";

export const x402FetchSchema = z
  .object({
    url: z.string().url(),
    /** Optional USDC cap for this call. If omitted, Hub uses min(per_tx_cap, cat_x402). */
    max_amount_usdc: z.number().positive().finite().optional(),
    /** @deprecated use max_amount_usdc */
    max_amount_xlm: z.number().positive().finite().optional(),
  })
  .transform((v) => ({
    url: v.url,
    max_amount_usdc: v.max_amount_usdc ?? v.max_amount_xlm,
  }));

export type X402FetchInput = {
  url: string;
  max_amount_usdc?: number;
};

export const x402FetchTool = {
  name: "x402_fetch" as const,
  description:
    "GET a URL. On HTTP 402, pay Stellar USDC via x402 and retry. Optional max_amount_usdc; if omitted, Hub policy caps apply automatically.",
  schema: x402FetchSchema,
  async handler(
    _input: X402FetchInput,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    return {
      status: "error",
      reason: "x402_fetch must be executed by the Hub payment stack.",
    };
  },
};

export const x402PaySchema = z
  .object({
    url: z.string().url(),
    /** Expected USDC amount. */
    amount_usdc: z.number().positive().finite().optional(),
    /** @deprecated use amount_usdc */
    amount_xlm: z.number().positive().finite().optional(),
    facilitator: z.string().min(1).optional(),
  })
  .refine((v) => v.amount_usdc != null || v.amount_xlm != null, {
    message: "amount_usdc is required",
    path: ["amount_usdc"],
  })
  .transform((v) => ({
    url: v.url,
    amount_usdc: (v.amount_usdc ?? v.amount_xlm) as number,
    facilitator: v.facilitator,
  }));

export type X402PayInput = {
  url: string;
  amount_usdc: number;
  facilitator?: string;
};

export const x402PayTool = {
  name: "x402_pay" as const,
  description:
    "Pay an x402-gated resource for a known USDC amount (amount_usdc). Destination comes from the 402 challenge.",
  schema: x402PaySchema,
  async handler(
    _input: X402PayInput,
    _ctx: ToolContext,
  ): Promise<ToolResult> {
    return {
      status: "error",
      reason: "x402_pay must be executed by the Hub payment stack.",
    };
  },
};

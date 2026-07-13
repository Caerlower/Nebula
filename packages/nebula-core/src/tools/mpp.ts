import { z } from "zod";

import { isValidStellarAddress } from "../stellar/address.js";
import type { ToolContext, ToolResult } from "../types/context.js";

export const mppOpenSchema = z.object({
  budget_usdc: z.number().positive().finite(),
  recipient: z
    .string()
    .refine(isValidStellarAddress, { message: "Invalid recipient (G...)" })
    .optional(),
});

export const mppPaySchema = z.object({
  recipient: z
    .string()
    .refine(isValidStellarAddress, { message: "Invalid recipient (G...)" }),
  amount_xlm: z.number().positive().finite(),
  streaming: z.boolean().optional().default(false),
});

export const mppFetchSchema = z.object({
  url: z.string().url(),
});

export const mppStatusSchema = z.object({});
export const mppCloseSchema = z.object({});

async function hubOnly(
  name: string,
): Promise<ToolResult> {
  return {
    status: "error",
    reason: `${name} must be executed by the Hub MPP stack.`,
  };
}

export const mppOpenSessionTool = {
  name: "mpp_open_session" as const,
  description:
    "Open an MPP payment channel with a USDC budget. Returns channel + Hub demo_url for mpp_fetch (no local merchant server needed for demos).",
  schema: mppOpenSchema,
  handler: async (
    _i: z.infer<typeof mppOpenSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("mpp_open_session"),
};

export const mppPayTool = {
  name: "mpp_pay" as const,
  description:
    "Deprecated: does not advance session spend. Use mpp_fetch for attested channel payments.",
  schema: mppPaySchema,
  handler: async (
    _i: z.infer<typeof mppPaySchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("mpp_pay"),
};

export const mppFetchTool = {
  name: "mpp_fetch" as const,
  description: "Fetch an MPP-gated URL using the active session (off-chain commit).",
  schema: mppFetchSchema,
  handler: async (
    _i: z.infer<typeof mppFetchSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("mpp_fetch"),
};

export const mppStatusTool = {
  name: "mpp_status" as const,
  description: "Show active MPP session status.",
  schema: mppStatusSchema,
  handler: async (
    _i: z.infer<typeof mppStatusSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("mpp_status"),
};

export const mppCloseSessionTool = {
  name: "mpp_close_session" as const,
  description: "Settle the active MPP session on-chain and refund unused deposit.",
  schema: mppCloseSchema,
  handler: async (
    _i: z.infer<typeof mppCloseSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("mpp_close_session"),
};

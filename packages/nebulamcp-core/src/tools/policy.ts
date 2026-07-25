import { z } from "zod";

import type { ToolContext, ToolResult } from "../types/context.js";

/** MCP tokens must NOT call policy mutations — Hub enforces dashboard-only auth. */
export const getPolicyStatusSchema = z.object({}).passthrough();
export const spendingReportSchema = z.object({}).passthrough();

async function hubOnly(name: string): Promise<ToolResult> {
  return {
    status: "error",
    reason: `${name} must be executed by the Hub policy stack.`,
  };
}

export const getPolicyStatusTool = {
  name: "get_policy_status" as const,
  description:
    "Read spending policy (USDC caps): micro/per-tx/daily, per-category, treasury liquid band (USDC), pause, lists.",
  schema: getPolicyStatusSchema,
  handler: async (
    _i: z.infer<typeof getPolicyStatusSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("get_policy_status"),
};

export const spendingReportTool = {
  name: "spending_report" as const,
  description:
    "List confirmed wallet activity in the last 24 hours (transfers, x402, mpp, treasury, etc.) with amounts and totals — not policy caps (use get_policy_status for caps).",
  schema: spendingReportSchema,
  handler: async (
    _i: z.infer<typeof spendingReportSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("spending_report"),
};

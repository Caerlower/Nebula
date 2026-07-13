import { z } from "zod";

import { isValidStellarAddress } from "../stellar/address.js";
import type { ToolContext, ToolResult } from "../types/context.js";

/** MCP tokens must NOT call policy mutations — Hub enforces dashboard-only auth. */
export const getPolicyStatusSchema = z.object({}).passthrough();
export const setPolicyLimitsSchema = z.object({
  max_per_call: z.number().positive().finite(),
  max_per_day: z.number().positive().finite(),
});
export const deployPolicySchema = z.object({
  max_per_call: z.number().positive().finite().optional(),
  max_per_day: z.number().positive().finite().optional(),
});
export const spendingReportSchema = z.object({}).passthrough();

export const whitelistAddSchema = z.object({
  address: z
    .string()
    .refine(isValidStellarAddress, { message: "Invalid Stellar address" }),
  label: z.string().min(1).max(64),
});

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

export const setPolicyLimitsTool = {
  name: "set_policy_limits" as const,
  description:
    "Update on-chain policy caps (dashboard Auth0 only — not available to Nebula MCP tokens).",
  schema: setPolicyLimitsSchema,
  handler: async (
    _i: z.infer<typeof setPolicyLimitsSchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("set_policy_limits"),
};

export const deployPolicyTool = {
  name: "deploy_policy" as const,
  description: "Deploy nebula-policy Soroban contract (dashboard Auth0 only).",
  schema: deployPolicySchema,
  handler: async (
    _i: z.infer<typeof deployPolicySchema>,
    _c: ToolContext,
  ): Promise<ToolResult> => hubOnly("deploy_policy"),
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

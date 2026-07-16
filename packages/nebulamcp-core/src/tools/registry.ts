import type { z } from "zod";

import type { ToolContext, ToolResult } from "../types/context.js";
import { zodToJsonSchema } from "./zod-json-schema.js";

import { transferTool } from "./transfer.js";
import {
  checkBalanceTool,
  getAddressTool,
  pingTool,
  requestFundingTool,
} from "./wallet.js";
import { x402FetchTool, x402PayTool } from "./x402.js";
import {
  mppCloseSessionTool,
  mppFetchTool,
  mppOpenSessionTool,
  mppPayTool,
  mppStatusTool,
} from "./mpp.js";
import {
  blendCheckRatesTool,
  blendDepositTool,
  blendWithdrawTool,
  getTreasuryStatusTool,
  optimizeTreasuryTool,
  setLiquidityThresholdTool,
} from "./blend.js";
import {
  deployPolicyTool,
  getPolicyStatusTool,
  setPolicyLimitsTool,
  spendingReportTool,
} from "./policy.js";
import {
  awaitConfirmationTool,
  getMyReputationTool,
  registerIdentityTool,
} from "./hub-stubs.js";
import { helpTool } from "./help.js";
import { getSwapQuoteTool, swapTool } from "./swap.js";

export interface NebulaToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: TSchema;
  jsonSchema: Record<string, unknown>;
  handler: (
    input: z.infer<TSchema>,
    ctx: ToolContext,
  ) => Promise<ToolResult>;
  /** Hidden from MCP agent tokens; dashboard APIs only. */
  dashboardOnly?: boolean;
  /** Present in registry but not listed to MCP clients. */
  mcpHidden?: boolean;
}

function wrap<T extends z.ZodType>(
  tool: {
    name: string;
    description: string;
    schema: T;
    handler: (input: z.infer<T>, ctx: ToolContext) => Promise<ToolResult>;
  },
  opts?: { dashboardOnly?: boolean; mcpHidden?: boolean },
): NebulaToolDefinition<T> {
  return {
    name: tool.name,
    description: tool.description,
    schema: tool.schema,
    jsonSchema: zodToJsonSchema(tool.schema),
    handler: tool.handler,
    dashboardOnly: opts?.dashboardOnly,
    mcpHidden: opts?.mcpHidden,
  };
}

export const tools = {
  ping: wrap(pingTool),
  help: wrap(helpTool),
  get_address: wrap(getAddressTool),
  check_balance: wrap(checkBalanceTool),
  request_funding: wrap(requestFundingTool),
  transfer: wrap(transferTool),
  get_swap_quote: wrap(getSwapQuoteTool),
  swap: wrap(swapTool),
  x402_fetch: wrap(x402FetchTool),
  x402_pay: wrap(x402PayTool),
  mpp_open_session: wrap(mppOpenSessionTool),
  mpp_pay: wrap(mppPayTool, { mcpHidden: true }),
  mpp_fetch: wrap(mppFetchTool),
  mpp_status: wrap(mppStatusTool),
  mpp_close_session: wrap(mppCloseSessionTool),
  blend_check_rates: wrap(blendCheckRatesTool),
  blend_deposit: wrap(blendDepositTool, { dashboardOnly: true }),
  blend_withdraw: wrap(blendWithdrawTool, { dashboardOnly: true }),
  get_treasury_status: wrap(getTreasuryStatusTool),
  set_liquidity_threshold: wrap(setLiquidityThresholdTool, {
    dashboardOnly: true,
    mcpHidden: true,
  }),
  optimize_treasury: wrap(optimizeTreasuryTool),
  spending_report: wrap(spendingReportTool),
  get_policy_status: wrap(getPolicyStatusTool),
  set_policy_limits: wrap(setPolicyLimitsTool, {
    dashboardOnly: true,
    mcpHidden: true,
  }),
  deploy_policy: wrap(deployPolicyTool, {
    dashboardOnly: true,
    mcpHidden: true,
  }),
  register_identity: wrap(registerIdentityTool),
  get_my_reputation: wrap(getMyReputationTool),
  await_confirmation: wrap(awaitConfirmationTool),
} as const;

export type ToolName = keyof typeof tools;

export function listToolsForMcp(): Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}> {
  return Object.values(tools)
    .filter((t) => !t.dashboardOnly && !t.mcpHidden)
    .map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.jsonSchema,
    }));
}

export function getTool(name: string): NebulaToolDefinition | undefined {
  if (name in tools) {
    return tools[name as ToolName] as unknown as NebulaToolDefinition;
  }
  return undefined;
}

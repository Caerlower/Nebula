import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  formatRebalanceSummary,
  rebalance,
} from "../treasury/rebalance.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerOptimizeTreasuryTool(server: McpServer): void {
  server.registerTool(
    "optimize_treasury",
    {
      description:
        "Manually trigger one treasury rebalance now (deposit excess or withdraw to threshold).",
    },
    async () => {
      try {
        const summary = await rebalance();
        return textToolResult(formatRebalanceSummary(summary));
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "Treasury rebalance failed.",
        );
      }
    },
  );
}

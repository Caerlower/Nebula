import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { parseThresholdValue } from "../utils/amount.js";
import { field, formatNetworkHeader } from "../lib/format-output.js";
import { getTreasuryAssetConfig } from "../treasury/asset.js";
import { treasuryState } from "../treasury/state.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerSetLiquidityThresholdTool(server: McpServer): void {
  server.registerTool(
    "set_liquidity_threshold",
    {
      description:
        "Update the liquid balance threshold used by the automatic treasury rebalancer.",
      inputSchema: {
        threshold: z
          .string()
          .describe("Minimum liquid balance to keep on hand (e.g. 10 XLM)"),
      },
    },
    async ({ threshold }) => {
      const parsed = parseThresholdValue(threshold);
      if (!parsed.ok) {
        return errorToolResult(parsed.error);
      }

      treasuryState.setLiquidityThreshold(parsed.numeric);

      let symbol = "XLM";
      try {
        symbol = getTreasuryAssetConfig().symbol;
      } catch {
        // Fall back to generic label if asset config is unavailable.
      }

      return textToolResult(
        [
          ...formatNetworkHeader("testnet", "Liquidity threshold updated"),
          field("New threshold", `${parsed.formatted} ${symbol}`),
          field("Effect", "Background rebalancer uses this on its next run"),
        ].join("\n"),
      );
    },
  );
}

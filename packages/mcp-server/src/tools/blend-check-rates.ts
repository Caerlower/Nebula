import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  fetchBlendSupplyRates,
  formatBlendRatesResponse,
} from "../blend/rates.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerBlendCheckRatesTool(server: McpServer): void {
  server.registerTool(
    "blend_check_rates",
    {
      description:
        "Return current Blend lending pool supply APY rates on testnet (read-only).",
    },
    async () => {
      try {
        const result = await fetchBlendSupplyRates();

        if (!result.ok) {
          return errorToolResult(result.error);
        }

        return textToolResult(formatBlendRatesResponse(result));
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "Failed to fetch Blend pool rates.",
        );
      }
    },
  );
}

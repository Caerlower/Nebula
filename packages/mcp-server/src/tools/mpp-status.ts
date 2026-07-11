import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import {
  formatMppSessionStatus,
  requireActiveMppSession,
} from "../mpp/session.js";
import { loadWalletFromEnv } from "../wallet.js";
import { formatNetworkHeader } from "../lib/format-output.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerMppStatusTool(server: McpServer): void {
  server.registerTool(
    "mpp_status",
    {
      description:
        "Show the active MPP session: channel address, budget, committed spend, and remaining session budget.",
      inputSchema: {},
    },
    async () => {
      try {
        const sessionState = requireActiveMppSession();
        if (!sessionState.ok) {
          return errorToolResult(sessionState.error);
        }

        const wallet = loadWalletFromEnv();
        const network = wallet.ok ? wallet.network.name : "testnet";

        return textToolResult(
          [
            ...formatNetworkHeader(network, "MPP session"),
            formatMppSessionStatus(sessionState.session, network),
          ].join("\n"),
        );
      } catch (error) {
        return errorToolResult(
          error instanceof Error ? error.message : "mpp_status failed unexpectedly.",
        );
      }
    },
  );
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { formatMyReputationResult } from "../8004/format.js";
import { getMyReputation } from "../8004/reputation.js";
import { loadWalletFromEnv } from "../wallet.js";
import { errorToolResult, textToolResult } from "./helpers.js";

export function registerGetMyReputationTool(server: McpServer): void {
  server.registerTool(
    "get_my_reputation",
    {
      description:
        "Read this Nebula agent's own ERC-8004 reputation summary (feedback count, average score, unique clients) for the configured network.",
      inputSchema: {},
    },
    async () => {
      try {
        const wallet = loadWalletFromEnv();
        if (!wallet.ok) {
          return errorToolResult(wallet.error);
        }

        const result = await getMyReputation(wallet.keypair, wallet.network);

        if (!result.ok) {
          return errorToolResult(result.error);
        }

        return textToolResult(
          formatMyReputationResult(result, wallet.network),
        );
      } catch (error) {
        return errorToolResult(
          error instanceof Error
            ? error.message
            : "get_my_reputation failed unexpectedly.",
        );
      }
    },
  );
}
